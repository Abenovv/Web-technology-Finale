(function () {
  "use strict";
  const S = window.Sidequest,
    U = window.UI;
  const taskKey = "sidequest-production-tasks";
  const capacityKey = "sidequest-weekly-capacity";
  const capacity = document.querySelector("#weekly-capacity");
  const storedCapacity = U.read(capacityKey, 5);
  if ([2, 5, 10, 15].includes(storedCapacity)) capacity.value = storedCapacity;
  let selected = U.readIds(taskKey, S.tasks);
  function render() {
    const discipline = document.querySelector("#discipline").value,
      found = S.tasks.filter(
        (t) => discipline === "all" || t.discipline === discipline,
      ),
      host = document.querySelector("#roadmap");
    host.replaceChildren();
    document.querySelector("#task-count").textContent =
      `${found.length} proposed tasks`;
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
  document.querySelector("#discipline").addEventListener("change", render);
  document.querySelector("#reset-production").addEventListener("click", () => {
    if (!U.write(taskKey, [])) {
      U.notice("Your browser could not clear the task selection.");
      return;
    }
    selected = [];
    render();
  });
  const date = document.querySelector("#collaboration-start"),
    now = new Date();
  date.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  function showSaved() {
    const b = U.read("sidequest-collaboration", null),
      box = document.querySelector("#collaboration-saved");
    box.replaceChildren();
    box.hidden =
      !b ||
      typeof b.name !== "string" ||
      !["Design", "Art", "Code", "Testing"].includes(b.role) ||
      !Number.isInteger(b.weeks);
    if (box.hidden) return;
    box.append(
      U.element("h3", "Your collaboration brief"),
      U.element(
        "p",
        `${b.name} · ${b.role} · ${b.hours} hours/week · approximately ${b.weeks} weeks for ${b.total} hours of tasks.`,
      ),
    );
    const clear = U.element(
      "button",
      "Clear collaboration brief",
      "button secondary",
    );
    clear.addEventListener("click", () => {
      if (U.write("sidequest-collaboration", null)) showSaved();
      else U.notice("Your browser could not clear this brief.");
    });
    box.append(clear);
  }
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
    if (!U.write("sidequest-collaboration", b))
      return {
        ok: false,
        message:
          "Your browser could not save this brief. Your form has been kept.",
      };
    showSaved();
    return {
      ok: true,
      message: `Brief saved. Allow about ${b.weeks} weeks at ${hours} hours per week. No email was sent or stored.`,
    };
  });
  render();
  showSaved();
})();
