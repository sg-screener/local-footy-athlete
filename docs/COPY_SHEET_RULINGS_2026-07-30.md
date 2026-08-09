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
| 9 | Add/Swap menus offer the five signed types | Task 4 | SHIPPED — fifth row label RULED "Accessories" (Sam, 2026-07-31), 6-IV-1 |
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
| Swap (live) | "Change it for another type of session" | `PlanChangeSheet.tsx:518` | REWRITE of a batch-3-signed sub-line (it enumerated strength, conditioning and recovery — see 6-III). `recovery` left the menu under ruling 9. **RULED 6-IV-2:** the neutral form (names no type) is signed as shipped. |
| Swap (off, day has work) | "Nothing on this day can be swapped." | `PlanChangeSheet.tsx:520` | NEW. A team night or a club commitment HAS something on it; it is just not the athlete's to trade. Selected by `hasSession`, which the projection owns. |
| Swap (off, empty day) / Remove (off) | "There's nothing on this day yet." | `PlanChangeSheet.tsx:521,563` | NEW, one string for both. `canRemove` is false only when the day holds nothing, and the Swap row uses it on the same condition, so neither can show over a day that has work on it. |
| Add row | "Put another session on this day" | `PlanChangeSheet.tsx:535` | REWRITE. Used to name extra strength or conditioning work — two of the five types behind it (ruling 9); retired wording in 6-III. **RULED 6-IV-2:** the neutral form is signed as shipped. |
| Strength row | "Upper, lower or full body" | `PlanChangeSheet.tsx:647` | REWRITE. Used to end by naming accessories too (6-III). Accessories and Gunshow now have rows of their own, so the strength bucket is three buckets and says so. |
| Remove (live, day has more on it) | "Remove it — anything else on the day stays." | `PlanChangeSheet.tsx` Remove row | Batch-3-signed, now the MULTI-CONTENT half of a state-selected pair (ruling 6-IV-3). |
| Remove (live, sole-content day) | "Remove it — the day becomes rest." | `PlanChangeSheet.tsx` Remove row | NEW, SIGNED 2026-07-31 (6-IV-3). The batch-3 sentence beside it was false on a day whose only content is the session being removed; the cause is typed, not guessed. |

The Move row has no sub-line of its own: when the move door refuses, the row
renders the producer's own TYPED refusal sentence. Two of those changed.

| Refusal | String | Where it appears (HEAD) | Why it changed |
|---|---|---|---|
| `nothing_movable` (NEW reason) | "Nothing on this day can be moved to another day." | `planChangeProducer.ts:418` | NEW. `anchored_day` used to cover two causes with one sentence, so a Club Session day told the athlete team training was fixed to a day with no team training. The reason is now split by the projection's part kinds; neither sentence can show about the wrong day. |

The `anchored_day` row that stood above `nothing_movable` — "Team training is
fixed to this day, so it can't be moved from here." (signed in this batch,
2026-07-31) — is RETIRED by the team-night movability unit (Batch 10, Sam's
2026-08-01 ruling signed 2026-08-02): a team anchor no longer refuses a move,
so the sentence has no reachable cause. Recorded in prose, per §6-III's
convention: the binder asserts quoted table strings PRESENT, and this one is
deliberately gone from the producer.

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

### 6-VI. OPEN QUESTION — the Remove row's sub-line and the whole-day scope
confirm disagree on an unanchored multi-kind day [post-unit review finding,
2026-07-31]

**Not proposed, not signed — a collision between two ALREADY-SIGNED
sentences, surfaced by review after 6-IV-3 landed.** Written outside any
table, on purpose (both sentences below are already present in the app and
already bound by table rows elsewhere in this document — 6-II-b — so a third
quoted occurrence here would be redundant against the binder, not new).

6-IV-3 ruled the Remove row's sub-line STATE-SELECTED by
`removeEmptiesTheDay`: multi-content day, "Remove it — anything else on the
day stays."; sole-content day, "Remove it — the day becomes rest." That
ruling assumed a binary state. `binScopesForSnapshot` produces a third shape
it did not consider: an UNANCHORED day carrying two or more section kinds
(e.g. a plain strength day the athlete has added conditioning to) reports
`removeEmptiesTheDay` FALSE (there is more than one part, so the row reads
"anything else on the day stays") while still offering a "Whole day" scope in
the picker one tap later — because nothing anchors the day, removing
everything is a legal choice, not just a removal of one part. Choosing that
scope reaches the confirmation Sam ruled for the OTHER state: "Are you sure?
This will be removed and the day becomes rest." The row's own sentence and
the confirm one tap later now disagree about the same day, in the same flow,
for a state 6-IV-3 did not name.

**The exact two-sentence collision, reachable and reproduced:**
- Row (`PlanChangeSheet.tsx:584`): "Remove it — anything else on the day
  stays."
- Confirm, after picking "Whole day" from the scope picker
  (`PlanChangeSheet.tsx:985`): "Are you sure? This will be removed and the
  day becomes rest."

**The ruling needed:** which sentence does the Remove row carry on an
unanchored day that offers a whole-day scope alongside its parts? Candidates,
none taken here (batch 3's principle stands — no signed sentence may be
guessed into existence to close this): (a) the row could read the
sole-content sentence whenever a whole-day scope is ONE OF the offered
scopes, regardless of part count; (b) the row could gain a third,
whole-day-scope-aware sentence; (c) the picker's own "Whole day" row already
carries "Everything - the day becomes rest" as its sub-line, so the ruling
could be that the top-level Remove row's sub-line is scoped to describe only
the DEFAULT/no-scope-chosen outcome and the picker's per-scope sub-lines are
what govern once a scope is offered — in which case nothing is broken and the
"collision" is a misreading of which sentence answers which question.

Full trace, file:line, and reproduction recipe (plain strength day,
`add_category`'d with `conditioning_light`):
`docs/BUTTONS_UI_UNIT_BOUNDARY_2026-07-31.md`, NOT-COVERED. Pinned
behaviourally (current behaviour, not a proposed fix) in
`planChangeMoveScopingTests.ts`. Combined device pass checklist item 4f asks
Sam to look at exactly this flow live.

## Batch 7 — device-pass fix round (2026-08-01): SIGNED

**STATUS: SIGNED BY SAM, 2026-08-01, same day** — 7-a as proposed, 7-b's
reword + the L-P7 deleted-vocabulary law confirmed, 7-c signed. His signing
message also carried a PART-COMPOSITION ruling, recorded as 7-e below.

Sam's combined device pass (7/11) failed three cells in one class — the
projection's naming layer lagging the session-type charter — and ruled the
charter-type headline work into the merge gate. Every string below shipped
PROPOSED and was signed at the head of this batch. **All entries are prose,
not table rows, deliberately**: every one lives in `src/rules/projectionCopy.ts`
or `src/utils/workoutCanonicalisation.ts`, which the binder's SOURCES scan
cannot see (the same recorded gap as 6-II-a/6-II-e; boundary report
NOT-COVERED, "the binder's `src/rules/` blind spot").

**7-a. Charter optional-type part headlines** (`part.headline.optional.<kind>`,
`projectionCopy.ts`) — selected by the workout's typed `composedOptionalKind`,
which the builder now stamps (`sessionBuilder.finaliseDerivedSession`) and
every placing route carries. No word is invented: each reuses the signed
Add-menu label for the door the athlete tapped.

1. `part.headline.optional.gunshow` — "Gunshow" (reuses Batch 5
   `CATEGORY_COPY.gunshow.label`). Replaces the generic "Strength" Sam saw on
   his G-1 Gunshow card (fail 2).
2. `part.headline.optional.prehab` — "Accessories" (reuses ruling 6-IV-1's
   fifth-row word; the CATEGORY ID stays `prehab`). An added Accessories
   session's strength part read "Strength" (fail 2); its trunk rows still
   classify `support` and keep "Midline Work" — the part-composition question
   is AUDITED in the fix-round notes, not silently re-answered here.
3. `part.headline.optional.mobility` — "Mobility" (reuses Batch 5
   `CATEGORY_COPY.mobility.label`). Also retires a deleted-type word: an
   athlete-added Mobility session rendered "Recovery" (fail 3's class).

**7-b. The `part.headline.recovery` entry is REWORDED: "Recovery" →
"Mobility".** Recovery is a charter-deleted type and its authored contents ARE
the ten mobility flows, so the `recovery`-KIND parts that still exist (attached
add-ons; athlete-placed legacy recovery sessions no deriver may rebuild) render
the word for what their rows are. The part KIND and every capability are
unchanged — a word, not a re-typing. The old word "Recovery" is RETIRED from
the projection's vocabulary entirely; walker law `L-P7 DELETED VOCABULARY`
(armed in `test:bible`) reds any day or part headline that ever says it again.

**7-c. The canonicaliser's add-on block words** (`workoutCanonicalisation.ts`):
title "Optional Recovery Add-on" → **"Optional Mobility Add-on"**, label
"Recovery" → **"Mobility"**. The block's own `kind` field has always been
`'mobility'`; the words now say what the rows are. RETIRED: "Optional Recovery
Add-on", "Recovery" (as an add-on label).

**7-d. Producer notes, no new words.** `day.headline.practice_match`
("Practice Match", SIGNED 6-IV-4) now has its producer: `createGameStub` stamps
a typed `fixtureVariant` from the season phase
(`canonicalFixtureKindForResolvedPhase`, `rules/fixtureConditionedAvailability.ts`
— the app's one phase→fixture-identity expression, same as the §18 week mode), so the 6-II-a item 1b seam note is
CLOSED — a pre-season fixture reads the signed word on device. The G+1
protection and the recovery-template rebuild now materialise MOBILITY sessions
(`buildDerivedSession('mobility')`), so the derived names "Post-game recovery"
and "Scheduled recovery - active" are RETIRED from the resolver; the generation
recovery-add-on placement pass is retired outright (charter: placement of
optional work is athlete-only).

**7-e. RULED: ONE WORD for a composed optional session (Sam, 2026-08-01,
with the Batch 7 signature).**

> An athlete-added session reads its door's name alone — "Accessories",
> never "Accessories + Midline Work". Its rows are contents, visible
> inside, not card vocabulary. Apply the same principle to the other
> composed optional types.

Landed structurally, not as a label: `getSessionComponentRows`
(`sessionComponents.ts`) no longer carves a trunk-support part out of a
workout carrying the typed `composedOptionalKind` marker, so the session is
ONE component → ONE part → ONE word, and every reader of that one function
(the projection's parts, the day-detail buckets, the rows-conservation law)
agrees by construction. The marker guarantees purity — `stackTemplate`
clears it the moment a day combines — so a combined day still names both of
its things (7-e governs the composed session's own card word, never the
team-combo join). The walker's charter cell now asserts the EXACT one-word
part list for all three door-added types.

## Batch 8 — block-rollover interim (2026-08-01): SIGNED (Sam, 2026-08-02)

The interim half of Sam's block-rollover ruling (2026-07-31, TOP of the
post-merge queue): the rollover succeeds, or refuses honestly with a
sentence. Two strings, shipped PROPOSED on 2026-08-01 per this file's
transitional rule (a string may ship PROPOSED and may never ship unlisted),
**SIGNED AS PROPOSED by Sam on 2026-08-02** (recorded in
`docs/PARKED_QUESTIONS_2026-08-01.md` §1) — both strings stand verbatim.

**8-a. The refusal sentence** (prose, not a table row — it lives in
`utils/readinessAcknowledgment.ts`, `buildRolloverAcknowledgment`, outside
the binder's scan like every ack sentence before it; recorded gap):

- "Your next training block couldn't be built — your current weeks are
  unchanged. Try again in a moment." — error tone, shown on the week screen
  whenever the lifecycle boundary refuses; claims only what is true (the
  rebuild candidate is validated whole and never committed on failure, so
  the current weeks really are unchanged; retry is offered, not promised).
  The engine's typed refusal code never reaches the athlete — it stays on
  the action-log tape.

**8-b. The retry affordance** (table row — it renders in `HomeScreenV2.tsx`,
which the binder scans):

| Row | String | Where it appears (HEAD) |
|---|---|---|
| Rollover retry | "Try again" | `HomeScreenV2.tsx` rollover-refusal card |

**7-f. RULED: CARD IDENTITY, ONE NAME — 7-e extends to ALL sessions (Sam,
2026-08-01, queue addition).**

> Support/midline rows inside a strength session are CONTENTS, not card
> vocabulary — a lower day reads "Lower Body Strength", never "+ Midline
> Work". "Midline Work" survives only as the identity of a day whose sole
> content is trunk work. Team-combo joins unchanged (a team night still
> names both its things).

Landed at the same one owner as 7-e (`getSessionComponentRows`): the trunk
split happens exactly when trunk rows are ALL the content rows there are —
otherwise they flow into the session's own bucket (strength days keep them
in the strength part, standalone conditioning in the conditioning part),
rows conserved, re-homed not lost (golden re-pin verified: zero `total`
deltas). Power rides beside a sole-trunk day unchanged — folding trunk
under an invented "Strength" word would be the opposite defect. Walker law
`L-P8 CARD IDENTITY` (both tiers, every action) reds any support part that
rides beside a strength or conditioning part. The "Midline Work" entry
(`part.headline.support`) STAYS registered — it is the sole-content
identity, not a retired word.

## Batch 9 — schedule-fact lanes (2026-08-03): SIGNED (Sam, 2026-08-03)

Declared reds 1 and 2 (§6-V) are PAID by the approved schedule-fact lanes
(`docs/SCHEDULE_FACT_OWNERSHIP_REASSESSMENT_2026-08-01.md` option 2, Sam
2026-08-02): the away door commits record-only and honest; "Short on time
today" derives the ruled COMPRESSED session — main lift kept, cut to
essentials, under the existing 35-minute owner (`SHORT_ON_TIME_MINUTES`).
§6-V's caveat said the two §6-II-f success sentences "come back for signing
when that red is paid, because the effect clause they will need does not
exist yet" — this batch is that return. Shipped PROPOSED per the
transitional rule on 2026-08-03; **SIGNED AS PROPOSED by Sam the same day —
9-a both variants, 9-b, and 9-c's moves** (recorded with §6/§7's answers in
`docs/PARKED_QUESTIONS_2026-08-01.md`).

All entries are PROSE, unquoted-in-table, on purpose: every sentence below
lives in `utils/readinessAcknowledgment.ts` or
`src/rules/temporarySourceFact.ts`, neither of which
`copyRulingsBindingTests` scans — the same recorded binder gap as 6-II-e/f.
The behavioural selection IS pinned: `programControlDurableOwnershipTests`
asserts the effect clause appears exactly when the committed result changed
the program, and never otherwise.

**9-a. Success, short on time — WITH its effect clause** (the 6-II-f
sentence extended, selected by the COMMITTED result so it can never claim a
state-dependent outcome):

- When the commit compressed today: "Got it — logged that you're short on
  time today. Today's session is compressed to fit — main lift kept, inside
  35 minutes." — `readinessAcknowledgment.ts`, `buildScheduleAcknowledgment`.
- When the commit changed nothing (rest day, session already short): the
  already-signed 6-II-f sentence stands unchanged: "Got it — logged that
  you're short on time today."

**9-b. Success, away — WITH its honest record-only clause** (away's effect
is UNRULED, so the clause states exactly that):

- "Got it — logged the days you're away. Your program stays as planned for
  now." — same owner. The refusal sentence for both doors is unchanged and
  already signed.

**9-c. The 6-II-e single-day strings MOVED to the fact the door now mints**
(byte-identical, no new words): the door records a today-scoped time-cap
fact rather than a busy fact, so "Short on time today" (modifier title),
"Today's session drops the highest-cost work. The rest of your week is
untouched." (modifier body) and "Short on time" (reason label) now ship
from `timeCapProjection` for any single-day cap. **6-II-e's honesty note is
PAID**: the body sentence described intended behaviour; the cap owner now
builds the compressed session (Bible §9 authored trim — main lift byte-
identical, accessory sets halved, hard finisher dropped), so the sentence
is true. The week-scoped busy wording is unchanged and still ships for a
week-scoped busy fact (which is record-only BY RULING until Sam rules
busy/away effects).

## Batch 10 — team-night movability (2026-08-03): SIGNED (Sam, 2026-08-02) + three PROPOSED riders

**STATUS: the seven ask strings are SIGNED BY SAM, 2026-08-02** — the
team-night movability sheet was signed whole
(`docs/TEAM_NIGHT_MOVABILITY_SHEET_2026-08-01.md`;
`docs/PARKED_QUESTIONS_2026-08-01.md` §3: "all seven strings as proposed").
Choice 1: MOVE raises the ask; SWAP on a team night stays refused with its
already-signed sentence ("Nothing on this day can be swapped.", 6-II-b) — the
club's session is not a type to trade. Choice 2: the permanent route confirms
INLINE in the ask; `teamTrainingDays` still writes through its one setup
owner.

All seven entries are PROSE, unquoted-in-table, on purpose: every sentence
lives in `src/rules/teamNightMoveAsk.ts` (registered via `registerSignedCopy`,
provenance `Sam, 2026-08-02`), which the binder's SOURCES scan cannot see —
the same recorded binder gap as 6-II-e/f and Batch 9. The registry IS the
enforcement: the sheet renders them only through `signedCopy`/the registered
templates.

**9-d. Success, short on time on a FIXTURE day — the game-day truth**
(SIGNED verbatim — Sam 2026-08-03, parked §7 answer, option (a); recorded in
`docs/PARKED_QUESTIONS_2026-08-01.md`):

- "It's game day — there's nothing to shorten. Go play." —
  `readinessAcknowledgment.ts`, `buildScheduleAcknowledgment`, selected by the
  COMMITTED result's typed `inertReason: 'fixture_day'`
  (`temporarySourceFactTransaction`'s lane owner, date-aware through the one
  fixture owner `fixtureConditionedAvailability`) — never by the door or the
  date alone. The fact records inert; the coach keeps the context; the athlete
  gets the truth. Same recorded binder gap as 9-a/9-b (the binder's SOURCES
  scan does not see `readinessAcknowledgment.ts`); the behavioural selection
  IS pinned: `programControlDurableOwnershipTests` (marked + virtual game-day
  cells, the plain-day honesty pin) and the walker's tape-world coordinate
  assert the sentence appears exactly when the committed result says
  `fixture_day`, and never otherwise. NOTE: on a Pre-season fixture the day's
  card reads "Practice Match" (6-IV-4) while this sentence says "game day" —
  built as signed, and the tension is RULED: §10 (Sam, 2026-08-03) signs a
  PRACTICE-MATCH variant — see 9-e.

**9-e. Success, short on time on a PRACTICE-MATCH day — the same truth in
the fixture's own words** (SIGNED verbatim — Sam 2026-08-03, parked §10
answer):

- "It's a practice match — nothing to shorten. Go play." —
  `readinessAcknowledgment.ts`, `buildScheduleAcknowledgment`, selected by the
  committed result's `inertFixtureVariant === 'practice_match'`. The variant is
  the SAME `FixtureAvailabilityKind` that picks the day's card label (6-IV-4,
  `canonicalFixtureKind`), threaded from the lane owner with the fixture's date
  — so the card and the sentence cannot disagree about what the day is, which
  was the tension 9-d shipped with and this pays. Both variants are pinned
  behaviourally in `programControlDurableOwnershipTests` (in-season MARKED →
  game day; pre-season fixture → practice match; the plain-day honesty pin
  unchanged). Same recorded binder gap as 9-a/9-b/9-d.

**10-a. The seven signed strings** (placeholders render from the change's own
dates):
- Ask title: "Move team training?"
- Ask body: "Is this a one-off, or has your club changed nights?"
- Route, once: "Just this week — training's moved for the week of {date}"
- Route, permanent: "Permanent — my team now trains {day}s"
- Back: "Go back — leave it where it is"
- One-off success: "Got it — team training is on {day} this week only."
- Permanent success: "Got it — your team nights are updated and your program follows."

**10-b. RETIRED with the unit**: "Team training is fixed to this day, so it
can't be moved from here." (`anchored_day`, signed 6-II-b) — the ask replaces
the refusal, the reason has no reachable cause, the string is deleted from
`planChangeProducer.ts` and its 6-II-b table row converted to prose above.
`teamNightMovabilityTests` TN-5 pins its absence from the producer.

**10-c. SIGNED (Sam, 2026-08-03 — parked §8 answer: "all three riders SIGNED
as proposed")** — shipped PROPOSED with the unit on 2026-08-03 per this
file's transitional rule, signed the same day, all three verbatim:
- Move scope row for the anchor (in `planChangeProducer.ts`
  `MOVE_SCOPE_COPY.team`): label "Team training", sub "Pick the night it's on
  — we'll ask if it's permanent".
- Destination sub-line for a team move onto an occupied day
  (`PlanChangeSheet.tsx`, multi-line ternary — extractor-invisible): "Joins
  {session} on this day" (the doubling law lands COMBINED; "Swap with …"
  would promise a trade the door will not do).
- The fact's modifier card (`src/rules/temporarySourceFact.ts`,
  `scheduleProjection`): reasonLabel "Team training moved", title "Team
  training moved this week", body "Team training is on {target day} instead
  of {usual day} this week only."

---

## Batch 11 — R5.7, the beta coach cut (2026-08-07): SIGNED

**Sam, verbatim: "sign yes"** (`docs/SIGNING_AND_MERGE_GATE_2026-08-07.md`).
All three strings SIGNED AS WRITTEN. They shipped PROPOSED with the unit under
this file's transitional rule and were signed the same day; the PROPOSED
markers retire here.

**WHY THERE ARE NEW WORDS AT ALL.** §6's beta scope cut removes every path to a
chat surface. Three sheets had "Ask Coach" as their ONLY action, so the cut left
them with nothing to do. A sheet the athlete cannot act on and that does not say
why is the half-alive surface decision C(a) exists to prevent. All three say the
same two things on purpose: **nothing changed**, and **where to act instead**.

**11-a. `HomeQuickActionSheet` — the "I need a bit more detail" sheet.**
Old: "This one needs more context before we can change your program safely."
New (Sam-signed): "This one needs more context than the menu can give, so nothing has changed. Use the day or session controls to make the change yourself."

**11-b. `StaleOverrideBanner` — the detail sheet.**
Old: "This one needs more context before we can change your program safely."
New (Sam-signed): "This one needs more context than we can gather here, so nothing has changed. Keep the session or clear it from the options above."

**11-c. `DayWorkoutScreenV2` — the `coach_fallback` step**, appended below the
step's own message (which is unchanged and still signed). This one replaces no
string — the step previously ended in a button, not a sentence:
- "Nothing has changed. You can make this change yourself from the day or session controls."

**11-d. A TITLE corrected, and it is not new copy.** The exercise-add fallback
sheet was TITLED "Ask Coach" and after the cut offers no coach. It now carries
the signed title its two sibling fallback sheets already use — **"I need a bit
more detail"**. Recorded because a title is athlete-visible and a silent change
to one is exactly what this file exists to prevent, not because it needs a
ruling.

**11-e. "Ask Coach" — the string's own status.** Batch 6-I signed it as the
replacement for "Message the coach". It no longer appears in any athlete-visible
position; it survives only in comments explaining the cut. **It is not RETIRED
as a ruling** — LR-6 freezes `CoachScreen` and the pipeline in the tree, and the
tab is one `Tab.Screen` block from returning, so the word is dormant for beta
rather than deleted. Stated so the next reader does not read its absence from
the UI as a retirement nobody signed.

---

## Batch 12 — day-first slices 1 + 2 (2026-08-08): SIGNED

**STATUS: SIGNED BY SAM, 2026-08-08, all seven strings exactly as proposed** —
"Today", "Week", "Time", "Away", "Sick", "Injured", "Equipment". Asked whether
the labels were right, he answered "yep" with no rewrites
(docs/WEEK_ROW_COMPOUND_BUCKET_RULING_2026-08-08.md §1). The tables below are
unchanged from the proposal because nothing about them changed; only this status
line moved, and the binding stays equality-bound in both directions
(`test:copy-rulings-binding`).

**WHY THERE ARE NEW WORDS AT ALL.** Sam's day-first ruling gives the Program
screen two shapes and one chip row. Neither is new *behaviour* — but a zoom
control needs two words, and a five-across chip row needs a word under each
glyph, because his own device-pass note was that icon meanings were not obvious.

**THE SHORT-LABEL LAW APPLIES** (this file, batch 1: Title Case for short action
labels). Every label below is ONE Title Case word. That is not only style: a
five-across row on a phone has room for a word and not a sentence, and each of
these sits under an icon that already carries the meaning.

**12-a. The zoom control** (`HomeScreenV2.tsx`, slice 1, shipped 2026-08-08):

| Control | PROPOSED label |
| --- | --- |
| Zoom to the day | "Today" |
| Zoom to the week | "Week" |

Both are already this screen's vocabulary — "Today" is the day badge, and
"This week" / "Next week" / "Last week" are the week-nav badges — which is why
they were chosen over inventing a pair.

**They are in a TABLE, and that is not a formatting choice.**
`copyRulingsBindingTests` binds what it finds QUOTED IN A TABLE ROW and ignores
everything else, so a proposal written as a bullet list is a proposal no gate
watches. The slice-1 report recorded these two as "parked for the signing
batch"; parked in prose, they were bound by nothing.

**12-b. The five life-fact chip labels** (`HomeScreenV2.tsx`, slice 2). Each
replaces a full sentence that used to be the bar's visible text. **The sentence
is not deleted**: it is now the chip's `accessibilityLabel` or
`accessibilityHint`, so it is still what the door is called and still what a
screen reader says.

| Chip | PROPOSED label | The sentence it replaces on screen |
| --- | --- | --- |
| Short on time | "Time" | "Short on time today" |
| Away | "Away" | "Away this week?" |
| Readiness | "Sick" | "I'm sick/flat today" (signed, ruling 4) |
| Injury | "Injured" | "I'm injured" |
| Equipment | "Equipment" | "Missing equipment?" |

**BOTH COLUMNS ARE QUOTED ON PURPOSE.** The binding gate reads every quoted
string in a table row and asserts it is in the app. The left column binds the
new labels — the thing that needs watching. The right column binds the
sentences, which is the receipt for 12-d below: if one of them is ever quietly
deleted along with the bar it used to sit on, the gate says so.

**12-c. "Equipment" over a shorter invention.** "Kit" and "Gear" both fit the row
more comfortably. Neither is a word this app uses: it says *equipment*
everywhere — the sheet, the constants file, the day screen's swap reason. A
shortened label should not also be a new noun, so the longest of the five labels
is the one that invents nothing.

**12-d. NOTHING WAS RETIRED, and that is deliberate.** "I'm sick/flat today"
(ruling 4) and "Missing equipment?" both keep their pins in
`weeklyReadinessCardTests`, `readinessSourceFactOwnershipTests` and
`profileResetUITests` — they are still in the file, in the accessible position.
If Sam signs the short labels AND rules that the sentences go, that is a
separate, later deletion with those three pins as its receipt.

---

## Batch 13 — the bucket vocabulary (Sam, 2026-08-08): NO NEW WORDS

**STATUS: NOT A COPY PROPOSAL. Every word below is already signed or already
PROPOSED; not one string is new.** It is recorded here because it changes WHICH
signed word the athlete reads in the most-looked-at position in the app, and this
file exists so that never happens quietly.

**THE RULING, Sam's own sentence:** *"week row = buckets, day title = buckets,
timeline = the variant names stacked one per line, exactly as now."* The bucket
words are Strength, Conditioning, Rest, Mobility, Accessories, Gunshow — and
Speed.

**13-a. WHAT MOVED.** A training day's week row and day title used to read the
session's VARIANT name (`part.headline.strength.<variant>` — "Upper Push",
"Lower Squat", "Full Body Strength"). They now read the leading part's BUCKET
(`part.headline.<kind>` — "Strength", "Conditioning", "Speed"). The variant name
is not retired and not deleted: it is what the timeline row says, which is the
one place the day's parts are enumerated.

**13-b. "Power" IS NOT RETIRED, IT IS DEMOTED.** Sam, verbatim: *"power should
not be labelled there for just 1 exercise — power is just part of the Strength
work."* `part.headline.power` ("Power") still names a power component ON THE
TIMELINE. It can no longer title a day: a day whose leading part is a power
component reads "Strength". Stated so its disappearance from the week view is not
read as a retirement nobody signed — and so the opposite is not assumed either.

**13-c. THE "+ X" SECOND LINE IS RETIRED FROM THE PROGRAM SCREEN.** It was never
a string: the row COMPOSED it by joining part headlines with " + ". Nothing in
`HomeScreenV2` composes a name from other names any more.

**13-d. UNCHANGED, and checked rather than assumed:** "Rest Day", "Game Day",
"Practice Match", "Team Training", "Gunshow", "Mobility", "Accessories" all read
exactly as before — measured on three generated weeks, before and after. The
three charter doors keep their own word BECAUSE they are buckets, and a gate now
holds that (a mutation that dropped it left every other cell green).

---

## Batch 14 — the compound day name (2026-08-08 afternoon): SIGNED

**STATUS: SIGNED BY SAM, 2026-08-08**, in his own words, quoted in full in
docs/WEEK_ROW_COMPOUND_BUCKET_RULING_2026-08-08.md §3:

> "on weekly view it should say whatever the bucket is that day i.e. Strength or
> strength + conditioning. On the daily it can get more granular and be like
> Upper body push and MAS work or whatever it is i think"

**14-a. NO NEW WORDS.** This batch adds no vocabulary. Every word a day can now
be called is a bucket word already signed in batch 13; what changed is how many
of them a title may say. Batch 13's rule was "the leading part's bucket"; this
one is "all of them".

**14-b. THE SEPARATOR IS A SIGNED ENTRY, AND IT IS HIS.** `copy.joiner.plus`
(`rules/projectionCopy.ts`) is `" + "`, quoted from the sentence above. It is
the first entry in the sheet marked `joiner: true` — a separator, the only kind
of entry `joinSignedCopy` will put between two signed strings.

**IT IS DELIBERATELY NOT IN A BOUND TABLE ROW, and that is stated rather than
quietly done.** This file's binding gate asserts every quoted string in a table
row appears in the surfaces; `" + "` is two characters of punctuation that
appears in hundreds of unrelated string concatenations, so a table row would bind
it VACUOUSLY — it would pass forever, against anything. That is the
`a-green-gate-that-watches-nothing` shape, and adding a row that cannot fail is
worse than adding none. It is bound where the binding can actually break: the
compound cells in `dayFirstTimelineTests` rebuild each expected title using
`signedCopy('copy.joiner.plus')` and compare byte-for-byte against what the
projection produces, so changing the separator reds them.

**14-c. BATCH 13-c IS REFINED, NOT REVERSED.** 13-c retired the composed "+ X"
second line. A "+" is on the glass again — but the composition moved, it did not
come back: **no surface joins anything.** The projection builds the one name
(`visibleDayLeadHeadline` -> `joinSignedCopy`), out of sheet entries only, and
the screens render a finished string. The test that forbids `HomeScreenV2` from
composing a name stands unchanged and still passes.

**14-d. AND THE LAST SURFACE-SIDE JOIN DIES WITH IT.** `DayWorkoutScreenV2` was
still building its subtitle with `detail.attached.join(' + ')` — a screen
choosing athlete-visible punctuation, which is exactly what `SignedCopy` exists
to prevent, and it had survived 13-c because 13-c only looked at the Program
screen. That line is gone: the day screen's subtitle is now date and count only,
and the day's identity is the title's job alone. This also closes parked question
4 of the slice-2 report ("Team Training" appearing twice on that screen).

**14-e. EACH WORD ONCE.** A day carrying a power part and a strength part
bucket both to "Strength" and reads **"Strength"**, not "Strength + Strength" —
Sam's power ruling (13-b) holding in the new place it could have broken out.

---

## Batch 15 — the Journal, slice 1 (2026-08-09): PROPOSED, NOT SIGNED

**STATUS: PROPOSED. Nothing here has Sam's signature.** Every string below ships
in the app today (`1659d664`) and is queued for his eye.

**15-0. WHY THIS BATCH EXISTS AT ALL, STATED PLAINLY: these words shipped
UNLISTED, which the transitional rule forbids.** The rule is "a string may ship
PROPOSED, and it may never ship unlisted" (batch 8's note). Slice 1's report
cited "journal batch 13" — but batch 13 is the bucket vocabulary and batch 14
the compound name, so **no journal batch existed and the citation pointed at
someone else's work.** Second sighting of proposed-copy-shipping-unlisted (the
first: "Today"/"Week" parked in a bullet list no gate reads). The compression is
in the same commit as this batch: the extraction gate's scope is now DERIVED
from the source tree instead of a hand-maintained list, so a new surface joins
the sheet the day it is created — see `signedCopyExtractionTests`, ceiling
re-baselined 130 → 558 with the jump attributed.

**15-a. THE TAB AND THE HEADINGS.** Title Case short labels, per batch 1's
short-label law.

| Where | PROPOSED string |
| --- | --- |
| Tab label | "Journal" |
| Tab accessibility label | "Journal tab" |
| Screen heading | "Journal" |
| Period subheading | "This week" |
| Section heading | "Did the work happen" |
| Section heading | "How the week felt" |
| Section heading | "Load" |

**15-b. THE WEEK-SHAPE STRIP.** The five day-shape words are Sam's own taxonomy
(docs/JOURNAL_LOAD_AND_DAY_SHAPE_RULING_2026-08-08.md §2) and are NOT new
vocabulary. What is new is the abbreviation.

| Day shape | Spoken name (his word) | PROPOSED letter |
| --- | --- | --- |
| Hard day | "Hard" | "H" |
| Moderate day | "Moderate" | "M" |
| Easy day | "Easy" | "E" |
| Game day | "Game" | "G" |
| Rest day | "Rest" | "·" |

**THE LETTERS ARE MINE, NOT HIS — FLAGGED, NOT SLIPPED IN.** Sam ruled the five
SHAPES; he never ruled that a shape is shown as a single letter. H/M/E/G and the
middle dot for rest are a terminal presentation choice made to fit seven days
across a phone. **This is the one row of this batch that most wants his eye**,
because an abbreviation is a word the athlete has to decode, and "M" for Moderate
sits one letter away from nothing at all. The spoken names are carried on each
day's accessibility label ("Hard day", "Moderate day", …) so the full word is
never actually lost.

**15-c. THE HONEST-ABSENCE LINES.** These are the Journal's most load-bearing
sentences: rider 1 says the Journal shows an honest "no reason recorded" state
and never invents a why.

| State | PROPOSED string |
| --- | --- |
| No sessions this week | "No sessions planned this week." |
| A missed session with no recorded reason | "No reason recorded for one of them." |
| Nothing recorded about how the week felt | "You haven't recorded how anything felt this week." |
| Not enough history for a load comparison | "Your Journal is building. Once you have a few weeks logged, this shows how the week compared with your normal." |
| Enough history, comparison not built yet | "Comparing this week with your normal is coming next." |

**15-d. THE COUNTED LINES ARE COMPOSED, AND ARE DELIBERATELY NOT IN A BOUND
TABLE ROW.** Five sentences take a number and cannot be quoted as a literal:

- "{done} of {planned} sessions done" (+ ", {n} in part" when partials exist)
- "{n} missed."
- "{n} still to log."
- "No reason recorded for {n} of them." (the plural arm of 15-c row 2)

Following batch 14-b's precedent: **a table row here would bind vacuously**, so
the row is not written rather than written and useless. The wording is instead
fixed by `journalWeekTests`, and the underlying counts by the derivation's own
cells. **Sam still owns these sentences** — they are listed here in template form
precisely so they are not invisible for being unquotable.

**15-e. WHAT IS NOT YET BOUND, SAID OUT LOUD.** `copyRulingsBindingTests` parses
the PROPOSED strings of **batch 5 only**; batches 12, 14 and this one are
recorded but not equality-bound by that gate. The extraction gate now *counts*
these strings and forbids new unlisted ones, which is a different and weaker
claim than "the sheet and the app agree". Extending the binder to every PROPOSED
batch is named here as owed and is not done in this commit.

---

## Batch 16 — the Journal's week note, slice 2 (2026-08-09): PROPOSED, NOT SIGNED

**STATUS: PROPOSED. Nothing here has Sam's signature.** Recorded in the same
commit that ships it, under the new derived-scope gate — which is what batch 15
was written to make impossible to skip.

**16-a. THE NOTE BOX.** The prompt is the base design's own sentence, quoted
from the approved doc rather than reworded, so the words the athlete reads are
the words the design was approved with.

| Where | PROPOSED string |
| --- | --- |
| Section heading | "Your note" |
| Note box placeholder | "Anything worth remembering about this week?" |
| Save button | "Save note" |
| No notes recorded for this week yet | "No notes yet this week." |

**16-b. THE TAG LABELS.** The tag KEYS are the design's vocabulary — the base
five (recovery, mobility, injury, diet, work stress) plus the addendum's three
(sleep, illness, travel), all in scope under Sam's full-scope ruling. What is
PROPOSED here is only their athlete-facing spelling.

| Tag key | PROPOSED label |
| --- | --- |
| recovery | "Recovery" |
| mobility | "Mobility" |
| injury | "Injury" |
| diet | "Diet" |
| work_stress | "Work stress" |
| sleep | "Sleep" |
| illness | "Illness" |
| travel | "Travel" |

**THE VOCABULARY IS CLOSED, AND THAT IS THE POINT.** The NOTE is free text; the
TAGS are not. `journalNoteStore` types them as a closed union and its door drops
anything outside it, so a surface cannot introduce a ninth tag — a free-text tag
set would be an unauthored vocabulary growing on the athlete's device, which is
the exact thing this whole sheet exists to prevent. `journalNoteOwnershipTests`
holds both directions.

**16-c. THE CEILING ROSE, AND THIS IS THE JUSTIFICATION IT ASKED FOR.**
`signedCopyExtractionTests` moved 561 → 565: four genuinely NEW athlete-visible
sentences ("Your note", the placeholder, "Save note", "No notes yet this week.").
Unlike batch 15's re-baseline — where the number moved because the instrument
improved — **these are new words in the app**, and the ratchet demanded a
deliberate edit somebody has to justify. This paragraph is that edit. They ship
PROPOSED, which the transitional rule allows; what it forbids is shipping them
unlisted, and they are listed here before the commit lands.

**16-d. NOT SIGNED, AND ONE OF THEM IS A CLAIM.** "No notes yet this week." is
the honest-absence line for notes, in the family of batch 15-c. The rest are
labels. Sam's veto is one line on any of them.
