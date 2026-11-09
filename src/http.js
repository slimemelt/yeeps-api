// Small helpers for CORS and JSON responses.

export function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// State-changing requests must come from one of our own pages.
export function isTrustedOrigin(request, env) {
  return allowedOrigins(env).includes(request.headers.get("Origin"));
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export const error = (status, message, headers = {}) => json({ error: message }, status, headers);
