# The Athlete Change Vocabulary — design page for sign-off

**Status: DESIGN — no code. This is the one page everything else follows
from.** The premise (Sam, 2026-07-03): the app replaces the S&C coach; the
plan is the product; athletes don't need freedom to say anything — they need
the handful of changes a real athlete actually makes, one tap away, with the
plan updating instantly and visibly.

## Principle

**The plan is the interface.** Tap a day → see the session → "Want to change
something?" → a short menu. The menu only ever shows *legal* options for that
day and week — policy becomes what's on the menu, not something the coach has
to explain or refuse. Every tap produces a typed, deterministic change that
runs through the SAME validate → apply → verify pipeline the chat coach uses
today. No interpretation layer, no clarify loops, ~2s apply (like today's
"yes" confirm — there's nothing to interpret).

Chat stays, demoted to two jobs: questions ("why is Thursday easy?") and the
compound/weird cases no menu covers ("away Mon–Wed and my knee's sore").

## The vocabulary

Six groups. Everything an athlete does to a plan falls in one; each maps to
machinery that already exists.

**1. This session** (tap a day)
- *Swap it* → menu of approved alternatives for that day/week (template
  registry; bye-gating already decides what appears — hard sessions simply
  don't show on game weeks)
- *Remove it / make it lighter* → revision pipeline remove/reduce (built)
- *Move it to another day* → shows only legal destination days (move
  validator, built)
- *Add something* (on a rest day) → same registry menu (built)

**2. How I'm going** (the coach's eyes — after a session or any time)
- *Done / partial / skipped* + *how it felt* (very easy → very hard),
  soreness → `SessionFeedback` store, exists end-to-end; feeds the resolver's
  readiness bias ("cooked" → rest over extra work). This is what lets 3–4-week
  rolling programming react to what actually happened.
- *Too easy / too hard lately* → load nudge (needs a small new adjustment
  event; the adjustment machinery exists)

**3. My body** (injury / sick)
- *I've hurt something* → pick body area → plan adapts around it
  (injury-tagged overrides + off-feet conversion — `applyAdjustmentEvents`,
  exists; includes clean un-do when healed, exists)
- *I'm sick* → this week goes recovery-only (same machinery, new event type)

**4. Games** (tap the calendar or a game day)
- *Add / move / remove a game* → `calendarStore` marks `'game'`/`'noGame'`;
  virtual weekly game + suppression logic already handles the ripple
  (G−1/G+1 sessions re-derive automatically — never stored, so no cleanup)
- *Bye this week* → `'noGame'` mark — and this automatically unlocks the
  hard-conditioning menu (already wired)

**5. My schedule** (settings-level, rare)
- *Season phase change* → exists (phase-shift modal)
- *Available days / team training nights changed* → setup regeneration
  pipeline (exists; today chat routes there via out_of_scope_setup)
- *Away / holiday* → date-range → rest marks or a travel week (rest marks
  exist; "travel template" is optional future)

**6. Ask the coach** (chat, unchanged pipeline)
- Questions, explanations, and anything compound. Same validated apply path,
  so it can never lie about what it did.

## What this kills, structurally

Every bug class we fought this fortnight came from unbounded input: date
ambiguity ("which Monday?"), intent guessing (add vs swap), refusal wording,
option discovery ("what are my options?"), 8–15s LLM latency. A menu can't be
ambiguous about the day (you tapped it), the intent (you picked it), or the
options (they're on screen). The LLM leaves the critical path; the validator
stays as the single enforcement layer for BOTH doors, so a menu bug still
can't corrupt a plan.

## Build order (proposal, after sign-off)

1. Day-tap sheet with group 1 (session changes) — highest frequency, all
   backend built; this is a UI + deterministic-proposal-producer job.
2. Group 4 (games) — store exists, UI is thin.
3. Groups 2–3 (feedback, injury) — feedback UI partially exists; wire nudges.
4. Group 5 already has flows; link them from the sheet.
5. Chat demotion is just navigation — pipeline untouched.

Running-rules plan (RUNNING_RULES_PLAN.md) is unaffected — it's generation-
side and still worth doing; this page governs the *change* side.

## Open decisions

1. Menu wording: athlete language ("I'm cooked", "hurt something") vs neutral
   ("reduce load", "report injury")? I'd go athlete language.
2. Does group 2 feedback prompt automatically after each session, or stay
   opt-in? (Auto-prompt = better data for rolling programming, mild friction.)
3. Horizon: lock editing to this week + next 2, view-only beyond — matches
   your 3–4-week coaching model and shrinks the surface further. Confirm.
4. Chat placement: its own tab as now, or inside the day sheet as "something
   else…"? (I'd fold it in — one door, layered.)
