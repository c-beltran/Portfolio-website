# The Desk: build spec for the carlos-beltran portfolio

You are building Carlos Beltran's personal portfolio site from scratch. Read this whole file before writing code. Stop at the end of every milestone for review.

_Amended 2026-11-13_ after the M0 review: section routes, the laptop screen, contact, hosting, the numbers rule, the tier rule and the performance job. _Amended 2026-11-15:_ the Claude Design output is a mock, not final art. Amended passages are marked **(amended)**.

Reference material in `docs/design/`:

- `desk-mock.dc.html`: the approved interactive mock (Direction E, "The Desk"). It uses a proprietary design-canvas runtime, so treat it as a reference for layout, copy and behavior. Don't port its runtime. Where it disagrees with this spec, this spec wins.
- **(amended)** The mock is a wireframe-level reference for the concept, object set, layout and behavior. **It is not the final art.** Its flat illustration style, colors and copy are not targets. The final look (lighting, camera, materials, object states) is designed in this build: it is set by the 3D scene in M3 and the baked renders in M4, and Carlos reviews it at each milestone. There is no separate `art-direction.png`.
- `directions/`: one PNG per direction designed on the Claude Design canvas (A–E). E is the chosen one. Used only for the "This site" panel thumbnails (Q21); they don't gate any milestone.

---

## 1. Who and why

Carlos Beltran is a Senior Software Engineer, Performance Engineering on the Ad Platform at People Inc. (formerly Dotdash Meredith, formerly Meredith), from July 2019 to the present. He's a backend and performance specialist, primarily Go, and an AI-native engineer who builds with Claude Code, Codex, Cursor and Claude Design using multi-agent workflows.

A visitor must leave with these, in priority order:

1. His experience: senior, deep, long-tenured.
2. How he uses AI to build, shown with real evidence, not buzzwords.
3. That the site itself is intuitive and interactive, not a static résumé.
4. His projects.

Audience: hiring managers, engineering leaders, recruiters (often non-technical) and engineers. It must make sense to a recruiter in **10 seconds** and reward an engineer who explores.

Feel: professional, interactive, easy to read, a little fun. It should feel like sitting at a real, warmly lit desk.

## 2. The concept

The homepage is Carlos's desk, seen from above at a three-quarter angle. Each object opens one section, and **every section has its own route (amended)**:

| Object                                             | Section                   | Route          | Click behavior                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Polaroid photo                                     | About                     | `/about`       | Tilts up toward the camera                                                                                                                                                                                                                                                              |
| ID badge on lanyard                                | Experience                | `/experience`  | Flips to show the company names. The face reads "People Inc. · since July 2019" in plain text                                                                                                                                                                                           |
| Laptop                                             | How I build (AI approach) | `/how-i-build` | Camera leans in. **(amended)** The screen is an editor window with a Claude Code side panel that replays a short excerpt of a real Claude Code session (prompt → plan → edit → tests pass → Carlos's review). Under reduced motion it shows the finished state. No interactive terminal |
| Backflow test-kit gauge with red/yellow/blue hoses | Potaflow project          | `/potaflow`    | Needle swings up and settles; hoses sway                                                                                                                                                                                                                                                |
| Phone                                              | Power Walk project        | `/power-walk`  | Screen lights up yellow, light spills on the felt                                                                                                                                                                                                                                       |
| Sticky note (handwritten)                          | This website              | `/this-site`   | Peels up                                                                                                                                                                                                                                                                                |
| Business card                                      | Contact                   | `/contact`     | Flips                                                                                                                                                                                                                                                                                   |
| Desk lamp                                          | Light/dark mode toggle    | (none)         | The room dims; the lamp lights the desk                                                                                                                                                                                                                                                 |
| Coffee mug                                         | Decoration                | (none)         | Steam drifts (off with reduced motion)                                                                                                                                                                                                                                                  |

Clicking an object moves the camera to it (about 0.9 s, ease-out, no spinning) and opens that section in an **HTML panel** beside the scene (a bottom sheet on phones).

**Routes (amended).**

- Opening an object pushes its route onto the history.
- Back and Forward move between sections. Esc, a Back control or clicking the desk returns to `/`.
- A direct load of a section route opens the desk with that object already selected and its panel open, in every tier, with **no camera animation on first load**.
- Each route has its own `<title>` and meta description, built from `facts.ts`.
- `/classic` links to the same routes.

**The header (amended)** always shows:

- his name and title
- a one-line summary that doesn't name the employer (People Inc. appears in Experience, on the badge and on `/classic`)
- the 10-second facts: Go · backend & performance · N+ years · AI-native · New York. The years are computed from July 2019.
- a Download résumé button
- a **"Classic version"** link

No company logos, brand colors or trademarked marks appear anywhere on the site. Company names appear as plain text only.

## 3. Hard rules

1. **No loading screen, ever.** The first paint is a still render of the desk (Tier 1) with working HTML hotspots. The live 3D scene loads afterwards and swaps in with no visual jump.
2. **All text is real HTML.** No copy is rendered inside WebGL. The panel, header and drawer are DOM.
3. **The site works fully without WebGL.** There are three tiers:
   - **Tier 0, Classic:** a plain, semantic HTML page with every fact. It's at `/classic`, linked in the header, and is what search engines and screen readers rely on.
   - **Tier 1, Still desk:** a pre-rendered image of the scene, with absolutely positioned `<button>` hotspots and CSS lift/hover states. Use it for reduced motion, `navigator.connection.saveData`, low `deviceMemory`, no WebGL2, or any 3D load failure.
   - **Tier 2, Live 3D:** used only when the device can handle it.
   - **Tier rule (amended):**
     - Every visit starts in Tier 1.
     - Tier 1 is final if any signal says no: reduced motion, `saveData`, `deviceMemory` < 4, no WebGL2.
     - If no signal says no, including when the signals are **unknown** (iOS Safari exposes neither `deviceMemory` nor `saveData`), Tier 2 is attempted on browser idle after first paint.
     - Once in Tier 2, a performance monitor drops back to Tier 1 on a sustained low frame rate (below 30 fps for 2 s) and keeps the current selection.
     - A load or runtime error also drops to Tier 1.
4. **Accessibility:**
   - Every object is mirrored by a real `<button>` in a visible "drawer" row under the desk. Keyboard Tab order goes header → drawer → panel.
   - Focus moves into the panel when it opens and returns to the trigger when it closes.
   - The panel uses `aria-live="polite"`.
   - Text contrast is at least 4.5:1 in both day and lamp modes. Touch targets are at least 44 px.
   - With `prefers-reduced-motion`, camera moves become cuts and idle animations stop.
5. **No invented facts.** All copy comes from one facts file (section 5). If something is missing, leave a visible `[TODO: …]` and list it in the milestone report. Never write new claims about Carlos.
6. **No hand-typed project numbers (amended).** Every published project stat (commits, PRs, specs and plans, directions) comes from `scripts/stats`, which reads git, `gh` and `docs/design/directions/`. It writes `content/stats.json` with an "as of" date and explicit denominators. `scripts/stats --check` scans rendered content (`content/`, `app/`, `components/`) and fails CI on a project stat not read from `stats.json`. Docs, budgets, versions and dates are out of scope.
7. **Avoid these tropes:** a fake terminal hero (or any interactive terminal), an editorial or magazine template, a city-skyline gimmick, a tool-filter chips row, a pipeline diagram, a node-graph career map, skill-percentage bars, stock photos, and dark-only hacker aesthetics.

## 4. Stack (amended: decided at M0)

- **Next.js (App Router) + TypeScript + React Three Fiber + @react-three/drei.** It's built as static pages and hosted on **Vercel's Hobby plan**, with preview deployments per PR. The whole pipeline must cost $0, so no paid features are used.
- Every page is statically rendered.
- The 3D scene loads client-side only, lazily, on browser idle after first paint (`next/dynamic(..., { ssr: false })`).
- The scene uses `frameloop="demand"`, so nothing renders while idle.
- Camera transitions use drei `CameraControls` with user orbit disabled. The camera is directed, not free.
- Hotspot buttons over the canvas are DOM `<button>`s, moved with CSS `transform` only (never `top`/`left`). The main panel stays outside the canvas.
- Analytics: Vercel Web Analytics, cookieless, **page views only**. Custom events are a paid feature and aren't used. Opening a section counts as a page view of its route.

## 5. Content: the single source of truth

`content/facts.ts` is typed and every fact has an ID. The Classic page, the panels, the hotspot labels, the route metadata and the Tier 1 `alt` text all read from this file. **(Amended)** Numbers come from `content/stats.json`, never literals.

```ts
export const facts = {
  F01: 'At the same company since July 2019: Meredith, then Dotdash Meredith, now People Inc.',
  F02: 'Senior Software Engineer, Performance Engineering on the Ad Platform',
  F03: 'Integrated new retailers into Go-based importer systems and optimized the importer processes',
  F04: 'Migrated the creative builder tool from PostgreSQL to a graph database',
  // F05 retired. IDs are never reused.
  F06: 'Carried platform migrations through the merger',
  F07: 'Ad performance, latency and infrastructure cost reduction',
  F08: 'Mentors engineers and leads projects',
  F09: 'Wrote Claude skills that are now widely shared across his team',
  F10: 'Ships internal tools for product managers fast with AI; drives AI adoption on his team',
  F11: 'Uses Claude Code, Codex, Cursor and Claude Design daily, with agents that plan, build and review in parallel',
  F12: 'Based in New York',
  P01: 'Potaflow: multi-tenant SaaS that removes the paper trail from backflow testing compliance for water districts in Nassau County, NY',
  P02: 'Potaflow: Nuxt, tRPC, Prisma, Postgres, S3, Sentry; {stats.potaflow.commits} commits ({stats.potaflow.coAuthoredShare} co-authored with Claude) and {stats.potaflow.mergedPRs} merged PRs, every one merged by Carlos; 1 human + agents',
  P03: 'Potaflow: custom AI skills encode NY DOH-1013 rules and physical testing procedures',
  P04: 'Power Walk: iPhone game where every real step (Apple Health) is a footstep through a blacked-out New York landmark; find the fuse and turn the lights back on',
  P05: 'Power Walk: React Native and Expo; built from {stats.powerWalk.specsAndPlans} specs and plans; every commit co-authored with Claude; Claude Design produced parts of the art',
  P06: 'This website: designed on a Claude Design canvas across {stats.thisSite.directions} directions, built with AI agents, every PR merged by Carlos',
  ABOUT: '[TODO: Carlos writes this in his own voice]',
} as const;
```

Rules for the stats in P02, P05 and P06:

- "co-authored with Claude" is the only label, never "written by AI". The denominator is stated in a footnote on the site.
- "Every one merged by Carlos" is shown only if the script verifies every merged PR's merger. "Merged by" is the only review claim made, because it's what GitHub records; nothing says "reviewed" unless a record of the review exists. **(Amended)**
- "Every commit co-authored with Claude" is shown only if the script verifies 100% coverage. Otherwise the site shows the percentage.
- No claim is made about an AI review gate unless a GitHub record of it exists for every PR.

Use the copy from `desk-mock.dc.html` as the starting point for each panel, except where this spec changes it. **Mark all panel prose `[DRAFT: Carlos to rewrite]`.** Carlos will rewrite it in his own voice before launch, so the site doesn't read as AI-written.

**This site panel (amended):** shows each direction in `docs/design/directions/` as a thumbnail, four labeled "rejected" and E labeled "chosen" (labels come from the filenames), with a one-line `[DRAFT]` caption each.

**Contact (amended):** the business card offers the résumé PDF (which carries his email), LinkedIn and GitHub. No email address appears anywhere in the HTML. The résumé is at `/public/carlos-beltran-resume.pdf`. It's hidden in production until the real PDF exists and shown in preview builds.

## 6. 3D assets

- **Format:** glTF/GLB, Draco or Meshopt geometry compression, KTX2 textures. Run every model through `gltf-transform`, and generate components with `gltfjsx`.
- **Lighting is baked in Blender** (headless scripts; Carlos reviews the renders). Bake ambient occlusion and light into the desk and mat textures. Real-time lighting is limited to: one directional light for day, one spotlight for lamp mode, and contact shadows. The day and lamp looks can be two baked lightmaps that cross-fade.
- **Model sources:**
  - **Scanned by Carlos** with iPhone LiDAR (Polycam), then cleaned and decimated: the backflow test kit (gauge and hoses), and optionally his mug and badge. These are the hero objects.
  - **CC0 or properly licensed** (for example Poly Haven): desk, laptop, phone, lamp. Record every model's source and license in `docs/ASSETS.md`.
  - **Simple geometry built in code:** the polaroid, sticky note and business card are planes with textures, using Carlos's real photo and a photo of his real handwriting.
  - Raw scans and `.blend` files live outside the repo; only optimized outputs are committed.
- **Until the real assets exist,** build every object as a labeled primitive with the correct size and position, so interactions can be built and tested first.
- **Tier 1 still:** render it from the same scene and camera at 1x, 2x and phone crop, in AVIF with a WebP fallback. Hotspot positions are computed from the 3D objects' projected bounds and exported to JSON, so the still and the live scene always line up.

## 7. Performance budget (enforced in CI)

- LCP ≤ 2.0 s and CLS < 0.05 on a mid-range phone over simulated 4G (Lighthouse mobile).
- Lighthouse: Performance ≥ 90, Accessibility 100, Best Practices ≥ 95, SEO 100 (mobile, on `/`, one section route and `/classic`).
- 3D payload (JS for three and the scene plus GLB plus textures) ≤ 3 MB gzipped total, loaded only after first paint.
- 60 fps on desktop and 30 fps or better on a recent iPhone during camera moves. Below that, automatically drop to Tier 1. **(Amended)** Frame rate is measured on a real GPU and on the device before each milestone report, with the numbers in the report. It isn't a CI gate, because CI runners have no GPU.
- No main-thread task over 200 ms during the Tier 1 → Tier 2 swap.
- **Tier 2 performance job (amended):** a separate CI job forces Tier 2 in desktop Chromium and gates the 3D payload (≤ 3 MB) and the longest task during the Tier 1 → 2 swap (≤ 200 ms). Like the other budgets, it fails CI.

## 8. Quality gates (nothing merges without review)

- TypeScript strict mode, ESLint, Prettier.
- Playwright end-to-end tests for:
  - every drawer button opens the right panel **and route**
  - Back, Forward and Esc
  - a direct load of each section route
  - keyboard-only navigation
  - the Classic page includes every fact ID
  - reduced-motion mode uses Tier 1
  - forcing WebGL off still gives a complete site
  - opening a section sends an analytics page view
- axe accessibility checks on every route, in both light and lamp modes.
- Lighthouse CI with the section 7 thresholds as failures, not warnings. Vercel previews keep deployment protection on; CI reaches them with Vercel's Protection Bypass for Automation (available on Hobby).
- `scripts/stats --check` (section 3.6).
- A repo-hygiene check that fails if anything under `docs/private/` is tracked (that path holds private working notes from a separate repo).
- Run an AI review of each change against this spec before opening a PR. Every PR description says which spec sections it touches.

## 9. Milestones (stop after each one for review)

- **M0, Plan:** done.
- **M1, Foundation:** project setup, `facts.ts`, `stats.json` and the stats script, the Classic page (Tier 0), section routes, site layout, lamp-mode theme tokens, CI with all gates.
- **M2, Still desk (Tier 1):** port the mock's behavior with a placeholder still (a primitive-geometry render is fine), hotspots, drawer, panel, phone bottom sheet. **(amended)** No design export gates this milestone: the placeholder still is ours, and the real look arrives in M3 and M4.
- **M3, Live 3D with primitives (Tier 2):** scene, camera moves, all object interactions and the lamp toggle using placeholder primitives; capability detection and fallback; no-jump swap from Tier 1; the Tier 2 performance job.
- **M4, Real assets:** baked lighting, scanned and licensed models, the final Tier 1 renders exported from the scene, `ASSETS.md`.
- **M5, Polish and hardening:** motion fine-tuning, the performance budget passing in CI, a real-device check on iPhone and Android, the launch `[TODO]` list. Exit check includes: the final Tier 1 still is a render from the scene, not the M2 CSS placeholder.

At the end of each milestone, report: open questions first, then what shipped, screenshots (desktop and phone, day and lamp mode), Lighthouse and test results, and the open `[TODO]`s.
