# AGENTS.md — Master Plan for Next Action Decision Assistant

## Project Overview
**App:** Next Action Decision Assistant  
**Goal:** Helps people decide what to work on next when everything feels important and time is limited.  
**Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui; Next.js Route Handlers; PostgreSQL (Neon) + Prisma; Vercel; NextAuth/Auth.js + Resend; Anthropic Claude Sonnet  
**Current Phase:** Phase 1 — Foundation

## How I Should Think
1. **Understand Intent First**: Identify what the user actually needs before proposing changes.
2. **Ask If Unsure**: If critical information is missing, ask before proceeding.
3. **Plan Before Coding**: Propose a brief plan, ask for approval, then implement.
4. **Verify After Changes**: Run checks/tests after each meaningful change; fix failures before continuing.
5. **Explain Trade-offs**: When recommending choices, include 1–2 alternatives and trade-offs.

## Plan → Execute → Verify
1. **Plan:** Outline a short approach and wait for approval before coding.
2. **Execute:** Implement one small feature at a time (small PR-sized steps).
3. **Verify:** Run the verification steps in `agent_docs/testing.md` after each feature.

## Context & Memory
- Treat `AGENTS.md` and `agent_docs/` as living docs.
- Use tool configs (`.cursorrules`, etc.) to enforce project rules.
- Update these files if stack, commands, or constraints change.

## Optional Roles (If Supported)
- **Explorer:** Scan codebase/docs for relevant context.
- **Builder:** Implement features based on approved plan.
- **Tester:** Run checks and report failures.

## Testing & Verification
- Follow `agent_docs/testing.md`.
- Do not proceed when verification fails.
- Prioritize the core E2E loop: create task → request rec → accept/skip → next rec.

## Checkpoints & Pre-Commit Hooks
- Create commits after each milestone.
- Add pre-commit hooks once basic app scaffolding exists (lint/format/test).

## Context Files
Load only as needed:
- `agent_docs/tech_stack.md`: Stack, dependencies, setup, env vars
- `agent_docs/code_patterns.md`: Architecture and code conventions
- `agent_docs/project_brief.md`: Persistent project rules and workflow
- `agent_docs/product_requirements.md`: PRD requirements and scope
- `agent_docs/testing.md`: Verification commands and checklist
- `agent_docs/resources.md`: Helpful references

## Current State (Update This!)
**Last Updated:** 2026-08-24
**Working On:** —
**Recently Completed:** Visual redesign — restrained grayscale base (no shadows, no vertical-centered "floating card" layouts) plus a 5-color brand accent palette (Blue Slate / Muted Teal / Soft Sage / Dry Sage / Almond Cream) used as fills only, never text color (see `docs/Design-System.md` for the WCAG contrast rules behind that). Custom `/auth/sign-in` page replaces next-auth's default UI. Before that: guest-first — the app requires no sign-in. Guest data (interests, tasks, suggestions, accept/skip history) lives in localStorage behind a `DataAdapter` abstraction (`src/lib/data/`); signed-in users are unchanged. Recommendations, quota, and account migration (idempotent, via `localId` columns) all work for guests. See `docs/Guest-First-Architecture.md`. Also: Recommendations are AI-generated only (no existing-task pick). GeneratedSuggestion table, 5/day quota, confirm/skip flow, fallback message.
**Blocked By:** None

## Roadmap

### Phase 1: Foundation
- [ ] Initialize Next.js app (App Router + TS)
- [ ] Add Tailwind + shadcn/ui
- [ ] Set up Prisma + Neon (schema + migrations)
- [ ] Set up NextAuth + Resend (magic link)
- [ ] Add basic layout + Dashboard shell

### Phase 2: Core Features
- [ ] Tasks CRUD (UI + API)
- [ ] Goals CRUD (UI + API)
- [ ] Context input form (time/energy/urgency)
- [ ] Deterministic recommendation (rules scoring)
- [ ] Recommendation card + accept/skip events
- [ ] History view (recent recommendations/outcomes)

### Phase 3: LLM Enhancement + Guards
- [ ] Shortlist builder (top N tasks)
- [ ] Claude Sonnet integration (bounded prompt + JSON parsing)
- [ ] Fallback on error/timeout → deterministic pick
- [ ] Daily per-user AI cap (10/day) + simple rate guard
- [ ] Cache recommendations (Postgres table, TTL 2–5 min)

### Phase 4: Launch
- [ ] Playwright E2E for main flow
- [ ] Manual smoke test (mobile Safari + desktop)
- [ ] Deploy to Vercel (env vars set)
- [ ] Invite early adopters + collect feedback

## What NOT To Do
- Do NOT add features explicitly marked “Won’t have” in the PRD.
- Do NOT log raw task titles/notes to application logs.
- Do NOT change the database schema without migration + brief note in PR.
- Do NOT bypass failing checks/tests.
- Do NOT expand LLM context beyond the hard limits (input ~4k tokens, output ~300 tokens).
