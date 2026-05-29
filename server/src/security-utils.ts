/** Signed-copy upload cap (override with MAX_UPLOAD_MB env, default 25). */
export const MAX_UPLOAD_BYTES =
  Math.max(1, parseInt(process.env.MAX_UPLOAD_MB || "25", 10)) * 1024 * 1024;

export const MAX_BATCH_SUBMISSION_IDS = 20;
export const MAX_JSON_FIELD_BYTES = 65536;
export const MIN_PASSWORD_LENGTH = 8;

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
