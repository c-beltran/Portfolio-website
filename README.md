# cbeltran.com

Carlos Beltran's portfolio, "The Desk": a statically exported Next.js site. The design and build spec is [`docs/design/DESK_SPEC.md`](docs/design/DESK_SPEC.md).

## Scripts

| Command                                              | What it does                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                                           | Local dev server                                                |
| `pnpm build`                                         | Static export to `out/`                                         |
| `pnpm serve:out`                                     | Serve `out/` on http://localhost:4173                           |
| `pnpm typecheck` / `pnpm lint` / `pnpm format:check` | Static checks                                                   |
| `pnpm test`                                          | Unit tests (Vitest)                                             |
| `pnpm e2e`                                           | End-to-end and accessibility tests (Playwright, against `out/`) |
| `pnpm stats`                                         | Refresh `content/stats.json` from git and GitHub (run by hand)  |
| `pnpm stats:check`                                   | Fail if rendered content contains a hand-typed project stat     |

## Private notes

`docs/private/` holds private working notes from a separate private repository. That path is git-ignored here, and CI fails if anything under it is ever tracked.
