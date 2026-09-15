# Change log

Short summary of what each change added, removed, and why. Newest first.
Full task plan and review: https://claude.ai/artifact/Rcp1nVDs7WbT8Wt2hUFFaz

---

## 2026-09-15 — Phase 0: stabilise build, CI, deploy, tests
PR [#15](https://github.com/vianneyKB/shuttle-sprite/pull/15) · branch `Dev` → `main` · tracking issue #16

### Added
| Item | Why |
|---|---|
| `.github/workflows/ci.yml` — runs lint, typecheck, test, build on pushes/PRs to `main` and `Dev` | There was no CI; nothing verified a change before merge. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` passed into the build step of `deploy.yml` | The Pages build had no Supabase env, so the deployed app started with an undefined URL (white screen). Secrets must still be added in repo settings. |
| `.env.example` | README told users to copy it, but it was gitignored and missing. |
| `npm run typecheck`, `npm test`, `npm run test:watch` scripts | Give CI and developers one command each for verification. |
| Vitest + Testing Library + jsdom config in `vite.config.ts`; `src/test/setup.ts` | First test harness in the project. |
| `src/hooks/__tests__/mappers.test.ts` — 6 tests | Cover the DB-row → domain mappers: numeric coercion, stop ordering, nullable fields, legacy-row defaults. |
| `mapBooking`, `mapRoute`, `mapRideRequest`, `mapVehicle` and their `Db*` types are now exported from the hook files | Needed so the mappers can be unit-tested; no behaviour change. |
| `scripts/create-issues.sh` | Creates the 26 tracking issues (#16–#41) for phases 0–6. Idempotent. |
| `docs/CHANGES.md` (this file) | Running summary of changes for reviewers. |
| README: `typecheck`/`test` in the scripts table; note on the two deploy secrets | Keep docs in step with the above. |

### Removed
| Item | Why |
|---|---|
| `.github/workflows/deployment` | GitHub's hello-world template; did nothing and had no `.yml` extension. |
| `supabase/migrations/20260621184641_…sql` | Duplicate of `20260515120000_shuttle_routes_and_operator.sql`; failed on any fresh database. `main` (PR #14) had already deleted it and reconciled history with the live project, so the merge kept the deletion. |
| Dependencies: `recharts`, `embla-carousel-react`, `vaul`, `cmdk`, `input-otp`, `react-resizable-panels`, `react-day-picker`, `next-themes` | Not used by any application code — only by shadcn stubs that were themselves unused. |
| shadcn stubs: `ui/chart`, `ui/carousel`, `ui/drawer`, `ui/command`, `ui/input-otp`, `ui/resizable`, `ui/calendar` | Sole consumers of the removed dependencies. |
| `useTheme` (next-themes) from `ui/sonner.tsx` | The app has no theme switcher; toaster now uses the light theme directly. |
| `.env.example` line in `.gitignore` | So the example file can be committed. |

### Changed
| Item | Why |
|---|---|
| `@types/react`, `@types/react-dom` 18 → 19 | Match the installed React 19; the mismatch was masking type differences. |
| `ui/command.tsx`, `ui/textarea.tsx`: empty `interface … extends X {}` → `type … = X` | ESLint `no-empty-object-type` errors. |
| `tailwind.config.ts`: `require("tailwindcss-animate")` → ES import | ESLint `no-require-imports` error; file is already an ES module. |
| `BookingModal.tsx`: `catch (e: any)` → `catch (e: unknown)` with `instanceof Error` check | ESLint `no-explicit-any` error; matches the pattern used elsewhere. |
| Merged `origin/main` into `Dev` | Picked up PR #14's security hardening (role escalation, queue leak, `WITH CHECK` gaps) and the migration-history reconciliation. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn fast-refresh warnings) · `npm run typecheck` clean · `npm test` 6/6 · `vite build` OK.

### Not changed (deliberately)
- No application behaviour changed; every user-facing screen renders as before.
- Bundle is still one ~976 kB chunk — code-splitting is issue #35, not this PR.
- Remaining shadcn stubs (sidebar, menubar, etc.) are unused but kept: they depend on Radix packages that are cheap and may be used soon.
