# The Desk

Carlos Beltran's portfolio, built with AI agents: a desk seen from the chair, where each object opens a part of the story. Pick up the test kit for Potaflow, the phone for Power Walk, or the mug for coffee.

> **Work in progress.** The desk, all its sections and their close-up moments work. The live 3D view is still being built (see [status](#status)).

## How it's built with agents

Carlos directs and decides. Agents plan, build and check.

1. **Brief.** Carlos describes the outcome. The agent asks about anything that would change it.
2. **Plan.** The agent writes a design and a task plan. Building starts after Carlos approves them.
3. **Build.** Behavior changes start with a failing test, then the code that passes it. The 3D scene is code too: Python that drives Blender headlessly, so agents can rebuild and check it.
4. **Review.** At the end of a phase, a fresh agent that didn't write the code reviews the branch.
5. **Judge.** Carlos looks at the result, asks for changes and decides what merges.

Agents work inside guardrails that live in this repo:

| Guardrail                                                       | Enforced by                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Claims come from one facts file, with no typed-in project stats | [`content/facts.ts`](content/facts.ts), `pnpm stats:check`                      |
| The site works without 3D, by keyboard and for screen readers   | [`tests/e2e`](tests/e2e), axe                                                   |
| It stays fast                                                   | [`lighthouserc.json`](lighthouserc.json): LCP of 2 s or less, performance ≥ 0.9 |
| Third-party models are licensed and unaltered downloads         | [`assets.json`](scripts/scene/assets.json): pinned checksums                    |
| Working notes stay private                                      | [CI](.github/workflows/ci.yml) and [hygiene tests](scripts/hygiene.test.ts)     |

## How it works

- **The default desk** is a set of Blender renders with HTML on top. Every section has its own URL and works without 3D.
- **The live desk** (preview: `?tier=2`) is the same scene baked for React Three Fiber, matched to the render so the swap doesn't jump.
- **[Classic](app/classic/page.tsx)** is the same content as a plain page.

[docs/design.md](docs/design.md) explains the design in one page.

## Find your way around

| Path                                    | What's there                                    |
| --------------------------------------- | ----------------------------------------------- |
| [`content/`](content)                   | Facts, copy, objects and generated layout data  |
| [`components/desk/`](components/desk)   | The default desk                                |
| [`components/scene/`](components/scene) | The live 3D desk                                |
| [`scripts/scene/`](scripts/scene)       | The Blender pipeline, from models to web assets |
| [`tests/`](tests)                       | Browser and accessibility tests                 |

## Run it

Needs Node 22 and pnpm.

```sh
pnpm install
pnpm dev                                    # development server
pnpm build && pnpm serve:out                # the static site on localhost:4173
pnpm typecheck && pnpm lint && pnpm test    # quick checks
pnpm e2e                                    # browser tests against the build (CI runs these)
```

## Status

- [x] The desk, its twelve sections and the Classic page
- [x] The test kit and phone come forward
- [x] Every other section's object comes forward or zooms in, with real HTML on the badge, the card and both monitor halves
- [x] The terminal on the monitor loops, under the same pause as the steam
- [ ] The live desk becomes the default on capable devices. Until then, its timing tests fail on CI's CPU-only renderer.
- [ ] Final copy, photos and recordings (marked `DRAFT` and `TODO` for now)

## Credits

Models and licenses are listed in [docs/ASSETS.md](docs/ASSETS.md).
