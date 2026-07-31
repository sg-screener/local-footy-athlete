# Copy sheet rulings — Sam, 2026-07-30 (running, compiled via Cowork)

Ruled conversationally per the sheet-and-gaps process. Each batch below is
signed by Sam. Wording in quotes is the exact legal string. This document is
the authoring source the SignedCopy sheet is filled from; equality-bound both
directions once implemented.

## Global rules (Sam-ruled, batch 1)

- **Button capitalisation:** short action labels (roughly ≤3 words) use Title
  Case everywhere — "Log Session", "Start Session", "Did It", "Missed It",
  "Move It Forward", "Skip It", "View Summary", "Keep Active", etc.
  Sentence-style options and bodies keep sentence case. (Interpretation noted
  to Sam; correct here if he meant otherwise.)

## Batch 1 — HomeScreenV2 (60 strings): SIGNED with two rewrites

All 60 strings signed as extracted, except:

1. Line 1774 REPLACED. Old: "This restores the exact displaced sessions and
   repairs the affected fixture horizon."
   **New (Sam-signed): "This puts the moved sessions back and sorts the week
   around your game."**
2. Line 1798 REPLACED. Old: "We'll remove this active adjustment from future
   program decisions."
   **New (Sam-signed): "We'll stop factoring this in and get your week back
   to normal."**
3. Capitalisation rule above applied across all short labels in this file.

## Batch 2 — DayWorkoutScreenV2 (38 strings): SIGNED with three rulings

All strings signed as extracted, except:

1. **Template-blank law (Sam-ruled):** any blank inside signed copy (e.g.
   "Add extra [focus] work in similar sessions.", "Avoid [exercise] in
   similar sessions.") may only be filled from Sam's signed vocabulary —
   session-type words (e.g. "conditioning", "upper body strength") or the
   exercise master sheet. Engine-internal text (allocation.focus etc.) is
   structurally barred from the blank; an unmapped engine value fails the
   build rather than falling back. Sam's confirmation verbatim: it should
   just say "add extra conditioning work in similar sessions".
2. Line 2700 REPLACED. Old: "Save a smarter ongoing adjustment"
   **New (Sam-signed): "Save this as an ongoing adjustment"**
3. Line 2758 REPLACED: "Message the coach" → **"Ask Coach"** — one name for
   the action everywhere on the screen.

## Batch 3 — PlanChangeSheet (28 strings): SIGNED with two rulings

All strings signed as extracted, except:

1. Line 541 REPLACED. Old: "Remove it - the day becomes rest" (can lie on
   combined days). **New (Sam-signed): "Remove it — anything else on the day
   stays."** Principle recorded: a signed sentence must never be able to lie —
   copy makes no claims about outcomes that depend on state it can't see.
   **AMENDED 2026-07-31 (ruling 6-IV-3):** the replacement could lie in the
   other direction — on a day whose only content IS the session being removed,
   nothing stays. The sentence above is now the MULTI-CONTENT half of a
   state-selected pair, with a sole-content half beside it. The principle is
   unchanged; it was applied to its own replacement. The retired string named
   here stays retired: it was hyphenated and unpunctuated, and the signed
   sole-content sentence is neither.
2. **Verb unification (Sam-ruled): REMOVE everywhere, not Bin.** "Bin this
   session" → "Remove this session"; "Yes, bin it" → "Yes, remove it";
   "No, keep it" stays. One verb for the act across the app.

Terminal notes (not Sam questions): freeze exact dash/glyph usage as signed;
line 455 fragment "this session" suggests sentence-assembly in code — retire
composition-by-concatenation, don't sign fragments.

## Batch 4 — HomeQuickActionSheet + all remaining files (72 strings): SIGNED

All strings signed as extracted, except:

1. **"Message the coach" → "Ask Coach" APP-WIDE (Sam-ruled).** One name for
   the action everywhere (HomeQuickActionSheet x4, StaleOverrideBanner x2,
   and the batch-2 instance). "Ask the coach..." placeholder on CoachScreen
   stays as-is (it is the coach screen's own input, not the action label).
2. Verb ruling applied: line 131 "Bin the missed session and keep the week
   moving" → **"Remove the missed session and keep the week moving"**. Any
   stray "bin" falls under the batch-3 Remove ruling.
3. Four rewrites (Sam-signed):
   - Line 154: "Adds an active schedule adjustment" →
     **"We'll lighten the load across the week"**
   - Line 159: "Needs the exact days before changing the plan" →
     **"Tell us which days you can't train"**
   - Line 185: "Use the guided body-status flow" →
     **"Tell us what's going on and we'll adjust"**
   - Line 190: "Needs the session or exercise affected" →
     **"Tell us which session or exercise"**
4. **"I'm injured" (Sam-ruled)** — homeScreenConstants line 158 "I got
   injured" → "I'm injured", matching CoachScreen.
5. ScheduleDebugPanel (13 strings): Sam approved the terminal determination —
   if athlete-unreachable it leaves the athlete sheet (dev surface); if
   reachable, its internal vocabulary ("Hard cap", "Remaining budget",
   "Resolved session") is a violation to fix. Terminal to verify
   reachability and record which.

## STATUS: ALL 200 RULED — sheet complete, 2026-07-30

Every athlete-visible string now traces to this document. Global rules:
Title Case for short action labels; template blanks fill only from signed
vocabulary; signed sentences never claim state-dependent outcomes; one verb
(Remove), one coach action name (Ask Coach); exact glyphs frozen as signed.

---

## Batch 5 — PROPOSED, NOT SIGNED (session type charter, 2026-07-30)

**STATUS: AWAITING SAM.** Every athlete-visible string the charter unit
introduced or changed is listed here before it is asked about. Nothing below is
signed; `copyRulingsBindingTests` binds the list to the code in both directions,
so a proposed string that is not in the app fails, and an athlete-visible string
in these surfaces that is not proposed fails too. That is the transitional form
of "nothing athlete-visible ships unsigned": it may ship PROPOSED, and it may
never ship unlisted.

### 5a. The Mobility door — NEW, needs wording

The Bible grants mobility outright (":122 — you can always add a recovery or
mobility flow to any day as optional") and the app has never offered it. The
door now exists and needs a name.

| Where | Proposed string |
|---|---|
| `CATEGORY_COPY.mobility.label` | "Mobility" |
| `CATEGORY_COPY.mobility.sub` | "A flow to loosen up - easy ranges only" |

Written in the voice of the six categories beside it; Title Case label follows
the batch-1 capitalisation rule. **The flow NAMES themselves are already yours**
— they come from `MOBILITY_FLOW_TEMPLATES`, so "Lower Body Reset",
"Ankles/Calves Reset" and the rest are traced, not proposed.

### 5b. Three strength sessions that existed and could not be reached

Their LABELS are not new — `canonicalStrengthLabel` has been putting them on
session cards for months, so the athlete already reads them. What is new is that
they now appear in a picker, which needs a line of description each.

| Session | Label (already shipping) | Proposed description |
|---|---|---|
| Lower Squat | "Lower Squat" | "Squat-led legs - quads, glutes and knee-friendly volume." |
| Lower Hinge | "Lower Hinge" | "Hinge-led legs - hamstrings, glutes and posterior chain." |
| Upper Body Strength | "Upper Body Strength" | "Push and pull together - the whole upper body in one session." |

The four already in the picker keep their existing descriptions unchanged.

### 5c. The Mobility door's own sentence

| Where | Proposed string |
|---|---|
| Mobility template description | "A full-body mobility flow - easy ranges only, nothing forced." |

**Revised the same day by your supersession.** It was a template with two
`derived_number` blanks — a flow's duration and its movement count — and both
came from a pre-built bundle that no longer exists. A composed session's length
varies with the athlete's equipment (it shrinks rather than padding), so a
sentence promising a count would be a signed sentence that can lie, which batch 3
forbids by name. No blanks now.

### 5d. A signed sentence that stopped needing part of itself

Not a rewording — a sentence that assembles from what the repair actually did,
and the repair now does less.

Before, binning Tuesday's Upper Pull also emptied Friday's optional session to
manufacture a rest day, and the confirmation disclosed it:

> "Upper Pull was removed. Pulling work was added to Wednesday. I also
> rebalanced Friday to keep your week balanced."

Under your Rest law the app no longer strips optional work, so nothing happens to
Friday and the sentence is now:

> "Upper Pull was removed. Pulling work was added to Wednesday."

**No new words.** Recorded because the disclosed-repair rule (invariant #4)
requires the confirmation to name every day touched, and a sentence still
claiming Friday would be a signed sentence that lies — which batch 3 forbids by
name.

### What is NOT proposed, and why

- **Team-day placeholder focus "Full rest"** — never reaches the athlete. The
  team-day label pass replaces it with the real team session before render, and
  it is only ever placed on a team day, so the pass always runs.
- **The seven strength labels** — all pre-existing; pinned verbatim by
  `strengthSessionVariantTests` B3 so a rename is a red cell rather than a rename
  nothing notices.

## Batch 6 — buttons/UI unit (2026-07-31): SIGNED

**STATUS: SIGNED BY SAM, 2026-07-31.** Every PROPOSED string in §6-II is signed
as written. The five rulings he gave in the same pass are recorded in §6-IV,
which is now four RULED items and no open questions.

**THE ONE CAVEAT, STANDING.** Two of the signed sentences (§6-II-e's busy-fact
body, §6-II-f's two success acknowledgments) are honest against INTENDED
behaviour, not current behaviour, because of declared reds 8 and 9 (§6-V). Sam's
signature covers them as written; **they come back for signing when that red is
paid**, because the effect clause they will need does not exist yet. Recorded
here rather than in a task report so the wording cannot outlive the behaviour.

Icons remain IMAGERY and are not signed as text (§6-II-h) — they are checked at
the combined device pass, which is where a glyph can actually be judged.

Everything below was accumulated task-by-task across the buttons/UI unit
(Tasks 1-11) and is tidied here, by Task 12, into four subsections so Sam can
sign it in one pass instead of eleven. **No string's content changed in this
tidy** — every quoted string is byte-identical to the task section it came
from; only the grouping, headings and cross-references moved. Every entry
keeps its originating `[Task N]` tag. Every `where-it-appears` pointer below
was re-verified against the file at HEAD (2026-07-31, unit-complete) by Task
12 — a handful had drifted a few lines from when they were first proposed
(normal churn across 8 further tasks' worth of commits); the current
locations are what is recorded.

Table rows are the binder's unit: `copyRulingsBindingTests`'s Batch-5-style
scan starts at the `## Batch 5 — PROPOSED` heading above and reads every
`|`-prefixed line to the end of the file, so **every quoted string inside a
table row here is checked against the app, both directions** (proposed-but-
unshipped fails; shipped-but-unproposed fails). Retired strings and
not-yet-reachable strings are therefore written in prose, unquoted-in-table,
exactly as the pre-tidy sections did — that convention is preserved, not
invented by this pass.

### 6-I. SIGNED-BY-RULING

Every entry below is copy Sam dictated verbatim in
`docs/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md` ("copy herein is
Sam-authored and feeds the signed-copy sheet when implemented") — recorded as
a pointer, not proposed, because there is nothing to ask.

**6-I-a. The four week-screen button labels — rulings 2, 3, 4 [Task 7]**

Quoted from `HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md` lines 12-17, not
written by the terminal.

| Row | String | Ruling | Where it appears (HEAD) |
|---|---|---|---|
| Short on time | "Short on time today" | Ruling 2 — the busy half of the split | `HomeScreenV2.tsx:627` (a11y), `:638` (Text) |
| Away | "Away this week?" | Ruling 2 — the away half of the split | `HomeScreenV2.tsx:655` (a11y), `:666` (Text) |
| Readiness | "I'm sick/flat today" | Ruling 4 — replaces the retired old label (6-III) | `HomeScreenV2.tsx:720` (fallback title) |
| Injury | "I'm injured" | Ruling 3 — new button, straight to the guided injury flow | `HomeScreenV2.tsx:739` (a11y), `:752` (Text) |

The bottom section now reads, in order: "No game this week - add one" ·
**"Short on time today"** · **"Away this week?"** · **"I'm sick/flat today"**
· **"I'm injured"** · "Missing equipment?" · practice-match · phase card.
Ruling 5 (equipment, practice match unchanged) and the phase card are
untouched — a constraint verified, not a task.

The readiness rename is bound BOTH DIRECTIONS by
`readinessSourceFactOwnershipTests` and `weeklyReadinessCardTests`
(`WEEK_READINESS_ENTRY_LABEL`, plus an explicit assertion that "I'm not 100%"
is gone from `HomeScreenV2`).

**6-I-b. The other nine rulings — behavioural, not new literal copy**

The remaining rulings govern WHAT the app does, not new words Sam dictated;
where they touch copy, the words are task-composed and therefore PROPOSED
(6-II) or an open question (6-IV), never signed-by-ruling. Pointers only:

| Ruling | What it ruled | Shipped by | Status |
|---|---|---|---|
| 1 | Repeat-week dies entirely | Task 1 | SHIPPED — 13 strings retired, 6-III |
| 5 | Equipment / practice-match buttons unchanged | Task 7 (constraint) | VERIFIED unchanged, not a task |
| 6 | Every week-screen button carries an icon | Tasks 7, 9 | SHIPPED — imagery, no per-icon signing (6-II-h below) |
| 7 | Intermediate "Edit this session" menu deleted | Task 4 | SHIPPED — strings retired, 6-III |
| 8 | The four-action menu is the whole menu | Task 4 | SHIPPED — sub-line wording task-composed, 6-II |
| 9 | Add/Swap menus offer the five signed types | Task 4 | SHIPPED — label question open, 6-IV |
| 10 | Global icon rule, every option row | Tasks 4, 8, 9 | SHIPPED — imagery, no per-icon signing |
| 11 | Injury "Other" data-path investigation | pre-unit, commit `4bb425a` | ALREADY DONE — not a task in this unit |
| 12 | "Edit exercises" modal retired, inline editing | Task 8 | SHIPPED — Sam's live mid-review ruling recorded in 6-III |
| 13 | Seven Coach preset chips removed | Task 10 | SHIPPED — strings retired, 6-III; coach voice migration LR-6-BLOCKED (NOT-COVERED) |

### 6-II. SIGNED — every new string (proposed 2026-07-31, signed the same day)

**6-II-a. Day/part headlines + row-prescription fallbacks [Task 2]**

`project()` (`src/rules/projectVisibleWeek.ts`) now resolves every headline
through the signed-copy sheet (`src/rules/projectionCopy.ts`). Most of the
vocabulary it needed already existed and is traced, not proposed: the seven
pinned strength session names (`data/strengthSessionVariants.ts`), the
`TEAM_ONLY_NAME` team-day constant, the whole locked exercise vocabulary and
its authored cues. What follows is the honest remainder — no existing signed
source covers it.

**Not formatted as a table, still, on purpose.** `copyRulingsBindingTests`'s
binder scans `screens/home`, `screens/coach`, `components`, and four named
authoring modules (`utils/planChangeProducer.ts`,
`utils/coachRevisionTemplates.ts`, `data/strengthSessionVariants.ts`,
`data/mobilityFlowTemplates.ts`) — `src/rules/projectionCopy.ts`, where these
entries are registered, is not one of them, and the literal text (e.g.
"Training Day") does not appear verbatim in any scanned file — it is
produced at runtime via `signedCopy('day.headline.training')`, not inlined.
**At the time this was first written (Task 2) that was because no screen
called `project()` yet; that is no longer true — Tasks 3-6 wired the card,
menu, title and content surfaces onto `project()`, so these words are now
genuinely athlete-visible.** The binder gap survives the reason for it
changing, and is recorded as a NOT-COVERED finding for whoever extends the
binder next (boundary report, method findings) rather than silently converted
to a table, which would make the binder falsely report every entry below as
"proposed and not in the app."

1. Day-kind headlines (`day.headline.<kind>`) — `projectionCopy.ts`:
   "Training Day", "Rest Day", "Game Day".
   **1b. `day.headline.practice_match` — "Practice Match". NEW, SIGNED
   2026-07-31 (ruling 6-IV-4).** The one day headline that is not a bare
   kind lookup: a practice/trial fixture reads its own word. LABEL ONLY —
   `dayIsFixture` keeps its week-shape behaviour, the day KIND stays `game`,
   and every capability with it, so this is a second WORD for one kind of day
   and never a second kind. Selected by `dayIsPracticeMatch`
   (`projectVisibleWeek.ts`), a read of the same typed `workoutType` set
   `dayIsFixture` already uses, so the label and the week shape cannot come
   to disagree about which days are fixtures. It reaches all three render
   sites through the two shared helpers — the week card and the away-day
   picker via `visibleDayLeadHeadline`, the day-detail title via
   `projectDayDetail`. **Known producer seam, recorded not assumed:**
   `'Practice Match'` is not a member of the `WorkoutType` union, and the
   generator's own practice-match anchor still resolves its day through
   `createGameStub` (`workoutType: 'Game'`), so on a freshly generated week
   the day still reads "Game Day". The signed word is registered and wired at
   the one place the athlete reads it and turns on the day a practice-match
   anchor materialises with its own type — a typed seam ahead of its
   producer, not a dead string.
2. The day refusal sentence (`day.refusal.nothing_to_change`) —
   `projectionCopy.ts:128`: "There's nothing to change on this day."
3. Generic part-kind headline fallbacks (`part.headline.<kind>`) —
   `projectionCopy.ts:142,149,157,163,169,175,181`, used when a kind has no
   existing specific name, or (strength only) when the specific resolution
   does not match one of the seven pinned names: "Strength", "Conditioning",
   "Recovery", "Power", "Speed", "Midline Work" (support), "Game Day"
   (part-level; same text as the day-kind headline, registered under its own
   id — REACHABLE since Task 6, via a fixture's last-resort `session`
   placeholder converting to a `game`-kind part).
4. The row-prescription fallback (`row.prescription.unspecified`) —
   `projectionCopy.ts:247`: "See session" — used only for prescription shapes
   not yet covered (distance, tempo, per-side); every other row-prescription
   entry mirrors an existing shipping format
   (`dayWorkoutHelpers.formatStrengthSetsReps` /
   `formatRecoveryPrescription`) and is not proposed as new wording.

**Deviation recorded rather than silently narrowed [Task 2]:** the brief
named `CATEGORY_COPY` (`utils/planChangeProducer.ts:192-241`) as the reuse
source for conditioning/mobility/gunshow/prehab part headlines. It was not
used. `CATEGORY_COPY` labels the ADD-menu's categories, not an identity a
placed session's own component carries, and nothing typed on a `Workout`
reliably says "this conditioning session is the light-flush kind" without
inventing a new classifier — the fourth-naming-authority failure this unit
exists to prevent. Gunshow/prehab/mobility resolve correctly through the
strength path (item 3 above is only their fallback): `resolveSessionDisplayName`
already passes their own template name through untouched rather than
mis-naming them as a squat/hinge/push/pull session — it just will not match
one of the seven pinned labels, so they get the generic "Strength" word until
a future unit gives them a specific one. Conditioning gets the same honest,
generic treatment for the same reason.

**6-II-b. The four-action menu — new and changed sub-lines [Task 4]**

**A DISABLED ROW SAYS WHY, AND THE WHY IS SELECTED BY A TYPED FACT.** Review
found two lines that could state something false; both are fixed by letting
the CAUSE be typed rather than letting one sentence guess which cause it
describes — a signed sentence never claims a state-dependent outcome, and
"there is nothing here" is a claim about state.

| Row | String | Where it appears (HEAD) | Why it is here |
|---|---|---|---|
| Swap (live) | "Change it for another type of session" | `PlanChangeSheet.tsx:518` | REWRITE of a batch-3-signed sub-line (it enumerated strength, conditioning and recovery — see 6-III). `recovery` left the menu under ruling 9. **OPEN QUESTION 6-IV-2:** this names no type at all rather than listing the five. |
| Swap (off, day has work) | "Nothing on this day can be swapped." | `PlanChangeSheet.tsx:520` | NEW. A team night or a club commitment HAS something on it; it is just not the athlete's to trade. Selected by `hasSession`, which the projection owns. |
| Swap (off, empty day) / Remove (off) | "There's nothing on this day yet." | `PlanChangeSheet.tsx:521,563` | NEW, one string for both. `canRemove` is false only when the day holds nothing, and the Swap row uses it on the same condition, so neither can show over a day that has work on it. |
| Add row | "Put another session on this day" | `PlanChangeSheet.tsx:535` | REWRITE. Used to name extra strength or conditioning work — two of the five types behind it (ruling 9); retired wording in 6-III. **OPEN QUESTION 6-IV-2.** |
| Strength row | "Upper, lower or full body" | `PlanChangeSheet.tsx:647` | REWRITE. Used to end by naming accessories too (6-III). Accessories and Gunshow now have rows of their own, so the strength bucket is three buckets and says so. |
| Remove (live, day has more on it) | "Remove it — anything else on the day stays." | `PlanChangeSheet.tsx` Remove row | Batch-3-signed, now the MULTI-CONTENT half of a state-selected pair (ruling 6-IV-3). |
| Remove (live, sole-content day) | "Remove it — the day becomes rest." | `PlanChangeSheet.tsx` Remove row | NEW, SIGNED 2026-07-31 (6-IV-3). The batch-3 sentence beside it was false on a day whose only content is the session being removed; the cause is typed, not guessed. |

The Move row has no sub-line of its own: when the move door refuses, the row
renders the producer's own TYPED refusal sentence. Two of those changed.

| Refusal | String | Where it appears (HEAD) | Why it changed |
|---|---|---|---|
| `anchored_day` | "Team training is fixed to this day, so it can't be moved from here." | `planChangeProducer.ts:416` | Used to continue with a clause offering to swap or bin the gym work on the day — two faults: the retired verb (Remove, not Bin), and a claim about state it cannot see (a team night with no gym work has none to swap). |
| `nothing_movable` (NEW reason) | "Nothing on this day can be moved to another day." | `planChangeProducer.ts:418` | NEW. `anchored_day` used to cover two causes with one sentence, so a Club Session day told the athlete team training was fixed to a day with no team training. The reason is now split by the projection's part kinds; neither sentence can show about the wrong day. |

**6-II-c. Reused, not new [Task 4]** — the Gunshow, Mobility and Accessories
rows render `CATEGORY_COPY`'s existing labels and sub-lines verbatim: "Gunshow"
/ "Arms and delts - light pump work", "Mobility" / "A flow to loosen up - easy
ranges only", and the fifth row's sub-line "Groin, calves, midline, shoulders -
the armour work" (`planChangeProducer.ts`). Already bound by Batch 5 — not
re-listed here. **The fifth row's LABEL is no longer "Prehab":** Sam signed
"Accessories" on 2026-07-31 (6-IV-1). The sub-line is unchanged and was signed
as written — "the armour work" describes what the door places whichever noun
heads the row.

**6-II-d. What Task 6 changed with no new copy [Task 6]**

**NOTHING NEW IS PROPOSED, AND THAT IS THE HEADLINE.** The day-detail
screen's title and metadata line now render `projectDayDetail(visibleDay)` —
the day and part headlines already listed in 6-II-a. No word was invented
for this task. What CHANGED is which words the screen says (the title moved
from a re-derivation off `workout.name` to the same shared headline the week
card shows; the exercise count now counts numbered rows actually rendered)
and what was retired (the raw `workoutType` metadata line — 6-III).

**6-II-e. Today-scoped schedule-fact copy [Task 7]**

Under ruling 2 the busy fact is now TODAY-scoped, which made the existing
modifier copy false for a day-scoped fact ("Busy week active" for a fact that
spans one day). The sentences are now selected by the fact's own
`scope.kind`; the week-scoped wording is unchanged and still ships for a
week-scoped fact. New, PROPOSED:

- Modifier title, single-day busy fact: "Short on time today" —
  `src/rules/temporarySourceFact.ts:872`
- Modifier body, single-day busy fact: "Today's session drops the
  highest-cost work. The rest of your week is untouched." —
  `temporarySourceFact.ts:878`
- Reason label, single-day busy fact: "Short on time" (was "Busy week") —
  `temporarySourceFact.ts:858`

Not tabled: `copyRulingsBindingTests` binds table rows against `screens/`,
`components/` and the four named authoring modules, and
`src/rules/temporarySourceFact.ts` is none of them (same binder gap as
6-II-a, different file).

**Honesty note, unresolved:** the body sentence describes what the
constraint is BUILT to do. Declared red 2 in
`programControlDurableOwnershipTests` records that it currently changes
nothing visible in any generated week (6-V), so this sentence is signed
against INTENDED behaviour and must be re-checked when that red is paid.

**6-II-f. What a schedule tap says back [Task 7, review fix]**

Review found both new doors discarded their result and the away sheet closed
unconditionally after its `await`. Since the door is refused on every device
with a real accepted base (declared red 1, 6-V), the athlete tapped "Short on
time today" and was told nothing, and tapped "Clear 1 day" and watched the
sheet close as if it had worked. Three sentences now answer those taps, owned
by `utils/readinessAcknowledgment.ts` (the module that already owns "what the
athlete is told when a tap does not land"):

- Refusal, both doors: "That didn't save — your week is unchanged. Give it
  another go in a moment." — `readinessAcknowledgment.ts:95`
- Success, short on time: "Got it — logged that you're short on time today."
  — `readinessAcknowledgment.ts:90`
- Success, away: "Got it — logged the days you're away." —
  `readinessAcknowledgment.ts:89`

Not tabled, same binder-gap reason as 6-II-e.

**RETIRED FROM THE ATHLETE'S VIEW, not from the code:** "The report was not
applied because the visible program could not be verified."
(`store/temporarySourceFactTransaction.ts`) — a sentence about a verifier,
not about the athlete's week; it stays as a store-layer diagnostic, and the
ack layer is asserted never to forward it.

**Both success sentences claim only what is true today.** Neither promises a
lighter session or a cleared day, because declared red 2 records that the
fact changes nothing an athlete can see. When that red is paid, both need the
effect clause and Sam needs to sign them again — recorded here so the
wording cannot outlive the behaviour.

**6-II-g. New accessibility labels only, no new visible copy [Task 8]**

Every new control is an icon or reuses an existing signed label as its own
`accessibilityLabel`; none of it is `VISIBLE_FIELDS` prose (`accessibilityLabel`
is not one of the extracted fields, and never has been). Not tabled — nothing
here reaches `copyRulingsBindingTests`'s scan (a11y attributes, not rendered
text):

- Top icon row (`DayWorkoutScreenV2.tsx:1168,1176,1184`): "Add an exercise"
  (new), "No equipment for an exercise" (new — distinct from the retired
  row-option label "No equipment", 6-III, so a screen reader does not read
  two different controls the same way), "Something hurts" (reused verbatim —
  the only place left in the file carrying these words, since 6-III's
  retirement pass)
- Per-row buttons (`DayWorkoutScreenV2.tsx:2383,2396`): "Swap exercise"
  (new), "Remove exercise" (reused verbatim from the pre-existing
  `confirm_remove` step's button label — same act)

**6-II-h. Icons — imagery, no copy, no per-icon signing [Tasks 4, 7, 8, 9]**

Ruling 6 (week-screen) and ruling 10 (global) are both imagery rules, checked
at Sam's device pass, not signed as text:

- **Week screen (7c):** plus (add game) · hourglass (short on time, new) ·
  globe (away — promoted from the old sheet) · pulse (sick/flat, unchanged) ·
  plaster/bandage (injured, new — deliberately not the readiness sheet's
  alert triangle) · dumbbell (equipment) · game (practice match). The old
  busy/away entry's clock retires with it.
- **Four-action menu + Add/Swap rows (Task 4):** arrows-cycle (Swap) · plus
  (Add) · arrow-right-to-bracket (Move) · minus/trash, danger tint (Remove);
  Add/Swap five rows: dumbbell (Strength) / heart-pulse (Conditioning) /
  flexed-arm (Gunshow) / stretch figure (Mobility) / shield (Accessories —
  6-IV-1).
- **Session-detail icon row (8c):** "+" (reused add glyph) · dumbbell
  (reused, same as "Missing equipment?") · plaster/bandage (reused, same as
  "I'm injured") · circular-arrows (row swap, redrawn) · "−" in a circle,
  danger tint (row remove, the one non-reused glyph, matching the app's one
  danger colour).
- **Option-sheet global pass (Task 9):** every row on `swap_reason`,
  `add_kind`, `future_scope`, injury regions/areas/severities and equipment
  tags now carries a glyph; `WeekReadinessSheet`'s three named nonsense
  pairings (Rough sleep chevron, Totally cooked lightning, Sick-how-bad
  droplets) are fixed. Full per-row inventory for Sam's device-pass eyeball:
  `.superpowers/sdd/2026-07-31-buttons-ui-unit/task-9-report.md`, "Per-row
  glyph inventory (Sam's eyeball list)".

**6-II-i. No new copy [Tasks 10, 11]** — Task 10's chip removal (ruling 13)
retires strings and adds none (6-III). Task 11's deletions
(`splitSessionName`, two `resolveSessionDisplayName` inference rules) removed
two *producers* of athlete-facing words that never appeared as a literal in
any surface file — no table entry either direction; the ceiling stays flat
at 141 (6-V) and the provenance is in `signedCopyExtractionTests`.

### 6-III. RETIRED — all retired strings, by task

Not quoted in tables, on purpose: the binder requires a quoted table string
to be PRESENT in the app, and these are the opposite of present.

**[Task 1] Ruling 1 — repeat-week dies entirely.** 13 strings: "Repeat this
week into next week" (×2 — CTA and confirm-sheet button), "Repeated week
active", "This week is using the saved Repeat Week overlay. You can restore
the exact plan it displaced.", "Restore previous target week", "Repeat this
week?", "We'll save this displayed week into next week while keeping next
week's fixtures, Team Training, and phase rules.", "Repeated week saved.
Your next week is ready.", "Repeat Week wasn't saved. Your program is
unchanged.", "Restoring the previous target week…", "Previous target week
restored and saved.", "A newer change owns this week, so Repeat Week was
left untouched.", "Repeat Week couldn't be restored because this week has
changed.", "Repeat Week wasn't restored. Your program is unchanged."
`ATHLETE_VISIBLE_GAP_CEILING`: 187 → 182.

**[Task 4] Rulings 7 and 8 — deleted from `PlanChangeSheet`:**
1. The intermediate menu's Edit-this-session row and its sub-line, which
   listed swap/add/move/remove — the menu in front of the menu.
2. The intermediate menu's Add-optional-session row — chosen by reading a
   workout's `workoutType` and lowercased name (the second-derivation shape
   this unit removes).
3. The not-100% row and its sub-line about tiredness, sickness and niggles —
   readiness lives on the week card only (ruling 7).
4. The ask-the-coach row and its sub-line about anything the menu does not
   cover — the Coach tab covers it.
5. The Add row's old sub-line, naming extra strength or conditioning work for
   a step that offers five types (ruling 9). Replacement in 6-II-b.
6. The two first-draft disabled-row lines ("there's nothing here to
   swap/remove") — review found the swap one false on a team night, which
   HAS something on it. Replacements in 6-II-b, selected by a typed fact.
7. The remove-confirmation FRAGMENT "everything on this day" — a blank
   filled into a sentence the whole-day branch never rendered, already dead
   prose (batch-3's terminal note asks for sentence-assembly fragments to be
   retired rather than signed).

Also retired (rewrites of already-signed strings, not new proposals): the
Swap row's old enumerating sub-line ("strength, conditioning or recovery")
and the Strength row's old sub-line naming accessories as a fourth strength
bucket. Replacements in 6-II-b. The verb ruling (batch 3: Remove everywhere,
not Bin) finishes here too: the bin-scope step heading ("Remove what?") and
the scoped confirmation sentence ("Are you sure? This removes {label} - the
rest of the day stays.").

**[Task 6] Never signed, never listed — the raw `workoutType` header line.**
The metadata line read `` `${workout.workoutType}` `` and, on a combined day,
`` `${workout.workoutType} + Conditioning}` `` — six planner ENUM values
quoted here only to say they are gone: "Mixed", "Flush-Out",
"MAS-Training", "Quality-Sprints", "6x1km", "Nordic-4x4". The line now shows
the projected part headlines (6-II-a), joined with `+`, the same list the
week card renders as its secondary line.

**[Task 7] Rulings 2 and 4.** Five strings gone (the readiness rename is
listed here too — a table row here would assert it is still in the app):
1. "I'm not 100%" — the readiness entry's old label (ruling 4, replaced by
   6-I-a).
2. "Busy or away this week?" — the old entry label and old sheet title (×2).
3. "Busy week — keep me training, go lighter" — the busy row inside the old
   menu.
4. "Away some days — clear them" — the away row inside the old menu.
5. "Back" — the menu step's return button, replaced by Cancel now that there
   is no step to go back to.

The away step keeps every word it had: "Which days are you away?", "No
upcoming sessions to clear this week.", "Clear N day(s)" / "Pick days to
clear". `ATHLETE_VISIBLE_GAP_CEILING`: 166 → 164.

**[Task 8] Ruling 12 — the `menu` and `exercise_menu` steps.** Fifteen
strings (thirteen counted by the extractor;
`ATHLETE_VISIBLE_GAP_CEILING` 164 → 151):
"Edit exercises" (sticky-header link), "Change" (per-row pill), "Make a
focused change inside this session." (menu subtitle), "Swap an exercise" /
"Pick one exercise and choose why it needs changing" (menu row), "Add an
exercise" / "Add one exercise or small block to this session" (menu row),
"Remove an exercise" / "Remove one exercise from today's session" (menu
row), "Something hurts / no equipment" / "Make a guided change inside this
session" (menu row), "Change this exercise only." (exercise_menu subtitle),
"Swap exercise" / "Remove exercise" (exercise_menu rows — distinct from the
surviving `confirm_remove` step's "Remove exercise" **button**, pre-existing
and NOT retired), "Something hurts" / "No equipment" / "Too hard / too easy"
(exercise_menu's duplicate of `concern_reason`'s three options — superseded
by the retirement pass below, once `concern_reason` itself died).

**[Task 8] Retirement pass, review finding + Sam's live ruling —
`concern_reason`, `injury_area`, `injury_severity`.** A review traced
reachability from all five live entry points and found zero forward setters
for these three steps. **SAM RULED** (mid-review): "equipment icon → straight
to the swap suggestion, option (a), as built. The tapped icon states the
reason; no intermediate menu. concern_reason may be retired with the other
unreachable steps." All three deleted outright. Three strings retired here,
all previously counted under the `menu`/`exercise_menu` list above (now
historical): "Something hurts" (`concern_reason` row label — the top icon's
`accessibilityLabel` reuses the words, unaffected, 6-II-g), "No equipment"
(`concern_reason` row label — distinct from the equipment icon's a11y
label), "Too hard / too easy" (`concern_reason` row label — no live path
produces this concern anymore; the `ExerciseConcern` type member and
`prepareConcern`'s branch for it are untouched, a dead branch inside a live
function, not a retired string). `injury_area`/`injury_severity` contributed
no literal strings (their rows were dynamic `label={area}`/`label={severity}`
expressions the extractor never counted) — their retirement is a code-health
fix, not a copy change. `ATHLETE_VISIBLE_GAP_CEILING`: 151 → 148.

**[Task 10] Ruling 13 — the seven Coach preset chips.** Fourteen strings,
seven counted (`ATHLETE_VISIBLE_GAP_CEILING` 148 → 141), each pinned absent
individually by `coachEntrySurfaceContractTests`. Labels: "I missed a
session", "I'm sore", "Feeling cooked this week", "Game day changed", "Swap
an exercise", "Busy week", "I'm injured". Prefills (not extractor-counted —
`prefill` is not a `VISIBLE_FIELDS` field): "I missed yesterday's session - ",
"I'm pretty sore today, especially in my ", "I'm feeling cooked this week -
can we lighten the load?", "My game day's changed - ", "Can you swap ",
"I've got a busy week ahead - ", "I've picked up a niggle - ". **NOT
retired:** the `route.params.prefill` path (other surfaces still navigate to
Coach with a prefill) and "Ask the coach..." (the input's own placeholder,
pre-existing, unchanged).

**Cumulative ceiling this unit: 187 → 141.** (Task 11 held it flat at 141 —
its two deletions were producers with no surface literal to count, so the
extractor's own provenance block records the flat ratchet as correct, not
missed.)

### 6-IV. RULED BY SAM, 2026-07-31 — no open questions remain

All four items below were open questions when this batch went to Sam. All four
are now ruled, in his words, and landed in the same commit as this edit.

**6-IV-1. RULED: the fifth Add/Swap row is "ACCESSORIES". [Task 4]**

> Fifth Add/Swap row label = **"ACCESSORIES"** — ruling 9's own word. It stays
> wired to the prehab door; the shield icon stands.

The session-type charter split `accessories` into two doors on 2026-07-30 and
ruling 9 lists **Gunshow** separately, so the fifth row is the PREHAB door. The
door, the template match and every capability are untouched: the CATEGORY ID
stays `prehab`, which is a typed id nobody reads. Only the word changed.

| Where | Signed label |
|---|---|
| `CATEGORY_COPY.prehab.label` (`planChangeProducer.ts`) | "Accessories" |

The sub-line is UNCHANGED and stands as signed — "Groin, calves, midline,
shoulders - the armour work" describes what this door places whichever noun
heads the row. Ruling 10 (a glyph must mean its row) is satisfied: the icon is
a shield, and Sam kept it.

**6-IV-2. RULED: the Swap/Add sub-lines keep the NEUTRAL form. [Task 4]**

> Sub-lines: NEUTRAL form signed as shipped.

No code change. The two sub-lines one tap above the five-row Add/Swap menu name
no type; the shipped wording is the signed wording.

| Row | SIGNED (neutral) |
|---|---|
| Swap | "Change it for another type of session" |
| Add | "Put another session on this day" |

The ENUMERATING alternative is recorded as NOT TAKEN, so the option is not
re-proposed by the next person who notices the menu is unnamed (written outside
the table on purpose — `copyRulingsBindingTests` requires a quoted table string
to be in the app, and these deliberately are not):

- Swap: Change to strength, conditioning, gunshow, mobility or accessories
- Add: Add strength, conditioning, gunshow, mobility or accessories

The argument that carried it: the five rows are one tap away and name
themselves, and an enumerating sub-line has already rotted TWICE (once when
accessories split into Gunshow and Prehab, once when mobility arrived), each
time leaving a signed sentence describing a menu that had moved.

**6-IV-3. RULED: the Remove sub-line is STATE-SELECTED. [Batch 3 residual,
surfaced again by this unit]**

> Remove sub-line: STATE-SELECTED variant approved — multi-content day:
> **"Remove it — anything else on the day stays."**; sole-content day:
> **"Remove it — the day becomes rest."** A typed cause picks the sentence —
> this unit's own pattern, like the swap sub selected by `hasSession`.

Batch 3's single sentence was false on a day whose only content IS the session
being removed: the next screen shows the day becomes rest, and there is nothing
else to stay. Batch 3's own principle — a signed sentence must never be able to
lie — applied to itself. Both sentences are now signed (the first from batch 3,
the second new here) and listed in 6-II-b.

**ONE PREDICATE, THREE READERS — the part that is architecture, not copy.**
The confirmation one tap later already makes the same claim ("Are you sure? This
will be removed and the day becomes rest."), selected by `step.label === null`.
Two signed sentences making the same claim about the same day is only safe while
ONE fact decides both, so `removeEmptiesTheDay` (`planChangeProducer.ts`, which
owns `binScopes`) is asked three times for one answer: whether the scope picker
appears, which sub-line the row carries, and — through `label: null` — which
confirmation follows. `planChangeMoveScopingTests` (armed in `test:bible`) holds
both halves: the behavioural one over really-produced options, and a source
contract forbidding the sheet from re-deriving the question from
`binScopes.length` itself.

**6-IV-4. RULED: a practice match reads "Practice Match". [Task 2/4/5]**

> PRACTICE MATCH: a practice/trial fixture day reads **"Practice Match"**, not
> "Game Day" — a NEW signed day-headline variant. `dayIsFixture` keeps its
> week-shape behaviour (capabilities/kind untouched); LABEL ONLY distinguishes.

Registered as `day.headline.practice_match` and wired at the one place the
athlete reads it. Full entry, including the honest producer seam, in 6-II-a
item 1b. `projectionOwnershipTests` (armed in `test:bible`) projects a
practice-match day and a competitive fixture from identical input but for the
`workoutType` and asserts everything except the headline is equal — kind, owner,
part kinds and every capability at day and part level — so a future change that
lets the label leak into the week's SHAPE reds before it reaches a phone.

### 6-V. Standing declared reds this unit's copy depends on

Two PROPOSED sentences above (6-II-e, 6-II-f) are honest against INTENDED
behaviour, not current behaviour, because of two declared reds in
`programControlDurableOwnershipTests` [Task 7]: (1) the schedule-fact
transaction refuses every schedule fact against a real accepted base — an
ownership collision between the writer and the verifier, unpatched, needs
Sam; (2) even composed by hand, the constraint changes nothing in any
generated week. Full detail in the boundary report
(`docs/BUTTONS_UI_UNIT_BOUNDARY_2026-07-31.md`), §"Declared reds standing".
