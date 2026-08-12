import assert from "node:assert/strict";
import test from "node:test";
import {
  interpretYaraExitCode,
  parseYaraStdout,
} from "../upload-yara-scan.js";
import { UploadSecurityError, UPLOAD_ERROR_MESSAGES } from "../upload-errors.js";

test("YARA exit code mapping", () => {
  assert.equal(interpretYaraExitCode(0, ""), "CLEAN");
  assert.equal(interpretYaraExitCode(1, ""), "MALICIOUS");
  assert.equal(interpretYaraExitCode(2, "error"), "SCAN_ERROR");
  assert.equal(interpretYaraExitCode(-1, "timeout"), "TIMEOUT");
});

test("YARA stdout parser extracts rule names", () => {
  const stdout = "EICAR_Test_File /tmp/sample.pdf\nSuspicious_Script_In_Document /tmp/sample.pdf\n";
  const rules = parseYaraStdout(stdout);
  assert.deepEqual(rules, ["EICAR_Test_File", "Suspicious_Script_In_Document"]);
});

test("upload error messages do not expose scanner internals", () => {
  assert.equal(UPLOAD_ERROR_MESSAGES.MALWARE_DETECTED.includes("YARA"), false);
  assert.equal(UPLOAD_ERROR_MESSAGES.SECURITY_SCAN_UNAVAILABLE.includes("API"), false);
});

test("UploadSecurityError uses safe generic messages", () => {
  const err = new UploadSecurityError("MALWARE_DETECTED");
  assert.equal(err.code, "MALWARE_DETECTED");
  assert.equal(err.message, UPLOAD_ERROR_MESSAGES.MALWARE_DETECTED);
});
