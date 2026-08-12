import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getYaraConfig, isFailClosedOnScanError, isYaraScanEnabled } from "./upload-config.js";
import { UploadSecurityError } from "./upload-errors.js";

const execFileAsync = promisify(execFile);

export type MalwareScanVerdict = "CLEAN" | "MALICIOUS" | "SCAN_ERROR" | "TIMEOUT";

export interface MalwareScanResult {
  verdict: MalwareScanVerdict;
  engine: "yara";
  detail?: string;
  ruleMatches?: string[];
}

/** Interpret YARA CLI exit code: 0 = no match, 1 = match, other = error. */
export function interpretYaraExitCode(exitCode: number, stderr: string): MalwareScanVerdict {
  if (exitCode === 0) return "CLEAN";
  if (exitCode === 1) return "MALICIOUS";
  if (/timeout/i.test(stderr)) return "TIMEOUT";
  return "SCAN_ERROR";
}

export function parseYaraStdout(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}

async function yaraBinaryAvailable(): Promise<boolean> {
  try {
    await execFileAsync("yara", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

function collectRuleFiles(rulesDir: string): string[] {
  if (!fs.existsSync(rulesDir)) return [];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(yar|yara)$/i.test(entry.name)) files.push(full);
    }
  };
  walk(rulesDir);
  return files;
}

/**
 * Scan a file with YARA (open-source, local, no API key).
 * Uses bundled/community rules from YARA_RULES_PATH.
 */
export async function scanFileWithYara(filePath: string): Promise<MalwareScanResult> {
  const config = getYaraConfig();
  const ruleFiles = collectRuleFiles(config.rulesPath);

  if (ruleFiles.length === 0) {
    return { verdict: "SCAN_ERROR", engine: "yara", detail: "no YARA rules found" };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "yara",
      ["-w", ...ruleFiles, filePath],
      { timeout: config.timeoutMs, maxBuffer: 2 * 1024 * 1024 }
    );
    const ruleMatches = parseYaraStdout(stdout);
    if (ruleMatches.length > 0) {
      return { verdict: "MALICIOUS", engine: "yara", ruleMatches, detail: "rule match" };
    }
    return { verdict: "CLEAN", engine: "yara" };
  } catch (err: unknown) {
    const execErr = err as { code?: number; stdout?: string; stderr?: string; killed?: boolean };
    if (execErr.killed) {
      return { verdict: "TIMEOUT", engine: "yara", detail: "yara timeout" };
    }
    const exitCode = typeof execErr.code === "number" ? execErr.code : -1;
    const verdict = interpretYaraExitCode(exitCode, execErr.stderr || "");
    const ruleMatches = parseYaraStdout(execErr.stdout || "");
    if (verdict === "MALICIOUS") {
      return { verdict, engine: "yara", ruleMatches, detail: "rule match" };
    }
    return {
      verdict,
      engine: "yara",
      detail: execErr.stderr?.trim() || "yara scan failed",
    };
  }
}

/** Fail-closed malware gate using YARA only. */
export async function assertUploadPassesMalwareScan(filePath: string): Promise<MalwareScanResult> {
  if (!isYaraScanEnabled()) {
    if (process.env.NODE_ENV === "production" && isFailClosedOnScanError()) {
      throw new UploadSecurityError("SECURITY_SCAN_UNAVAILABLE", 503);
    }
    return { verdict: "CLEAN", engine: "yara", detail: "yara disabled in non-production" };
  }

  if (!(await yaraBinaryAvailable())) {
    throw new UploadSecurityError("SECURITY_SCAN_UNAVAILABLE", 503);
  }

  const result = await scanFileWithYara(filePath);
  if (result.verdict === "CLEAN") return result;
  if (result.verdict === "MALICIOUS") throw new UploadSecurityError("MALWARE_DETECTED");
  throw new UploadSecurityError("SECURITY_SCAN_UNAVAILABLE", 503);
}
