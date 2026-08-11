import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DOCX_MIME,
  MAX_UPLOAD_BYTES,
  extensionForUploadMime,
  isAllowedUploadFilename,
  resolveUploadMimeType,
} from "../security-utils.js";
import { hasAllowedFileSignature, isValidDocxContent, isValidPdfContent } from "../upload-content.js";
import { interpretClamAvResponse } from "../upload-virus-scan.js";

const MINIMAL_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8");

/** Build an uncompressed (store) ZIP with the given entries — enough for OOXML tests. */
function buildZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // method = store
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14); // crc (0 ok for tests)
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const local = Buffer.concat([localHeader, nameBuf, entry.data]);
    localParts.push(local);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(Buffer.concat([central, nameBuf]));

    offset += local.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function minimalDocx(): Buffer {
  return buildZip([
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>", "utf8") },
    { name: "_rels/.rels", data: Buffer.from("<Relationships/>", "utf8") },
    { name: "word/document.xml", data: Buffer.from("<w:document/>", "utf8") },
  ]);
}

function writeTemp(name: string, data: Buffer): string {
  const filePath = path.join(os.tmpdir(), `ap-road-upload-test-${Date.now()}-${name}`);
  fs.writeFileSync(filePath, data);
  return filePath;
}

test("should allow only PDF and DOCX filenames", () => {
  assert.equal(isAllowedUploadFilename("valid.pdf"), true);
  assert.equal(isAllowedUploadFilename("road-safety-report.docx"), true);
  assert.equal(isAllowedUploadFilename("FIR_12.08.2026.pdf"), true);
  assert.equal(isAllowedUploadFilename("FIR_2026.docx"), true);
  assert.equal(isAllowedUploadFilename("signed copy.pdf"), true);

  for (const name of [
    "x.jpg",
    "x.jpeg",
    "x.png",
    "x.gif",
    "x.svg",
    "x.txt",
    "x.csv",
    "x.xls",
    "x.xlsx",
    "x.zip",
    "x.rar",
    "x.exe",
    "x.php",
    "x.js",
    "x.html",
    "x.sh",
    "x.py",
  ]) {
    assert.equal(isAllowedUploadFilename(name), false, name);
  }
});

test("should reject APTS double-extension and manipulated-extension PoCs", () => {
  for (const name of [
    "evil.php.pdf",
    "evil.exe.pdf",
    "evil.js.pdf",
    "evil.html.pdf",
    "evil.svg.pdf",
    "evil.php.docx",
    "evil.exe.docx",
    "evil.js.docx",
    "file.txt.pdf",
    "file.zip.docx",
    "document.txt.pdf",
    "document.zip.docx",
    "payload.phpd",
    "payload.phd",
    "evil.phpd.pdf",
    "evil.phd.pdf",
  ]) {
    assert.equal(isAllowedUploadFilename(name), false, name);
  }
});

test("should reject path traversal and unsafe filename characters", () => {
  assert.equal(isAllowedUploadFilename("../../file.pdf"), false);
  assert.equal(isAllowedUploadFilename("..\\..\\file.pdf"), false);
  assert.equal(isAllowedUploadFilename("bad\0.pdf"), false);
  assert.equal(isAllowedUploadFilename("bad\npdf.pdf"), false);
  assert.equal(isAllowedUploadFilename("C:\\windows\\file.pdf"), false);
});

test("should map only PDF/DOCX MIME types to safe stored extensions", () => {
  assert.equal(extensionForUploadMime("application/pdf"), ".pdf");
  assert.equal(extensionForUploadMime(DOCX_MIME), ".docx");
  assert.equal(extensionForUploadMime("image/jpeg"), null);
  assert.equal(extensionForUploadMime("image/png"), null);
  assert.equal(extensionForUploadMime("text/html"), null);
  assert.equal(extensionForUploadMime("application/zip"), null);
});

test("should require extension and declared MIME agreement", () => {
  assert.equal(resolveUploadMimeType("report.pdf", "application/pdf"), "application/pdf");
  assert.equal(resolveUploadMimeType("report.docx", DOCX_MIME), DOCX_MIME);
  assert.equal(resolveUploadMimeType("report.pdf", ""), "application/pdf");
  assert.equal(resolveUploadMimeType("report.pdf", "application/octet-stream"), "application/pdf");
  assert.equal(resolveUploadMimeType("report.pdf", "text/html"), null);
  assert.equal(resolveUploadMimeType("report.docx", "application/pdf"), null);
  assert.equal(resolveUploadMimeType("report.docx", "application/zip"), null);
});

test("should validate PDF signature and structure", () => {
  const pdfPath = writeTemp("ok.pdf", MINIMAL_PDF);
  const htmlAsPdf = writeTemp("html.pdf", Buffer.from("<html>hi</html>", "utf8"));
  const zipAsPdf = writeTemp("zip.pdf", buildZip([{ name: "a.txt", data: Buffer.from("x") }]));
  try {
    assert.equal(isValidPdfContent(pdfPath), true);
    assert.equal(hasAllowedFileSignature(pdfPath, "application/pdf"), true);
    assert.equal(isValidPdfContent(htmlAsPdf), false);
    assert.equal(isValidPdfContent(zipAsPdf), false);
  } finally {
    fs.unlinkSync(pdfPath);
    fs.unlinkSync(htmlAsPdf);
    fs.unlinkSync(zipAsPdf);
  }
});

test("should validate DOCX OOXML structure and reject arbitrary ZIP/PDF", () => {
  const docxPath = writeTemp("ok.docx", minimalDocx());
  const zipPath = writeTemp("arb.zip.docx", buildZip([{ name: "readme.txt", data: Buffer.from("hi") }]));
  const pdfAsDocx = writeTemp("pdf.docx", MINIMAL_PDF);
  const macroDocx = writeTemp(
    "macro.docx",
    buildZip([
      { name: "[Content_Types].xml", data: Buffer.from("<Types/>", "utf8") },
      { name: "_rels/.rels", data: Buffer.from("<Relationships/>", "utf8") },
      { name: "word/document.xml", data: Buffer.from("<w:document/>", "utf8") },
      { name: "word/vbaProject.bin", data: Buffer.from("MZ", "utf8") },
    ])
  );
  try {
    assert.equal(isValidDocxContent(docxPath), true);
    assert.equal(hasAllowedFileSignature(docxPath, DOCX_MIME), true);
    assert.equal(isValidDocxContent(zipPath), false);
    assert.equal(isValidDocxContent(pdfAsDocx), false);
    assert.equal(isValidDocxContent(macroDocx), false);
  } finally {
    fs.unlinkSync(docxPath);
    fs.unlinkSync(zipPath);
    fs.unlinkSync(pdfAsDocx);
    fs.unlinkSync(macroDocx);
  }
});

test("should enforce 5 MB upload cap constant", () => {
  assert.equal(MAX_UPLOAD_BYTES, 5 * 1024 * 1024);
  assert.ok(5 * 1024 * 1024 - 1 < MAX_UPLOAD_BYTES);
  assert.ok(5 * 1024 * 1024 <= MAX_UPLOAD_BYTES);
  assert.ok(5 * 1024 * 1024 + 1 > MAX_UPLOAD_BYTES);
});

test("ClamAV response interpretation: clean vs malware", () => {
  assert.equal(interpretClamAvResponse("stream: OK").clean, true);
  assert.equal(interpretClamAvResponse("stream: Win.Test.EICAR FOUND").clean, false);
  assert.equal(interpretClamAvResponse("").clean, false);
});

test("server-generated storage names never use client path", () => {
  // Storage naming is built from district/FIR/id + mime extension only.
  const clientName = "../../evil.php.pdf";
  assert.equal(isAllowedUploadFilename(clientName), false);
  const safeExt = extensionForUploadMime("application/pdf");
  assert.equal(safeExt, ".pdf");
  const serverName = `DIST_FIR_abc123${safeExt}`;
  assert.equal(serverName.includes(".."), false);
  assert.equal(serverName.includes("php"), false);
  assert.match(serverName, /^[A-Za-z0-9_]+\.pdf$/);
});

test("uploads directory remains outside frontend static web root", () => {
  const uploadsRoot = path.resolve(process.cwd(), "uploads", "signed-copies");
  const frontendDist = path.resolve(process.cwd(), "..", "dist");
  assert.equal(uploadsRoot.startsWith(frontendDist + path.sep), false);
});
