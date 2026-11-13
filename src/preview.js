// Admin-only preview of unreleased site work, served from the Worker's static assets.
// Every request passes through here first, so nothing in /preview is reachable without a session.

const PREFIX = "/preview";

const LOGIN_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sign in</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 16px system-ui, sans-serif; background: #1b0a63; color: #fff; }
  form { display: grid; gap: 12px; width: min(320px, 86vw); }
  input, button { font: inherit; padding: 12px; border: 0; border-radius: 10px; }
  button { background: #fbb110; font-weight: 700; cursor: pointer; }
  p { margin: 0; min-height: 1.2em; color: #ff7aa8; }
</style>
</head>
<body>
<form id="form">
  <input id="password" type="password" placeholder="Admin password" autocomplete="current-password" required>
  <button>Sign in</button>
  <p id="status" role="alert"></p>
</form>
<script>
  document.getElementById("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("status");
    status.textContent = "";
    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: document.getElementById("password").value }),
      });
      if (response.ok) return location.reload();
      status.textContent = response.status === 429 ? "Too many attempts, try again later." : "Wrong password.";
    } catch {
      status.textContent = "Couldn't reach the server.";
    }
  });
</script>
</body>
</html>`;

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export const isPreviewPath = (pathname) => pathname === PREFIX || pathname.startsWith(`${PREFIX}/`);

export async function servePreview(request, env, admin) {
  const url = new URL(request.url);
  if (url.pathname === PREFIX) return Response.redirect(`${url.origin}${PREFIX}/`, 301);

  if (!admin) {
    return new Response(LOGIN_PAGE, {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE_HEADERS },
    });
  }

  const path = url.pathname.slice(PREFIX.length);
  const assetUrl = new URL(path.endsWith("/") ? `${path}index.html` : path, url.origin);
  const response = await env.ASSETS.fetch(new Request(assetUrl, request));
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}
