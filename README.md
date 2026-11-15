# SIDEQUEST Final

SIDEQUEST is a five-page student game studio for Web Technologies 1, group IT-2511. The Final keeps Emberwake, Orbit Post and After Hours and adds Tideglass and Mossbound.

[Live site](https://abenovv.github.io/Web-technology-Finale/) · [Final repository](https://github.com/Abenovv/Web-technology-Finale) · [Endterm](https://github.com/Abenovv/EndTerm-WebTechnology) · [Midterm](https://github.com/Abenovv/Midterm-Web_Technologies-1stTerm)

## Open the site

Run `npm start` in the project root and open `http://127.0.0.1:8768/`. The site uses local assets and needs no backend or build step. Serving over HTTP lets the pages share one browser storage origin.

- On any page, open the navigation and toggle **Dark mode**. It follows the device until you choose a mode. The chosen mode persists across the site.
- On **Our games**, save a session or filter the catalogue to saved sessions. The **Saved** link shows the count and takes you to the Home list. Remove sessions one at a time or clear the list. The total adds each saved session’s duration.
- On **Emberwake**, switch routes to see the corresponding illustration. Photo stop and valley memories add 10 and 15 minutes.
- On **Community**, build an evening plan and save playtest preferences locally. On **Studio**, filter tasks with the Design, Art, Code and Testing cards. The workload estimate divides selected hours by weekly capacity and rounds up. The selections persist after reload.

The three demo forms validate their fields inline and save the resulting plan on the visitor’s device. The success message confirms what was stored. Email and phone fields are validated without storing or transmitting their values.

## Team scope

| Member | Work recorded in Midterm and Endterm | Final defense area |
| --- | --- | --- |
| Yerkebulan Abenov | Home, Community, shared styles, session finder and evening planner | Find and save a session, switch theme, and plan a Community evening |
| Assan Nurbergen | Games, Emberwake, catalogue search and comparison, expedition calculator | Filter the expanded catalogue, compare sessions, and explain the trail total |
| Kuvandyk Bekarys | Studio, roadmap, collaboration form, and integration checks | Pick a discipline, estimate weeks for selected tasks, and verify saved data |

These Final review areas describe the handoff. The repository history records the actual commits. The release carries forward the Endterm history at `8aec442` into the separate Final repository selected for publication. The rubric specifies the earlier repository.

## Verify

With Node.js 22 or newer, run `npm ci`, `npx playwright install chromium`, then `npm test` in the project root. On Windows the suite can use installed Chrome or Edge. Set `SIDEQUEST_BROWSER` to override the browser path.

The suite checks all five pages in both themes at 375, 768 and 1280 px. It also checks internal links and images, console errors, keyboard interaction, saved data, form validation and storage failure handling, and jQuery effects with rapid clicks and reduced motion. The HTML was checked with [W3C Nu](https://validator.w3.org/nu/).

## Credits

- Bootstrap 5.3.8 (MIT) provides the local grid, navigation and form components. jQuery 3.7.1 (MIT) provides sliding help panels, fading feedback and smooth scrolling. Their licenses are in `assets/vendor/`.
- DM Sans by Colophon Foundry is used under the SIL Open Font License. The license is in `assets/fonts/`.
- OpenAI provided image generation for the artwork and icon, plus development support for JavaScript, testing and documentation. Playwright and Prettier support development.
- The team supplied the Studio portraits.
