import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { DOCX_MIME } from "./security-utils.js";
import { isValidPdfContent } from "./upload-content.js";

const execFileAsync = promisify(execFile);
const PDF_TIMEOUT_MS = 60_000;

function isSanitizeEnabled(): boolean {
  return process.env.UPLOAD_SANITIZE_ENABLED !== "false";
}

export async function sanitizeUploadFile(filePath: string, mimeType: string): Promise<void> {
  if (!isSanitizeEnabled()) {
    return;
  }

  if (mimeType === "application/pdf") {
    await sanitizePdf(filePath);
    return;
  }

  if (mimeType === DOCX_MIME) {
    // DOCX: no server-side execution/rendering; enforce non-executable permissions only.
    fs.chmodSync(filePath, 0o644);
    return;
  }

  throw new Error("Unsupported file type for sanitization");
}

async function ghostscriptAvailable(): Promise<boolean> {
  try {
    await execFileAsync("gs", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function runGhostscript(filePath: string, tempPath: string, extraArgs: string[]): Promise<void> {
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
      `-sOutputFile=${tempPath}`,
      filePath,
    ],
    { timeout: PDF_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
  );

  if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size === 0) {
    throw new Error("empty output");
  }
}

/**
 * PDF CDR via Ghostscript rewrite. Fail closed: never keep the original when
 * sanitization is required and Ghostscript is missing or all rewrite attempts fail.
 */
async function sanitizePdf(filePath: string): Promise<void> {
  if (!(await ghostscriptAvailable())) {
    throw new Error("PDF sanitization unavailable (Ghostscript required)");
  }

  const tempPath = `${filePath}.sanitized.pdf`;
  const attempts: string[][] = [
    ["-dDetectDuplicateImages=true"],
    [],
  ];

  let lastError: unknown;
  for (const extraArgs of attempts) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      await runGhostscript(filePath, tempPath, extraArgs);
      if (!isValidPdfContent(tempPath)) {
        throw new Error("sanitized output is not a valid PDF");
      }
      fs.renameSync(tempPath, filePath);
      fs.chmodSync(filePath, 0o644);
      return;
    } catch (err) {
      lastError = err;
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  console.error("PDF sanitization failed:", lastError);
  throw new Error("PDF sanitization failed. Upload rejected.");
}
