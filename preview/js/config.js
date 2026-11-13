// Everything that is likely to change between environments or releases lives here.

export const STREAM_URL = "https://watch.mistlive.tv/hls/yeeps/playlist.m3u8";
export const HLSJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.17/hls.min.js";

// Base URL of the Cloudflare Worker (see /worker in the repo root).
// Leave empty to run without a backend: the admin is then limited to local development.
export const API_BASE = "https://api.bloomnetworks.net";

// Without a backend the admin only edits a private copy in the visitor's browser,
// so it is limited to local development. With API_BASE set it is available everywhere.
const isLocalHost = ["localhost", "127.0.0.1"].includes(location.hostname);
export const ADMIN_ENABLED = Boolean(API_BASE) || isLocalHost;

// Sites that can have short links (must match HOSTS in the Worker).
export const REDIRECT_HOSTS = ["bloomnetworks.net", "yeeps.bloomnetworks.net", "monarch.bloomnetworks.net"];

export const SITES = {
  ch: { key: "ch", name: "Yeeps Channel", file: "channel.json" },
  ds: { key: "ds", name: "Yeeps Don’t Sleep", file: "dont-sleep.json" },
};

// Hash route -> view name. Anything not listed is the home view.
export const ROUTES = {
  "#dmca": "dmca",
  "#schedule": "schedule",
  "#watch": "watch",
  "#fundings": "fund",
  "#applications": "apps",
  "#admin": "admin",
};

export const VIEW_TITLES = {
  dmca: "DMCA",
  schedule: "Schedule",
  watch: "Watch",
  fund: "Fundings",
  apps: "Applications",
  apply: "Application",
  admin: "Admin",
};

// Where the hand-drawn underline sits under the active menu item: [left %, top %, width %].
export const MENU_UNDERLINE = {
  home: [3.744, 22.832, 23.305],
  schedule: [3.534, 34.336, 44.89],
  watch: [3.534, 45.044, 25.788],
  fund: [3.534, 55.75, 44.0],
};

export const DESIGN_WIDTH = 1047; // width of the Figma artboard, in px
export const SITE_STORAGE_KEY = "ypch-site";
