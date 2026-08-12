import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import test from "node:test";
import { isAllowedUploadFilename } from "../security-utils.js";
import { assertSanitizedPdfIsSafe, inspectPdfSecurity, pdfRequiresSanitization } from "../upload-inspect-pdf.js";
import { UploadSecurityError } from "../upload-errors.js";
import {
  buildAptsXssPdfPoC,
  buildEicarPdf,
  MINIMAL_PDF,
  safeUnlink,
  writeTempFixture,
} from "../upload-poc-fixtures.js";

const execFileAsync = promisify(execFile);

async function commandAvailable(cmd: string, args: string[] = ["--version"]): Promise<boolean> {
  try {
    await execFileAsync(cmd, args, { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function runSecurePipeline(
  filePath: string,
  originalFilename: string,
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
) {
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
    originalFilename,
    mimeType,
    fileSizeBytes: fs.statSync(filePath).size,
    userId: "test-user",
    submissionId: "00000000-0000-4000-8000-000000000001",
  });
}

test("APTS PoC double-extension filenames are rejected before upload processing", () => {
  for (const name of ["malicious.php.pdf", "payload.exe.pdf", "evil.js.docx", "report.phpd"]) {
    assert.equal(isAllowedUploadFilename(name), false, name);
  }
});

test("APTS PoC XSS PDF is detected as requiring sanitization", () => {
  const filePath = writeTempFixture("apts-xss.pdf", buildAptsXssPdfPoC());
  try {
    const inspection = inspectPdfSecurity(filePath);
    assert.equal(pdfRequiresSanitization(inspection), true);
    assert.ok(inspection.threats.includes("javascript") || inspection.threats.includes("open_action"));
  } finally {
    safeUnlink(filePath);
  }
});

test("clean PDF is approved without sanitization", async () => {
  const hasYara = await commandAvailable("yara");
  if (!hasYara) {
    console.log("Skipping pipeline test: yara not installed");
    return;
  }

  const filePath = writeTempFixture("clean.pdf", MINIMAL_PDF);
  try {
    const result = await runSecurePipeline(filePath, "clean.pdf", "application/pdf");
    assert.equal(result.securityStatus, "APPROVED");
    assert.equal(result.sanitizationApplied, false);
    assertSanitizedPdfIsSafe(result.sanitizedPath);
    safeUnlink(result.sanitizedPath);
  } finally {
    safeUnlink(filePath);
  }
});

test("APTS PoC XSS PDF is blocked or stripped of JavaScript by the upload pipeline", async (t) => {
  const hasYara = await commandAvailable("yara");
  const hasGs = await commandAvailable("gs");
  if (!hasYara || !hasGs) {
    t.skip("Requires yara and ghostscript (run inside production Docker image)");
    return;
  }

  const filePath = writeTempFixture("apts-xss.pdf", buildAptsXssPdfPoC());
  try {
    try {
      const result = await runSecurePipeline(filePath, "malicious-xss.pdf", "application/pdf");
      assert.equal(result.securityStatus, "APPROVED");
      assert.equal(result.sanitizationApplied, true, "malicious PDF must be sanitized");
      const postInspect = inspectPdfSecurity(result.sanitizedPath);
      assert.equal(pdfRequiresSanitization(postInspect), false, "stored copy must not retain active PDF threats");
      assertSanitizedPdfIsSafe(result.sanitizedPath);
      const stored = fs.readFileSync(result.sanitizedPath).toString("latin1");
      assert.equal(/\/JavaScript\b/i.test(stored), false);
      assert.equal(/app\.alert/i.test(stored), false);
      safeUnlink(result.sanitizedPath);
    } catch (err) {
      assert.ok(
        err instanceof UploadSecurityError,
        `malicious PDF must be rejected or sanitized, got: ${err}`
      );
      assert.ok(
        ["SANITIZATION_FAILED", "UNSAFE_DOCUMENT", "MALWARE_DETECTED"].includes(err.code),
        `unexpected rejection code: ${err.code}`
      );
    }
  } finally {
    safeUnlink(filePath);
  }
});

test("EICAR malware test artifact is rejected by YARA scan", async (t) => {
  const hasYara = await commandAvailable("yara");
  if (!hasYara) {
    t.skip("Requires yara (run inside production Docker image)");
    return;
  }

  const filePath = writeTempFixture("eicar.pdf", buildEicarPdf());
  try {
    await assert.rejects(
      () => runSecurePipeline(filePath, "eicar.pdf", "application/pdf"),
      (err: unknown) => err instanceof UploadSecurityError && err.code === "MALWARE_DETECTED"
    );
  } finally {
    safeUnlink(filePath);
  }
});
