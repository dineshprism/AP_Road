import { sanitizeUploadFile } from "./upload-sanitize.js";
import { assertUploadPassesMalwareScan } from "./upload-virus-scan.js";

/**
 * Runs upload hardening before a signed copy is stored.
 * Default: content sanitization (re-encoded images + Ghostscript PDF rewrite).
 * Optional: ClamAV when CLAMAV_ENABLED=true.
 */
export async function secureUploadedFile(filePath: string, mimeType: string): Promise<void> {
  const sanitizeEnabled = process.env.UPLOAD_SANITIZE_ENABLED !== "false";
  const clamavEnabled = process.env.CLAMAV_ENABLED === "true";

  if (sanitizeEnabled) {
    await sanitizeUploadFile(filePath, mimeType);
  }

  if (clamavEnabled) {
    await assertUploadPassesMalwareScan(filePath);
  }

  if (!sanitizeEnabled && !clamavEnabled && process.env.NODE_ENV === "production") {
    throw new Error("Upload security is not configured");
  }
}
