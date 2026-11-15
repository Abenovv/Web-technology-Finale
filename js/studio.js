(function () {
  "use strict";
  const S = window.Sidequest,
    U = window.UI;
  const taskKey = "sidequest-production-tasks";
  const capacityKey = "sidequest-weekly-capacity";
  const capacity = document.querySelector("#weekly-capacity");
  const disciplineFilter = document.querySelector("#discipline");
  const disciplineCards = document.querySelectorAll("[data-discipline]");
  const storedCapacity = U.read(capacityKey, 5);
  if ([2, 5, 10, 15].includes(storedCapacity)) capacity.value = storedCapacity;
  let selected = U.readIds(taskKey, S.tasks);
  function render() {
    const discipline = disciplineFilter.value,
      found = S.tasks.filter(
        (t) => discipline === "all" || t.discipline === discipline,
      ),
      host = document.querySelector("#roadmap");
    host.replaceChildren();
    disciplineCards.forEach((card) => {
      card.setAttribute(
        "aria-pressed",
        String(card.dataset.discipline === discipline),
      );
    });
    document.querySelector("#task-count").textContent =
      `${found.length} ${found.length === 1 ? "task" : "tasks"}`;
    found.forEach((t) => {
      const card = U.element("article", undefined, "roadmap-card");
      card.append(
        U.element("span", t.discipline, "tag"),
        U.element("h3", t.title),
        U.element("p", t.detail),
        U.element("p", `${t.hours} estimated hours`),
      );
      const label = U.element("label", undefined, "task-choice"),
        input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selected.includes(t.id);
      input.setAttribute("aria-label", `Include ${t.title}`);
      input.addEventListener("change", () => {
        const next = input.checked
          ? [...selected, t.id]
          : selected.filter((id) => id !== t.id);
        if (!U.write(taskKey, next)) {
          input.checked = !input.checked;
          U.notice("Your browser could not save the task selection.");
          return;
        }
        selected = next;
        updateTotal();
      });
      label.append(input, document.createTextNode(" Include in estimate"));
      card.append(label);
      host.append(card);
    });
    updateTotal();
  }
  function updateTotal() {
    document.querySelector("#reset-production").disabled = selected.length === 0;
    const tasks = S.tasks.filter((t) => selected.includes(t.id));
    const total = S.total(tasks, "hours");
    document.querySelector("#production-total").textContent =
      `${tasks.length} selected tasks · ${total} estimated hours`;
    const weeks = Math.ceil(total / Number(capacity.value));
    document.querySelector("#production-weeks").textContent = weeks
      ? `About ${weeks} ${weeks === 1 ? "week" : "weeks"} at ${capacity.value} hours per week.`
      : "Select tasks to estimate how many weeks they will take.";
  }
  capacity.addEventListener("change", () => {
    if (!U.write(capacityKey, Number(capacity.value)))
      U.notice("Your browser could not remember the weekly hours for later.");
    updateTotal();
  });
  disciplineFilter.addEventListener("change", render);
  disciplineCards.forEach((card) => {
    card.addEventListener("click", () => {
      const discipline = card.dataset.discipline;
      disciplineFilter.value =
        disciplineFilter.value === discipline ? "all" : discipline;
      render();
    });
  });
  document.querySelector("#reset-production").addEventListener("click", () => {
    if (!U.write(taskKey, [])) {
      U.notice("Your browser could not clear the task selection.");
      return;
    }
    selected = [];
    render();
    disciplineFilter.focus();
  });
  const briefKey = "sidequest-collaboration";
  const date = document.querySelector("#collaboration-start");
  const today = new Date();
  const limit = new Date(today);
  limit.setFullYear(limit.getFullYear() + 1);
  function localDate(day) {
    return [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, "0"),
      String(day.getDate()).padStart(2, "0"),
    ].join("-");
  }
  date.min = localDate(today);
  date.max = localDate(limit);

  const history = document.querySelector("#collaboration-history");
  const saved = document.querySelector("#collaboration-saved");
  const empty = document.querySelector("#collaboration-empty");
  const historyError = document.querySelector("#collaboration-history-error");
  function readBriefs() {
    const stored = U.read(briefKey, []);
    const entries = Array.isArray(stored) ? stored : [stored];
    return entries.filter(
      (brief) =>
        brief &&
        typeof brief.name === "string" &&
        ["Design", "Art", "Code", "Testing"].includes(brief.role) &&
        Number.isInteger(brief.hours) &&
        Number.isInteger(brief.total) &&
        Number.isInteger(brief.weeks),
    );
  }
  function showSaved(briefs) {
    history.replaceChildren();
    empty.hidden = briefs.length > 0;
    saved.hidden = briefs.length === 0;
    historyError.textContent = "";
    for (const brief of briefs) {
      const item = U.element("li");
      item.append(
        U.element("h4", `${brief.name} · ${brief.role}`),
        U.element(
          "p",
          `${brief.hours} hours/week · ${brief.weeks} ${brief.weeks === 1 ? "week" : "weeks"} for ${brief.total} hours of tasks`,
        ),
      );
      if (typeof brief.start === "string" && brief.start)
        item.append(U.element("p", `Preferred start: ${brief.start}`));
      if (typeof brief.message === "string" && brief.message)
        item.append(U.element("p", brief.message));
      history.append(item);
    }
  }
  document.querySelector("#clear-collaboration").addEventListener("click", () => {
    if (U.write(briefKey, [])) {
      showSaved([]);
      document.querySelector("#brief-history-title").focus();
    } else {
      historyError.textContent = "Your browser could not clear the brief history.";
    }
  });
  U.bindForm(document.querySelector("#collaboration-form"), (data) => {
    const hours = Number(data.hours),
      total = S.total(
        S.tasks.filter((t) => t.discipline === data.role),
        "hours",
      ),
      b = {
        name: data.name,
        role: data.role,
        hours,
        total,
        weeks: Math.ceil(total / hours),
        start: data.start,
        message: data.message,
      };
    const briefs = [b, ...readBriefs()];
    if (!U.write(briefKey, briefs))
      return {
        ok: false,
        message:
          "Your browser could not save this brief. Your form has been kept.",
      };
    showSaved(briefs);
    return {
      ok: true,
      message: `Brief saved. Allow about ${b.weeks} weeks at ${hours} hours per week. No email was sent or stored.`,
    };
  });
  render();
  showSaved(readBriefs());
})();
