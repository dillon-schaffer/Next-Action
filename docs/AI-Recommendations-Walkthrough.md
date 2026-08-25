# AI Recommendations — Full Walkthrough

This document describes how the AI-generated “next action” suggestions work: files, flow, prompts, validation, storage, quotas, failures, and how to test.

> **Guest-first update (2026-08-23):** The app no longer requires sign-in. `POST /api/recommendations` now serves both signed-in users (unchanged: DB-backed context, DB-backed quota, writes a `GeneratedSuggestion` row) and guests (no session: client-supplied context, browser-local quota, no DB write — the client keeps its own copy in localStorage). See `docs/Guest-First-Architecture.md` for the full guest data model, storage choice, and migration flow. The sections below describe the signed-in path as originally built; guest-specific differences are called out inline.

---

## 1) Files created/modified (exact paths)

| Path | Role |
|------|------|
| `src/lib/llm/generate-suggestion.ts` | Prompt builder + Claude call + Zod validation + fallback for **generated** (new-idea) suggestions |
| `src/lib/llm/claude.ts` | Claude client for **shortlist** recommendations (pick-from-list); not used by the main “Get recommendation” flow |
| `src/lib/llm/generated-quota.ts` | Per-user daily cap (5) for generated suggestions; checked before calling Claude |
| `src/lib/llm/budget.ts` | LLMBudget table usage (10/day for shortlist LLM); not used by generated-suggestion flow |
| `src/lib/similarity.ts` | Uniqueness guard: Jaccard similarity + thresholds (familiar/related/novel) |
| `src/lib/time.ts` | Parses time input (e.g. 45m, 2h, 1d) and caps at 30 days |
| `src/app/api/recommendations/route.ts` | POST: branches on session. **Signed-in:** quota check → fetch interests/tasks/events → build prompt inputs → `getGeneratedSuggestionWithUniquenessGuard` → write `GeneratedSuggestion` → return JSON. **Guest** (no session): client already ran its own local quota check; server builds the same prompt inputs from the `guest` field in the request body (interests/task themes/reference texts/behavior counts the client computed) → same guard function → returns the suggestion with **no** `recommendationId` and **no** DB write. GET: list recommendation events + generated-suggestion history (signed-in only). |
| `src/lib/llm/generate-suggestion.ts` (`getGeneratedSuggestionWithUniquenessGuard`) | Shared retry/fallback logic (get → similarity check → retry once → fallback) used by both the signed-in and guest branches of the route above |
| `src/app/api/guest/migrate/route.ts` | POST (signed-in only): idempotently upserts a guest's localStorage goals/tasks/suggestions into the account by `localId`, merges interests |
| `src/lib/guest/*`, `src/lib/data/*` | Guest storage layer and the `DataAdapter` abstraction UI components call instead of talking to sessions/Prisma directly — see `docs/Guest-First-Architecture.md` |
| `src/app/api/recommendations/generated/[id]/confirm/route.ts` | POST: mark suggestion accepted, create Task from it |
| `src/app/api/recommendations/generated/[id]/skip/route.ts` | POST: mark suggestion skipped |
| `src/app/dashboard/context-form.tsx` | Form: time, energy, uniqueness, optional idea hint → POST /api/recommendations |
| `src/app/dashboard/dashboard-client.tsx` | Renders result (generated card, fallback message, daily limit), Add to tasks / Skip buttons |
| `prisma/schema.prisma` | Models: GeneratedSuggestion, LLMBudget, RecommendationEvent (and Task, User, UserInterest) |

---

## 2) What each file does (plain English)

**`src/lib/llm/generate-suggestion.ts`**  
Builds the prompt for Claude (context, interests, recent behavior, uniqueness rule, optional idea hint and “different from these” references). Calls Anthropic `messages.create` with a single user message, max 350 output tokens. Strips markdown code fences from the reply, parses JSON, validates with Zod. If the API key is missing, JSON is invalid, or validation fails, it returns a fallback object (no throw). No retry for bad JSON (no repair step).

**`src/lib/llm/claude.ts`**  
Used for the **shortlist** flow (choose one task from a list). Not used when the user clicks “Get recommendation” on the dashboard; that path uses `generate-suggestion.ts` only.

**`src/lib/llm/generated-quota.ts`**  
Counts how many `GeneratedSuggestion` rows the user has created today (UTC). If count ≥ 5, `canUseGeneratedSuggestion` returns false and the API returns a “daily limit reached” response without calling Claude.

**`src/lib/llm/budget.ts`**  
Reads/writes `LLMBudget` (per user per day) for the older shortlist LLM feature. The main “Get recommendation” (generated suggestion) flow does **not** use this; it uses only `generated-quota.ts` and the count of `GeneratedSuggestion` rows.

**`src/lib/similarity.ts`**  
Normalizes and tokenizes two strings, computes Jaccard similarity (word overlap). `isTooSimilar(title, nextAction, referenceTexts, threshold)` returns true if either the title or nextAction is too similar to any reference. Thresholds: familiar 0.75, related 0.6, novel 0.4.

**`src/lib/time.ts`**  
`parseTimeInput("45m" | "2h" | "1d" | "60" etc.)` returns minutes or null. Capped at 30 days. Used by the API and the context form.

**`src/app/api/recommendations/route.ts`**  
**POST:** Validates body (time, energy, uniqueness, optional ideaHint). Resolves time from `timeInput` or `timeMinutes`. Checks `canUseGeneratedSuggestion(userId)`; if over cap, returns 200 with `dailyLimitReached: true`. Loads user interests, tasks, recent RecommendationEvents, recent GeneratedSuggestions, and builds `referenceTexts` (existing task titles + recent suggestion title/nextAction). Builds `userInterestsSummary` and `recentBehaviorSummary`. Calls `getGeneratedSuggestion` (first time without referenceTexts). If the result is successful but `isTooSimilar` to references, retries once with `referenceTexts` in the prompt; if still too similar after retry, returns fallback. On success, creates a `GeneratedSuggestion` row with `decision: "pending"` and returns the generated task + `recommendationId`. **GET:** Returns recent recommendation events for the user (for history).

**`src/app/api/recommendations/generated/[id]/confirm/route.ts`**  
**POST:** Ensures the suggestion exists, belongs to the user, and is still `pending`. Creates a new Task from the suggestion’s title, nextAction (as notes), estimatedMinutes. Updates the suggestion to `decision: "accepted"` and `createdTaskId: task.id`.

**`src/app/api/recommendations/generated/[id]/skip/route.ts`**  
**POST:** Ensures the suggestion exists, belongs to the user, and is still `pending`. Updates the suggestion to `decision: "skipped"`.

**`src/app/dashboard/context-form.tsx`**  
Client form: available time (text input, e.g. 60 or 45m), energy (low/med/high), uniqueness (familiar/related/novel), optional “have an idea” + idea hint (max 500 chars). On submit, POSTs to `/api/recommendations` with `timeInput`, `timeMinutes`, `energy`, `uniqueness`, and optionally `ideaHint`. Passes the JSON response to `onRecommendation(result)`.

**`src/app/dashboard/dashboard-client.tsx`**  
Holds the recommendation result in state. Renders the context form; when the result is `type: "generated"`, shows the “Your next action” card with title, nextAction, reasoning, confidence, “Add to my tasks” and “Skip”. “Add to my tasks” POSTs to `/api/recommendations/generated/{id}/confirm`; “Skip” POSTs to `.../skip`. Also renders fallback message and daily-limit message when present.

**`prisma/schema.prisma`**  
Defines `GeneratedSuggestion` (userId, context fields, title, nextAction, estimatedMinutes, tags, reasoning, confidence, model, sourceFeatures, shortlistHash, decision, createdTaskId, createdAt), `LLMBudget` (userId, day, count), and `RecommendationEvent` (used for the older task-pick flow). Enums: `GeneratedSuggestionDecision` (pending, accepted, skipped).

---

## 3) Full request/response flow

1. **UI**  
   User fills context form (time, energy, uniqueness, optional idea hint) and clicks “Get recommendation”.  
   `ContextForm` submits: `POST /api/recommendations` with `{ timeInput, timeMinutes, energy, uniqueness, ideaHint? }`.

2. **API route** (`src/app/api/recommendations/route.ts` POST)  
   - Session → userId. Validate body (Zod). Resolve `timeMinutes`.  
   - **Quota:** `canUseGeneratedSuggestion(userId)`. If false → return 200 `{ dailyLimitReached: true, message: "..." }`.  
   - Load in parallel: interests, tasks (for themes), recent RecommendationEvents, recent GeneratedSuggestions, existing task titles, recent suggestion title/nextAction.  
   - Build `userInterestsSummary`, `recentBehaviorSummary`, `referenceTexts`.  
   - **Prompt build + Claude:** `getGeneratedSuggestion(context, userInterestsSummary, recentBehaviorSummary)` (no referenceTexts on first call).  
   - If outcome is fallback → return 200 `{ fallback: { message, deterministicIdea } }`.  
   - **Uniqueness guard:** If `isTooSimilar(title, nextAction, referenceTexts, threshold)` → retry `getGeneratedSuggestion(..., referenceTexts)`. If retry fails or is still too similar → return 200 with fallback.  
   - **DB write:** `prisma.generatedSuggestion.create({ ...context, title, nextAction, ... decision: "pending" })`.  
   - Return 200 `{ type: "generated", recommendationId, generatedTask, model, meta }`.

3. **UI render**  
   `DashboardClient` receives the response. If `type === "generated"`, it shows the suggestion card and stores `recommendationId`. User can “Add to my tasks” (POST confirm) or “Skip” (POST skip). Confirm creates a Task and marks suggestion accepted; skip marks suggestion skipped.

Flow summary:  
**UI (form submit) → POST /api/recommendations → validate + quota → prompt builder (in getGeneratedSuggestion) → Claude call → validation (Zod) → (optional) similarity retry → DB write (GeneratedSuggestion) → response → UI (card or fallback/daily limit).**

---

## 4) How we build the prompt

**Inputs used**

- **Context:** `timeMinutes`, `energy` (low/med/high), `uniqueness` (familiar/related/novel), optional `ideaHint` (trimmed, max 500 chars in schema).  
- **userInterestsSummary:** From `listInterestsForUser` labels + task themes (goal title + task title). If no interests: fixed line asking for broad, low-risk suggestion and mentioning that adding interests improves suggestions.  
- **recentBehaviorSummary:** Counts only: “Last 10 (existing recs): X accepted, Y skipped. Last 10 (generated): X accepted, Y skipped. No task titles.”  
- **referenceTexts** (optional, used only on retry): Existing task titles + recent generated suggestion titles and nextAction strings. Prompt then includes: “IMPORTANT: Your suggestion MUST be clearly different from these: …”.

**Token limits**

- **Output:** `MAX_OUTPUT_TOKENS = 350` in `generate-suggestion.ts`.  
- Input is not explicitly truncated; the prompt is kept compact (interests slice 0..20, task themes 0..10, recent counts, no full task lists).

**Uniqueness rules (in prompt)**

- **familiar:** Same kind of task user has done before.  
- **related:** Adjacent to existing interests/projects, slight variation.  
- **novel:** New skill/domain, still fitting time/energy.

**Time-fit rules (in prompt)**

- Suggestion must fit within `timeMinutes`.  
- Prefer `estimatedMinutes` using most of the window (e.g. 70–100%); only suggest a short task (e.g. 25 min) when a longer one doesn’t fit.  
- `estimatedMinutes` must be ≤ context time.

**Critical snippet (prompt build)** — `generate-suggestion.ts`:

```ts
return `You suggest ONE new, concrete next action. You do NOT choose from an existing list. Output valid JSON only.

Context: available time = ${context.timeMinutes} minutes; energy = ${context.energy}; uniqueness preference = ${context.uniqueness}.${ideaHintInstruction}

The suggestion MUST fit within the user's available time (${context.timeMinutes} min). Prefer estimatedMinutes that use most of this window (e.g. 70-100%) when it makes sense...
Interests (from user's goals/tasks, themes only): ${userInterestsSummary}
Recent behavior (counts only): ${recentBehaviorSummary}
${differentInstruction}
${uniquenessInstruction}
Output JSON only, no markdown:
{"type":"generated","generatedTask":{"title":"...","nextAction":"...","estimatedMinutes":N,"tags":["..."],"reasoning":"...","confidence":"low|med|high"},"model":"claude-sonnet","meta":{"sourceFeatures":[...],"shortlistHash":"..."}}
Rules: title = one short actionable sentence. nextAction = single step ≤120 chars. estimatedMinutes must be ≤ ${context.timeMinutes}...`;
```

---

## 5) How we validate/parse the AI response

**Zod schema** — `generate-suggestion.ts`:

```ts
const GENERATED_OUTPUT_SCHEMA = z.object({
  type: z.literal("generated"),
  generatedTask: z.object({
    title: z.string(),
    nextAction: z.string().max(120),
    estimatedMinutes: z.number().int().min(1),
    tags: z.array(z.string()),
    reasoning: z.string(),
    confidence: z.enum(["low", "med", "high"]),
  }),
  model: z.string(),
  meta: z.object({
    sourceFeatures: z.array(z.string()),
    shortlistHash: z.string(),
  }),
});
```

**Parsing steps**

1. Get first text block from `response.content`.  
2. Strip optional markdown fences: `trimmed = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim()`.  
3. `JSON.parse(trimmed)` — on throw, return fallback (no JSON repair, no retry).  
4. `GENERATED_OUTPUT_SCHEMA.safeParse(parsed)` — if invalid, return fallback.  
5. On success, return `{ success: true, data: validated.data }`.

**Fallback logic**

- Missing `ANTHROPIC_API_KEY`, JSON parse error, or Zod validation failure: return `{ success: false, fallback: { message: "AI is unavailable. Here's a short idea you can try:", deterministicIdea: FALLBACK_IDEA } }` with `FALLBACK_IDEA = "Spend 15 minutes on the one thing that would make tomorrow easier."`  
- Any thrown error from `client.messages.create` (timeout, 5xx, etc.): same fallback.  
- After similarity retry, if still too similar or retry returns fallback: return fallback with message “I couldn't find a truly new idea right now…” and empty deterministicIdea.

---

## 6) What we store in Postgres for AI

**Tables and key columns**

- **GeneratedSuggestion**  
  - Stored: `userId`, `contextTimeMinutes`, `contextEnergy`, `contextUrgency`, `contextUniqueness`, `title`, `nextAction` (VarChar 120), `estimatedMinutes`, `tags` (JSON array), `reasoning`, `confidence`, `model`, `sourceFeatures` (JSON), `shortlistHash`, `decision` (pending/accepted/skipped), `createdTaskId` (if accepted), `createdAt`.  
  - Used for: quota (count per user per day), similarity references (recent title/nextAction), and confirm/skip flows.

- **LLMBudget**  
  - `userId`, `day` (UTC date), `count`.  
  - Used by the shortlist LLM path only, not by the main “Get recommendation” flow.

- **RecommendationEvent**  
  - Used for the older “pick from list” flow (taskId, context, decision, explanation, model).  
  - The generated-suggestion flow uses its “recent behavior” only as counts in the prompt (accepted/skipped); it does not write RecommendationEvent for generated suggestions.

**What we do NOT store or log**

- Full prompt text or raw model response is not written to the DB.  
- We do not log task titles or user content in application logs (per project rules).  
- No PII or full prompts in `GeneratedSuggestion` beyond the structured fields above.

---

## 7) Quotas and rate limits

**Per-user / per-browser caps**

- **Generated suggestions:** 5 per calendar day (UTC) — same limit for signed-in users and guests. The cap lives in one shared constant, `GENERATED_SUGGESTION_DAILY_CAP` in `src/lib/llm/quota-constants.ts`.
- **Signed-in:** `generated-quota.ts`: `canUseGeneratedSuggestion(userId)` counts `GeneratedSuggestion` rows where `userId` and `createdAt >= dayStart(today)`. If count ≥ 5, the API returns `dailyLimitReached: true` and does not call Claude.
- **Guest:** no DB, so there's nothing to count server-side. `src/lib/guest/store.ts`'s `canUseGuestGeneratedSuggestion()` counts today's entries in the guest's own `localStorage` suggestion list and is checked **client-side, before the network request is made** — a guest at the cap never even calls `/api/recommendations`. This is intentionally a browser-local limit, not a security boundary: a guest could clear localStorage to reset it. That's an accepted trade-off for a guest with no account (see `docs/Guest-First-Architecture.md`).
- **Shortlist LLM** (if used elsewhere): `LLMBudget` with cap 10/day; enforced via `budget.ts`, not in the main recommendation route.

**Where enforced**

- In `src/app/api/recommendations/route.ts` POST, immediately after validating the request body and resolving `timeMinutes`:  
  `const allowed = await canUseGeneratedSuggestion(userId); if (!allowed) return NextResponse.json({ dailyLimitReached: true, message: "..." }, { status: 200 });`  
- No other rate limit (e.g. per-minute) is applied in code. Anthropic’s own API limits apply.

---

## 8) How failures are handled

- **Missing env (ANTHROPIC_API_KEY):** `getGeneratedSuggestion` returns fallback with deterministic idea; no throw.  
- **Invalid request body (Zod):** API returns 400 with `{ error, details }`.  
- **Invalid or missing time:** API returns 400 “Provide timeMinutes or valid timeInput (e.g. 45m, 2h, 1d)”.  
- **Daily cap reached:** API returns 200 `{ dailyLimitReached: true, message }`; UI shows “You've reached your 5 AI suggestions for today…”.  
- **Claude request throws (timeout, 5xx, network):** Caught in `getGeneratedSuggestion`, returns fallback; in development a warning is logged.  
- **Bad JSON from Claude:** `JSON.parse` throws → catch → return fallback (no repair).  
- **Zod validation failure:** `safeParse` fails → return fallback; in development validation error is logged.  
- **Too similar (first response):** Retry once with `referenceTexts`. If retry fails or is still too similar → return fallback “I couldn't find a truly new idea right now…”.  
- **Confirm/Skip:** 404 if suggestion not found or not pending; 401 if not authenticated.

---

## 9) How to test locally

**Commands**

```bash
cd "C:\Coding Projects\Vibe Coding\Decision Making"
npm run dev
```

**Env**

- `.env` must include: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3000` (and any auth/email vars if you test sign-in).

**Steps**

1. Open http://localhost:3000 — you land straight on the dashboard as a guest, no sign-in required. (Optionally click “Save progress” in the header to sign in and try the signed-in path too.)
2. Complete onboarding (interests) if shown; go to dashboard.  
3. Set context: e.g. time “60”, energy Med, uniqueness Related, optionally “Have an idea” + hint.  
4. Click “Get recommendation”.  
5. Expect either: a “Your next action” card (title, next action, reasoning, confidence, Add to my tasks / Skip), or a fallback message, or “You've reached your 5 AI suggestions for today”.  
6. Click “Add to my tasks” → task should appear in Tasks; card clears.  
7. Or click “Skip” → card clears.  
8. Repeat up to 5 times in one day (UTC) to hit quota; 6th request should show daily limit message.

**Where to look**

- Server logs: terminal where `npm run dev` is running (e.g. validation/Claude errors in development).  
- Network tab: POST to `/api/recommendations` and to `/api/recommendations/generated/{id}/confirm` or `/skip`.

---

## 10) How to test in production (Vercel)

**Env vars that must exist**

- `ANTHROPIC_API_KEY` — required for Claude; if missing, users get fallback message.  
- `DATABASE_URL` — Prisma/Neon.  
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (e.g. `https://next-action.vercel.app`).  
- Any auth/email vars used by your sign-in.

**Steps**

1. Deploy the app to Vercel (e.g. push to connected branch).  
2. In Vercel project → Settings → Environment Variables, confirm the above.  
3. Open production URL, sign in, go to dashboard.  
4. Use “Get recommendation” as in local testing; verify generated card or fallback or daily limit.

**Where to look for logs**

- Vercel Dashboard → Project → Deployments → select deployment → “Functions” or “Logs” for serverless function logs.  
- Runtime logs from `generate-suggestion.ts` (e.g. validation/request failures) only appear in development; in production we do not log prompt or response content.  
- For 4xx/5xx: Vercel function logs and response status; for “AI is unavailable” or fallback, check that `ANTHROPIC_API_KEY` is set and that the function isn’t timing out (Vercel serverless limit).

---

## Checklist: If AI stops working, check these 10 things first

1. **ANTHROPIC_API_KEY** — Set in `.env` (local) or Vercel env (production); no typos, key valid.  
2. **Quota** — User under 5 generated suggestions today (UTC)? Check `GeneratedSuggestion` count for that user and date.  
3. **Request body** — POST to `/api/recommendations` includes `timeInput` or `timeMinutes`, `energy`, `uniqueness`; time parses (e.g. 45m, 2h, 1d or number).  
4. **Auth** — Not required. Signed-in requests use `userId` from the session; guest requests have none and that's expected — the route branches on `session?.user?.id`, it never 401s for a missing session.  
5. **Claude response** — In dev, check server logs for “[Claude] Generated suggestion: invalid JSON” or “validation failed”; indicates bad or non-JSON output.  
6. **Fallback path** — If you always get the “AI is unavailable” fallback, key is missing or Claude call is throwing (timeout, 5xx, rate limit).  
7. **Database** — `GeneratedSuggestion` table exists and is writable; Prisma client and `DATABASE_URL` correct.  
8. **Confirm/Skip 404** — Suggestion exists, same user, and `decision` is still `pending`; not already accepted/skipped.  
9. **Vercel timeouts** — Default serverless execution limit; long Claude calls can time out; consider upgrading plan or shortening prompt if needed.  
10. **No logging of secrets** — Ensure prompts and API keys are never logged in production.

---

*End of walkthrough.*
