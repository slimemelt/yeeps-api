import { passwordHtml } from "./password.js";
import { escapeHtml as e } from "../dom.js";
import { redirectsHtml } from "./redirects.js";

const itemActions = () =>
  `<div class="item-actions">
    <button data-act="up" aria-label="Move up">↑</button>
    <button data-act="down" aria-label="Move down">↓</button>
    <button data-act="del" aria-label="Delete">✕</button>
  </div>`;

function bannersTab(draft) {
  const items = draft.banners
    .map(
      (banner, i) => `<div class="item" data-k="banners" data-i="${i}">
        <div>
          <img class="thumb" src="${e(banner.src)}" alt="">
          <label>Alt text (describe the banner)<input type="text" data-f="alt" value="${e(banner.alt)}"></label>
        </div>
        ${itemActions()}
      </div>`
    )
    .join("");
  return `<div class="panel">
    <p class="note">Banner images show at the top of the home page. Best size is about 4:1 wide (for example 2400×590). The first one shows first.</p>
    ${items || '<p class="note">No banners yet.</p>'}
    <p><button class="btn" data-act="add-image" data-k="banners">+ Add banner image</button></p>
  </div>`;
}

function scheduleEntry(entry, i) {
  const isShow = entry.type === "show";
  const fields = isShow
    ? `<label>Time<input type="text" data-f="time" value="${e(entry.time)}" placeholder="3:00PM"></label>
       <label class="wide">Show name<input type="text" data-f="title" value="${e(entry.title)}"></label>
       <label class="wide">By (people, optional)<input type="text" data-f="by" value="${e(entry.by)}" placeholder="Onion, Yeep"></label>
       <label class="wide">Home page blurb (optional)<input type="text" data-f="desc" value="${e(entry.desc)}"></label>
       <div class="wide">
         <span class="check"><input type="checkbox" data-f="mature" ${entry.mature ? "checked" : ""}> * mature audiences</span>
         <span class="check"><input type="checkbox" data-f="flash" ${entry.flash ? "checked" : ""}> ^ flashing lights</span>
       </div>`
    : `<label class="wide">${entry.type === "heading" ? "Section heading" : "Divider text"}<input type="text" data-f="text" value="${e(entry.text)}"></label>
       <div class="wide"><span class="tag">${entry.type === "heading" ? "Section heading" : "In case you missed it divider"}</span></div>`;
  return `<div class="item" data-k="schedule" data-i="${i}"><div class="fields">${fields}</div>${itemActions()}</div>`;
}

function scheduleTab(draft) {
  return `<div class="panel">
    <p class="note">Shows appear on the schedule page in this order. The first four also appear in the schedule card on the home page. <b>By</b> adds a “by this person” line. “In case you missed it!” adds a divider for reruns.</p>
    ${draft.schedule.map(scheduleEntry).join("") || '<p class="note">Nothing scheduled yet.</p>'}
    <p>
      <button class="btn" data-act="add-entry" data-type="show">+ Show</button>
      <button class="btn" data-act="add-entry" data-type="heading">+ Section heading</button>
      <button class="btn" data-act="add-entry" data-type="recap">+ In case you missed it!</button>
    </p>
  </div>`;
}

function showsTab(draft) {
  const items = draft.shows
    .map(
      (show, i) => `<div class="item" data-k="shows" data-i="${i}">
        <div class="fields">
          <div><img class="thumb thumb--wide" src="${e(show.img)}" alt=""><button class="btn" data-act="replace-image">Replace image</button></div>
          <label class="wide">Title<input type="text" data-f="title" value="${e(show.title)}"></label>
          <label class="wide">Description<textarea data-f="desc">${e(show.desc)}</textarea></label>
        </div>
        ${itemActions()}
      </div>`
    )
    .join("");
  return `<div class="panel">
    <p class="note">Featured shows appear in the card on the home page. Card images are about 546×220 (wide). With two or more shows, visitors can swipe between them.</p>
    ${items || '<p class="note">No featured shows yet.</p>'}
    <p><button class="btn" data-act="add-image" data-k="shows">+ Add featured show</button></p>
  </div>`;
}

function textTab(draft) {
  const s = draft.settings;
  return `<div class="panel"><div class="fields">
    <label>Schedule date, like 11/7 (leave blank for today)<input type="text" data-set="date" value="${e(s.date)}" placeholder="11/7"></label>
    <label>Time zone note<input type="text" data-set="tz" value="${e(s.tz)}"></label>
    <label class="wide">Notes under the header (one per line)<textarea data-set="notes">${e(s.notes)}</textarea></label>
    <label class="wide">Sign-off at the bottom of the schedule<input type="text" data-set="closing" value="${e(s.closing)}"></label>
  </div></div>`;
}

function backupTab(draft) {
  return `<div class="panel">
    <p class="note">Copy this to keep a backup of this site, or paste a saved copy and press Import. Nothing changes until you press Save changes.</p>
    <textarea id="admin-backup" style="min-height:180px">${e(JSON.stringify(draft, null, 1))}</textarea>
    <p>
      <button class="btn" data-act="import">Import</button>
      <button class="btn" data-act="copy">Copy</button>
      <button class="btn" data-act="reset">Reset to the original content</button>
    </p>
  </div>`;
}

export const TABS = [
  ["banners", "Banners", bannersTab],
  ["schedule", "Schedule", scheduleTab],
  ["shows", "Featured shows", showsTab],
  ["text", "Page text", textTab],
  ["redirects", "Redirects", redirectsHtml],
  ["backup", "Backup", backupTab],
  ["password", "Password", passwordHtml],
];
