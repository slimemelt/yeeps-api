// Password check and signed session cookie. Everything uses WebCrypto, which Workers and Node both provide.

const encoder = new TextEncoder();
export const SESSION_SECONDS = 12 * 60 * 60;
export const COOKIE_NAME = "session";

const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex) => Uint8Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16));

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

// Stored format: pbkdf2$<iterations>$<salt hex>$<hash hex>  (see scripts/hash-password.mjs)
export async function hashPassword(password, iterations = 100_000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(await pbkdf2(password, salt, iterations))}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored || "").split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !hash) return false;
  const candidate = await pbkdf2(password, fromHex(salt), Number(iterations));
  return timingSafeEqual(candidate, fromHex(hash));
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export async function createSession(secret, now = Date.now()) {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${expires}.${toHex(await hmac(secret, String(expires)))}`;
}

export async function verifySession(secret, token, now = Date.now()) {
  const [expires, signature] = String(token || "").split(".");
  if (!expires || !signature || Number(expires) < Math.floor(now / 1000)) return false;
  return timingSafeEqual(await hmac(secret, expires), fromHex(signature));
}

export function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

export const sessionCookie = (token, maxAge = SESSION_SECONDS) =>
  `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
