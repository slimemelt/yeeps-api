import test from "node:test";
import assert from "node:assert/strict";
import { createSession, hashPassword, verifyPassword, verifySession } from "../src/auth.js";

test("a password verifies against its own hash only", async () => {
  const stored = await hashPassword("correct horse", 1000);
  assert.equal(await verifyPassword("correct horse", stored), true);
  assert.equal(await verifyPassword("wrong horse", stored), false);
});

test("malformed stored hashes never verify", async () => {
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "plain-text"), false);
});

test("sessions verify until they expire and reject tampering", async () => {
  const now = Date.now();
  const token = await createSession("secret", now);
  assert.equal(await verifySession("secret", token, now + 1000), true);
  assert.equal(await verifySession("other-secret", token, now + 1000), false);
  assert.equal(await verifySession("secret", token, now + 13 * 3600 * 1000), false);
  const [expires, signature] = token.split(".");
  assert.equal(await verifySession("secret", `${Number(expires) + 99999}.${signature}`, now), false);
});
