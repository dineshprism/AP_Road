import { sanitizeUploadFile } from "./upload-sanitize.js";
import { assertUploadPassesMalwareScan } from "./upload-virus-scan.js";
import { assertUploadContentMatchesMime } from "./upload-content.js";

/**
 * Runs upload hardening before a signed copy is stored permanently.
 * Order: content sanitize (PDF CDR) → re-validate → ClamAV (fail closed).
 */
export async function secureUploadedFile(filePath: string, mimeType: string): Promise<void> {
  const sanitizeEnabled = process.env.UPLOAD_SANITIZE_ENABLED !== "false";
  const clamavEnabled = process.env.CLAMAV_ENABLED === "true";

  if (process.env.NODE_ENV === "production" && !sanitizeEnabled) {
    throw new Error("Upload sanitization cannot be disabled in production");
  }

  if (process.env.NODE_ENV === "production" && !clamavEnabled) {
    throw new Error("Malware scanning cannot be disabled in production");
  }

  if (sanitizeEnabled) {
    await sanitizeUploadFile(filePath, mimeType);
    assertUploadContentMatchesMime(filePath, mimeType);
  }

  // Always invoke the malware gate: production requires ClamAV; non-prod may no-op when disabled.
  await assertUploadPassesMalwareScan(filePath);

  if (!sanitizeEnabled && !clamavEnabled && process.env.NODE_ENV === "production") {
    throw new Error("Upload security is not configured");
  }
}
