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

## Decisions (Sam, 2026-07-03 — SIGNED OFF)

1. **Menu wording: athlete language.** "I'm cooked", "I'm injured".
2. **Feedback auto-prompts after each session** — better data for rolling
   programming beats the mild friction.
3. **Edit horizon locked: this week + next 2, view-only beyond.**
4. **Chat folds into the day sheet** as the layered "something else…" door —
   no separate front-door tab.

## Sheet v2 (Sam, 2026-07-03 evening — SIGNED OFF)

The Phase-1 flat menu deepens into russian-doll categories. Every pick
below the category level is DETERMINISTIC (producer, not LLM): policy
filters + date-seeded rotation choose the concrete session. The AI coach
only ever talks in the "I'm not 100%" flows.

**Swap this session** → Conditioning / Strength / Recovery / Rest day
- Conditioning → Light / Hard / Sprint (DEFERRED — on-legs running
  policy lands with RUNNING_RULES_PLAN.md). Producer picks the template:
  registry filter + variety (avoid what's already in the week) +
  date-hash rotation.
- Strength → Upper / Lower / Full body / Accessories. Athlete picks the
  bucket; producer picks push-vs-pull / squat-vs-hinge from week context.
  Generated via the EXISTING programming engine (microcycle splits +
  buildTagAwareSession: tag scoring, game proximity, injury filters,
  weekly variety) — materialized through the template-registry seam the
  writer already uses (templateId → builder). Needs real prescriptions
  wired (one-off path currently placeholder 3×8-10) + load estimates.
  Accessories = Gunshow-style pump AND rehab/prehab for small groups
  (groin, rotator cuff…) — the derived-session types that already exist.
- Recovery → puts a recovery flow on the day (registry template).
- Rest day → same as bin (confirm step, then rest).

**Move it to another day** → any non-game day in horizon, rest days
listed first. Occupied destination = the two days SWAP atomically
(supersedes the backlogged "move v2 merge" idea).

**Bin this session** → confirm step (built). On multi-session days the
athlete picks WHICH to bin or both — any session is binnable, including
team training (that single date only; the recurring team schedule and
future weeks are untouched; manual override wins at resolver priority 1
so team training never re-injects). Partial bin needs: conditioning-
promotion (removing all strength currently trips
protected_conditioning_missing) and team-overlay rebuild (overlay is
baked into the generated workout name/flags).

**"I'm not 100%"** (new option, replaces old ask-coach slot) → Tired /
Sick / Injured, each with SEVERITY TAPS. Clear ends apply
deterministically with no chat (bed-ridden → recovery-only week;
absolutely cooked → rest bias; athlete can re-add sessions when better,
optionally offered light flushes/accessory days). Injuries and murky
middles open the coach PRE-LOADED with what was tapped — never re-asks.

**Something else — ask the coach** → unchanged, demoted to true
catch-all.

**Add a session** (rest days) → same russian-doll categories as swap.
Also addable to OCCUPIED days (e.g. conditioning onto a lower-body day)
→ needs combined-day merge machinery; same later phase as partial bin.

**Build order (approved):** 1) menu restructure + conditioning
categories with deterministic pick, 2) move-as-swap, 3) bin scopes incl.
team training, 4) strength generation wiring, 5) "I'm not 100%".

## Athlete override principle (Sam, 2026-07-04 — SIGNED OFF)

**The athlete can choose anything and override anything in the program.**
Nothing on the menu is hidden or blocked by coaching policy — caution is
expressed as an advisory warning at the point of choice, then the athlete
proceeds if they want. Supersedes the hard bye-week gate from 2026-07-03.

- Hard session on a game week → "Make sure you don't overdo it — we want
  you fresh for game day." → *Add it anyway — I'm good*.
- Third-plus hard session in one week (off/pre-season stacking) →
  burnout warning, same proceed affordance.
- Single warning owner: `planChangeWarningForCategory` in the producer.
  The validator's byeOnly mechanism remains in place but is fed an empty
  list — a future hard gate is one line away. Free-form (non-registry)
  content is still rejected: override covers the athlete's CHOICE, never
  arbitrary content.
