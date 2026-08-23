# THE FEMALE PATH — SAM'S BRIEF, RULED 2026-08-23

**Written by seat `primer` at Sam's request, straight after R-129 shipped, so the
seat that builds this starts from his answers rather than from questions he has
already answered. Every quoted line below is his.**

---

## THE RULING, IN HIS WORDS

> *"Add female path - no gunshow option, favour primer as default instead, put
> core on upper days to minimise upper accessories and add more glutes / lowers
> accessories to their lowers days, more knee work too). Will need to add an
> onboarding step to make sure there is a female path. That needs to be saved in
> profile."*

**ONE SWITCH.** *"It's one switch. Male or Female."* Asked at onboarding, stored
on the profile, and **IMMUTABLE** — *"No it can't be changed after onboarding - a
male is always a male."*

**THE MALE PATH DOES NOT MOVE.** *"Everything in the app right now is built for
the male path. Nothing has to change on the male side."* Treat any male-side diff
as a defect, and measure it: a control run on the male worlds must come back
byte-identical.

**NO EXISTING ATHLETES.** *"There are no existing athletes mate."* No migration,
no back-compat, no default-for-the-unrecorded. The field is required.

### WHAT THE FEMALE PATH CHANGES — ALL OF IT

| # | change | his words |
| --- | --- | --- |
| 1 | **The generator never places a Gunshow.** The Add menu still offers it. | *"never program gunshow for females … if they really want to do it then they can add it"* |
| 2 | **The Primer is placed on G-1, as OPTIONAL** — but only *"if no other sessions exist there"*. **A multi-game week gets NO Primer** unless she adds it. | *"place primer as optional on g-1 if no other sessions exist there - if multi game week = no primer unless they add it"* |
| 3 | **Lower-body accessories and core are prioritised over upper-body accessories.** Core goes on upper days to displace upper accessory volume. | *"Prioritises lower body accessories and core over upper body accessories"* |
| 4 | **Knee work needs no separate mechanism** — *"there should be more focus on lower body accessories which will take care of the knee issue thing"*. |

### THE ONBOARDING STEP — SIGNED COPY

> **Question:** `What is your gender?`
> **Two buttons:** `Male` · `Female`

**These are his literal words and they are the signed copy.** This app REFUSES to
render an athlete-facing string that is not registered with provenance — seat
`primer` shipped a Primer that threw a render error on the athlete's screen for
the invented word `Acceleration`. Register these three strings before building
the screen, not after.

### THE NON-GOAL, STATED SO THE JOB CANNOT BALLOON

**The week's SHAPE does not change.** Same number of days, same session types per
week, same anchors. What changes is *which accessories fill the sessions* and
*which optional session is offered*. Anything that moves the weekly structure is
out of scope and is a new ruling.

---

## WHAT THE AUDIT WILL HIT — FROM SOMEONE WHO JUST BUILT IN HERE

### ⚠ 1. THE BIGGEST SHAPE CHANGE: THE CHARTER ANSWERS GLOBALLY, NOT PER ATHLETE

`rules/sessionTypeCharter.ts` answers four questions for each of Sam's session
types, and **question (a) — "who may place this?" — has exactly ONE answer per
type, for the whole app.** Gunshow says `['generator', 'athlete']`. Primer says
`['athlete']`.

The female path needs BOTH of those answers to depend on WHO THE ATHLETE IS, and
that table has never had to do that. **This is the design decision of the whole
job.** Do it deliberately in the charter's own shape; do NOT sprinkle
`if (female)` through `coachingEngine`. `test:session-type-charter` walks every
type against observed behaviour and will red honestly if the two disagree.

### 2. WHERE THE GUNSHOW IS ACTUALLY PLACED

`utils/coachingEngine.ts`, the remaining-days loop: `slot.offset === -1` pushes
`composedOptionalKind: 'gunshow'`. Its own comment says *"the gunshow is
fixture-relative"* — **no fixture, no G-1, no Gunshow**, which is already why an
away week loses it. That single branch is where change 1 and change 2 both land,
and Sam's *"if no other sessions exist there"* is already the shape of that loop
(it only fills days nothing else claimed).

### 3. THE ACCESSORY MIX IS TYPED, WHICH MAKES CHANGE 3 SMALLER THAN IT SOUNDS

`data/exercisePoolsStrength.ts` keys pools by `PoolSlotKey` × `PoolRole`, with
`isolation_upper` / `isolation_lower` among the slots and `anchor` vs `accessory`
as the role. So *"more lower accessories, fewer upper"* is a change to **how many
of which slot each day asks for** — not free-text, not name matching.

### ⚠ 4. A COLLISION SAM SHOULD RULE BEFORE IT IS BUILT

`rules/consecutiveCoreDayPolicy.ts` limits core work on consecutive days
(`PERMITTED_CONSECUTIVE_CORE_DAYS`, `PREFERRED_CONSECUTIVE_CORE_DAY_BREAK`).
**"Core on every upper day" can fight that rule.** Decide which wins and record
it; do not let one silently override the other.

### 5. ONBOARDING IS A REGISTRY, NOT A HARD-CODED FLOW

`utils/onboardingSteps.ts` — `ONBOARDING_STEPS`, each step with a `visible(data)`
predicate, and `screens/onboarding/reviewRows.ts` derives the review screen from
the same list. Adding a step is small and clean. **Place it EARLY**: generation
reads it.

### 6. THE PRIMER IS BUILT AND ITS SLOTS ARE SIGNED — DO NOT REDESIGN IT

R-129, shipped `f53cfff9`. Ten authored slots, `test:primer-session` 27 cells.
The female path CHANGES ONE THING about it: who may place it. **Its composition,
copy, order, doses and icon are ruled and held.**

---

## THE HARD-WON LESSONS FROM R-129 — READ THESE OR PAY THEM AGAIN

1. **EVERY READ PATH CAN BE RIGHT WHILE THE ATHLETE GETS SOMETHING ELSE.** The
   Primer's composer, template, projection and session template all returned ten
   rows; the WRITE path silently rebuilt the session and deleted four. Twenty-two
   green cells never saw it. **Sam found it on his phone, four times, before it
   was caught.** Any cell that stops at the composer is blind by construction —
   assert against what the athlete READS.
2. **`finaliseWorkoutAfterMutation` RE-DECIDES CONTENT ON EVERY MUTATION.** It is
   a STRENGTH-session canonicaliser. Composed optional sessions now return from
   it untouched. **Anything new that is not an ordinary strength session must
   decide, explicitly, whether it belongs in that pass.**
3. **A RULING THAT SUPERSEDES AN EARLIER ONE DOES NOT UN-WRITE THE CODE THE OLD
   ONE JUSTIFIED.** Three separate defects in one day were this exact shape.
   **When Sam rules here, grep for what the previous ruling is still holding up.**
4. **DECIDE BY THE TYPED MARKER, NEVER BY THE NAME.** Name regexes over sessions
   and exercises broke three different ways in one day. `composedOptionalKind` is
   stamped by the builder and cannot be defeated by a rename.
5. **A NUMBER FROM AN UNCONTROLLED INSTRUMENT IS NOT A MEASUREMENT.** A probe
   read the wrong field and printed `0` regardless; two fixes were made against
   it. A cast invented a field that did not exist and answered `undefined`
   forever, silently. **Control your instrument before you trust its zero.**
6. **MEASURE AT BOTH ENDS, ON THE SAME TREE.** Typecheck and every suite, control
   and candidate, restored byte-identical after. This repo's gates are red on
   `main` in places; without a control you cannot tell your damage from theirs.

**FULL DETAIL:** `docs/STATUS_PRIMER.md` · **THE RULING:** `R-129` in
`docs/RULINGS_REGISTRY.md`.
