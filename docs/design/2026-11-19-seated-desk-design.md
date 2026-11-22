# The seated desk: design

**Status:** agreed in conversation with Carlos on 2026-11-19. He will judge the result by eye once it's built.

This document amends `docs/design/DESK_SPEC.md`. Where the two disagree, this one wins, and the spec gets an "(amended 2026-11-19)" note pointing here.

Notation:

- Statements marked **(Carlos)** are his decisions, in his words where possible.
- Statements marked **(my call)** were settled by Claude. Each one can be changed without reopening the rest.

## 1. Intent

The visitor should feel they are sitting in Carlos's chair at his desk.

- **(Carlos)** "the entire screen is the view of the desk. The visitor should feel as if they are in my place."
- **(Carlos)** "Think immersive experience."

The page is no longer a desk shown inside a page. The browser window _is_ the view from the chair. Every object on the desk is something you can reach for. When you click one, it comes to you and shows what it is.

**Why:** the site is the portfolio's strongest proof of craft (spec §1, goal 3). A framed render inside a page reads as a picture of a desk. A first-person, full-screen seat reads as a place.

## 2. Goals, non-goals, anti-goals

**Goals**

- The whole viewport is the desk, seen from the seat, at every screen shape.
- The desk feels alive: your head follows the cursor, labels appear where you look, and objects come forward and open.
- The art is right. **(Carlos)** "lets focus on rendering the right art and experience."

**Non-goals for now**

- Final copy and numbers. **(Carlos)** "numbers and text can be modified later we can have dummy text display for now."
  - Spec rule §3.5 still holds: no invented claims.
  - Where a section already has content in `facts.ts`, use it.
  - Where it doesn't, show a visible `[TODO: …]` placeholder, never made-up text.
- Final textures for Carlos's photo and handwriting, the Power Walk clip and the session recording. Each gets a placeholder until Carlos supplies it.
- iPhone frame-rate work. **(Carlos)** "leave iphone frame rates out for now." It came up earlier in the project and still stands.

**Anti-goals (this fails even if it technically works)**

- It feels like a website with a 3D picture in it: a header bar, page chrome, or a menu laid over the desk.
- Labels permanently covering the desk.
- The camera spins, swoops or orbits. It's directed and calm (spec §2: about 0.9 s, ease-out).
- Any loading screen (spec §3.1).
- Readable personal text, real logos, or Carlos's real window view (spec §2, Privacy).

## 3. What the visitor sees on arrival

### 3.1 The seat (Carlos chose this from mockups)

- The browser window is filled edge to edge by the desk. There is no header, name bar, page margin or frame.
- The camera sits at Carlos's seated eye height, in front of the keyboard. The desk edge and keyboard touch the bottom of the screen, and the monitor fills the middle.
- **Head follows the cursor:** moving the mouse turns the view a few degrees, as if glancing around.
  - The target is about ±3° yaw and ±2° pitch, eased and damped.
  - The pose returns to centre when the pointer leaves the window.
  - **(my call)** On phones, the device's tilt drives the same glance only where the browser allows it without a permission prompt (Android Chrome). iOS asks for motion permission, and a prompt on arrival breaks the immersion, so iOS gets a still seat.
  - With `prefers-reduced-motion`, there is no glance (that visitor gets Tier 1 anyway, see 3.4).

**The camera checkpoint (my call).** Carlos chose C from a crop of today's overview render: scaled 1.32× about a point 50% across and 78% down. The mockups are kept in `docs/private/design/seated/mockups/`.

- That crop gives the feel, not exact camera numbers.
- So phase 1 starts with a look test: Cycles renders from the seat, day mode. Carlos approves them before anything that depends on the cameras (stills, bounds, residual).
- This follows spec §9, where the phone framing is Carlos's to approve.
- **Result (Carlos, 2026-11-20):** "the 16:9 view for most monitors is best not everyone has ultrawide."
  - The wide seat stands as rendered: eye 0.52 m back from the desk edge at seated height, pitched 22.5° down.
  - 16:9 is the reference view. It is tuned and reviewed first.
  - **(my call)** Ultrawide windows keep the overscan (3.2), but nothing is tuned for them. It costs a 16:9 visitor nothing, because each band's still only downloads at its own window shapes.
  - For phones Carlos chose C, straight ahead with a sideways swipe (3.2), and asked for the turn-sideways hint (3.5).

### 3.2 Screen shapes (my call)

The framing is chosen by the window's aspect ratio (width ÷ height), not by its pixel width.

- **Portrait or near-square windows (aspect up to 1.2) look straight ahead from the same seat. (Carlos, 2026-11-20: option C.)** This covers phones, portrait tablets and narrow desktop windows.
  - Why: the desk is about 1.15 m wide and 0.8 m deep. A portrait window can't hold all of it and still be filled with desk. With every object in view, the desk filled only the lower third of a phone.
  - The view is the wide seat's safe frame at full window height: the light bar at the top, the desk edge at the bottom, centred on the keyboard and monitor.
  - A sideways swipe turns the view left (laptop, notepad) or right (mug, card), as far as the safe frame's edges.
  - **(my call)** The swipe is the page's own horizontal scroll over the still. It works without JavaScript and has native momentum, and the hotspots move with the picture. A trackpad or Shift+wheel scrolls it in a narrow desktop window.
    - A one-line inline script centres the view before first paint. Without JavaScript the view starts at the left edge.
  - In Tier 2 the live view follows the same scroll (`setViewOffset` reads it), so live and still match at every position.
  - The swipe is a scroll, not the glance. Touch still never drives the glance (3.1).
  - There is one seat camera, `cam_seat`, and one master render. The portrait camera `cam_seat_phone` is dropped.
  - The `PORTRAIT` query in `content/deskLayout.ts` changes from `(max-width: 719px) and (orientation: portrait)` to `(max-aspect-ratio: 6/5)`. The panel layout (object on top, panel below) follows the same query.
- **Every wider window (above 1.2)** uses `cam_seat` with the whole desk in view. The still and the live view are cropped to the window ("cover"), anchored so the monitor stays centred and the desk edge stays at the bottom.
  - The master still is rendered with overscan: wide enough to fill 32:9 and tall enough to fill 1.2:1, with extra wall above and desk to the sides.
  - Any window in that range crops into real rendered pixels and never cuts past the outermost interactive object (the notepad on the left, the mug and coaster on the right).
  - Landscape phones (about 2.2:1 in Safari) are in that range.
- The phase 1 review includes a portrait tablet (768×1024) and a 32:9 window as well as desktop, ultrawide and phone.
- Hotspot boxes are computed from the 3D objects' projected bounds (`export_bounds.py`), as now. The CSS applies the same cover crop to the boxes as to the image, so they stay on their objects at any window shape.

### 3.3 Finding what's clickable (Carlos chose option B)

- At rest the desk is clean. A tape label fades in as the cursor comes near an object, the way your eye settles on something.
- **On touch screens**, all labels show for a moment on arrival (about 2 s), then fade. **(my call)** They come back for a moment after about 8 s with no touch, until the visitor first opens something.
  - When the turn-sideways hint (3.5) shows, the label intro starts as the hint fades.
- **On keyboard focus**, the focused object's label shows.
- This replaces spec §2 "Discoverability (amended)", which had labels always visible on a first visit.
- **The glow (Carlos, 2026-11-20):** "the rectangular outlines do not look so good". The hover rectangle and the open object's ring are replaced by a slight warm glow that follows the object's silhouette, chosen from a sketch.
  - **On the edges only (Carlos, 2026-11-21):** "the glow should be on the edges not the item". The glow lies just outside the silhouette and never lights the object itself; on the monitor, neither half's glow lies on the screen.
  - It shows on hover, on the open object, with keyboard focus in the Sections list, and on touch screens together with the labels. It never shows while an object has come forward.
  - It is built from a silhouette mask per object, rendered from the seat (`scripts/scene/render_masks.py`, `encode_glow.mjs`, about 2 kB each). The masks load once the page is idle, never on first paint, and the glow follows the glance in the live preview.

### 3.4 Tiers (spec §3.3 still holds, adapted)

- **Tier 1** is the full-screen seated still: Cycles renders from the new cameras in day and lamp mode, with HTML hotspot buttons.
  - Every visit still starts in Tier 1, and Tier 1 is still the first paint.
  - There is no glance in Tier 1.
- **Tier 2** is the live scene. It takes over with no visual jump, as today, and adds the glance and the 3D "comes to you" moments.
- **Tier 0** (`/classic`) is unchanged.

### 3.5 Turn your phone sideways (Carlos, 2026-11-20)

Carlos: "we should detect if user is on a mobile device and have an indicator to use landscape mode to view this better. for example they visit and load the website in the first 3-5 secods we grayout the site and have an indicator to use landscape mode for better experience then goes away."

- On arrival on a touch screen held upright, the desk grays out. A card in the middle shows a phone turning sideways, with "Turn your phone sideways to see the whole desk, or swipe to look around." This is placeholder copy.
- It fades away by itself after about 4 s.
- **(my call)** The details:
  - "Mobile device" is detected with the browser's own media queries: a touch pointer (`pointer: coarse`) and a window up to 1.2 wide (`PORTRAIT`). There is no user-agent sniffing.
    - A narrow desktop window with a mouse never sees the hint, and neither does a phone already held sideways.
  - It shows once per visit, remembered for the browser tab's session.
  - It shows only on the desk itself. A direct load of a section route, which opens with its panel, skips it.
  - A tap anywhere dismisses it early. That tap only dismisses the hint and never opens what's underneath.
  - It is CSS, so it works in Tier 1 without JavaScript. It doesn't delay the still, which paints underneath, and it moves nothing, so there is no layout shift.
  - With reduced motion there is no fade and no turning animation. It simply shows and hides.
  - It is hidden from screen readers (`aria-hidden`). It is advice about the picture, and everything is equally reachable upright.

## 4. When the visitor clicks an object

### 4.1 The shared moment

- **(Carlos)** The object comes forward to the visitor and does something that shows what it is, with a detail screen beside it about that work.
- **(my call)** While an object is out:
  - The rest of the desk dims and softens behind it, so the room stays around you.
  - Esc, the back button, a close control or clicking the dimmed desk puts the object back, and the route returns to `/`. Spec §2's routes behavior is otherwise unchanged.
- **Layout:**
  - On wide screens, the object sits on one side and the detail panel on the other. The object goes to the side it already sits on, so it travels the shortest way.
  - On portrait phones, the object is in the top part and the detail panel scrolls below it, replacing the bottom sheet.
- The detail panel is real HTML (spec §3.2) and keeps today's panel content, focus handling and `aria-live`.
- The motion is about 0.9 s with an ease-out, matching the camera moves, then the object's own animation. With reduced motion (Tier 1), there is no travel: the opened-object image appears with a short cross-fade.
- **As built (phase 2, the kit case and the phone; my calls, 2026-11-20):**
  - Only the kit and the phone come forward so far. The other six keep phase 1's open (ring, label, panel card or sheet, no dim) until phase 3. Carlos confirmed this on 2026-11-20.
  - While one is out, `.desk` carries `data-open` and `data-side`. The still and the name on the monitor dim to `brightness(0.45)` and blur 6 px; the live scene dims by the same amount in sRGB, with no blur. It is CSS on server-rendered attributes, so a direct load paints it, without JavaScript too.
  - The whole dimmed desk is one close target: its hotspots, the light bar included, take no clicks while an object is out. The lamp stays in the Sections list. A click on the object keeps it out. The panel's "Back to desk" is the close control.
  - The object sits in a slot on its own side, with the panel on the other side; in portrait it is in the top 42dvh above the panel. A forward panel fades in from its own side (24 px) and never slides across. Switching straight to the other object drops the old art at once; a close fades it in 0.3 s.
  - In Tier 1, a patch render of the object's spot with the object gone covers it on the still, so it isn't shown twice. The opened render is drawn on a `<canvas>`, not an `<img>`, so it is never the page's largest element (an `<img>` would land about when the seat photo does on Lighthouse's slow phone, against the 2.0 s gate). The cost: without JavaScript, the dim and the panel show but the object doesn't.
  - The glance holds still while an object is out.
  - The phone plays its clip muted and looped, with a Pause/Play button in the panel (WCAG 2.2.2: it loops past 5 s, and the opened phone is decorative). It never autoplays under reduced motion, and going back stops it and drops its source.

### 4.2 Each object

| Object                 | Section     | When clicked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backflow test-kit case | Potaflow    | **(Carlos)** It comes forward and opens, showing a gauge, a screwdriver and a backflow tester certificate inside. The detail panel covers Potaflow LLC, the small SaaS for backflow testers. The certificate is generic and unreadable: no name, license number or logo. **(Carlos, 2026-11-21)** Closer to his real kit, from his photos: the gauge with its red, blue and yellow hoses, brass fittings and his screwdriver. The certificate is dropped.                                                                                                                                                                                                                                             |
| Phone                  | Power Walk  | **(Carlos)** It comes forward, turns to landscape and plays a short muted, looped clip of Power Walk on its screen. The detail panel covers the vibe-coded iOS game built with React Native, and how Claude Code and Claude Design shaped its game design. Placeholder clip until Carlos supplies a screen recording.                                                                                                                                                                                                                                                                                                                                                                                 |
| Monitor, right half    | You (CV)    | **(Carlos, 2026-11-19)** The right half of the ultrawide is Carlos's own screen. At rest it shows his name and title, large enough to read from the seat. Clicking it leans in to that half, which shows basic info, the 10-second facts (spec §2's former header line), a Download CV button and a Classic version button. **(my call)** It is a new section with its own route, `/cv`. The name and title at rest are real HTML mapped onto the screen with a CSS `matrix3d` built from the screen's projected corners, in Tier 1 as well as Tier 2, so they're crisp and readable by search engines and screen readers. It follows the glance like the hotspots do. The page's `<h1>` is the name. |
| Monitor, left half     | How I build | **(Carlos, 2026-11-19: split)** The camera leans in to the left half. Its screen shows the visual evidence: a spec and a merged PR with its checks going green, plus a small replay of a cleaned session (spec §2). The section's prose and facts (F11, F09, F10) stay in a detail panel, as for every other object: beside the leaned-in monitor on wide screens, below it on portrait windows. In Tier 2, the screen content is HTML laid onto the screen in 3D (drei `<Html transform>`). In Tier 1 it is a Cycles lean-in still with placeholder screens. Either way the panel carries the words, so the panel tests, focus and `aria-live` apply to this object unchanged.                       |
| ID badge               | Experience  | **(my call)** It lifts off its lanyard, comes forward and flips. The back shows the role timeline, and the detail panel sits beside it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Framed photo           | About       | **(my call)** It comes forward and tilts to face you, with the About panel beside it. Placeholder image until M4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Notepad and pen        | This site   | **(my call)** It slides forward and the top page lifts, showing hand-drawn sketches of this desk scene. Placeholder sketches until M4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Business card          | Contact     | **(my call)** It slides forward and flips. The back shows the contact links, which are real HTML buttons laid onto the card, and the panel sits beside it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Light bar              | Lamp toggle | Unchanged: day to evening, with a warm pool of light. It's now the only lamp control, because there is no header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### 4.3 What the screens show at rest (closes Q27)

- **The monitor's left half** shows a code editor and terminal that look alive but are too small to read from the seat. The content changes only slowly and stays static under reduced motion.
- **The monitor's right half** shows Carlos's name and title, readable from the seat (see 4.2).
- **The laptop** shows a dummy Potaflow dashboard: generic shapes, no real customer data.
- **The phone** stays face up and dark until clicked.
- **Update rule (spec §6):** animated screen textures update only while their object is selected. The resting monitor is a pre-rendered loop of a few frames, or a still.

## 5. Changes to the spec

1. **§2, the header.** There is no header on the desk.
   - The light bar replaces the header's lamp button.
   - The name and title move to the monitor's right half at rest. The 10-second facts, CV download and Classic link move to its lean-in, `/cv` (see 4.2).
2. **§2, discoverability.** Labels appear as described in 3.3.
3. **§2, click behavior.** Section 4 replaces the "Click behavior" column and the "HTML panel beside the scene" paragraph.
4. **§3.4, the drawer.** **(my call)** A visible drawer row under the desk contradicts the full-screen seat.
   - **As built (phase 1, my call, 2026-11-20):** the drawer stays as the keyboard and screen-reader path, the "Sections" list, out of sight until something in it has keyboard focus. Then it shows as a card at the top left.
     - The first Tab reaches it on every window shape. It lists every section, then a "Lamp" button (`aria-pressed`), since the header's lamp toggle left the desk.
     - The hotspots stay out of the tab order, inside the `aria-hidden` desk, as before. Focusing a section in the list shows that object's label (3.3) and, in portrait, scrolls the desk to it.
     - After a pointer or touch, focus that a close returns to the list stays invisible, so the card never appears under a finger. Without JavaScript, it shows on any focus.
     - This replaces the earlier idea of hotspots in the tab order behind a "Skip to sections" link. The drawer keeps the tested open, close and focus behaviour, and the desk stays one picture for assistive tech.
   - Every other accessibility rule stands: focus moves into the panel and back, `aria-live`, 4.5:1 contrast, 44 px targets.
5. **§6, Tier 1 still.** The still comes from the new seated cameras (3.2), not the overview camera.
   - **(my call)** Each object also gets a Cycles render in its opened pose, so Tier 1 visitors see the same art when they click.
   - These renders are loaded on demand when that object is opened, never on first paint.
6. **§6, Model sources.** New models are needed:
   - the kit case's interior and hinged lid
   - the gauge with its hoses, the fittings and the screwdriver (the certificate was dropped, 2026-11-21)
   - a hinged badge clip, a card that flips, and a notepad page that lifts

   Sources are CC0, or CC-BY credited on `/classic`, or modeled in Blender. glTF only, recorded in `docs/ASSETS.md`.

7. **§9, milestones.** Section 7 below replaces M3c and pulls parts of M4 forward.

## 6. How it's built (decided parts)

**Cameras**

- One new Blender camera, `cam_seat`, is added to the `.blend` and to `content/scene/cameras`. Portrait windows look through it too (3.2).
- Each object gets an "opened" pose, which is a pose for the object, not for the camera. The monitor keeps a camera lean-in (`cam_monitor`, re-aimed from the seat).

**Animation**

- Opening animations are authored in Blender as glTF animation clips (lid hinge, flip, page lift, phone rotate) and played with three's `AnimationMixer`.
- The scene stays `frameloop="demand"` and only renders while a move, a glance or a clip runs.

**Baked lighting on moving parts (my call)**

- Parts that move get two bakes: a rest pose (lid shut, card face up), seen from the seat, and an opened pose, so the inside of the kit case isn't baked dark.
  - The material cross-fades from the rest bake to the opened bake while the clip plays, using the same mechanism as the day-to-lamp fade.
- The desk under a lifted object keeps its baked shadow. The dim while the object is out hides it, so there is no separate shadow layer.
  - "Softens" means a CSS blur on the Tier 1 still. In Tier 2 the desk is only dimmed, because spec §6 rules out real-time depth of field.
- Hotspots follow the glance: each frame, their boxes are re-projected from the objects' bounds.
- **A direct load of a section route** (for example `/potaflow`) paints the seat still, dimmed, with the panel open. The opened-object image streams in afterwards, so it is never the page's largest element.
- **As built (phase 2):**
  - The movers are pivots over rigid parts with one glTF clip each (`kit_open` hinges the lid 105° in 0.8 s; `phone_turn` turns the phone a quarter in 0.5 s), in their own `movers.glb`. Each has its own atlas, baked at rest and in its opened pose (a canonical pose in front of the seat, `scripts/scene/opened.py`). The opened bakes load on demand from `public/opened/bake`.
  - The live object is fitted each frame to the DOM slot that holds the Tier 1 art: aimed where the render shows its pivot, sized to the box, and refitted for the stretch a flat image gives off the camera's axis. The slot is the only layout.
  - Measured on 2026-11-20: Lighthouse `/potaflow` LCP 759 ms, and its LCP element is a panel paragraph, not the art. The live scene adds 1034 kB of the 3 MB. Desktop runs at 60 fps median through both moments (Apple M4).
- **Close-up textures** for an opened object load when it opens. They count toward that object's on-demand cap, not the 3 MB first load.
- If Carlos sees a leftover shadow when he reviews it, the fallback is a per-object baked shadow decal that fades out as the object lifts.

**The match gap (third decision, my call)**

- The live view must match the Tier 1 still at the moment it takes over.
- Approach: a camera-projected residual, exact at the seat's rest pose. The residual is the difference between the still and the live render from the seat, projected from the seat camera onto static geometry only.
  - **(my call, phase 1, measured)** It stays at full weight through the ±3° glance. Projected onto the geometry from the seat, it stays on its surfaces as the head turns. It fades only for a lean-in (phase 3).
  - **Measured at the seat (2026-11-20):** every review window, day and lamp, has a mean difference of 1.8–3.8 and at most 0.8% of pixels off by more than 40, including a portrait window swiped to either side. Before the residual it was 8.95 at 1280×800. The residual is 64 kB in all.
  - It's masked off any object that's out.
  - **As built (phase 2):** the mover's own residual fades as it lifts (`residualWeight` = 1 − travel). The desk under where it rested keeps its bake and its few residual pixels, hidden by the dim, as for the baked shadow above. Recaptured after the kit's lid seam: every review window, day and lamp, is at most 3.86 mean and 0.8% over 40.
- Target, as before: mean difference ≤ 6 and ≤ 3% of pixels off by more than 40, measured with `scripts/scene/measure/match.mjs` at the new cameras.
- This was recommended earlier, and Carlos didn't object. The HDR multi-probe is the fallback if the residual shows seams while glancing.

**Payload (spec §7)**

- The 3D payload stays ≤ 3 MB gzipped on first load.
- The Power Walk clip and the opened-object stills load only when their object is opened, and don't count against first load. **(my call)** Each still has its own cap: ≤ 1 MB per clip and ≤ 150 kB per opened-object still, enforced by a test like `content/scene/payload.test.ts`.

**Load time (first decision)**

- The full-screen still is now the page's largest element, so Lighthouse's load-time (LCP) measurement depends on it.
- **(my call)** Each framing renders at the sizes it actually displays at, with AVIF first and a WebP fallback, preloaded with `fetchpriority="high"`. Its file size and LCP get measured before anything about the gate is decided.
- Changing the CI gate itself (`lighthouserc`) is Carlos's decision (Q-B in §9). The builder does not change it.

## 7. Phases (each stops for Carlos's review)

1. **The seat.**
   - New cameras, the full-screen layout with no header, the Tier 1 stills from the seat, and hotspots in the cover crop.
   - Labels per 3.3 and the glance in Tier 2.
   - Your name and title on the monitor's right half at rest (4.2), with `/cv` built behind it.
   - The residual match at the seat.
   - LCP measured.
   - The turn-sideways hint (3.5).
   - Review: screenshots at desktop (16:9 first), ultrawide and phone (centred and swiped to each side), day and lamp, the hint, plus a short screen recording of the glance.
2. **Coming forward.**
   - The shared open and close moment (4.1) with the dim, the panel beside it, routes and focus.
   - Built first on the kit case (lid, gauge, screwdriver, generic certificate) and the phone (rotate and placeholder clip).
   - The opened-pose Tier 1 stills for both.
   - Review: recordings of both moments.
   - **As built (2026-11-20):** done on `m3c/coming-forward`, not pushed. The kit case opens on a gauge (ticks only), a screwdriver and a generic certificate (grey bars, a blank box, a seal), all modelled and drawn in code. The phone turns and plays a placeholder clip until Carlos's screen recording arrives.
   - **The kit re-modelled (2026-11-21):** Carlos asked for something closer to his real kit and shared photos of it. The case keeps its size and its place on the desk; inside, grey foam holds the gauge face up (a white face with a blue arc of ticks under a black bezel, a small supply gauge, the manifold's red, blue and yellow knobs), the three hoses coiled round it, four brass fittings and his black-and-yellow screwdriver. The lid is lined with egg-crate foam. No text, numerals or brand anywhere.
3. **The rest of the desk.**
   - The badge, photo, notepad, card and the monitor lean-in with its HTML screen content.
   - The resting screens (4.3).
   - Review: recordings of each.
4. **Going live (my call).** Through phases 1–3, the live scene stays behind the `?tier=2` preview flag. Visitors and Lighthouse see Tier 1, so Carlos judges the art without the performance gates moving under him. This phase carries what spec M3c owned:
   - capability detection replacing the flag (`lib/tier.ts`)
   - the fall back to Tier 1 below 30 fps for 2 s, keeping the current selection even mid-travel
   - the no-jump swap
   - the Tier 2 CI performance job

## 8. Left to the builder

- Exact glance angles, damping and easing, within 3.1.
- Exact dim and blur amounts, the panel's width and side rules, and the close control's look.
- Which free models to use, or whether to model in Blender, within the licence rules.
- The label fade timings, within 3.3.
- Test design, keeping the spec §8 gates. The hotspot, drawer and panel e2e tests get updated for the new layout rather than deleted.

## 9. Decisions that were open (now settled)

- **Q-A: where the name, title, CV and Classic link live. Decided (Carlos, 2026-11-19):** on the monitor's right half, with the lean-in at `/cv` (see 4.2).
- **Q-B: the Lighthouse load-time (LCP) gate. Decided (Carlos, 2026-11-19): "your recommendation".**
  - Lighthouse CI switches to devtools throttling (`throttlingMethod: "devtools"` in `lighthouserc.json`). The thresholds stay unchanged: LCP ≤ 2.0 s and Performance ≥ 90.
  - This is done in phase 1, with the LCP before and after reported in phase 1's review.
  - The approval covers this one change. Any other change to the gates still needs Carlos's OK.
- **Q-C: the phone framing (spec §9). Decided (Carlos, 2026-11-20):** option C, straight ahead with a sideways swipe, plus the turn-sideways hint (see 3.2 and 3.5). The wide seat was approved with 16:9 as the reference view (3.1).
