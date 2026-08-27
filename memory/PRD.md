# LifeOS — Product & Build Memory

> **Branding note:** the shipped app is now named **Nannu** (app.json
> `expo.name`, app icon, and in-app copy updated). The internal codebase,
> file names, and this memory doc still use "LifeOS" as the working/spec
> name — purely a display-name change, no functional/architecture change.

## Product
LifeOS — personal life command center (iOS + Android, Expo). Unifies tasks, health,
calendar, documents (OCR), social stats into a "Today" dashboard with private,
explainable AI. Full specs in:
- `/app/LifeOS_PRD.md` — product requirements
- `/app/LifeOS_IA_and_Screens.md` — navigation model + 38 screen specs (S0–S38)
- `/app/LifeOS_Technical_Foundation.md` — data models, API design, sync, security
- `/app/LifeOS_Design_System.md` — tokens, components, motion

## Build order agreed with user
One real screen per prompt: **Today dashboard next**, then onboarding, health,
tasks, documents, then the rest. Keep everything aligned with the four spec docs —
do not invent new tokens/models/endpoints.

## Stack
- Mobile: Expo SDK 54 + expo-router (file-based), TypeScript, Feather icons
  (@expo/vector-icons), Inter fonts bundled in `assets/fonts` (expo-font).
- Backend: FastAPI + Motor/MongoDB, all routes under `/api`.
- No new packages added in skeleton phase.

## Completed — Phase 1: Setup & Navigation Skeleton (verified)
Backend (`/app/backend`):
- `core/config.py` (env settings), `core/db.py` (Motor client, collection handles,
  `ensure_indexes()` on startup)
- `models/` — Pydantic entities per Tech Foundation Part A: base (SyncableModel),
  user (User/Profile/Device), task (Task/Project), health (HealthEntry/
  HealthCacheSample), document (Document/DocumentPage), integration
  (Integration/IntegrationToken — token excluded from serialization),
  ai (AIMemoryEntry/Suggestion), notification, preference (DataControls),
  system (SyncOp/AuditLogEntry/Job)
- `routes/__init__.py` (api_router aggregator) + `routes/meta.py`
  (GET /api/ + GET /api/health with db ping) — both verified via curl
- `server.py` rewritten as thin entrypoint.

Frontend (`/app/frontend`):
- `src/theme/tokens.ts` — full light/dark design tokens (colors, type w/ Inter,
  space, radius, layout, motion, elevation). RULE: no raw hex outside tokens.
- `src/theme/index.tsx` — ThemeProvider (system|light|dark, persisted via storage
  key `lifeos.theme.mode`) + useTheme().
- `src/types/models.ts` — TS entity types mirroring backend models + sync protocol.
- `src/api/client.ts` — typed fetch wrapper (`api.get/post/patch/put/del`), error
  envelope → ApiError, bearer token from secure storage.
  Token keys: `lifeos.auth.access_token` / `lifeos.auth.refresh_token`.
- `src/providers/AuthProvider.tsx` (shell, unauthenticated) and
  `src/providers/SyncProvider.tsx` (shell, idle).
- `src/components/` — TopBar (large-title), TabBar (custom 5 tabs + raised center
  Quick-Add FAB), QuickAddSheet (modal bottom sheet, 4 actions stubbed),
  StubScreen.
- Routes: `app/_layout.tsx` (SafeArea > Theme > Auth > Sync > Stack, Inter+icon
  fonts, StatusBar by scheme); `app/(tabs)/_layout.tsx` (Tabs + custom tabBar +
  QuickAdd state); stubs: `(tabs)/index` (Today), `tasks/`, `health/`, `docs/`,
  `more/` (each tab dir has its own Stack _layout for future sub-screens).
  `more/index` has a temporary theme-mode segmented control (graduates to S25).
- Deleted old `app/index.tsx`.

Verified via screenshot automation: all 5 tabs navigable, quick-add opens/closes,
light + dark themes apply globally, backend health OK.

## Auth
No auth implemented yet (AuthProvider is a shell). No test credentials exist yet.
When auth is built: use integration_expert playbook first; update
`/app/memory/test_credentials.md`.

## Notes / gotchas
- `app/+html.tsx` exists (web shell) — leave as is.
- Icon fonts load from CDN in Expo Go via `src/hooks/use-icon-fonts.ts` — don't remove.
- Protected: metro.config.js, .env URLs, EXPO_PACKAGER_* vars.
- Design doc says lucide-style icons — using Feather (Lucide's predecessor,
  already bundled) to avoid extra deps.

## Completed — Phase 2: Today Dashboard (S6, verified)
Backend:
- `routes/deps.py` — `get_current_user_id()` returns DEMO_USER_ID ("demo-user")
  until auth lands (swap seam for JWT later).
- `routes/tasks.py` — GET /api/tasks (bucket/completed filters), POST /api/tasks,
  POST /api/tasks/{id}/complete, POST /api/tasks/{id}/reopen.
- `routes/health.py` — GET/POST /api/health/entries (manual water/mood/weight
  logs only; integration health data stays on-device per S34).
- `core/seed.py` — idempotent demo user + profile ("Priya") + 3 starter tasks
  (marker = demo user doc exists). DEV ONLY — remove when auth ships.
- `server.py` — HTTPException → uniform error envelope {error:{code,message,retryable}}.

Frontend:
- Shared: `src/components/Card.tsx` (Card raised/flat/ai + CardHeader + CardError),
  `Skeleton.tsx` (pulse), `Toast.tsx` (ToastProvider + useToast, undo support;
  wired into root layout).
- `src/features/today/` — `api.ts` (fetchTodayTasks/complete/reopen,
  fetchWaterToday/addWater), `useCardData.ts` (loading/error/offline-with-cache
  hook, caches to storage `lifeos.cache.*`), `mocks.ts` (MOCK health snapshot as
  HealthCacheSample, MOCK social as SocialStat shape, placeholder Suggestion
  generator with reason/sources), `TodayHeader.tsx`, `cards/` (SuggestionCard,
  HealthCard, TasksCard, WaterCard, SocialCard).
- `app/(tabs)/index.tsx` — real Today screen: header (greeting/date/avatar/bell),
  offline banner, pull-to-refresh, flexible card feed.

Card data sources: Tasks = REAL API · Water = REAL API · Health = MOCK (local
HealthCache shape) · Social = MOCK (SocialStat shape, "Sample" chip) ·
AI suggestion = placeholder logic through real Suggestion shape.
Interactions verified: task complete (optimistic + undo toast), +250ml water
(optimistic), suggestion accept/dismiss, card deep-links to tab stubs, both themes.

## Next
- Phase 3: Onboarding (S1–S5) — user will prompt. Auth via integration_expert!
- Later: health (S14–S17), tasks (S10–S13), documents (S18–S21), more-hub.
