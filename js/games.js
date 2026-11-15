(function () {
  "use strict";
  const S = window.Sidequest,
    U = window.UI;
  let compared = [];
  const search = document.querySelector("#search"),
    genre = document.querySelector("#genre"),
    sort = document.querySelector("#sort"),
    savedOnly = document.querySelector("#saved-only");
  function comparison() {
    const host = document.querySelector("#comparison");
    host.replaceChildren();
    if (!compared.length) {
      host.append(
        U.element(
          "p",
          "No sessions selected. Use Compare on a card.",
          "empty-state",
        ),
      );
      return;
    }
    const selected = S.sessions.filter((s) => compared.includes(s.id)),
      list = U.element("div", undefined, "comparison-grid");
    selected.forEach((s) => {
      const card = U.element("article", undefined, "work-panel");
      card.append(
        U.element("h3", s.title),
        U.element("p", `${s.genre} · ${s.minutes} minutes`),
      );
      const remove = U.element(
        "button",
        "Remove " + s.title,
        "button secondary",
      );
      remove.addEventListener("click", () => {
        compared = compared.filter((id) => id !== s.id);
        render();
        const compareButton = document
          .getElementById(s.id)
          ?.querySelector(".compare-button");
        (compareButton || search).focus();
      });
      card.append(remove);
      list.append(card);
    });
    host.append(
      list,
      U.element(
        "p",
        `Combined session time: ${S.total(selected, "minutes")} minutes`,
      ),
    );
  }
  function render(saved = U.savedIds()) {
    const found = S.filterSessions(
        search.value,
        genre.value,
        sort.value,
      ).filter((session) => !savedOnly.checked || saved.includes(session.id)),
      host = document.querySelector("#catalog");
    host.replaceChildren();
    document.querySelector("#game-count").textContent =
      `${found.length} of ${S.sessions.length} sessions`;
    const empty = document.querySelector("#catalog-empty");
    empty.hidden = Boolean(found.length);
    empty.textContent =
      savedOnly.checked && !saved.length
        ? "Save a session to see it here."
        : "No matches. Try another search or reset the filters.";
    found.forEach((s) => {
      const card = U.sessionCard(s, saved.includes(s.id)),
        button = U.element(
          "button",
          compared.includes(s.id) ? "Comparing" : "Compare",
          "button compare-button",
        );
      button.setAttribute("aria-label", `Compare ${s.title}`);
      button.setAttribute("aria-pressed", String(compared.includes(s.id)));
      button.disabled = compared.length >= 3 && !compared.includes(s.id);
      button.addEventListener("click", () => {
        compared = compared.includes(s.id)
          ? compared.filter((id) => id !== s.id)
          : [...compared, s.id];
        render();
        document.querySelector(`[aria-label="Compare ${s.title}"]`)?.focus();
      });
      card.querySelector(".card-body").append(button);
      host.append(card);
    });
    comparison();
  }
  for (const filter of [search, genre, sort, savedOnly]) {
    filter.addEventListener("input", () => render());
  }
  document.addEventListener("shortlist-change", (event) => {
    if (!savedOnly.checked) return;
    const focusedSave = document.activeElement?.matches("[data-save]");
    render(event.detail);
    if (focusedSave)
      (document.querySelector("#catalog [data-save]") || savedOnly).focus();
  });
  function resetFilters() {
    search.value = "";
    genre.value = "all";
    sort.value = "title";
    savedOnly.checked = false;
    render();
  }
  document.querySelector("#reset-filters").addEventListener("click", () => {
    resetFilters();
    search.focus();
  });
  for (const link of document.querySelectorAll(".game-world")) {
    link.addEventListener("click", () => {
      if (!document.getElementById(link.hash.slice(1))) resetFilters();
    });
  }
  render();
  if (location.hash)
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
})();
