import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";

const execFileAsync = promisify(execFile);
const PDF_TIMEOUT_MS = 60_000;

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default;
  } catch (err) {
    console.error("Failed to load sharp:", err);
    throw new Error("Image processing is temporarily unavailable");
  }
}

function isSanitizeEnabled(): boolean {
  return process.env.UPLOAD_SANITIZE_ENABLED !== "false";
}

export async function sanitizeUploadFile(filePath: string, mimeType: string): Promise<void> {
  if (!isSanitizeEnabled()) {
    return;
  }

  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    await sanitizeImage(filePath, mimeType);
    return;
  }

  if (mimeType === "application/pdf") {
    await sanitizePdf(filePath);
    return;
  }

  throw new Error("Unsupported file type");
}

async function sanitizeImage(filePath: string, mimeType: string): Promise<void> {
  const tempPath = `${filePath}.sanitized`;
  try {
    const sharp = await loadSharp();
    const pipeline = sharp(filePath, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();

    if (mimeType === "image/png") {
      await pipeline.png({ compressionLevel: 9, force: true }).toFile(tempPath);
    } else {
      await pipeline.jpeg({ quality: 90, mozjpeg: true, force: true }).toFile(tempPath);
    }

    fs.renameSync(tempPath, filePath);
    fs.chmodSync(filePath, 0o644);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error("Image sanitization failed:", err);
    throw new Error("Image could not be processed. Please upload a valid JPG or PNG file.");
  }
}

async function ghostscriptAvailable(): Promise<boolean> {
  try {
    await execFileAsync("gs", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function sanitizePdf(filePath: string): Promise<void> {
  if (!(await ghostscriptAvailable())) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PDF processing is temporarily unavailable");
    }
    console.warn("ghostscript not installed; skipping PDF sanitization in development");
    return;
  }

  const tempPath = `${filePath}.sanitized.pdf`;
  try {
    await execFileAsync(
      "gs",
      [
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dPDFSETTINGS=/prepress",
        "-dDetectDuplicateImages=true",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        `-sOutputFile=${tempPath}`,
        filePath,
      ],
      { timeout: PDF_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
    );

    if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size === 0) {
      throw new Error("empty output");
    }

    fs.renameSync(tempPath, filePath);
    fs.chmodSync(filePath, 0o644);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error("PDF sanitization failed:", err);
    throw new Error(
      "PDF could not be processed. Re-save or export the file (Print to PDF) and try again."
    );
  }
}
