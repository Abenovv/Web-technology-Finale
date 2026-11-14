(function () {
  "use strict";
  const key = "sidequest-theme";
  const root = document.documentElement;
  const prefersLight = matchMedia("(prefers-color-scheme: light)");
  let choice = null;

  function savedTheme() {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  function paint() {
    const theme = choice || (prefersLight.matches ? "light" : "dark");
    root.dataset.bsTheme = theme;
    document
      .querySelector("#theme-toggle")
      ?.setAttribute("aria-pressed", String(theme === "dark"));
  }

  choice = savedTheme();
  paint();
  prefersLight.addEventListener("change", paint);
  addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      choice = savedTheme();
      paint();
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    paint();
    document.querySelector("#theme-toggle").addEventListener("click", () => {
      choice = root.dataset.bsTheme === "dark" ? "light" : "dark";
      paint();
      if (!window.UI.write(key, choice)) {
        window.UI.notice(
          "The theme changed here. Your browser could not remember it for other pages.",
        );
      }
    });
  });
})();
