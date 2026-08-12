import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { isSessionIdleExpired, getSessionPolicy } from "../auth.js";

test("session policy enforces 30-minute idle and 30-minute JWT rotation", () => {
  const policy = getSessionPolicy();
  assert.equal(policy.idleTimeoutMs, 30 * 60 * 1000);
  assert.equal(policy.jwtExpiresInSeconds, 30 * 60);
  assert.equal(policy.jwtExpiresInSeconds, policy.idleTimeoutMs / 1000);
});

test("idle timeout rejects sessions inactive for more than 30 minutes", () => {
  const now = Date.parse("2026-08-07T10:00:00.000Z");
  const lastActivity = new Date(now - 31 * 60 * 1000);

  assert.equal(isSessionIdleExpired(lastActivity, now), true);
});

test("active sessions within idle window remain valid", () => {
  const now = Date.parse("2026-08-07T10:00:00.000Z");
  const lastActivity = new Date(now - 10 * 60 * 1000);

  assert.equal(isSessionIdleExpired(lastActivity, now), false);
});

test("long-lived active sessions are not forced out by an absolute cap", () => {
  const now = Date.parse("2026-08-07T18:00:00.000Z");
  const lastActivity = new Date(now - 5 * 60 * 1000);

  assert.equal(isSessionIdleExpired(lastActivity, now), false);
});

test("JWT exp claim is 30 minutes, not 8 hours", () => {
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
});
