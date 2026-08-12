/**
 * CWE-434 security regression runner — simulates APTS malicious upload PoCs.
 *
 * Run locally (with yara + ghostscript):
 *   npm run test:security-poc
 *
 * Run inside production container after deploy:
 *   docker compose exec app node dist/tools/security-poc-upload-test.js
 */
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAllowedUploadFilename } from "../security-utils.js";
import { inspectPdfSecurity, pdfRequiresSanitization } from "../upload-inspect-pdf.js";
import { UploadSecurityError } from "../upload-errors.js";
import {
  buildAptsXssPdfPoC,
  buildEicarPdf,
  MINIMAL_PDF,
  safeUnlink,
  writeTempFixture,
} from "../upload-poc-fixtures.js";

const execFileAsync = promisify(execFile);

type CaseResult = { name: string; pass: boolean; detail: string };

async function commandAvailable(cmd: string): Promise<boolean> {
  try {
    await execFileAsync(cmd, ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function runPipeline(filePath: string, filename: string) {
  process.env.YARA_SCAN_ENABLED = "true";
  process.env.DOCUMENT_SANITIZATION_ENABLED = "true";
  process.env.FAIL_CLOSED_ON_SCAN_ERROR = "false";

  const { quarantineOriginalDir, quarantineSanitizedDir } = await import("../upload-config.js");
  for (const dir of [quarantineOriginalDir(), quarantineSanitizedDir()]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }

  const { processSecureDocumentUpload } = await import("../upload-pipeline.js");
  return processSecureDocumentUpload({
    quarantineOriginalPath: filePath,
    originalFilename: filename,
    mimeType: "application/pdf",
    fileSizeBytes: fs.statSync(filePath).size,
    userId: "security-poc-runner",
    submissionId: "00000000-0000-4000-8000-000000000099",
  });
}

function printResult(result: CaseResult) {
  const icon = result.pass ? "PASS" : "FAIL";
  console.log(`[${icon}] ${result.name}`);
  console.log(`       ${result.detail}`);
}

async function main() {
  const writePocArg = process.argv.find((arg) => arg.startsWith("--write-poc="));
  if (writePocArg) {
    const outPath = writePocArg.slice("--write-poc=".length);
    fs.writeFileSync(outPath, buildAptsXssPdfPoC());
    console.log(`Wrote APTS XSS PoC PDF to ${outPath}`);
    console.log("Use only for authorized security testing on your own deployment.");
    return;
  }

  const results: CaseResult[] = [];
  const hasYara = await commandAvailable("yara");
  const hasGs = await commandAvailable("gs");

  console.log("CWE-434 Security PoC Upload Test");
  console.log("================================");
  console.log(`yara: ${hasYara ? "available" : "MISSING"}`);
  console.log(`ghostscript: ${hasGs ? "available" : "MISSING"}`);
  console.log("");

  // 1. Double extension
  const doubleExt = isAllowedUploadFilename("malicious.php.pdf");
  results.push({
    name: "Double extension (malicious.php.pdf)",
    pass: doubleExt === false,
    detail: doubleExt ? "Filename was incorrectly allowed" : "Rejected at filename whitelist (INVALID_FILE_TYPE)",
  });

  // 2. APTS XSS PDF detection
  const xssPath = writeTempFixture("apts-xss.pdf", buildAptsXssPdfPoC());
  try {
    const inspection = inspectPdfSecurity(xssPath);
    results.push({
      name: "APTS XSS PDF threat detection",
      pass: pdfRequiresSanitization(inspection),
      detail: `Threats: ${inspection.threats.join(", ") || "none"}`,
    });
  } finally {
    safeUnlink(xssPath);
  }

  // 3. Clean PDF
  if (hasYara) {
    const cleanPath = writeTempFixture("clean.pdf", MINIMAL_PDF);
    try {
      const result = await runPipeline(cleanPath, "clean.pdf");
      results.push({
        name: "Clean PDF upload",
        pass: result.securityStatus === "APPROVED" && !result.sanitizationApplied,
        detail: `status=${result.securityStatus}, sanitization=${result.sanitizationApplied}`,
      });
      safeUnlink(result.sanitizedPath);
    } catch (err) {
      results.push({
        name: "Clean PDF upload",
        pass: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      safeUnlink(cleanPath);
    }
  } else {
    results.push({
      name: "Clean PDF upload",
      pass: false,
      detail: "Skipped — yara not available",
    });
  }

  // 4. APTS XSS PDF pipeline
  if (hasYara && hasGs) {
    const maliciousPath = writeTempFixture("apts-xss.pdf", buildAptsXssPdfPoC());
    try {
      const result = await runPipeline(maliciousPath, "malicious-xss.pdf");
      const stored = fs.readFileSync(result.sanitizedPath).toString("latin1");
      const jsGone = !/\/JavaScript\b/i.test(stored) && !/app\.alert/i.test(stored);
      results.push({
        name: "APTS XSS PDF (stored copy safe)",
        pass: result.sanitizationApplied && jsGone,
        detail: jsGone
          ? "Sanitized — JavaScript payload removed from stored file"
          : "Stored file still contains JavaScript markers",
      });
      safeUnlink(result.sanitizedPath);
    } catch (err) {
      const rejected =
        err instanceof UploadSecurityError &&
        ["SANITIZATION_FAILED", "UNSAFE_DOCUMENT", "MALWARE_DETECTED"].includes(err.code);
      results.push({
        name: "APTS XSS PDF (stored copy safe)",
        pass: rejected,
        detail: `Rejected with ${err instanceof UploadSecurityError ? err.code : "unknown error"}`,
      });
    } finally {
      safeUnlink(maliciousPath);
    }
  } else {
    results.push({
      name: "APTS XSS PDF (stored copy safe)",
      pass: false,
      detail: "Skipped — requires yara and ghostscript",
    });
  }

  // 5. EICAR
  if (hasYara) {
    const eicarPath = writeTempFixture("eicar.pdf", buildEicarPdf());
    try {
      await runPipeline(eicarPath, "eicar.pdf");
      results.push({
        name: "EICAR malware test file",
        pass: false,
        detail: "EICAR file was incorrectly accepted",
      });
    } catch (err) {
      results.push({
        name: "EICAR malware test file",
        pass: err instanceof UploadSecurityError && err.code === "MALWARE_DETECTED",
        detail:
          err instanceof UploadSecurityError
            ? `Rejected with ${err.code}`
            : err instanceof Error
              ? err.message
              : String(err),
      });
    } finally {
      safeUnlink(eicarPath);
    }
  } else {
    results.push({
      name: "EICAR malware test file",
      pass: false,
      detail: "Skipped — yara not available",
    });
  }

  console.log("");
  for (const result of results) {
    printResult(result);
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log("");
  console.log(`Summary: ${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
