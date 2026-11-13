import { store } from "../store.js";

const MIN_LENGTH = 12;

const MESSAGES = {
  401: "That isn’t your current password.",
  429: "Too many tries. Wait a few minutes.",
};

// The Worker answers 401 both for a wrong current password and for an ended session.
const sessionEnded = (error) => error.status === 401 && error.message === "sign in first";

export function passwordHtml() {
  return `<form class="panel" id="admin-password" autocomplete="off">
    <p class="note">Pick something at least ${MIN_LENGTH} characters long. Changing it signs out every other device.</p>
    <div class="fields">
      <label class="wide">Current password<input type="password" name="current" autocomplete="current-password" required></label>
      <label class="wide">New password<input type="password" name="next" autocomplete="new-password" minlength="${MIN_LENGTH}" required></label>
      <label class="wide">New password again<input type="password" name="again" autocomplete="new-password" required></label>
    </div>
    <p><button class="btn-primary" type="submit">Change password</button></p>
    <p class="note" id="admin-password-message" role="status"></p>
  </form>`;
}

/** Submit handler for the form above. `ui.signedOut` runs if the session has already ended. */
export async function onPasswordSubmit(form, ui) {
  const message = form.querySelector("#admin-password-message");
  const data = new FormData(form);
  const [current, next, again] = ["current", "next", "again"].map((name) => data.get(name));
  if (next.length < MIN_LENGTH) return void (message.textContent = `Use at least ${MIN_LENGTH} characters.`);
  if (next !== again) return void (message.textContent = "The new passwords don’t match.");
  if (next === current) return void (message.textContent = "Pick a password you haven’t used here.");
  try {
    await store.changePassword(current, next);
  } catch (error) {
    if (sessionEnded(error)) return ui.signedOut();
    message.textContent = MESSAGES[error.status] ?? "Couldn’t reach the server.";
    return;
  }
  form.reset();
  message.textContent = "Password changed. Other devices have been signed out.";
}
