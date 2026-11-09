// Short links such as bloomnetworks.net/discord. Stored as one flat list and served publicly,
// so each site's 404 page can look its path up and forward the visitor.

export const HOSTS = ["bloomnetworks.net", "yeeps.bloomnetworks.net", "monarch.bloomnetworks.net"];
export const MAX_REDIRECTS = 300;

const PATH = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/;

function fail(message) {
  throw new Error(message);
}

function cleanUrl(value) {
  if (typeof value !== "string" || value.length > 2000) fail("destination is missing or too long");
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    fail(`“${value}” is not a full web address (start with https://)`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") fail("destination must start with https://");
  return url.href;
}

export function validateRedirects(data) {
  const list = data?.redirects;
  if (!Array.isArray(list) || list.length > MAX_REDIRECTS) fail(`redirects must be a list of at most ${MAX_REDIRECTS}`);

  const seen = new Set();
  return list.map((row) => {
    if (!HOSTS.includes(row?.host)) fail("unknown site");
    const path = String(row?.path ?? "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    if (!PATH.test(path)) fail(`“${row?.path}” can only use letters, numbers, - and _`);
    const key = `${row.host}/${path}`;
    if (seen.has(key)) fail(`${key} is listed twice`);
    seen.add(key);
    return { host: row.host, path, url: cleanUrl(row.url) };
  });
}
