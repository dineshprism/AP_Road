import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Minimal valid PDF structure for security tests. */
export const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj\ntrailer<< /Size 4 /Root 1 0 R >>\n%%EOF\n",
  "utf8"
);

/**
 * APTS CWE-434 PoC: PDF with OpenAction JavaScript that triggers pdf.js alert on open.
 * @see VAPT report Step 2–3 (malicious PDF / XSS payload)
 */
export function buildAptsXssPdfPoC(): Buffer {
  return Buffer.from(
    `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/OpenAction << /S /JavaScript /JS (app.alert('Malicious JS Executed..')) >>
>>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
trailer
<< /Size 4 /Root 1 0 R >>
%%EOF`,
    "utf8"
  );
}

/** EICAR test string wrapped in a PDF container (malware scanner test artifact). */
export function buildEicarPdf(): Buffer {
  const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  return Buffer.from(`%PDF-1.4\n1 0 obj<<>>endobj\n${eicar}\ntrailer<<>>\n%%EOF\n`, "utf8");
}

export function writeTempFixture(name: string, data: Buffer): string {
  const filePath = path.join(os.tmpdir(), `ap-road-poc-${Date.now()}-${name}`);
  fs.writeFileSync(filePath, data);
  return filePath;
}

export function safeUnlink(filePath: string | undefined) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort
  }
}
