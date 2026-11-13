import { $ } from "../dom.js";
import { API_BASE } from "../config.js";

let loaded;

function loadApplications() {
  loaded ??= fetch("content/applications.json")
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.statusText))))
    .then((data) => data.applications)
    .catch(() => []);
  return loaded;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function shield() {
  const img = el("img", "app-shield");
  img.alt = "";
  img.src = "assets/img/apps-shield.svg";
  return img;
}

export async function renderApplicationsPage() {
  const list = $("apps-list");
  const applications = await loadApplications();
  list.replaceChildren(
    ...applications.map((app) => {
      const card = el("a", "app-card");
      card.href = `#apply/${app.id}`;
      const head = el("div", "app-card-head");
      head.append(shield(), el("h2", "app-card-title", app.title));
      const action = el("span", app.open ? "app-go" : "app-go closed", app.open ? "Apply" : "Closed");
      card.append(head, el("p", "app-card-text", app.summary), action);
      const item = el("li");
      item.append(card);
      return item;
    }),
  );
}

function questionField(question, open) {
  const name = `q-${question.id}`;
  if (question.type === "choice") {
    const list = el("ul", "q-options");
    question.options.forEach((option) => {
      const label = el("label");
      const input = el("input");
      Object.assign(input, { type: "radio", name, value: option, disabled: !open });
      label.append(input, el("span", null, option));
      const item = el("li");
      item.append(label);
      list.append(item);
    });
    return list;
  }
  const field = question.type === "long" ? el("textarea", "q-long") : el("input", "q-short");
  Object.assign(field, { name, placeholder: question.placeholder ?? "write your response here...", disabled: !open });
  if (question.type !== "long") field.type = "text";
  field.maxLength = 2000;
  return field;
}

function questionCard(question, open) {
  const card = el("section", "q-card");
  card.dataset.id = question.id;
  const title = el("h2", "q-title", question.title);
  card.append(el("div", "q-head"), questionField(question, open));
  card.firstChild.append(title);
  return card;
}

async function submit(app, form, status) {
  const answers = app.questions.map((question) => {
    const field = form.elements[`q-${question.id}`];
    return { id: question.id, answer: (field.value ?? "").trim() };
  });
  if (answers.some((entry) => !entry.answer)) {
    status.textContent = "answer every question first.";
    return;
  }
  status.textContent = "sending…";
  try {
    const response = await fetch(`${API_BASE}/applications/${app.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (!response.ok) throw new Error(String(response.status));
    form.replaceChildren(el("p", "apply-note", "thanks! we’ll message you on Discord."));
  } catch {
    status.textContent = "couldn’t send that. try again in a bit.";
  }
}

export async function renderApplicationPage(id) {
  const body = $("apply-body");
  const app = (await loadApplications()).find((entry) => entry.id === id);
  if (!app) {
    const back = el("a", "plain-link", "back to applications");
    back.href = "#applications";
    body.replaceChildren(el("h1", "apply-title", "Not found"), back);
    return;
  }

  const head = el("div", "apply-head");
  head.append(shield(), el("h1", "apply-title", app.title));

  const intro = el("div", "apply-intro");
  app.intro.forEach((block) => {
    intro.append(el("p", null, block.p));
    if (block.list) {
      const list = el("ul");
      block.list.forEach((line) => list.append(el("li", null, line)));
      intro.append(list);
    }
  });

  const form = el("form", "apply-form");
  form.noValidate = true;
  form.append(el("div", "apps-rule"));
  if (!app.open) form.append(el("p", "apply-note", "this application is closed right now."));
  app.questions.forEach((question) => form.append(questionCard(question, app.open)));
  if (app.open) {
    const status = el("p", "apply-status");
    status.setAttribute("role", "status");
    const send = el("button", "apply-send", "Submit");
    send.type = "submit";
    form.append(send, status);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(app, form, status);
    });
  }
  body.replaceChildren(head, intro, form);
  document.title = `${app.title} – ${document.title.split(" – ").pop()}`;
}
