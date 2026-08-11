import fs from "node:fs";
import { DOCX_MIME } from "./security-utils.js";

const PDF_MAGIC = Buffer.from("%PDF-");
const ZIP_EOCD_MAGIC = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

const REQUIRED_DOCX_ENTRIES = [
  "[Content_Types].xml",
  "_rels/.rels",
  "word/document.xml",
] as const;

/**
 * List entry names from a ZIP central directory (minimal reader, no decompression).
 * Rejects truncated/malformed archives.
 */
export function listZipEntryNames(filePath: string): string[] {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 22) {
    throw new Error("Invalid ZIP/DOCX package");
  }
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("Not a ZIP/DOCX package");
  }

  // EOCD is at least 22 bytes and typically near the end (allow comment up to 64KiB).
  const maxScan = Math.min(buf.length, 22 + 65535);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= buf.length - maxScan; i -= 1) {
    if (i < 0) break;
    if (buf.subarray(i, i + 4).equals(ZIP_EOCD_MAGIC)) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("Invalid ZIP/DOCX package (missing central directory)");
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const centralDirSize = buf.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);

  if (centralDirOffset + centralDirSize > buf.length) {
    throw new Error("Invalid ZIP/DOCX package (corrupt central directory)");
  }

  const names: string[] = [];
  let offset = centralDirOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (offset + 46 > buf.length) {
      throw new Error("Invalid ZIP/DOCX package (truncated central directory)");
    }
    if (buf.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid ZIP/DOCX package (bad central directory signature)");
    }
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > buf.length) {
      throw new Error("Invalid ZIP/DOCX package (bad entry name)");
    }
    names.push(buf.subarray(nameStart, nameEnd).toString("utf8"));
    offset = nameEnd + extraLen + commentLen;
  }

  return names;
}

export function isValidPdfContent(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      const header = Buffer.alloc(8);
      const bytesRead = fs.readSync(fd, header, 0, 8, 0);
      if (bytesRead < 5) return false;
      if (!header.subarray(0, 5).equals(PDF_MAGIC)) return false;

      // Require an %%EOF marker somewhere near the end (basic structure check).
      const stat = fs.fstatSync(fd);
      const tailSize = Math.min(stat.size, 2048);
      const tail = Buffer.alloc(tailSize);
      fs.readSync(fd, tail, 0, tailSize, Math.max(0, stat.size - tailSize));
      return tail.toString("latin1").includes("%%EOF");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

export function isValidDocxContent(filePath: string): boolean {
  try {
    const names = listZipEntryNames(filePath);
    const normalized = new Set(names.map((n) => n.replace(/\\/g, "/")));

    for (const required of REQUIRED_DOCX_ENTRIES) {
      if (!normalized.has(required)) {
        return false;
      }
    }

    // Reject macro-enabled / executable Office payloads disguised as .docx.
    for (const name of normalized) {
      const lower = name.toLowerCase();
      if (
        lower === "word/vbaproject.bin" ||
        lower.endsWith("/vbaproject.bin") ||
        lower.includes("vbaproject") ||
        lower.endsWith(".exe") ||
        lower.endsWith(".js") ||
        lower.endsWith(".vbs") ||
        lower.endsWith(".bat") ||
        lower.endsWith(".cmd") ||
        lower.endsWith(".ps1") ||
        lower.endsWith(".dll")
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function hasAllowedFileSignature(filePath: string, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    return isValidPdfContent(filePath);
  }
  if (mimeType === DOCX_MIME) {
    return isValidDocxContent(filePath);
  }
  return false;
}

export function assertUploadContentMatchesMime(filePath: string, mimeType: string): void {
  if (!hasAllowedFileSignature(filePath, mimeType)) {
    throw new Error("Uploaded file content does not match the declared PDF or DOCX type");
  }
}
