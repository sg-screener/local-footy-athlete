# The recovery day: who decided, and who wrote it

**STATUS: TRACE ONLY. NOTHING CHANGED. Sam rules before any behaviour change,
and per his instruction this is NOT folded into the promotion.**

## (a) Which code decides a day becomes "Recovery" rather than "Rest"

`coachingEngine.ts`, the weekly allocator. It pushes a recovery slot outright,
with the focus text written inline at the call site:

- `:1980` — `plan.push({ tier: 'recovery', focus: 'Post-game recovery - flush,
  mobility, stretching', dayOfWeek: slot.dayName, isHardExposure: false })`
- `:2003` — `plan.push({ tier: 'recovery', focus: 'Mobility, foam rolling, light
  movement', ... })`
- `:1792`, `:2177`, `:2196` — three more `tier: 'recovery'` allocations.

**Authored source cited: none.** No sheet, no contract field, no Bible reference
at any of the five sites. The choice is a hardcoded branch in the allocator, and
the athlete-facing `focus` string is a literal typed beside it — which is also how
"aerobic conditioning component" reached a card (the same file, `:1262`/`:6500`).

There is no code path that asks the athlete, and no stored decision representing
their answer. `restStress.trueFullRestDays` is derived from what the allocator
already chose.

## (b) Who authored the recovery template's exercise list

**Split, and the split is the finding.**

- The exercise NAMES and their cues ARE authored: `Foam Roll — Calves & Outer
  Shins`, `Foam Roll — Hip Flexor, Quad, Adductors`, `Foam Roll — IT Band`,
  `Foam Roll — Lats`, `Foam Roll — T-Spine`, `Adductor Rockback` all appear in
  `src/data/exerciseCues.ts` with cues, so they are on Sam's sheet and pass the
  locked-list and cue gates.
- The SELECTION AND ORDERING — which of those becomes "the recovery session", how
  many, in what sequence — has **no authored source I can find**. There is no
  recovery template in `mobilityFlowTemplates.ts` (no `RECOVERY` entry), and the
  allocator's own description of the session is the free-text `focus` string above.

So: authored vocabulary, **invented composition**. The athlete sees a session whose
individual exercises Sam wrote and whose shape nobody did.

## (c) The Bible says the choice is the athlete's

Sam's reading is supported by every mention, and the wording is consistent rather
than incidental:

- `:79` — "rest or recovery day - **user can always add** a session i.e. a
  flushout or aerobic base session if they want to (some athletes like doing this)
  but maybe just put a warning"
- `:81` — all THREE ideal weekly structures end "sunday **rest or recovery**", and
  each names "friday gunshow **or** recovery"
- `:122` — "You can **always add** a recovery or mobility flow to any day **as
  optional**"
- `:134` — "Rules around G+1: complete **rest or recovery**"

Four independent statements, all disjunctive, all framing recovery as OPTIONAL and
ADDED. **Nothing in the Bible instructs the app to choose.** The generator
currently resolves a disjunction the Bible left open, and resolves it the same way
every time.

## Recommendation

**Treat this as its own unit, and rule it as an athlete decision.** Concretely:

1. The allocator emits a day whose kind is **`rest_or_recovery` — an open
   choice**, not a resolved one. That is the Bible's own shape, and under the north
   star an unresolved choice is exactly the kind of thing that should be DERIVED
   from the absence of a decision rather than decided at generation.
2. Until the athlete chooses, the day presents as **rest** — the safer reading of
   "complete rest or recovery", and the one that cannot manufacture work nobody
   asked for. The recovery flow is offered, per `:122`, as something they can
   always add.
3. Their choice is a stored **decision** (the edit ledger already has the shape),
   so it survives regeneration and is visible in the tape.
4. The recovery session's COMPOSITION needs authoring before it is offered as a
   real session under ruling 3 — Sam writes which of his foam-roll/rockback/stretch
   exercises make the session, in what order. The names are already his; the shape
   is not.

**Why not fold it into the promotion:** the promotion makes recovery first-class
for rendering, menus and editing. This changes WHO DECIDES a recovery day exists.
Doing both at once would mean shipping a first-class day type whose existence is
still decided by a hardcoded branch, and any later correction would move athlete
state rather than code.

## Immediate answer to Sam's flag on item (2)

**Nothing to flag.** The hard-day taxonomy already parses the sentence as Sam
means it. `sectionClassificationAdapter.ts:148` maps the category
`gunshow_prehab` — one category covering BOTH gunshow and prehab — to
`contributions.gunshow`, and `section18EffectiveWeekEvaluator.ts:470-477` sends
accessory, gunshow and recovery contributions to `dayRecovery = true`, never
`dayHard`. So all four of gunshow, accessories, recovery and **prehab** are
already NOT hard days. No code path counts any of them as hard.
