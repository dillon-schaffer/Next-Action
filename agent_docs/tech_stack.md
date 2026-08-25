# Tech Stack & Tools

## Core Stack
- **Frontend:** Next.js (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Backend:** Next.js Route Handlers (`/app/api/...`) + service layer
- **Database:** PostgreSQL (Neon) + Prisma ORM (signed-in users)
- **Client storage:** localStorage (guest users) — see `docs/Guest-First-Architecture.md`
- **Auth:** NextAuth/Auth.js — optional, framed as "save progress / sync"; the app is guest-first and fully usable with no account
- **Email:** Resend (magic links)
- **Hosting:** Vercel (web) + Neon (DB)
- **LLM:** Anthropic Claude (Sonnet tier)
- **E2E Testing:** Playwright

## Key Constraints
- **Timeline:** 1 week
- **Budget:** ~$20/month total (Hosting/DB ~$10 + LLM ~$10)
- **Performance:** initial load < 2s; first recommendation < 5s target (< 8s acceptable); refresh < 3s
- **LLM Limits:** input ~4k tokens; output ~300 tokens; **10 AI recs/day/user**
- **Privacy:** PII-lite; **never log raw task content**

## Environment Variables (Production)
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `RESEND_API_KEY`
- `ANTHROPIC_API_KEY`

## Local Dev Commands (expected)
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint` (after lint is set up)
- `npx prisma migrate dev`
- `npx prisma studio` (optional)

## Deployment Notes (Vercel)
- Use Vercel Preview Deployments for PR review.
- Ensure Neon connection pooling is configured if needed (avoid too many connections in serverless).
