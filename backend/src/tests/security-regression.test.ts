import assert from "node:assert/strict";
import test from "node:test";
import { buildCspDirectives } from "../security-headers.js";
import { isAllowedUploadFilename, extensionForUploadMime } from "../security-utils.js";
import { canWriteSubmissions } from "../rbac.js";

test("should return a strict CSP", () => {
  const csp = buildCspDirectives();
  assert.deepEqual(csp.defaultSrc, ["'self'"]);
  assert.deepEqual(csp.objectSrc, ["'none'"]);
  assert.deepEqual(csp.frameAncestors, ["'none'"]);
  assert.deepEqual(csp.baseUri, ["'self'"]);
  assert.deepEqual(csp.formAction, ["'self'"]);
});

test("should not allow unsafe-eval", () => {
  const serialized = JSON.stringify(buildCspDirectives());
  assert.equal(serialized.includes("'unsafe-eval'"), false);
});

test("should not allow unsafe-inline", () => {
  const csp = buildCspDirectives();
  assert.equal(csp.styleSrc.includes("'unsafe-inline'"), false);
  assert.equal(JSON.stringify(csp).includes("'unsafe-inline'"), false);
});

test("should allow intended upload extensions", () => {
  assert.equal(isAllowedUploadFilename("valid.pdf"), true);
  assert.equal(isAllowedUploadFilename("valid.jpg"), true);
  assert.equal(isAllowedUploadFilename("valid.jpeg"), true);
  assert.equal(isAllowedUploadFilename("valid.png"), true);
  assert.equal(isAllowedUploadFilename("FIR_12.08.2026.pdf"), true);
  assert.equal(isAllowedUploadFilename("signed copy.pdf"), true);
});

test("should reject double-extension uploads", () => {
  assert.equal(isAllowedUploadFilename("evil.php.pdf"), false);
  assert.equal(isAllowedUploadFilename("file.exe.pdf"), false);
  assert.equal(isAllowedUploadFilename("payload.js.pdf"), false);
});

test("should reject executable or unsupported upload types", () => {
  assert.equal(isAllowedUploadFilename("evil.html"), false);
  assert.equal(isAllowedUploadFilename("evil.svg"), false);
});

test("should reject path traversal filename", () => {
  assert.equal(isAllowedUploadFilename("../../file.pdf"), false);
  assert.equal(isAllowedUploadFilename("..\\..\\file.pdf"), false);
  assert.equal(isAllowedUploadFilename("bad\0.pdf"), false);
});

test("should map only allowed MIME types to safe stored extensions", () => {
  assert.equal(extensionForUploadMime("application/pdf"), ".pdf");
  assert.equal(extensionForUploadMime("image/jpeg"), ".jpg");
  assert.equal(extensionForUploadMime("image/png"), ".png");
  assert.equal(extensionForUploadMime("text/html"), null);
  assert.equal(extensionForUploadMime("image/svg+xml"), null);
});

test("should reject manipulated double extensions", () => {
  assert.equal(isAllowedUploadFilename("evil.phpd.pdf"), false);
  assert.equal(isAllowedUploadFilename("evil.phd.pdf"), false);
});

test("should deny DGP and ADGP district submit operation", () => {
  assert.equal(canWriteSubmissions(["dgp"]), false);
  assert.equal(canWriteSubmissions(["adgp"]), false);
});

test("should allow admin authorized submission operation and deny prism-only submission write", () => {
  assert.equal(canWriteSubmissions(["admin"]), true);
  assert.equal(canWriteSubmissions(["prism"]), false);
});
