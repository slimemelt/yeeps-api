import { SITES, validateContent } from "./content.js";
import { COOKIE_NAME, createSession, hashPassword, readCookie, sessionCookie, verifyPassword, verifySession } from "./auth.js";
import { corsHeaders, error, isTrustedOrigin, json } from "./http.js";
import { isPreviewPath, servePreview } from "./preview.js";
import { validateRedirects } from "./redirects.js";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);
const LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_SECONDS = 15 * 60;

const PASSWORD_KEY = "admin:password";
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;

// A password changed from the admin lives in KV and wins over the ADMIN_PASSWORD_HASH secret.
const storedPasswordHash = async (env) => (await env.CONTENT.get(PASSWORD_KEY)) || env.ADMIN_PASSWORD_HASH;

// Sessions are signed with the current password hash too, so changing the password signs everyone out.
const sessionSecret = async (env) => `${env.SESSION_SECRET}:${await storedPasswordHash(env)}`;

async function isAdmin(request, env) {
  return verifySession(await sessionSecret(env), readCookie(request, COOKIE_NAME));
}

async function login(request, env, cors) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `login:${ip}`;
  const attempts = Number(await env.CONTENT.get(key)) || 0;
  if (attempts >= LOGIN_ATTEMPTS) return error(429, "too many attempts", cors);

  let password = "";
  try {
    ({ password } = await request.json());
  } catch {
    return error(400, "invalid request", cors);
  }
  if (!(await verifyPassword(String(password), await storedPasswordHash(env)))) {
    await env.CONTENT.put(key, String(attempts + 1), { expirationTtl: LOGIN_WINDOW_SECONDS });
    return error(401, "wrong password", cors);
  }
  await env.CONTENT.delete(key);
  return json({ ok: true }, 200, { ...cors, "Set-Cookie": sessionCookie(await createSession(await sessionSecret(env))) });
}

async function changePassword(request, env, cors) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `login:${ip}`;
  const attempts = Number(await env.CONTENT.get(key)) || 0;
  if (attempts >= LOGIN_ATTEMPTS) return error(429, "too many attempts", cors);

  let current, next;
  try {
    ({ current, next } = await request.json());
  } catch {
    return error(400, "invalid request", cors);
  }
  if (typeof current !== "string" || typeof next !== "string") return error(400, "invalid request", cors);
  if (!(await verifyPassword(current, await storedPasswordHash(env)))) {
    await env.CONTENT.put(key, String(attempts + 1), { expirationTtl: LOGIN_WINDOW_SECONDS });
    return error(401, "wrong password", cors);
  }
  if (next.length < MIN_PASSWORD_LENGTH || next.length > MAX_PASSWORD_LENGTH) {
    return error(400, `new password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`, cors);
  }
  if (next === current) return error(400, "new password must be different", cors);

  await env.CONTENT.put(PASSWORD_KEY, await hashPassword(next));
  await env.CONTENT.delete(key);
  return json({ ok: true }, 200, { ...cors, "Set-Cookie": sessionCookie(await createSession(await sessionSecret(env))) });
}

async function readContent(site, env, cors) {
  const stored = await env.CONTENT.get(`content:${site}`);
  if (stored === null) return error(404, "no saved content", cors);
  return new Response(stored, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30", ...cors } });
}

async function writeContent(site, request, env, cors) {
  let clean;
  try {
    clean = validateContent(await request.json());
  } catch (problem) {
    return error(400, problem.message, cors);
  }
  await env.CONTENT.put(`content:${site}`, JSON.stringify(clean));
  return json({ ok: true }, 200, cors);
}

const REDIRECTS_KEY = "redirects";

// Public: every site's 404 page reads this to forward short links.
async function readRedirects(env) {
  const stored = await env.CONTENT.get(REDIRECTS_KEY);
  return new Response(stored ?? '{"redirects":[]}', {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30", "Access-Control-Allow-Origin": "*" },
  });
}

async function writeRedirects(request, env, cors) {
  let clean;
  try {
    clean = validateRedirects(await request.json());
  } catch (problem) {
    return error(400, problem.message, cors);
  }
  await env.CONTENT.put(REDIRECTS_KEY, JSON.stringify({ redirects: clean }));
  return json({ ok: true }, 200, cors);
}

async function uploadImage(request, env, cors) {
  const type = (request.headers.get("Content-Type") || "").split(";")[0];
  if (!IMAGE_TYPES.has(type)) return error(415, "unsupported image type", cors);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return error(413, "image is empty or too large", cors);
  const key = `${crypto.randomUUID()}.${type.split("/")[1]}`;
  await env.CONTENT.put(`media:${key}`, bytes, { metadata: { type } });
  return json({ url: new URL(`/media/${key}`, request.url).href }, 201, cors);
}

async function readImage(key, env) {
  const { value, metadata } = await env.CONTENT.getWithMetadata(`media:${key}`, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, {
    headers: {
      "Content-Type": metadata?.type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (isPreviewPath(pathname) && ["GET", "HEAD"].includes(request.method)) {
      return servePreview(request, env, await isAdmin(request, env));
    }

    // Uploaded images are public and cacheable; everything else answers to our own origins only.
    const media = pathname.match(/^\/media\/([\w.-]+)$/);
    if (media && request.method === "GET") return readImage(media[1], env);

    if (pathname === "/redirects" && request.method === "GET") return readRedirects(env);

    if (request.method !== "GET" && !isTrustedOrigin(request, env)) return error(403, "origin not allowed", cors);

    const content = pathname.match(/^\/content\/(\w+)$/);
    if (content && !SITES.includes(content[1])) return error(404, "unknown site", cors);

    if (pathname === "/session" && request.method === "GET") return json({ admin: await isAdmin(request, env) }, 200, cors);
    if (pathname === "/login" && request.method === "POST") return login(request, env, cors);
    if (pathname === "/logout" && request.method === "POST") {
      return json({ ok: true }, 200, { ...cors, "Set-Cookie": sessionCookie("", 0) });
    }
    if (content && request.method === "GET") return readContent(content[1], env, cors);

    // Everything below needs a signed-in admin.
    if (pathname === "/password" && request.method === "POST") {
      if (!(await isAdmin(request, env))) return error(401, "sign in first", cors);
      return changePassword(request, env, cors);
    }
    if (pathname === "/redirects" && request.method === "PUT") {
      if (!(await isAdmin(request, env))) return error(401, "sign in first", cors);
      return writeRedirects(request, env, cors);
    }
    const writes = (content && request.method === "PUT") || (pathname === "/media" && request.method === "POST");
    if (writes) {
      if (!(await isAdmin(request, env))) return error(401, "sign in first", cors);
      return content ? writeContent(content[1], request, env, cors) : uploadImage(request, env, cors);
    }
    return error(404, "not found", cors);
  },
};
