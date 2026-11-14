const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const serve = require("./serve.cjs");
let browser, server, base;
const root = path.resolve(__dirname, "..");
const pages = [
  "index.html",
  "games.html",
  "emberwake.html",
  "community.html",
  "studio.html",
];
before(async () => {
  server = await serve(root);
  base = `http://127.0.0.1:${server.address().port}`;
  const chrome =
    process.env.SIDEQUEST_BROWSER ||
    [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ].find(fs.existsSync);
  browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});
async function scenario(url, fn, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...options,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  try {
    await page.goto(base + "/" + url);
    await fn(page, context);
    assert.deepEqual(errors, [], "browser errors");
  } finally {
    await context.close();
  }
}
for (const colorScheme of ["light", "dark"])
  for (const width of [375, 768, 1280])
    for (const file of pages) {
      test(`Layout and accessibility: ${file} at ${width}px in ${colorScheme}`, () =>
        scenario(
          file,
          async (page) => {
            await page.evaluate(() => {
              document
                .querySelectorAll("img")
                .forEach((img) => (img.loading = "eager"));
              return document.fonts.ready;
            });
            await page.waitForFunction(() =>
              [...document.images].every((img) => img.complete),
            );
            assert.equal(await page.locator("h1").count(), 1);
            assert.equal(
              await page.locator("html").getAttribute("data-bs-theme"),
              colorScheme,
            );
            const issues = await page.evaluate(() => {
              const errors = [];
              if (document.documentElement.scrollWidth > innerWidth + 1)
                errors.push("horizontal overflow");
              document.querySelectorAll("img").forEach((img) => {
                if (!img.hasAttribute("alt") || !img.complete || !img.naturalWidth)
                  errors.push("image " + img.src);
              });
              const ids = [...document.querySelectorAll("[id]")].map(
                (el) => el.id,
              );
              if (new Set(ids).size !== ids.length)
                errors.push("duplicate IDs");
              const current = document.querySelectorAll(
                'header a[aria-current="page"]',
              );
              if (current.length !== 1)
                errors.push("current nav count " + current.length);
              let level = 0;
              document
                .querySelectorAll("main h1,main h2,main h3")
                .forEach((h) => {
                  const next = Number(h.tagName[1]);
                  if (next > level + 1) errors.push("heading jump");
                  level = next;
                });
              document
                .querySelectorAll("input,select,textarea")
                .forEach((el) => {
                  if (!el.labels?.length && !el.getAttribute("aria-label"))
                    errors.push("unlabelled field");
                });
              return errors;
            });
            assert.deepEqual(issues, []);
            await page.keyboard.press("Tab");
            assert.equal(
              await page.evaluate(() =>
                document.activeElement.textContent.trim(),
              ),
              "Skip to content",
            );
            assert.notEqual(
              await page.evaluate(
                () => getComputedStyle(document.activeElement).outlineStyle,
              ),
              "none",
            );
            if (width < 992) {
              await page
                .getByRole("button", { name: "Toggle navigation" })
                .click();
              await page.waitForFunction(() =>
                document
                  .querySelector("#main-navigation")
                  .classList.contains("show"),
              );
            }
            for (const link of await page.locator("header a").all())
              assert.ok(await link.isVisible());
            const nav = await page.locator(".site-header nav").boundingBox();
            for (const control of await page
              .locator("header nav a, header nav button")
              .all()) {
              const box = await control.boundingBox();
              if (box)
                assert.ok(
                  box.x >= nav.x - 1 &&
                    box.x + box.width <= nav.x + nav.width + 1,
                );
            }
            for (const control of await page
              .locator(
                "main button,main input,main select,main textarea,main a",
              )
              .all()) {
              if ((await control.isVisible()) && (await control.isEnabled()))
                assert.ok(await control.evaluate((el) => el.tabIndex >= 0));
            }
          },
          { colorScheme, viewport: { width, height: 900 } },
        ));
    }
test("Mobile menu closes with Escape and restores focus", () =>
  scenario("index.html", async (page) => {
    const menu = page.getByRole("button", { name: "Toggle navigation" });
    await menu.press("Enter");
    const games = page.locator("#main-navigation a[href='games.html']");
    await games.press("Escape");
    await page.waitForFunction(() => document.querySelector(".navbar-toggler").getAttribute("aria-expanded") === "false");
    assert.ok(await menu.evaluate((element) => element === document.activeElement));
  }, { viewport: { width: 375, height: 740 }, reducedMotion: "reduce" }));

test("Studio discipline artwork filters tasks and follows the select", () =>
  scenario("studio.html", async (page) => {
    const testing = page.locator('[data-discipline="Testing"]');
    await testing.press("Enter");
    assert.equal(await testing.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#discipline").inputValue(), "Testing");
    assert.equal(await page.locator("#roadmap article").count(), 2);
    await page.locator("#discipline").selectOption("Art");
    assert.equal(await page.locator('[data-discipline="Art"]').getAttribute("aria-pressed"), "true");
    assert.equal(await testing.getAttribute("aria-pressed"), "false");
  }));

test("Theme toggle uses the keyboard and wins over the OS after reload and navigation", () =>
  scenario(
    "index.html",
    async (page) => {
      const toggle = page.getByRole("button", { name: "Dark mode" });
      await toggle.focus();
      await page.keyboard.press("Space");
      assert.equal(await toggle.getAttribute("aria-pressed"), "true");
      assert.equal(
        await page.locator("html").getAttribute("data-bs-theme"),
        "dark",
      );
      await page.reload();
      assert.equal(await toggle.getAttribute("aria-pressed"), "true");
      for (const file of pages.slice(1)) {
        await page.goto(`${base}/${file}`);
        assert.equal(
          await page.locator("html").getAttribute("data-bs-theme"),
          "dark",
        );
      }
      assert.equal(
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem("sidequest-theme")),
        ),
        "dark",
      );
    },
    { colorScheme: "light" },
  ));

test("Save in Games, filter to saved, remove on Home, and clear across pages", () =>
  scenario("games.html", async (page) => {
    await page
      .getByRole("button", { name: "Save Emberwake: First light", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Save Orbit Post: First delivery",
        exact: true,
      })
      .click();
    assert.equal(await page.locator("#nav-saved-count").textContent(), "2");
    await page.getByLabel("Saved sessions only").check();
    assert.equal(await page.locator("#catalog article").count(), 2);
    await page.locator(".nav-saved").click();
    await page.waitForLoadState("domcontentloaded");
    assert.equal(
      await page.locator("#saved-total").textContent(),
      "2 saved · 50 minutes in total",
    );
    await page.reload();
    await page
      .locator("#saved-games")
      .getByRole("button", {
        name: "Remove Emberwake: First light",
        exact: true,
      })
      .click();
    assert.equal(
      await page.locator("#saved-total").textContent(),
      "1 saved · 20 minutes in total",
    );
    await page.locator("#clear-games").click();
    assert.ok(await page.locator("#clear-games").isDisabled());
    await page.goto(`${base}/games.html`);
    assert.equal(await page.locator("#nav-saved-count").textContent(), "0");
    await page.getByLabel("Saved sessions only").check();
    assert.ok(await page.locator("#catalog-empty").isVisible());
  }));

test("Emberwake displays the bridge illustration for the matching route", () =>
  scenario("emberwake.html", async (page) => {
    await page
      .getByLabel("Route", { exact: true })
      .selectOption("emberwake-bridges");
    assert.equal(
      await page.locator("#route-total").textContent(),
      "Your trail: 45 minutes",
    );
    const illustration = page.locator("#route-image");
    await illustration.scrollIntoViewIfNeeded();
    assert.equal(
      await illustration.getAttribute("src"),
      "assets/images/broken-bridges.webp",
    );
    assert.match(
      await illustration.getAttribute("alt"),
      /broken stone bridge/i,
    );
    await page.waitForFunction(
      () => document.querySelector("#route-image").naturalWidth === 1200,
    );
  }));

test("Studio estimates weeks from selected tasks and remembers the workload", () =>
  scenario("studio.html", async (page) => {
    await page.locator("#roadmap input").first().check();
    const firstTotal = await page.locator("#production-total").textContent();
    const hours = Number(firstTotal.match(/(\d+) estimated hours/)[1]);
    await page.getByLabel("Available hours per week").selectOption("2");
    const weeks = Math.ceil(hours / 2);
    assert.equal(
      await page.locator("#production-weeks").textContent(),
      `About ${weeks} ${weeks === 1 ? "week" : "weeks"} at 2 hours per week.`,
    );
    await page.reload();
    assert.ok(await page.locator("#roadmap input").first().isChecked());
    assert.equal(
      await page.getByLabel("Available hours per week").inputValue(),
      "2",
    );
    await page.locator("#reset-production").click();
    await page.reload();
    assert.equal(
      await page.locator("#roadmap input").first().isChecked(),
      false,
    );
    assert.match(
      await page.locator("#production-weeks").textContent(),
      /Select tasks/,
    );
  }));
test("Internal links and fragments resolve on every page", async () => {
  for (const file of pages)
    await scenario(file, async (page, context) => {
      const links = await page
        .locator("a[href]")
        .evaluateAll((els) => els.map((el) => el.href));
      const checked = new Set();
      for (const href of links) {
        const url = new URL(href);
        if (url.origin !== base || checked.has(href)) continue;
        checked.add(href);
        const response = await page.request.get(url.origin + url.pathname);
        assert.equal(response.status(), 200, href);
        if (url.hash) {
          const target = await context.newPage();
          await target.goto(href);
          assert.equal(
            await target
              .locator('[id="' + decodeURIComponent(url.hash.slice(1)) + '"]')
              .count(),
            1,
            href,
          );
          await target.close();
        }
      }
    });
});
test("Assan: catalogue search, filter, sort, empty and comparison limit", () =>
  scenario("games.html", async (page) => {
    assert.equal(await page.locator("#catalog article").count(), 12);
    await page.getByLabel("Search sessions").fill("valley");
    assert.equal(await page.locator("#catalog article").count(), 2);
    await page.getByLabel("Genre", { exact: true }).selectOption("cozy");
    assert.ok(await page.locator("#catalog-empty").isVisible());
    await page.getByRole("button", { name: "Reset filters" }).click();
    await page.getByLabel("Sort by").selectOption("short");
    assert.ok(
      (await page.locator("#catalog article").first().textContent()).includes(
        "20 minutes",
      ),
    );
    for (const name of [
      "Orbit Post: First delivery",
      "After Hours: Rainy opening",
      "Emberwake: First light",
    ])
      await page
        .getByRole("button", { name: "Compare " + name, exact: true })
        .click();
    assert.ok(
      (await page.locator("#comparison").textContent()).includes("75 minutes"),
    );
    assert.equal(await page.locator("#catalog button:disabled").count(), 9);
    await page
      .getByRole("button", {
        name: "Remove Orbit Post: First delivery",
        exact: true,
      })
      .click();
    assert.equal(await page.locator("#catalog button:disabled").count(), 0);
  }));
test("Yerkebulan: home recommendations, invalid input, shortlist persistence and clear", () =>
  scenario("index.html", async (page) => {
    await page.getByLabel("Minutes to spare").fill("10");
    assert.ok(
      (await page.locator("#recommendations").textContent()).includes(
        "No sessions",
      ),
    );
    await page.getByLabel("Minutes to spare").fill("-1");
    assert.ok(
      (await page.locator("#minutes-error").textContent()).includes(
        "10 to 180",
      ),
    );
    await page.getByLabel("Minutes to spare").fill("45");
    await page
      .getByRole("button", {
        name: "Save Orbit Post: First delivery",
        exact: true,
      })
      .click();
    assert.ok(
      (await page.locator("#saved-total").textContent()).includes("20 minutes"),
    );
    await page.reload();
    assert.equal(await page.locator("#saved-games article").count(), 1);
    await page.getByRole("button", { name: "Clear my shortlist" }).click();
    assert.ok(
      (await page.locator("#saved-total").textContent()).includes("0 saved"),
    );
  }));
test("Assan: expedition calculation, query selection and Midterm wishlist migration", () =>
  scenario("emberwake.html?route=emberwake-bridges", async (page, context) => {
    assert.equal(
      await page.getByLabel("Route", { exact: true }).inputValue(),
      "emberwake-bridges",
    );
    await page.getByLabel("Photo stop").check();
    await page.getByLabel("Read valley memories").check();
    await page.getByLabel("Participants").fill("2");
    assert.equal(
      await page.locator("#route-total").textContent(),
      "Your trail: 70 minutes",
    );
    assert.ok(
      (await page.locator("#booking-estimate").textContent()).includes(
        "140 participant-minutes",
      ),
    );
    await page.evaluate(() =>
      localStorage.setItem("sidequest-emberwake", "saved"),
    );
    await page.reload();
    assert.equal(
      await page.locator("#wishlist-button").getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("#wishlist-button").click();
    await page.reload();
    assert.equal(
      await page.locator("#wishlist-button").getAttribute("aria-pressed"),
      "false",
    );
  }));
test("Yerkebulan: community filters, local evening total and persistence", () =>
  scenario("community.html", async (page) => {
    assert.equal(await page.locator("#activities article").count(), 8);
    await page.getByLabel("Activity format").selectOption("Online");
    assert.equal(await page.locator("#activities article").count(), 4);
    await page
      .getByRole("button", { name: "Add Valley clue exchange", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add Write a space postcard", exact: true })
      .click();
    assert.equal(
      await page.locator("#evening-total").textContent(),
      "2 activities · 35 minutes",
    );
    await page.reload();
    assert.equal(
      await page.locator("#evening-total").textContent(),
      "2 activities · 35 minutes",
    );
    await page.getByRole("button", { name: "Clear evening" }).click();
    assert.equal(
      await page.locator("#evening-total").textContent(),
      "0 activities · 0 minutes",
    );
    await page.getByLabel("Search activities").fill("unfindable");
    assert.ok(
      (await page.locator("#activities").textContent()).includes(
        "No activities",
      ),
    );
  }));
test("Bekarys: roadmap filter preserves selected tasks and calculated total", () =>
  scenario("studio.html", async (page) => {
    assert.equal(await page.locator("#roadmap article").count(), 8);
    await page.getByLabel("Include Define the core loop").check();
    await page.getByLabel("Include Prototype movement").check();
    assert.equal(
      await page.locator("#production-total").textContent(),
      "2 selected tasks · 12 estimated hours",
    );
    await page.getByLabel("Show discipline").selectOption("Art");
    assert.equal(await page.locator("#roadmap article").count(), 2);
    assert.ok(
      (await page.locator("#production-total").textContent()).includes(
        "12 estimated hours",
      ),
    );
    await page.getByRole("button", { name: "Reset task selection" }).click();
    assert.ok(
      (await page.locator("#production-total").textContent()).includes(
        "0 estimated hours",
      ),
    );
  }));
const forms = [
  {
    file: "community.html",
    prefix: "preferences",
    button: "Save my preferences",
    saved: "#saved-preferences",
    key: "sidequest-playtest",
    fields: { game: "Emberwake", format: "Online", minutes: "45" },
  },
  {
    file: "emberwake.html",
    prefix: "booking",
    button: "Save expedition plan",
    saved: "#booking-saved",
    key: "sidequest-expedition",
    fields: { date: "future", people: "2", phone: "+7 700 123 45 67" },
  },
  {
    file: "studio.html",
    prefix: "collaboration",
    button: "Save collaboration brief",
    saved: "#collaboration-saved",
    key: "sidequest-collaboration",
    fields: {
      role: "Code",
      hours: "5",
      start: "future",
      message: "I would build keyboard movement and test the first puzzle.",
    },
  },
];
async function fillForm(page, f) {
  await page.locator("#" + f.prefix + "-name").fill("Test Player");
  await page.locator("#" + f.prefix + "-email").fill("test@example.com");
  for (const [name, value] of Object.entries(f.fields)) {
    const node = page.locator("#" + f.prefix + "-" + name),
      tag = await node.evaluate((el) => el.tagName);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    if (tag === "SELECT") await node.selectOption(value);
    else await node.fill(value === "future" ? date : value);
  }
  await page.locator("#" + f.prefix + "-consent").check();
}
test("New worlds connect Games, the Home shortlist and Community preferences", () =>
  scenario("games.html", async (page) => {
    for (const [id, world, image] of [
      ["tideglass", "Tideglass", "tideglass.webp"],
      ["mossbound", "Mossbound", "mossbound.webp"],
    ]) {
      await page.getByLabel("Search sessions").fill(world);
      assert.equal(await page.locator("#catalog article").count(), 2);
      const card = page.locator(`#catalog #${id}`);
      assert.equal(await card.locator("img").getAttribute("src"), `assets/images/${image}`);
      await card.locator("[data-save]").click();
      await card.locator(".text-link").click();
      await page.waitForLoadState("domcontentloaded");
      assert.equal(await page.locator("#preferences-game").inputValue(), world);
      const preferences = forms.find((form) => form.prefix === "preferences");
      await fillForm(page, { ...preferences, fields: { ...preferences.fields, game: world } });
      await page.getByRole("button", { name: "Save my preferences" }).click();
      await page.reload();
      assert.ok((await page.locator("#saved-summary").textContent()).includes(world));
      await page.goto(`${base}/games.html`);
    }
    await page.locator(".nav-saved").click();
    await page.waitForLoadState("domcontentloaded");
    assert.equal(await page.locator("#saved-games article").count(), 2);
    assert.match(await page.locator("#saved-total").textContent(), /2 saved/);
  }));

for (const f of forms) {
  test(`Form: ${f.prefix} inline errors, live correction, success reset and persistence`, () =>
    scenario(f.file, async (page) => {
      assert.equal(await page.locator(".field-error:not(:empty)").count(), 0);
      await page.getByRole("button", { name: f.button, exact: true }).click();
      assert.ok((await page.locator(".field-error:not(:empty)").count()) >= 5);
      await fillForm(page, f);
      assert.equal(await page.locator(".field-error:not(:empty)").count(), 0);
      await page.getByRole("button", { name: f.button, exact: true }).click();
      await page.waitForFunction(() =>
        /saved/i.test(document.querySelector(".form-feedback").textContent),
      );
      assert.equal(
        await page.locator("#" + f.prefix + "-name").inputValue(),
        "",
      );
      if (f.prefix === "booking") {
        assert.ok(
          (await page.locator("#booking-estimate").textContent()).startsWith(
            "1 participant ·",
          ),
        );
      }
      assert.ok(await page.locator(f.saved).isVisible());
      assert.equal(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).email,
          f.key,
        ),
        undefined,
      );
      await page.reload();
      assert.ok(await page.locator(f.saved).isVisible());
    }));
  test(`Form: ${f.prefix} storage failure retains form and prior data`, () =>
    scenario(f.file, async (page) => {
      await fillForm(page, f);
      await page.getByRole("button", { name: f.button, exact: true }).click();
      const prior = await page.evaluate(
        (key) => localStorage.getItem(key),
        f.key,
      );
      await fillForm(page, f);
      await page.evaluate(() => {
        Storage.prototype.setItem = function () {
          throw new DOMException("Blocked", "SecurityError");
        };
      });
      await page.getByRole("button", { name: f.button, exact: true }).click();
      assert.ok(
        (await page.locator(".form-feedback").textContent()).includes(
          "could not save",
        ),
      );
      assert.equal(
        await page.locator("#" + f.prefix + "-name").inputValue(),
        "Test Player",
      );
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), f.key),
        prior,
      );
    }));
}
test("All pages: repeated accordion clicks, fade and keyboard smooth scroll", async () => {
  for (const file of pages)
    await scenario(file, async (page) => {
      await page.locator(".help-toggle").evaluate((el) => {
        for (let i = 0; i < 11; i++) el.click();
      });
      await page.waitForFunction(
        () => window.jQuery("#page-help").queue("fx").length === 0,
      );
      assert.equal(
        await page.locator(".help-toggle").getAttribute("aria-expanded"),
        "true",
      );
      assert.ok(await page.locator("#page-help").isVisible());
      await page.locator(".help-toggle").click();
      await page.waitForFunction(
        () => document.querySelector("#page-help").hidden,
      );
      assert.ok(await page.locator("#page-help").isHidden());
      await page.locator("[data-scroll]").focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => document.activeElement.id === "main" && scrollY < 130,
      );
      assert.ok(
        await page
          .locator("main")
          .evaluate((el) => document.activeElement === el),
      );
    });
});
test("Malformed and stale local storage does not break pages", async () => {
  for (const file of pages)
    await scenario(file, async (page, context) => {
      await page.evaluate(() => {
        for (const key of [
          "sidequest-sessions",
          "sidequest-playtest",
          "sidequest-evening",
          "sidequest-expedition",
          "sidequest-collaboration",
        ])
          localStorage.setItem(key, '{"wrong":true}');
      });
      await page.reload();
      assert.equal(await page.locator("h1").count(), 1);
    });
});
test("Reduced motion completes jQuery effects without queues", () =>
  scenario(
    "studio.html",
    async (page) => {
      await page.locator(".help-toggle").click();
      assert.ok(await page.locator("#page-help").isVisible());
      assert.equal(
        await page.evaluate(() => jQuery("#page-help").queue("fx").length),
        0,
      );
    },
    { reducedMotion: "reduce" },
  ));
