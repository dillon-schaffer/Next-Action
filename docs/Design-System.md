# Design System

Visual design decisions for the app: the surface hierarchy, the palette and
where each color is allowed to appear, the motion system, the custom
sign-in page, and the reusable pieces. This document has been rewritten
three times as the approach changed (grayscale → brand palette as accents →
full-app recolor at raw hex strength → **current: the same recolor, tuned
by rendering it and looking at it**); it describes the current state only.
Tokens live in `src/app/globals.css`.

---

## 1) The palette — full strength vs. tinted

| Token | Full-strength hex | Role |
|---|---|---|
| Ebony | `#5F634F` | Text, icons, primary buttons, borders, focus rings |
| Light Blue | `#9BC4CB` | Header band (tinted, not full strength — see below), stripe accents |
| Frozen Water | `#CFEBDF` | Secondary/status card fill, source tint for the page canvas |
| Frosted Mint | `#E2FADB` | Source tint for the content panel + inputs |
| Tea Green | `#DBEFBC` | Reserved for small "selected/rich" accents; source tint for the primary card |

The first full-strength recolor (all five hexes applied directly to large
surfaces) technically passed every contrast check but still looked
**patchy**: Frozen Water, Frosted Mint, and Tea Green are all similar
mid-light values, so three of them stacked as nested full-strength fills
read as "slightly different shades of the same off-green" rather than an
intentional hierarchy — and the fully-saturated Light Blue header sitting
directly above them read as a second, unrelated app. Meanwhile every
selected control and primary button being solid Ebony scattered several
heavy dark-olive blocks through every screen.

**The fix — tint large surfaces toward white, reserve full strength for
small accents:**

| Token | Value | Recipe |
|---|---|---|
| `--background` (canvas) | `#f6fbf9` | Frozen Water blended 18% into white |
| `--secondary`/`--muted` (content panel, inputs) | `#f3fdf1` | Frosted Mint blended 40% into white |
| `--card` (primary card) | `#e7f4d1` | Tea Green blended 68% into white |
| `--header` | `#d2e4e8` | Light Blue blended 45% into white |
| `--accent` (hover tint) | `#e3f3cd` | a touch deeper than `--secondary` |

Each tier is a **different blend of a different source color**, not the
same color at different opacities — that keeps the hue relationships (cool
canvas → green panel → greener card) while making each step read as a
deliberate degree of emphasis instead of a hard color-block boundary. Full
Tea Green (`#DBEFBC`) is now reserved for one job: the "selected/rich" pop
on toggle controls and the "Accepted" history badge, where it needs to
visually jump off the now much lighter `--card` — a job it couldn't do at
raw strength when the card *was* raw Tea Green (they were the same color).

Borders were softened alongside the fills (`Card` went from a 2px
`border-foreground/20` down to a 1px `border-foreground/12`, the outline
button from `border-2 border-foreground/60` to `border border-foreground/40`,
`--input` from 45% Ebony to 30%) — once the surfaces themselves carry real
tonal separation, thick dark outlines around every element read as
"coloring-book," not "polished."

**Contrast is unaffected by any of this — lightening a surface only
increases its contrast against Ebony text.** Every tint above still gives
Ebony text 5.3–6.0:1 (checked against the tightest case, the card tint).
Light Blue is still never a fill directly behind body text — even tinted,
Ebony only reaches 4.7:1 at 45% strength on a large area, and the numbers
get worse, not better, at higher opacity, so it stays header-band-and-
stripes only (the wordmark is sized/weighted to qualify as WCAG "large
text," 3:1 minimum — see the header comment in `layout.tsx`).
`--destructive` (`#551010`) is unaffected by the tuning pass and stays
comfortably safe (11:1+ on the tinted surfaces, even more margin than
before since they're lighter now).

**There is no separate lighter "muted" text color** — `--muted-foreground`
still equals `--foreground` (both Ebony); hierarchy comes from size/weight,
not a second text tone the palette doesn't have room for.

---

## 2) Surface hierarchy

Four visible layers, each a tint of a different source color:

```
--background  (canvas, Frozen Water tint)
 └─ --secondary  (content panel, PageSurface component, Frosted Mint tint)
     └─ --card  (primary card, Tea Green tint)
         └─ --secondary again (chips/inputs, lighter than the card)
         └─ full Ebony (primary buttons) or full Tea Green (selected states)
```

| Layer | Surface | Implementation |
|---|---|---|
| Page canvas | Frozen Water tint | `body` background |
| **Content panel** | Frosted Mint tint | `PageSurface` (`src/components/page-surface.tsx`) |
| Primary card | Tea Green tint | `Card` component default (`--card`) — forms, list rows, onboarding, recommendation result, Save Progress |
| Secondary/status card | Full-strength Frozen Water fill + Light Blue left-border stripe | Fallback message, daily-limit-reached, empty states — deliberately more saturated than the tinted card, since these are occasional/secondary, not the dominant surface |
| Header band | Tinted Light Blue (`--header`) | Full-bleed, wordmark sized to qualify as large text |
| Chips/tags/badges on a card | Frosted Mint tint fill + Ebony border | Interest chips, goal-tag pills, "AI-suggested" tag, confidence badge |
| Inputs/textareas | Frosted Mint tint fill, visible Ebony border (`--input`, 30%) | Every `<input>`/`<textarea>`/`<select>` |
| Primary buttons | Ebony fill, Frosted Mint text | Get recommendation, Add to my tasks, Create task/goal, Continue/Save, Send sign-in link — the one truly dark color, spent on one action per screen |
| Secondary buttons | Frosted Mint tint fill, Ebony border | Skip, Back to guest mode, nav links |
| **Selected toggle states** | **Full-strength Tea Green fill**, Ebony border + text | Energy/Uniqueness/idea-hint pills — full Tea Green now pops clearly against the *tinted* card, and reads as "chosen, still light" rather than "committed," which is also a better semantic match than reusing the button's dark Ebony for a selection that hasn't submitted anything yet |

### Signature stripe

A 4px near-black (`border-l-foreground`) left edge on the recommendation
result and migration banner. Secondary/status cards use a Light Blue stripe
instead — the one place Light Blue's "info/status" role lives, since it
can't be the fill.

---

## 3) Motion system

Unchanged from the previous pass — carried forward as-is:

- One blanket `@media (prefers-reduced-motion: reduce)` rule collapses all
  animation/transition durations to ~0, catching every current and future
  motion rule without per-utility `motion-safe:` prefixes.
- 150–220ms, `var(--ease-out)`.
- Card entrance (fade + 6px rise) on mount only, via `.animate-card-in` on
  `Card`, `EmptyState`, and `PageSurface`.
- Hover: 1px lift + border/color shift on cards, buttons, pills, rows; plain
  text nav links get just the color shift.
- CSS grid-rows expand/collapse for the idea-hint field.
- Shimmering skeleton (`.animate-shimmer`, uses `--muted`/Frosted Mint) while
  a recommendation is generating.
- Small checkmark + fade-in on the accept confirmation and momentum
  indicator — no confetti, no bounce.

---

## 4) Reusable pieces

- **`PageSurface`** (`src/components/page-surface.tsx`) — new this pass. The
  Frosted Mint content-panel wrapper every page uses instead of a bare div.
- **`Button`** variants: `default` (Ebony/primary), `outline`/`secondary`
  (Frosted Mint + Ebony border), `ghost`, `destructive`, `link`. The earlier
  separate `accent` variant was retired — once Ebony became the palette's
  one "selected/primary" color, a second core-loop color no longer made
  sense (and Tea Green couldn't fill that role without disappearing into
  its own card).
- **`EmptyState`** — Frozen Water + Light Blue stripe, same family as the
  fallback/daily-limit cards, not a separate treatment.
- **`MomentumIndicator`** — unchanged in behavior, recolored (Ebony dot).

---

## 5) Custom sign-in page

`src/app/auth/sign-in/page.tsx`, wired via `pages.signIn` in
`src/auth.config.ts`. Framed as "Save your progress." The card is the same
Tea Green main-card surface as everywhere else. The one thing still unique
to this screen: a very light Light Blue wash on the page background
(`bg-light-blue/12` — tuned down from an initial 20% after checking body
text landed at only 4.55:1 there; 12% keeps a safe 4.7:1 margin) and
full-viewport centering, both scoped to this one screen. Submitting stays
on the page (`signIn("email", { redirect: false })` swaps in an inline
"Check your email" state). "Back to guest mode" is a real `<Link>` to the
callback URL — plain navigation, touches no local data. A plain credentials
form renders only when `E2E_TEST_MODE=1` (never in production).

---

## 6) What didn't change

Component *structure* and the `DataAdapter` guest/signed-in abstraction are
untouched — this was a visual pass. See `docs/Guest-First-Architecture.md`
for the data layer.
