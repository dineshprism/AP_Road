import path from "path";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Signed-copy upload cap — MAX_UPLOAD_SIZE_MB (spec) or legacy MAX_UPLOAD_MB, default 5. */
export const MAX_UPLOAD_BYTES =
  (intEnv("MAX_UPLOAD_SIZE_MB", 0) || intEnv("MAX_UPLOAD_MB", 5)) * 1024 * 1024;

export const MAX_BATCH_SUBMISSION_IDS = 20;
export const MAX_JSON_FIELD_BYTES = 65536;
export const MIN_PASSWORD_LENGTH = 8;

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Allowed final extensions for signed-copy uploads (lowercase, with leading dot). */
export const ALLOWED_UPLOAD_EXTENSIONS = new Set([".pdf", ".docx"]);

export const ALLOWED_UPLOAD_MIME_TYPES = new Set(["application/pdf", DOCX_MIME]);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": DOCX_MIME,
};

/** Map validated MIME to a single safe stored extension (never trust client filename). */
export function extensionForUploadMime(mimeType: string): string | null {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === DOCX_MIME) return ".docx";
  return null;
}

export function mimeTypeForUploadExtension(ext: string): string | null {
  return MIME_BY_EXTENSION[ext.toLowerCase()] ?? null;
}

const UPLOAD_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": DOCX_MIME,
  // Legacy signed copies uploaded before PDF/DOCX-only policy (download only).
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/**
 * Intermediate “extensions” that must never appear before a whitelist suffix
 * (e.g. evil.php.pdf, document.txt.pdf, file.zip.docx). Numeric date segments
 * like FIR_12.08.2026.pdf remain allowed.
 */
const BLOCKED_INTERMEDIATE_EXTENSIONS = new Set([
  "php",
  "phtml",
  "php3",
  "php4",
  "php5",
  "phar",
  "phpd",
  "phd",
  "pht",
  "phps",
  "exe",
  "dll",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "js",
  "mjs",
  "cjs",
  "html",
  "htm",
  "shtml",
  "svg",
  "xml",
  "jsp",
  "jspx",
  "asp",
  "aspx",
  "cgi",
  "pl",
  "py",
  "rb",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "vbs",
  "jar",
  "war",
  "class",
  "txt",
  "csv",
  "tsv",
  "zip",
  "rar",
  "7z",
  "gz",
  "tgz",
  "tar",
  "bz2",
  "xz",
  "doc",
  "docx",
  "docm",
  "dot",
  "dotx",
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "tif",
  "tiff",
  "ico",
  "xls",
  "xlsx",
  "xlsm",
  "ppt",
  "pptx",
  "pptm",
  "rtf",
  "odt",
  "ods",
  "odp",
  "json",
  "yaml",
  "yml",
  "ini",
  "cfg",
  "conf",
  "sql",
  "db",
  "wasm",
  "so",
  "dylib",
]);

/**
 * Reject path tricks, missing/disallowed final extensions, and dangerous double
 * extensions (e.g. evil.php.pdf). Dated names like FIR_12.08.2026.pdf are allowed.
 * Stored filenames are always server-generated — this only gates the client name.
 */
export function isAllowedUploadFilename(originalName: string): boolean {
  if (!originalName || typeof originalName !== "string") return false;
  if (originalName.includes("\0")) return false;
  if (/[\x00-\x1f\x7f]/.test(originalName)) return false;

  const trimmed = originalName.trim();
  if (!trimmed || trimmed !== originalName) return false;
  if (trimmed.includes("/") || trimmed.includes("\\")) return false;
  if (/^[a-zA-Z]:/.test(trimmed)) return false;

  const base = path.basename(trimmed);
  if (!base || base === "." || base === ".." || base !== trimmed) return false;

  const lower = base.toLowerCase();
  const ext = path.extname(lower);
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return false;

  const stem = lower.slice(0, -ext.length);
  if (!stem) return false;

  const segments = stem.split(".");
  for (const segment of segments.slice(1)) {
    if (!segment) return false;
    if (BLOCKED_INTERMEDIATE_EXTENSIONS.has(segment)) return false;
    if (segment.startsWith("php") || segment === "phd" || segment === "pht") return false;
  }

  return true;
}

/**
 * Resolve canonical MIME from extension + declared Content-Type.
 * Empty/octet-stream is allowed only when the extension is whitelisted;
 * any other declared MIME must exactly match the extension.
 */
export function resolveUploadMimeType(originalName: string, reportedMime: string): string | null {
  if (!isAllowedUploadFilename(originalName)) return null;

  const ext = path.extname(originalName).toLowerCase();
  const expected = mimeTypeForUploadExtension(ext);
  if (!expected) return null;

  const declared = (reportedMime || "").trim().toLowerCase();
  if (!declared || declared === "application/octet-stream") {
    return expected;
  }
  if (declared === expected) {
    return expected;
  }
  return null;
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
