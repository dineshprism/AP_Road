import assert from "node:assert/strict";
import test from "node:test";
import { inspectPdfSecurity, pdfRequiresSanitization } from "../upload-inspect-pdf.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UPLOAD_ERROR_MESSAGES } from "../upload-errors.js";

test("PDF with JavaScript is flagged as unsafe before sanitization", () => {
  const pdfWithJs = Buffer.from(
    "%PDF-1.4\n1 0 obj<< /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert('x')) >> >>endobj\n%%EOF\n",
    "utf8"
  );
  const filePath = path.join(os.tmpdir(), `malicious-js-${Date.now()}.pdf`);
  fs.writeFileSync(filePath, pdfWithJs);
  try {
    const result = inspectPdfSecurity(filePath);
    assert.equal(result.safe, false);
    assert.ok(result.threats.includes("javascript") || result.threats.includes("open_action"));
  } finally {
    fs.unlinkSync(filePath);
  }
});

test("PDF with hyperlinks does not require sanitization", () => {
  const pdfWithLink = Buffer.from(
    "%PDF-1.4\n1 0 obj<< /Type /Annot /Subtype /Link /A << /S /URI /URI (https://example.com) >> >>endobj\n%%EOF\n",
    "utf8"
  );
  const filePath = path.join(os.tmpdir(), `link-only-${Date.now()}.pdf`);
  fs.writeFileSync(filePath, pdfWithLink);
  try {
    const result = inspectPdfSecurity(filePath);
    assert.equal(result.safe, true);
    assert.equal(pdfRequiresSanitization(result), false);
  } finally {
    fs.unlinkSync(filePath);
  }
});

test("upload error messages are safe and generic", () => {
  assert.equal(UPLOAD_ERROR_MESSAGES.MALWARE_DETECTED.includes("ClamAV"), false);
  assert.equal(UPLOAD_ERROR_MESSAGES.SECURITY_SCAN_UNAVAILABLE.includes("API"), false);
});
