(function () {
  "use strict";
  const S = window.Sidequest;
  const savedKey = "sidequest-sessions";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const duration = () => (reducedMotion.matches ? 0 : 180);
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function notice(message) {
    let node = document.querySelector("#device-notice");
    if (!node) {
      node = element("p", "", "shell device-notice");
      node.id = "device-notice";
      node.setAttribute("role", "status");
      document.querySelector("main").prepend(node);
    }
    node.textContent = message;
  }
  function readIds(key, records) {
    const value = read(key, []);
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter((id) => records.some((item) => item.id === id)),
          ),
        ]
      : [];
  }
  function savedIds() {
    return readIds(savedKey, S.sessions);
  }
  function showSavedIds(ids) {
    document.dispatchEvent(
      new CustomEvent("shortlist-change", { detail: ids }),
    );
  }
  function saveIds(ids) {
    if (!write(savedKey, ids)) {
      notice("Your browser could not save the shortlist.");
      return false;
    }
    showSavedIds(ids);
    return true;
  }
  function toggleSaved(id) {
    const current = savedIds();
    const next = current.includes(id)
      ? current.filter((saved) => saved !== id)
      : [...current, id];
    return saveIds(next) ? next : null;
  }
  function labelSaveButton(button, saved) {
    button.textContent = saved ? "Remove from shortlist" : "Save session";
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute(
      "aria-label",
      `${saved ? "Remove" : "Save"} ${button.dataset.sessionTitle}`,
    );
  }
  function sessionCard(session, saved = savedIds().includes(session.id)) {
    const card = element("article", undefined, "game-card");
    card.id = session.id;
    const image = document.createElement("img");
    image.src = `assets/images/${session.image}.webp`;
    image.alt = S.artwork[session.image];
    image.width = 1200;
    image.height = 800;
    image.loading = "lazy";
    card.append(image);
    const body = element("div", undefined, "card-body");
    body.append(
      element("span", session.genre, "tag"),
      element("h3", session.title),
      element("p", session.description),
      element("p", `${session.minutes} minutes`),
    );
    const button = element("button", undefined, "button secondary");
    button.type = "button";
    button.dataset.save = session.id;
    button.dataset.sessionTitle = session.title;
    labelSaveButton(button, saved);
    button.addEventListener("click", () => toggleSaved(session.id));
    body.append(button);
    const isExpedition = session.world === "Emberwake";
    const link = element(
      "a",
      isExpedition ? "Plan an expedition →" : "Playtest preferences →",
      "text-link",
    );
    link.href = isExpedition
      ? `emberwake.html?route=${encodeURIComponent(session.id)}#expedition`
      : `community.html?game=${encodeURIComponent(session.world)}#playtest`;
    body.append(link);
    card.append(body);
    return card;
  }
  function updateSavedControls(ids) {
    const count = document.querySelector("#nav-saved-count");
    if (count.textContent !== String(ids.length)) {
      count.textContent = ids.length;
      count.classList.remove("count-changed");
      if (!reducedMotion.matches) {
        requestAnimationFrame(() => count.classList.add("count-changed"));
      }
    }
    document.querySelectorAll("[data-save]").forEach((button) => {
      labelSaveButton(button, ids.includes(button.dataset.save));
    });
  }
  updateSavedControls(savedIds());
  document.addEventListener("shortlist-change", (event) =>
    updateSavedControls(event.detail),
  );
  window.addEventListener("storage", (event) => {
    if (event.key === savedKey || event.key === null) {
      showSavedIds(savedIds());
    }
  });
  // Finish the previous effect and clear its queue before a repeated click.
  $(".help-toggle").on("click", function () {
    const open = this.getAttribute("aria-expanded") !== "true";
    this.setAttribute("aria-expanded", String(open));
    const panel = $("#" + this.getAttribute("aria-controls"));
    panel.stop(true, true);
    if (open) panel.removeAttr("hidden").hide().slideDown(duration());
    else panel.slideUp(duration(), () => panel.attr("hidden", ""));
  });
  $("[data-scroll]").on("click", function (event) {
    event.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    $("html, body").stop(true).animate({ scrollTop: 0 }, duration());
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });

  const navigation = document.querySelector("#main-navigation");
  const menu = document.querySelector(".navbar-toggler");
  const collapse = bootstrap.Collapse.getOrCreateInstance(navigation, {
    toggle: false,
  });
  navigation.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !navigation.classList.contains("show"))
      return;
    collapse.hide();
    menu.focus();
  });
  navigation.querySelectorAll('a[href*="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      collapse.hide();
    });
  });
  function reveal(node) {
    $(node).stop(true, true).removeAttr("hidden").hide().fadeIn(duration());
  }
  function bindForm(form, onValid) {
    if (!form) return;
    const fields = [...form.querySelectorAll("input,select,textarea")];
    const feedback = form.querySelector(".form-feedback");
    let attempted = false;
    function valueOf(field) {
      return field.type === "checkbox" ? field.checked : field.value.trim();
    }
    function showFieldError(field, error) {
      document.getElementById(field.id + "-error").textContent = error;
      field.classList.toggle("is-invalid", Boolean(error));
      field.setAttribute("aria-invalid", String(Boolean(error)));
    }
    function check(field) {
      const error = S.validate(field.name, valueOf(field), form.dataset.form);
      showFieldError(field, error);
      return !error;
    }
    function hideFeedback() {
      $(feedback).stop(true, true).hide().attr("hidden", "");
    }
    for (const field of fields) {
      function onEdit() {
        if (attempted || field.dataset.touched) check(field);
        hideFeedback();
      }
      field.addEventListener("input", onEdit);
      field.addEventListener("change", onEdit);
      field.addEventListener("blur", () => {
        field.dataset.touched = "true";
        check(field);
      });
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      attempted = true;
      const invalidFields = fields.filter((field) => !check(field));
      if (invalidFields.length) {
        hideFeedback();
        invalidFields[0].focus();
        return;
      }
      const data = Object.fromEntries(
        fields.map((field) => [field.name, valueOf(field)]),
      );
      const result = onValid(data);
      if (result.ok) {
        form.reset();
        attempted = false;
        for (const field of fields) {
          delete field.dataset.touched;
          showFieldError(field, "");
          field.removeAttribute("aria-invalid");
        }
        form.dispatchEvent(new Event("local-save"));
      }
      feedback.classList.toggle("feedback-error", !result.ok);
      feedback.textContent = result.message;
      reveal(feedback);
    });
  }
  const wishlist = document.querySelector("#wishlist-button");
  if (wishlist) {
    function refresh(ids) {
      const saved = ids.includes("emberwake");
      wishlist.textContent = saved ? "Saved to my list ✓" : "Add to my list +";
      wishlist.setAttribute("aria-pressed", String(saved));
    }
    try {
      if (
        localStorage.getItem("sidequest-emberwake") === "saved" &&
        localStorage.getItem(savedKey) === null
      )
        write(savedKey, ["emberwake"]);
    } catch {
      /* Browsing still works when storage is unavailable. */
    }
    document.addEventListener("shortlist-change", (event) =>
      refresh(event.detail),
    );
    showSavedIds(savedIds());
    wishlist.addEventListener("click", () => {
      const ids = toggleSaved("emberwake");
      if (!ids) return;
      document.querySelector("#wishlist-message").textContent = ids.includes(
        "emberwake",
      )
        ? "Saved on this device."
        : "Removed from your list.";
    });
  }
  window.UI = {
    element,
    read,
    write,
    readIds,
    savedIds,
    saveIds,
    sessionCard,
    bindForm,
    reveal,
    notice,
  };
})();
