(function () {
  "use strict";
  const S = window.Sidequest;
  const U = window.UI;
  const output = document.querySelector("#recommendations");
  const minutesInput = document.querySelector("#minutes");
  const minutesError = document.querySelector("#minutes-error");
  const mood = document.querySelector("#mood");
  const list = document.querySelector("#saved-games");
  const total = document.querySelector("#saved-total");
  const clear = document.querySelector("#clear-games");

  function recommend() {
    const minutes = Number(minutesInput.value);
    const invalid = !Number.isInteger(minutes) || minutes < 10 || minutes > 180;
    minutesError.textContent = invalid
      ? "Enter a whole number from 10 to 180."
      : "";
    minutesInput.setAttribute("aria-invalid", String(invalid));
    output.replaceChildren();
    if (invalid) return;
    const saved = U.savedIds();
    const found = S.filterSessions("", mood.value, "short")
      .filter((s) => s.minutes <= minutes)
      .slice(0, 3);
    if (!found.length)
      output.append(
        U.element(
          "p",
          "No sessions fit that time. Try at least 20 minutes or another mood.",
          "empty-state",
        ),
      );
    else
      found.forEach((s) =>
        output.append(U.sessionCard(s, saved.includes(s.id))),
      );
    U.reveal(output);
  }
  document.querySelector("#recommend").addEventListener("click", recommend);
  mood.addEventListener("change", recommend);
  minutesInput.addEventListener("input", recommend);
  minutesInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") recommend();
  });

  function renderSaved(ids) {
    const sessions = S.sessions.filter((session) => ids.includes(session.id));
    const keepFocus = list.contains(document.activeElement);
    const cards = sessions.map((session) => {
      const card = U.sessionCard(session, true);
      card.id = "saved-" + session.id;
      return card;
    });
    if (!cards.length) {
      cards.push(
        U.element(
          "p",
          "Save a session to start your shortlist.",
          "empty-state",
        ),
      );
    }
    list.replaceChildren(...cards);
    clear.disabled = !sessions.length;
    total.textContent = `${sessions.length} saved · ${S.total(sessions, "minutes")} minutes in total`;
    if (keepFocus) (list.querySelector("[data-save]") || total).focus();
  }
  clear.addEventListener("click", () => {
    if (U.saveIds([])) total.focus();
  });
  document.addEventListener("shortlist-change", (event) =>
    renderSaved(event.detail),
  );
  recommend();
  renderSaved(U.savedIds());
})();
