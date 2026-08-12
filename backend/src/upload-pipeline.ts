import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DOCX_MIME } from "./security-utils.js";
import { assertUploadContentMatchesMime, hasAllowedFileSignature } from "./upload-content.js";
import {
  isDocumentSanitizationEnabled,
  quarantineSanitizedDir,
} from "./upload-config.js";
import { UploadSecurityError } from "./upload-errors.js";
import { inspectPdfSecurity, pdfRequiresSanitization } from "./upload-inspect-pdf.js";
import { docxRequiresSanitization, inspectDocxSecurity } from "./upload-inspect-docx.js";
import { assertUploadPassesMalwareScan, type MalwareScanResult } from "./upload-yara-scan.js";
import { sanitizeDocumentToFile } from "./upload-sanitize.js";
import { logUploadSecurityEvent } from "./upload-security-log.js";

export interface SecureUploadInput {
  quarantineOriginalPath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  userId?: string;
  submissionId?: string;
}

export interface SecureUploadResult {
  sanitizedPath: string;
  storedFileName: string;
  sha256: string;
  securityStatus: "APPROVED";
  scanResultPre: string;
  scanResultPost: string;
  sanitizationApplied: boolean;
}

function safeUnlink(filePath: string | undefined) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort
  }
}

async function runMalwareScan(filePath: string): Promise<MalwareScanResult> {
  return assertUploadPassesMalwareScan(filePath);
}

function documentRequiresSanitization(mimeType: string, filePath: string): boolean {
  if (mimeType === "application/pdf") {
    return pdfRequiresSanitization(inspectPdfSecurity(filePath));
  }
  if (mimeType === DOCX_MIME) {
    return docxRequiresSanitization(inspectDocxSecurity(filePath));
  }
  return true;
}

/**
 * Full quarantine → validate → YARA scan → inspect → sanitize → rescan → approve pipeline.
 */
export async function processSecureDocumentUpload(input: SecureUploadInput): Promise<SecureUploadResult> {
  const started = Date.now();
  const { quarantineOriginalPath, originalFilename, mimeType, fileSizeBytes, userId, submissionId } = input;

  const sanitizedWorkPath = path.join(
    quarantineSanitizedDir(),
    `${crypto.randomUUID()}${mimeType === "application/pdf" ? ".pdf" : ".docx"}`
  );

  let scanPre: MalwareScanResult | null = null;
  let scanPost: MalwareScanResult | null = null;
  let sanitizationApplied = false;

  const reject = (code: UploadSecurityError["code"]) => {
    logUploadSecurityEvent({
      timestamp: new Date().toISOString(),
      userId,
      submissionId,
      originalFilename,
      detectedMimeType: mimeType,
      fileSizeBytes,
      scanResultPre: scanPre?.verdict,
      scanResultPost: scanPost?.verdict,
      sanitizationResult: sanitizationApplied ? "applied" : "not_applied",
      securityStatus: "REJECTED",
      reasonCode: code,
      durationMs: Date.now() - started,
    });
    safeUnlink(sanitizedWorkPath);
    throw new UploadSecurityError(code);
  };

  try {
    if (!hasAllowedFileSignature(quarantineOriginalPath, mimeType)) {
      reject("INVALID_FILE_TYPE");
    }

    scanPre = await runMalwareScan(quarantineOriginalPath);

    const needsSanitize =
      isDocumentSanitizationEnabled() &&
      documentRequiresSanitization(mimeType, quarantineOriginalPath);

    if (needsSanitize) {
      await sanitizeDocumentToFile(quarantineOriginalPath, sanitizedWorkPath, mimeType);
      sanitizationApplied = true;

      if (!hasAllowedFileSignature(sanitizedWorkPath, mimeType)) {
        reject("SANITIZATION_FAILED");
      }

      assertUploadContentMatchesMime(sanitizedWorkPath, mimeType);
      scanPost = await runMalwareScan(sanitizedWorkPath);
    } else {
      fs.copyFileSync(quarantineOriginalPath, sanitizedWorkPath);
      fs.chmodSync(sanitizedWorkPath, 0o644);
      scanPost = scanPre;
    }

    const sha256 = crypto.createHash("sha256").update(fs.readFileSync(sanitizedWorkPath)).digest("hex");
    const ext = mimeType === "application/pdf" ? ".pdf" : ".docx";
    const storedFileName = `${crypto.randomUUID()}${ext}`;

    logUploadSecurityEvent({
      timestamp: new Date().toISOString(),
      userId,
      submissionId,
      originalFilename,
      detectedMimeType: mimeType,
      fileSizeBytes,
      scanResultPre: scanPre.verdict,
      scanResultPost: scanPost.verdict,
      sanitizationResult: sanitizationApplied ? "applied" : "skipped_clean",
      securityStatus: "APPROVED",
      durationMs: Date.now() - started,
    });

    return {
      sanitizedPath: sanitizedWorkPath,
      storedFileName,
      sha256,
      securityStatus: "APPROVED",
      scanResultPre: scanPre.verdict,
      scanResultPost: scanPost.verdict,
      sanitizationApplied,
    };
  } catch (err) {
    safeUnlink(sanitizedWorkPath);
    if (err instanceof UploadSecurityError) throw err;
    console.error("Upload pipeline error:", err);
    throw new UploadSecurityError("UNSAFE_DOCUMENT");
  }
}

export function promoteToPermanentStorage(sanitizedPath: string, storageDir: string, storedFileName: string): string {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true, mode: 0o755 });
  }
  const finalPath = path.join(storageDir, storedFileName);
  fs.renameSync(sanitizedPath, finalPath);
  fs.chmodSync(finalPath, 0o644);
  return finalPath;
}

export function cleanupQuarantineFile(filePath: string | undefined) {
  safeUnlink(filePath);
}
