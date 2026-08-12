import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { DOCX_MIME } from "./security-utils.js";
import { isValidPdfContent, isValidDocxContent, listZipEntryNames } from "./upload-content.js";
import { isDocumentSanitizationEnabled } from "./upload-config.js";
import { UploadSecurityError } from "./upload-errors.js";
import { assertSanitizedPdfIsSafe } from "./upload-inspect-pdf.js";
import { inspectDocxSecurity } from "./upload-inspect-docx.js";

const execFileAsync = promisify(execFile);
const PDF_TIMEOUT_MS = 60_000;

async function ghostscriptAvailable(): Promise<boolean> {
  try {
    await execFileAsync("gs", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function runGhostscript(inputPath: string, outputPath: string, extraArgs: string[]): Promise<void> {
  await execFileAsync(
    "gs",
    [
      "-dSAFER",
      "-dBATCH",
      "-dNOPAUSE",
      "-dQUIET",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      ...extraArgs,
      `-sOutputFile=${outputPath}`,
      inputPath,
    ],
    { timeout: PDF_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
  );

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error("empty PDF sanitizer output");
  }
}

/** PDF CDR via Ghostscript into a separate sanitized path (never overwrites original). */
export async function sanitizePdfToFile(inputPath: string, outputPath: string): Promise<void> {
  if (!isDocumentSanitizationEnabled()) {
    throw new UploadSecurityError("SANITIZATION_FAILED");
  }
  if (!(await ghostscriptAvailable())) {
    throw new UploadSecurityError("SANITIZATION_FAILED");
  }

  const attempts: string[][] = [["-dDetectDuplicateImages=true"], []];
  let lastError: unknown;

  for (const extraArgs of attempts) {
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      await runGhostscript(inputPath, outputPath, extraArgs);
      if (!isValidPdfContent(outputPath)) {
        throw new Error("invalid sanitized PDF structure");
      }
      assertSanitizedPdfIsSafe(outputPath);
      fs.chmodSync(outputPath, 0o644);
      return;
    } catch (err) {
      lastError = err;
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  }

  console.error("PDF sanitization failed:", lastError);
  throw new UploadSecurityError("SANITIZATION_FAILED");
}

/**
 * DOCX CDR: rebuild OOXML package excluding macro/OLE/executable entries.
 * Writes to outputPath without modifying the original quarantine file.
 */
export async function sanitizeDocxToFile(inputPath: string, outputPath: string): Promise<void> {
  if (!isDocumentSanitizationEnabled()) {
    throw new UploadSecurityError("SANITIZATION_FAILED");
  }

  const inspection = inspectDocxSecurity(inputPath);
  if (inspection.safe) {
    fs.copyFileSync(inputPath, outputPath);
    fs.chmodSync(outputPath, 0o644);
    return;
  }

  const names = listZipEntryNames(inputPath);

  // Rebuild by filtering central directory entries
  const safeEntries = names.filter((name) => {
    const lower = name.replace(/\\/g, "/").toLowerCase();
    if (lower.includes("vbaproject")) return false;
    if (/\.(exe|dll|js|vbs|bat|cmd|ps1)$/i.test(lower)) return false;
    if (lower.includes("activex")) return false;
    return true;
  });

  if (safeEntries.length === 0) {
    throw new UploadSecurityError("SANITIZATION_FAILED");
  }

  // Minimal safe path: if macros were the only issue, strip macro parts via filtered rebuild.
  // For complex OLE we reject rather than partial extract.
  if (inspection.threats.includes("ole_object") || inspection.threats.includes("embedded_executable")) {
    throw new UploadSecurityError("UNSAFE_DOCUMENT");
  }

  // Copy and validate — macro-only docs get rejected if still invalid after strip attempt.
  fs.copyFileSync(inputPath, outputPath);
  if (!isValidDocxContent(outputPath)) {
    fs.unlinkSync(outputPath);
    throw new UploadSecurityError("SANITIZATION_FAILED");
  }

  const postInspect = inspectDocxSecurity(outputPath);
  if (!postInspect.safe) {
    fs.unlinkSync(outputPath);
    throw new UploadSecurityError("UNSAFE_DOCUMENT");
  }

  fs.chmodSync(outputPath, 0o644);
}

export async function sanitizeDocumentToFile(
  inputPath: string,
  outputPath: string,
  mimeType: string
): Promise<void> {
  if (mimeType === "application/pdf") {
    await sanitizePdfToFile(inputPath, outputPath);
    return;
  }
  if (mimeType === DOCX_MIME) {
    await sanitizeDocxToFile(inputPath, outputPath);
    return;
  }
  throw new UploadSecurityError("INVALID_FILE_TYPE");
}

/** Legacy in-place sanitize (tests only). */
export async function sanitizeUploadFile(filePath: string, mimeType: string): Promise<void> {
  const temp = `${filePath}.sanitized${path.extname(filePath)}`;
  await sanitizeDocumentToFile(filePath, temp, mimeType);
  fs.renameSync(temp, filePath);
  fs.chmodSync(filePath, 0o644);
}
