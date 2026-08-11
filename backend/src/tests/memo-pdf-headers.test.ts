import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import {
  memoPdfFrameHeadersMiddleware,
  ROAD_SAFETY_MEMO_PDF_PATH,
  securityHeadersMiddleware,
} from "../security-headers.js";

async function get(app: express.Express, requestPath: string) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object" && "port" in address);
  const port = address.port;

  try {
    return await new Promise<{
      statusCode: number;
      headers: http.IncomingHttpHeaders;
      body: Buffer;
    }>((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port, path: requestPath }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
      });
      req.on("error", reject);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

function buildStaticApp(staticRoot: string) {
  const app = express();
  app.use(securityHeadersMiddleware(true));
  app.use(memoPdfFrameHeadersMiddleware());
  app.use(express.static(staticRoot));
  app.get("*", (_req, res) => res.type("html").send("<!doctype html><title>app</title>"));
  return app;
}

test("GET /assets/memo_road_safety-BpjtUU0I.pdf should allow same-origin iframe embedding only for the memo PDF", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memo-pdf-static-"));
  try {
    fs.mkdirSync(path.join(root, "assets"));
    fs.writeFileSync(
      path.join(root, "assets", "memo_road_safety-BpjtUU0I.pdf"),
      "%PDF-1.7\n% test memo\n"
    );

    const response = await get(buildStaticApp(root), ROAD_SAFETY_MEMO_PDF_PATH);
    const csp = String(response.headers["content-security-policy"] || "");

    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["content-type"]), /^application\/pdf\b/);
    assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
    assert.match(csp, /frame-ancestors 'self'/);
    assert.match(csp, /script-src-attr 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /form-action 'self'/);
    assert.doesNotMatch(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /'unsafe-inline'/);
    assert.doesNotMatch(csp, /'unsafe-eval'/);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("normal application routes should retain global DENY and frame-ancestors none", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memo-pdf-static-"));
  try {
    const response = await get(buildStaticApp(root), "/");
    const csp = String(response.headers["content-security-policy"] || "");

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /script-src-attr 'none'/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("arbitrary PDFs under /assets must not receive the memo PDF frame exception", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memo-pdf-static-"));
  try {
    fs.mkdirSync(path.join(root, "assets"));
    fs.writeFileSync(path.join(root, "assets", "other.pdf"), "%PDF-1.7\n% other pdf\n");

    const response = await get(buildStaticApp(root), "/assets/other.pdf");
    const csp = String(response.headers["content-security-policy"] || "");

    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["content-type"]), /^application\/pdf\b/);
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /frame-ancestors 'self'/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
