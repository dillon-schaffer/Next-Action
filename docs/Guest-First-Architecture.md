# Guest-First Architecture

How the app works with no sign-in required: storage choice, the data adapter
abstraction, guest quota, and account migration. Written 2026-08-23 alongside
the guest-first change; treat this and `docs/AI-Recommendations-Walkthrough.md`
as the source of truth over the older PRD/Tech Design docs where they conflict.

---

## 1) The product change, in one paragraph

Opening the site (or `/dashboard` directly) no longer requires an account.
A brand-new visitor lands on the dashboard immediately, can add tasks and
interests, request AI recommendations, and accept/skip them — all of it
persisted in their browser. Signing in is now an optional, low-pressure
action ("Save progress") that syncs that same local data into an account so
it follows the user across devices. Existing signed-in users see no change:
same routes, same database, same behavior.

---

## 2) Why localStorage, not IndexedDB

The task asked to pick whichever fits best and explain briefly. LocalStorage:

- The guest dataset (interests, a handful of goals/tasks, recent suggestions)
  is small, flat, and text-only — nothing that needs IndexedDB's object
  store/index/blob capabilities.
- All reads are "give me everything" (list tasks, list suggestions) rather
  than indexed range queries, so IndexedDB's query features buy nothing here.
- Synchronous access keeps `src/lib/guest/store.ts` simple: plain functions
  that read-mutate-write, no async ceremony, no transaction boundaries to
  reason about.
- One JSON blob under one key (`next-action:guest-data:v1`) is trivial to
  version, validate with Zod, and safely reset if it's ever corrupt or from
  an incompatible future version (see §4).

If the guest dataset ever needs to hold large attachments or the app needs
offline-queryable indexes, that's the point to revisit IndexedDB — the
storage layer is isolated behind `src/lib/guest/storage.ts` specifically so
that swap wouldn't touch the rest of the app.

**Cookies are not used for guest data.** The only auth-related cookies are
next-auth's own session cookies for signed-in users; guests carry no cookie
at all — their identity is just a `guestId` embedded in the localStorage
blob, used only to label the record, never sent to the server.

---

## 3) The data adapter — how components stay storage-agnostic

Components never call `fetch("/api/tasks")` or Prisma directly, and never
branch on `useSession()` themselves. They call a `DataAdapter`
(`src/lib/data/adapter.ts`), obtained from `useDataAdapter()`
(`src/lib/data/data-context.tsx`):

```
useDataAdapter() → { adapter, mode, isReady, showMigrationPrompt, runMigration, ... }
```

`DataProvider` watches `useSession()` and hands out one of two
implementations of the same interface:

- **`guest-adapter.ts`** — reads/writes `src/lib/guest/store.ts`
  (localStorage). For recommendations, it also does the local quota check
  and orchestrates the request (see §5).
- **`server-adapter.ts`** — thin `fetch()` wrapper around the existing,
  unchanged REST API (`/api/tasks`, `/api/goals`, `/api/user/interests`,
  `/api/recommendations`, confirm/skip). This is exactly what signed-in
  users used before this change — no new behavior for them.

Every page (`dashboard`, `dashboard/tasks`, `dashboard/goals`,
`dashboard/history`, `onboarding/interests`) is now a client component that
calls `adapter.listX()` / `adapter.createX()` in a `useEffect`, instead of a
server component doing `getServerSession` + a Prisma query + a redirect.
That's the one unavoidable structural change: guest data only exists in the
browser, so nothing that depends on it can be resolved on the server anymore.
Signed-in users still get exactly the same server-backed data — it's just
fetched over `fetch()` after mount instead of inline during SSR, so there's a
brief "Loading your dashboard…" state instead of the previous instant
server-rendered page. That loading gate is also what onboarding-vs-dashboard
routing depends on client-side now (see `src/app/dashboard/page.tsx`).

---

## 4) Guest data shape, storage, and safety

`src/lib/guest/types.ts` defines `GuestData`: interests, goals, tasks,
generated-suggestion history (with accept/skip `decision`), onboarding
completion, and a `migratedAt`/`migratedUserId` pair. One record, one
localStorage key: `next-action:guest-data:v1`.

`src/lib/guest/storage.ts` is the only place that touches
`window.localStorage`:

- Every read is validated against a Zod schema. Missing key, corrupt JSON,
  or a shape Zod rejects (e.g. from a future incompatible version) all fall
  back to a **fresh empty record** — never a crash, never a thrown error the
  UI has to handle.
- `GUEST_DATA_VERSION` exists for forward migrations: bump it and extend
  `migrate()` in `storage.ts` when the shape changes, so old local data gets
  upgraded in place instead of discarded.
- Every write is wrapped in `try/catch` — private browsing, a full quota, or
  a disabled storage API degrade to "nothing persists this session" rather
  than breaking the page.
- IDs (`src/lib/guest/id.ts`) use `crypto.randomUUID()` with a fallback for
  environments without it, so every record has a stable local id from
  creation, and timestamps are ISO strings set at write time.

---

## 5) Recommendations for guests

`POST /api/recommendations` now branches on whether the request is
authenticated (see `docs/AI-Recommendations-Walkthrough.md` for the full
flow). The guest path:

1. **Client-side quota check first.** `guest-adapter.ts` calls
   `canUseGuestGeneratedSuggestion()` — if the browser-local count of
   suggestions created today (UTC) is already at the shared cap (5, same as
   signed-in users), the UI shows the daily-limit message and **no network
   request is made at all**.
2. **Client builds a compact context summary** from its own local data —
   interest labels, a handful of task "themes," and reference texts (task
   titles + recent suggestion titles/next-actions, for the uniqueness guard)
   — and sends only that summary, not full records, as a `guest` field on
   the request body.
3. **Server never needs a user id.** It builds the same prompt inputs from
   that client-supplied summary instead of DB queries, and runs the exact
   same generation + uniqueness-retry logic (`getGeneratedSuggestionWithUniquenessGuard`,
   extracted so both branches share one implementation). No `GeneratedSuggestion`
   row is written and no `recommendationId` is returned.
4. **Client assigns its own local id** for the returned suggestion and
   stores it in `localStorage` with `decision: "pending"` — accept/skip
   (`confirmSuggestion`/`skipSuggestion` on the adapter) then resolve
   entirely client-side, same shape as the signed-in flow.

The Anthropic API key is only ever read server-side
(`process.env.ANTHROPIC_API_KEY` inside the route handler / `generate-suggestion.ts`)
— it's never sent to, or reachable from, the browser in either path.

---

## 6) Optional sign-in and migration

Signing in was already just next-auth's existing magic-link flow — nothing
about auth itself changed. What's new is the offer to bring local data along:

- `MigrationBanner` (`src/components/migration-banner.tsx`) appears on the
  dashboard once someone is signed in *and* `hasUnmigratedGuestData()` finds
  local data that hasn't been synced yet. It never blocks anything; "Not now"
  dismisses it for the session.
- "Sync now" calls `POST /api/guest/migrate` (`src/app/api/guest/migrate/route.ts`)
  with the guest's goals, tasks, interests, and suggestion history.
- **Idempotency:** every guest record already carries a client-generated
  `localId`. `Goal`, `Task`, and `GeneratedSuggestion` each gained a nullable
  `localId` column, unique **per user** — `@@unique([userId, localId])`
  (migrations `20260823000000_add_local_id_for_guest_migration` and
  `20260823010000_scope_local_id_per_user`) — so every write in the migrate
  route is `prisma.<model>.upsert({ where: { userId_localId: { userId, localId } }, ... })`.
  Retrying the exact same payload — a dropped connection, a double-click —
  updates nothing new; it can't create duplicates. Interests don't need a
  `localId` for this: they're merged into the account's existing interests
  and deduped case-insensitively, which is naturally idempotent.
  `localId` is scoped **per user, not globally unique**, on purpose: it's a
  client-supplied, unvalidated string, so a global unique constraint would
  let one signed-in user's migration payload collide with another user's
  existing `localId` — the upsert would resolve to that user's row, and its
  real database id (e.g. a goal id) could then get referenced from the
  attacker's own new rows. Scoping to `(userId, localId)` makes that
  impossible: a caller can only ever resolve or reference `localId`s within
  their own rows.
- **Never wipes local data on failure.** `markGuestDataMigrated()` (which
  only sets `migratedAt`/`migratedUserId` on the local record — it does not
  delete anything) is called only after the server confirms success. If the
  request fails, the guest data is untouched and "Sync now" can simply be
  clicked again.
- **After success**, the local record is marked migrated (not deleted) and
  the app is already reading from the server adapter (it switched the moment
  the session became authenticated) — so the UI is fully on signed-in
  storage from that point on, no reload needed.

---

## 7) Sync status indicator

`src/components/sync-status.tsx` renders next to the dashboard heading:
"Saved on this device" (guest) or "Synced to your account" (signed-in), with
a "Save progress" link in the guest state. The header's own auth control
(`src/components/header-auth.tsx`) says "Save progress" instead of "Sign in"
when signed out, for the same reason: signing in is framed as syncing, not a
requirement.

---

## 8) What did *not* change

- Prisma schema, signed-in API routes, and their Zod validation are
  untouched other than the three new `localId` columns.
- The signed-in recommendation flow (prompt building, Zod validation,
  similarity guard, fallback behavior, DB-backed daily quota) is byte-for-byte
  the same logic, now shared via `getGeneratedSuggestionWithUniquenessGuard`
  instead of duplicated.
- `next-auth` config, email sign-in, and session handling are unchanged.
