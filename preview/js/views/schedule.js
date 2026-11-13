import { $, escapeHtml } from "../dom.js";
import { state } from "../state.js";
import { getContent } from "../content.js";

const HOME_ROWS = 4;

// "11/7" in New York time, used when the admin leaves the date blank.
function todayEastern() {
  try {
    return new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", month: "numeric", day: "numeric" });
  } catch {
    return "";
  }
}

function eventMarkup(entry) {
  if (entry.type === "heading") return `<li class="event-section">${escapeHtml(entry.text)}</li>`;
  if (entry.type === "recap") {
    return `<li class="event-recap"><i></i><span>${escapeHtml(entry.text || "in case you missed it!")}</span></li>`;
  }
  const marks = (entry.mature ? "*" : "") + (entry.flash ? "^" : "");
  const by = entry.by ? `<p class="by">by ${escapeHtml(entry.by)}</p>` : "";
  return `<li class="event"><time>${escapeHtml(entry.time)}</time><h3>${escapeHtml(entry.title)}${marks}</h3>${by}</li>`;
}

// The cards on the home and watch views list the first few shows.
export function renderScheduleRows() {
  const shows = getContent(state.site).schedule.filter((entry) => entry.type === "show").slice(0, HOME_ROWS);
  const markup = shows
    .map(
      (show) =>
        `<div class="schedule-row"><time>${escapeHtml(show.time)}</time><h3>${escapeHtml(show.title)}</h3><p>${escapeHtml(show.desc || "")}</p></div>`
    )
    .join("");
  $("home-rows").innerHTML = markup;
  $("watch-rows").innerHTML = markup;
}

export function renderSchedulePage() {
  const { schedule, settings } = getContent(state.site);
  const date = (settings.date || todayEastern()).trim().replace(/^\(|\)$/g, "");
  $("schedule-date").textContent = state.site === "ch" ? `(${date})` : date;
  $("schedule-timezone").textContent = settings.tz;
  $("schedule-notes").innerHTML = escapeHtml(settings.notes).replace(/\n/g, "<br>");
  $("schedule-closing").textContent = settings.closing;
  $("events").innerHTML = schedule.length
    ? schedule.map(eventMarkup).join("")
    : '<li class="schedule-empty">Nothing scheduled yet.</li>';
}
