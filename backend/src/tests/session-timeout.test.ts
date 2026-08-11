import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { evaluateSessionFreshness, getSessionPolicy } from "../auth.js";

test("session policy enforces 30-minute idle and short-lived JWT", () => {
  const policy = getSessionPolicy();
  assert.equal(policy.idleTimeoutMs, 30 * 60 * 1000);
  assert.equal(policy.absoluteMaxMs, 8 * 60 * 60 * 1000);
  assert.equal(policy.jwtExpiresInSeconds, 30 * 60);
  assert.ok(
    policy.jwtExpiresInSeconds <= policy.idleTimeoutMs / 1000,
    "JWT crypto lifetime must not exceed idle timeout"
  );
});

test("idle timeout rejects sessions inactive for more than 30 minutes", () => {
  const now = Date.parse("2026-08-07T10:00:00.000Z");
  const createdAt = new Date(now - 60 * 60 * 1000);
  const lastActivity = new Date(now - 31 * 60 * 1000);

  assert.equal(evaluateSessionFreshness(createdAt, lastActivity, now), "idle_expired");
});

test("active sessions within idle window remain valid", () => {
  const now = Date.parse("2026-08-07T10:00:00.000Z");
  const createdAt = new Date(now - 60 * 60 * 1000);
  const lastActivity = new Date(now - 10 * 60 * 1000);

  assert.equal(evaluateSessionFreshness(createdAt, lastActivity, now), "ok");
});

test("absolute 8-hour cap expires even if recently active", () => {
  const now = Date.parse("2026-08-07T18:00:00.000Z");
  const createdAt = new Date(now - 8 * 60 * 60 * 1000 - 1000);
  const lastActivity = new Date(now - 60 * 1000);

  assert.equal(evaluateSessionFreshness(createdAt, lastActivity, now), "absolute_expired");
});

test("JWT exp claim is ~30 minutes, not 8 hours (CWE-613 evidence)", () => {
  const policy = getSessionPolicy();
  const secret = "test-session-timeout-secret-at-least-32-chars";
  const token = jwt.sign({ userId: "u1", email: "demo", jti: "j1" }, secret, {
    expiresIn: policy.jwtExpiresInSeconds,
    algorithm: "HS256",
  });
  const payload = jwt.decode(token) as { iat: number; exp: number };
  const lifetimeSec = payload.exp - payload.iat;
  assert.equal(lifetimeSec, 30 * 60);
  assert.notEqual(lifetimeSec, 8 * 60 * 60);
  assert.notEqual(lifetimeSec, 24 * 60 * 60);
});
