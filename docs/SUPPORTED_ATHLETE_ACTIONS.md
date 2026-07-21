# Supported Athlete Actions — QA Contract

**Derived from `ATHLETE_CHANGE_VOCABULARY.md` (signed off 2026-07-03/04).
This page is the test surface. If an action is not on this page, we do not
test it, and an AI agent must not invent a test for it.**

Pass criteria for EVERY action below (the product loop):

1. Athlete taps a visible Program control.
2. The app previews the exact change (or applies a trivially-safe one).
3. The rules engine repairs the week where needed.
4. The visible plan changes to match — same session, same day, no silent
   side effects on other days/exercises/loads.
5. The change survives app relaunch.

A test FAILS if the claim and the visible plan disagree, if anything not
requested changed, or if a legal action is refused.

---

## Group 1 — This session (day tap → sheet)

| # | Action | Status | Test note |
|---|--------|--------|-----------|
| 1.1 | Swap session → Conditioning (Light/Hard) | BUILT (Sprint deferred) | Producer picks template; check variety vs rest of week |
| 1.2 | Swap session → Strength (Upper/Lower/Full/Accessories) | BUILT 07-04 | Producer picks split; Upper avoids existing push/pull |
| 1.3 | Swap session → Recovery | BUILT | Registry template lands on day |
| 1.4 | Swap session → Rest day | BUILT | Confirm step, then rest |
| 1.5 | Move session to another day | BUILT | Only legal days offered; occupied destination = atomic swap |
| 1.6 | Bin session (incl. one of a multi-session day; incl. team training single-date) | BUILT 07-04 | Recurring team schedule untouched; no re-injection |
| 1.7 | Add session to rest day | BUILT | Same categories as swap |
| 1.8 | Add conditioning onto occupied day | BUILT 07-04 | Combined S+C day materializes; one block per day |

## Group 2 — How I'm going

| # | Action | Status | Test note |
|---|--------|--------|-----------|
| 2.1 | Session feedback: done/partial/skipped + feel + soreness | BUILT | Persists; feeds readiness bias |
| 2.2 | "Too easy / too hard lately" load nudge | NOT BUILT (small event needed) | Do not test until built |

## Group 3 — My body ("I'm not 100%")

| # | Action | Status | Test note |
|---|--------|--------|-----------|
| 3.1 | Tired → readiness signal for today | BUILT 07-04 | Self-heals tomorrow |
| 3.2 | Sick: sniffle → today becomes Recovery Flow | BUILT 07-04 | |
| 3.3 | Sick: bed-ridden → confirm → recovery-only week | BUILT 07-04 | Games untouched |
| 3.4 | Injured → body area → plan adapts + clean un-do | BUILT | Murky cases open coach PRE-LOADED, never re-asks |

## Group 4 — Games

| # | Action | Status | Test note |
|---|--------|--------|-----------|
| 4.1 | Add / move / remove a game | BUILT | G−1/G+1 re-derive automatically |
| 4.2 | Bye this week | BUILT | Unlocks hard-conditioning menu |

## Group 5 — My schedule (rare, settings-level)

| # | Action | Status | Test note |
|---|--------|--------|-----------|
| 5.1 | Season phase change | BUILT | Phase-shift modal. Off-season removing team-training days is INTENDED (no scheduled club training off-season — Sam, 2026-07-22) |
| 5.2 | Available days / team nights changed | BUILT | Setup regeneration |
| 5.3 | Away / holiday date range | PARTIAL | Rest marks exist; travel template future |
| 5.4 | Busy this week → pick which days are out | DECIDED 2026-07-22, NOT BUILT | Replaces the vague "make training lighter" busy path. Same mechanic as away, scoped to picked days: days become rest → week repairs → preview → approve. Do not test the old busy route. |
| 5.5 | Missed session → past un-logged day card asks "Did it / Missed it / Move it forward" | DECIDED 2026-07-22, NOT BUILT | FLOW_AUDIT gap #3. Depends on Group B (visible persistence of feedback signals) landing first. |

## Group 6 — Ask the coach (chat, demoted)

Questions and compound cases only. **Coach-driven program mutations are NOT
under test until the tap system is proven AND the architecture reassessment
required by CLAUDE.md is done** (triggers on record from 2026-07-21: wrong-
domain mutation with false "Done", silent load drift, §18 preview-gate
refusal of a benign edit).

## Override principle (applies across groups)

Nothing legal is hidden or hard-blocked; risky choices get an advisory
warning + "proceed anyway". Test that the warning shows AND that proceeding
works. Free-form content is still rejected — that rejection is correct
behaviour, not a bug.

---

## Explicitly NOT product — do not test, do not build tests for

- Editing session **duration** (field exists internally; no athlete control;
  confirmed pointless 2026-07-21)
- Editing individual sets/reps/loads via chat phrases
- Any free-text mutation path as primary interface
- Anything requiring the athlete to know internal vocabulary
- **Journal** (workout history, personal records, log-workout screens) —
  built but unwired to any navigator by design; not reachable from any tab,
  so not testable. See `docs/audits/JOURNAL_2026-07-22.md`. Backlog entry
  below.
- **Auth** (sign in / sign up / forgot password / sign out) — built but
  unwired by design; no reachable entry point anywhere, including the
  post-Full-reset onboarding landing screen. App is effectively local-only
  today. See `docs/audits/AUTH_2026-07-22.md`. Backlog entry below.

## Known pre-existing gaps (log once, don't rediscover)

See `FLOW_AUDIT_2026-07-07.md`: busy-week tap path not on live screen,
wellbeing actions date-target bug, missed-session concept absent, equipment
not consumed by generation, feedback only steering strength, sheet-added
strength uses placeholder rx, team-training "different night this week"
missing. These are product decisions / feature work — an audit finding that
duplicates one of these is noise.

## Backlog (not built, not scheduled — product to size later)

**Journal.** Athlete-facing weekly log of numbers, progress, and fatigue,
so the athlete can review "was I too tired this week? / did I do too
much?" and adjust their program from it. Includes free-note sections for
recovery, mobility, injury, diet, and life stress. Must draw on the same
feedback/readiness data as fix group B (visible persistence of session
feedback and readiness signals) rather than standing up a parallel store —
Journal is a view over that data, not a second source of truth for it.

**Auth/account strategy.** Decide the auth/account strategy before release.
Today there is no reachable sign-in anywhere in the app — it is effectively
local-only (see `docs/audits/AUTH_2026-07-22.md`). Needs a product decision
on whether/how accounts, sign-in, and sign-out ship, not just wiring the
existing SignIn/SignUp/ForgotPassword screens back in.
