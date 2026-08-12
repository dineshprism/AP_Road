import path from "node:path";
import { fileURLToPath } from "node:url";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** MB cap — supports MAX_UPLOAD_SIZE_MB (spec) and legacy MAX_UPLOAD_MB. */
export function getMaxUploadBytes(): number {
  const mb =
    intEnv("MAX_UPLOAD_SIZE_MB", 0) ||
    intEnv("MAX_UPLOAD_MB", 5);
  return mb * 1024 * 1024;
}

export function getUploadQuarantineRoot(): string {
  const configured = process.env.UPLOAD_QUARANTINE_PATH?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), "uploads", "quarantine");
}

export function getUploadStorageRoot(): string {
  const configured = process.env.UPLOAD_STORAGE_PATH?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), "uploads", "signed-copies");
}

export function quarantineOriginalDir(): string {
  return path.join(getUploadQuarantineRoot(), "original");
}

export function quarantineSanitizedDir(): string {
  return path.join(getUploadQuarantineRoot(), "sanitized");
}

export function isDocumentSanitizationEnabled(): boolean {
  return process.env.DOCUMENT_SANITIZATION_ENABLED !== "false";
}

export function isFailClosedOnScanError(): boolean {
  return process.env.FAIL_CLOSED_ON_SCAN_ERROR !== "false";
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function getYaraConfig() {
  const configured = process.env.YARA_RULES_PATH?.trim();
  const defaultRules = path.resolve(moduleDir, "../yara-rules");
  return {
    rulesPath: configured ? path.resolve(configured) : defaultRules,
    timeoutMs: intEnv("YARA_SCAN_TIMEOUT_MS", 60_000),
  };
}

export function isYaraScanEnabled(): boolean {
  return process.env.YARA_SCAN_ENABLED !== "false";
}
