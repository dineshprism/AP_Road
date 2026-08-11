import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertUploadPassesMalwareScan, interpretClamAvResponse } from "../upload-virus-scan.js";

test("ClamAV interpret: clean OK", () => {
  assert.deepEqual(interpretClamAvResponse("stream: OK"), { clean: true, detail: "stream: OK" });
});

test("ClamAV interpret: malware FOUND rejects", () => {
  const result = interpretClamAvResponse("stream: Eicar-Test-Signature FOUND");
  assert.equal(result.clean, false);
});

test("ClamAV interpret: empty/error response is not clean", () => {
  assert.equal(interpretClamAvResponse("").clean, false);
  assert.equal(interpretClamAvResponse("ERROR").clean, false);
});

test("ClamAV enabled: unavailable scanner fails closed", async () => {
  const previousEnabled = process.env.CLAMAV_ENABLED;
  const previousHost = process.env.CLAMAV_HOST;
  const previousPort = process.env.CLAMAV_PORT;
  const previousNodeEnv = process.env.NODE_ENV;

  const tempFile = path.join(os.tmpdir(), `clam-test-${Date.now()}.pdf`);
  fs.writeFileSync(tempFile, "%PDF-1.4\n%%EOF\n");

  try {
    process.env.CLAMAV_ENABLED = "true";
    process.env.CLAMAV_HOST = "127.0.0.1";
    process.env.CLAMAV_PORT = "1"; // nothing listening
    process.env.NODE_ENV = "test";

    await assert.rejects(
      () => assertUploadPassesMalwareScan(tempFile),
      /Malware scanner unavailable|ECONNREFUSED|connect|timed out|scan/i
    );
  } finally {
    fs.unlinkSync(tempFile);
    if (previousEnabled === undefined) delete process.env.CLAMAV_ENABLED;
    else process.env.CLAMAV_ENABLED = previousEnabled;
    if (previousHost === undefined) delete process.env.CLAMAV_HOST;
    else process.env.CLAMAV_HOST = previousHost;
    if (previousPort === undefined) delete process.env.CLAMAV_PORT;
    else process.env.CLAMAV_PORT = previousPort;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("production requires ClamAV enabled", async () => {
  const previousEnabled = process.env.CLAMAV_ENABLED;
  const previousNodeEnv = process.env.NODE_ENV;
  const tempFile = path.join(os.tmpdir(), `clam-prod-${Date.now()}.pdf`);
  fs.writeFileSync(tempFile, "%PDF-1.4\n%%EOF\n");

  try {
    process.env.NODE_ENV = "production";
    process.env.CLAMAV_ENABLED = "false";
    await assert.rejects(
      () => assertUploadPassesMalwareScan(tempFile),
      /Malware scanning is required in production/
    );
  } finally {
    fs.unlinkSync(tempFile);
    if (previousEnabled === undefined) delete process.env.CLAMAV_ENABLED;
    else process.env.CLAMAV_ENABLED = previousEnabled;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
