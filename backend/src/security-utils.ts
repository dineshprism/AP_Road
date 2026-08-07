import path from "path";

/** Signed-copy upload cap (override with MAX_UPLOAD_MB env, default 5). */
export const MAX_UPLOAD_BYTES =
  Math.max(1, parseInt(process.env.MAX_UPLOAD_MB || "5", 10)) * 1024 * 1024;

export const MAX_BATCH_SUBMISSION_IDS = 20;
export const MAX_JSON_FIELD_BYTES = 65536;
export const MIN_PASSWORD_LENGTH = 8;

/** Allowed final extensions for signed-copy uploads (lowercase, with leading dot). */
export const ALLOWED_UPLOAD_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

/** Map validated MIME to a single safe stored extension (never trust client filename). */
export function extensionForUploadMime(mimeType: string): string | null {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return null;
}

const UPLOAD_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/**
 * Reject path tricks, missing/disallowed final extensions, and double extensions
 * (e.g. evil.php.pdf). Only a single whitelist extension is allowed.
 */
export function isAllowedUploadFilename(originalName: string): boolean {
  if (!originalName || typeof originalName !== "string") return false;
  if (originalName.includes("\0")) return false;

  const base = path.basename(originalName.trim());
  if (!base || base === "." || base === "..") return false;

  const lower = base.toLowerCase();
  const ext = path.extname(lower);
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return false;

  const stem = lower.slice(0, -ext.length);
  if (!stem || stem.includes(".")) return false;

  return true;
}

export function contentTypeForUploadExt(ext: string): string {
  return UPLOAD_CONTENT_TYPES[ext.toLowerCase()] || "application/octet-stream";
}

export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const sanitized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

export function toSignedCopyApiUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/^\/+/, "");
  if (normalized.startsWith("api/uploads/")) {
    return `/${normalized}`;
  }
  return `/api/uploads/${normalized}`;
}

export function assertJsonFieldSize(
  value: unknown,
  fieldName: string,
  maxBytes = MAX_JSON_FIELD_BYTES
): void {
  const serialized = JSON.stringify(value ?? null);
  if (serialized.length > maxBytes) {
    throw new Error(`Field ${fieldName} exceeds maximum allowed size`);
  }
}
