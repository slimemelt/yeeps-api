// The shape the front end expects. Anything else is rejected before it reaches storage.

export const SITES = ["ch", "ds"];
export const MAX_CONTENT_BYTES = 200_000;

const ENTRY_TYPES = new Set(["show", "heading", "recap"]);
const isText = (value, max) => typeof value === "string" && value.length <= max;

// Images are either shipped with the site or uploaded to /media on this Worker.
const isImageUrl = (value) => isText(value, 500) && (/^assets\/img\/[\w./-]+$/.test(value) || /^https:\/\/[^\s"'<>]+$/.test(value));

// A banner link is a web address or a page on the site itself (#schedule); anything else is dropped.
const isLink = (value) => isText(value, 500) && (/^https?:\/\/[^\s"'<>]+$/i.test(value) || /^#[\w/-]+$/.test(value));

function fail(message) {
  throw new Error(message);
}

export function validateContent(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("content must be an object");
  const { banners, schedule, shows, settings } = data;
  if (!Array.isArray(banners) || banners.length > 20) fail("banners must be a list of at most 20");
  if (!Array.isArray(schedule) || schedule.length > 200) fail("schedule must be a list of at most 200");
  if (!Array.isArray(shows) || shows.length > 50) fail("shows must be a list of at most 50");
  if (!settings || typeof settings !== "object") fail("settings are missing");

  const clean = {
    banners: banners.map((b) => {
      if (!isImageUrl(b?.src)) fail("banner image is not allowed");
      const banner = { src: b.src, alt: isText(b.alt, 300) ? b.alt : "" };
      if (isLink(b.link)) banner.link = b.link;
      return banner;
    }),
    schedule: schedule.map((e) => {
      if (!ENTRY_TYPES.has(e?.type)) fail("unknown schedule entry type");
      if (e.type !== "show") return { type: e.type, text: isText(e.text, 200) ? e.text : "" };
      return {
        type: "show",
        time: isText(e.time, 40) ? e.time : "",
        title: isText(e.title, 200) ? e.title : "",
        by: isText(e.by, 200) ? e.by : "",
        desc: isText(e.desc, 500) ? e.desc : "",
        mature: e.mature === true,
        flash: e.flash === true,
      };
    }),
    shows: shows.map((s) => {
      if (!isImageUrl(s?.img)) fail("show image is not allowed");
      return { title: isText(s.title, 200) ? s.title : "", desc: isText(s.desc, 2000) ? s.desc : "", img: s.img };
    }),
    settings: {},
  };
  for (const key of ["date", "tz", "notes", "closing"]) {
    clean.settings[key] = isText(settings[key], 500) ? settings[key] : "";
  }
  if (JSON.stringify(clean).length > MAX_CONTENT_BYTES) fail("content is too large");
  return clean;
}
