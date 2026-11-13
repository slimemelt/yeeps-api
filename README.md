# Yeeps API (Cloudflare Worker)

Stores site content in KV, images in the same KV namespace (no R2 needed), and guards edits behind a password login (PBKDF2 hash, HMAC-signed HttpOnly session cookie, login rate limit).

## Setup

    npm install
    # KV namespace "yeeps-content" is already created and set in wrangler.toml
    node scripts/hash-password.mjs                 # prints the hash for your password
    npx wrangler secret put ADMIN_PASSWORD_HASH
    npx wrangler secret put SESSION_SECRET         # long random string
    npx wrangler deploy

Set `ALLOWED_ORIGINS` in `wrangler.toml` to the site origin, attach a custom domain (e.g. api.bloomnetworks.net), then put that URL in the site's `js/config.js` as `API_BASE`.

## Preview

`/preview/` serves the files in `preview/` to signed-in admins only (everyone else gets a password form). Replace that folder with a copy of the site to test unreleased work, then deploy.

## Routes

`GET /redirects` (public) and `PUT /redirects` (admin) hold the short links; `GET /session`, `POST /login`, `POST /logout`, `POST /password` (admin; stores a new hash in KV, which overrides `ADMIN_PASSWORD_HASH`, and signs out other sessions), `GET|PUT /content/:site`, `POST /media`, `GET /media/:key`.

## Tests

    npm test
