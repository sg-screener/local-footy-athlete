# Copy Audit — 2026-07-23

**Scope:** every athlete-facing string in the live app — `HomeScreenV2`,
`PlanChangeSheet`, `GuidedInjuryFlowSheet`, `EquipmentLimitationSheet`,
`DayWorkoutScreenV2`, `ProfileScreen`, all 21 onboarding screens, and the
message-producing utilities `planChangeProducer.ts`/`coachActions.ts`. Read
in full, not sampled. **Method:** read-only, no edits. This is a findings
document with proposed replacement copy per finding — it does not silently
"grade" every clean string; strings not listed below were reviewed and are
not flagged.

**A note on scope validity:** a repo-wide check this session confirmed the
21 files under `src/screens/program/`, `src/screens/workout/`, and
`src/screens/journal/` are not referenced by any navigator — the live
Program/Workout/Journal experience is actually `HomeScreenV2`/
`DayWorkoutScreenV2` (already covered above). Those 21 files are dead code.
They're covered in their own section at the end rather than given
per-string replacement copy, since fixing copy nobody can see isn't useful
until/unless they're wired back in (see Journal backlog entry in
`SUPPORTED_ATHLETE_ACTIONS.md`).

---

## Priority 1 — raw codes, raw dates, raw exceptions

These are functional defects with a copy face, not tone issues — full
site-by-site fix plans for the first two live in
`docs/GROUPD_EXECUTION_PLAN_2026-07-23.md` (items D3, D4). Listed here for
completeness of the copy inventory, with replacement copy.

| # | File:line | Current | Proposed replacement |
|---|---|---|---|
| P1-1 | `planChangeProducer.ts:1364,1451,1681,1824` | `` `That change isn't possible here (${resolution.error}).` `` | Generic: "That change isn't possible from here — the plan is untouched." Specific codes get their own copy per D4's mapping (e.g. `nothing_to_swap` → "There's nothing on this day to swap yet."). |
| P1-2 | `planChangeProducer.ts:2027,2029,2032,2034,2036,2038,2040,2052,2053` | e.g. `` `Done. ${change.fromDate} and ${change.toDate} swapped sessions.` `` | `` `Done. ${outcomeWeekday(change.fromDate)} and ${outcomeWeekday(change.toDate)} swapped sessions.` `` — reuse the weekday formatter the sibling functions already use (see D3). |
| P1-3 | `coachActions.ts:417,433,451,471,518,521,538,542,558,642,671,707` | e.g. `` `${date} is in the past - I can't change it.` `` | `` `${weekday} is in the past - I can't change it.` `` — same fix, coach-chat door. |
| P1-4 | `coachActions.ts:1026` | `` `Unknown action kind: ${(action as any).kind}` `` | "I couldn't make that change, so nothing was applied." (drop the raw kind from athlete-visible text; log it server-side if a logging path exists) |
| P1-5 | `coachActions.ts:1043` | `` `Exception applying ${action.kind}: ${e?.message || String(e)}` `` | Same generic fallback as P1-4. Never surface a raw JS exception message to the athlete. |
| P1-6 | `CompleteScreen.tsx:283` | `setErrorMessage(err.message)` shown verbatim on the "Something went wrong" screen for `OverloadError` | Map `OverloadError` to a fixed plain string ("The service is busy right now — try again in a moment.") the same way the other error branches on this screen already do; don't let this one branch skip the mapping the rest of the screen follows. |

---

## Priority 2 — internal jargon / dev language leaking to athlete surfaces

These are the highest-value findings in this audit — not cosmetic, and not
already tracked by the Group C accessibility-label sweep (that's about
screen-reader labels; these are visible, sighted-user copy).

### P2-1 — Debug-style "Key: Value" dump in a native alert

`ProfileScreen.tsx:211-213`, shown after "Clear active changes":

```
`Active injury: ${summary.activeInjuryCleared ? 'removed' : 'none'}\nCoach Update cards: ${summary.coachUpdatesCleared}\nInjury overrides: ${summary.injuryOverridesRemoved.length}`
```

This reads exactly like a debug console dump, not athlete copy — labeled
fields separated by newlines, a raw count of "Injury overrides," and a
`'removed'`/`'none'` binary rendered as if it were a log line. An athlete
tapping "Clear" doesn't think in terms of "overrides" or "cards."

**Proposed replacement** (natural sentence, drop internal counts that don't
mean anything to the athlete):

> "Your active coach adjustments have been cleared. Your base program is
> unchanged."

If Sam wants the injury-specific confirmation kept (reasonable — clearing an
injury note is a meaningfully different action from clearing a readiness
nudge), a two-sentence version:

> "Your active coach adjustments have been cleared."
> "Your injury note was also cleared." *(only appended when
> `activeInjuryCleared` is true)*

Either way: no field-count enumeration, no `\n`-joined "Key: Value" lines.

**P2-2 (Gunshow) — resolved, not a fix item.** See "Resolved — confirmed
intentional" below.

### P2-3 — Coach-chat reason strings written in third person about the athlete, to the athlete

`coachActions.ts:567,676`:

```
`"${fromExercise}" matches multiple exercises on ${date}: ${matchResult.candidates.join(', ')}. Ask the athlete which one they mean.`
```

"Ask the athlete which one they mean" reads as an instruction from the
engine to some other party (the LLM prompt layer, presumably) about the
athlete — not a message written to the athlete. **Whether this string ever
reaches the athlete verbatim, or is only consumed internally as context for
an LLM that rewrites it before display, needs engineering confirmation
before this is scored as a live bug** — if it's LLM-internal-only, it's not
a copy defect (though it's a confusing variable name for what the string
actually is: an instruction, not a message). If it does reach the athlete
raw on any code path, it's a clear defect.

**Proposed replacement, if athlete-facing:**

> `` `I found more than one match for "${fromExercise}" on ${weekday}: ${matchResult.candidates.join(', ')}. Which one did you mean?` ``

(Second person, addressed to the athlete directly, matching every other
coach-chat string's voice.)

### P2-4 — Parameter names used as prose

`coachActions.ts:467`:

```
"fromDate and toDate are the same."
```

Reads as a validation message written for a developer calling the function,
not copy shown to an athlete who asked to move a session. If this reaches
chat (need the same "does this reach the athlete" confirmation as P2-3):

> "That's the same day it's already on — nothing to move."

### P2-5 — "MVP" is engineering jargon in a shipped footer

`ProfileScreen.tsx:796`: `"MVP 0.1"` as the Profile screen footer version
label. "MVP" (Minimum Viable Product) is an internal engineering/product
term; an athlete has no reason to know what it means, and it undercuts the
app's own App Store positioning as a finished, "real programming, not random
workouts" product (`APP_STORE_LISTING_DRAFT.md`).

**Proposed replacement:** drop "MVP" entirely and source the version from
the actual app config instead of a hand-maintained string that's already
drifted (`app.json`/`package.json` both say `1.0.0`, this footer says
`0.1`):

> `` `LFA v${appVersion}` `` (e.g. "LFA v1.0.0", sourced from `expo-constants`
> or `app.json`, not hardcoded)

This also fixes a second, quieter bug: the footer's version number is
already wrong/stale relative to the real app version.

---

## Priority 3 — consistency issues (typography, symbols, duplicate screens)

### P3-1 — Mixed straight and curly apostrophes across the same UI surfaces

Examples of the inconsistency, same component tree: `HomeScreenV2.tsx:748`
uses a curly apostrophe ("You’re in..."), while dozens of sibling strings in
the same file use straight ones ("don't", "isn't", "can't" — e.g. lines 621,
719, 1287). `ProfileScreen.tsx:721` mixes both within one string:
`` "Got a question the app can't answer?\nWe'll get back to you..." `` reads
as straight in the source dump but the underlying file uses curly
(`can’t`/`We’ll`) per direct inspection — while `DayWorkoutScreenV2.tsx` uses
curly in some places ("today’s") and none of the sibling menu-option strings
in the same file use any apostrophe-bearing contractions to compare against
consistently.

This is invisible to most users but shows up as visually inconsistent
letter-forms in typefaces that render straight and curly quotes very
differently, and it signals copy pasted in from different sources/times
rather than a single style pass.

**Recommendation:** pick one (straight `'` is simpler, avoids encoding
edge cases, and is already the majority convention in this codebase) and run
a single find-and-replace pass across all athlete-facing string literals.
Not urgent, but cheap to fix in the same pass as any other copy edit in a
touched file — bundle it opportunistically with D1-D5 file touches rather
than opening a dedicated PR just for this.

### P3-2 — Inconsistent "what's kept / what's lost" symbol convention

`HomeScreenV2.tsx:2351-2352` (rebuild confirm) and `:2451-2453` (phase-shift
confirm) use ballot symbols: "✓ Game days and logged workouts are
preserved" / "✗ Any custom exercise swaps will be lost". `ProfileScreen.tsx:1209-1211`
(setup-update confirm) uses a *different* symbol for the negative case: "✓
Setup changes saved" / "× Custom coach edits may be replaced" — a
multiplication sign (×), not the ballot ✗ used elsewhere for the same
semantic role ("this will be lost/changed").

Beyond the visual inconsistency, symbol-only signaling of "kept" vs. "lost"
is also a Group-C-adjacent accessibility concern (VoiceOver's announcement
of "✓" vs "×" vs "✗" is inconsistent across iOS versions) even though it's
raised here as a copy-consistency finding, not filed as a new Group C
accessibility defect.

**Proposed replacement:** standardize on one symbol pair app-wide (✓/✗,
matching the majority usage in `HomeScreenV2.tsx`), or — more robust —
replace symbols with words entirely: "Kept: game days and logged workouts."
/ "Changed: any custom exercise swaps will be lost." Words read identically
regardless of font/VoiceOver/locale; symbols don't.

### P3-3 — Two divergent copies of the same options screen

`TeamTrainingDurationScreen.tsx` and `TeamTrainingIntensityScreen.tsx` both
define an `INTENSITY_OPTIONS` array for the same underlying concept (team
session intensity), with different casing and different sub-copy:

| | Duration screen version | Intensity screen version |
|---|---|---|
| Casing | "Light" / "Moderate" / "Hard" / "Very hard" | "LIGHT" / "MODERATE" / "HARD" / "VERY HARD" |
| Sub-copy | "Some running" | "Bit of running" |

If both screens are reachable (via different onboarding branches — pre-
season vs. in-season setup, say), an athlete could see either casing/wording
depending on path taken, which reads as an unfinished product. If one is
truly dead code (a superseded draft of the other, never removed), it's a
smaller finding — just delete it — but that determination needs an
engineering check of which screen(s) the onboarding navigator actually
routes to, which is outside this audit's read-only scope.

**Action:** flag for engineering triage before writing replacement copy —
fixing the wording is pointless if one file is unreachable, and merging the
two some other way is pointless if both are genuinely live for different
flows.

### P3-4 — All-caps dynamic splice reads awkwardly for freeform text

`InjuriesScreen.tsx`'s `getSeverityQuestion()` (lines 104-106): when an area
is known, the question becomes
`` `HOW MUCH IS YOUR ${area.toUpperCase()} LIMITING YOU?` `` — for a preset
area like "Groin" this reads fine ("HOW MUCH IS YOUR GROIN LIMITING YOU?"),
but the "Other area" path (line 449, free-text placeholder "e.g. calf,
wrist, elbow") lets the athlete type anything, including multi-word phrases
that read badly upper-cased and grammatically stitched into a fixed
template — e.g. typing "left knee, outside" produces "HOW MUCH IS YOUR LEFT
KNEE, OUTSIDE LIMITING YOU?"

**Proposed replacement:** for the custom-area path specifically, fall back
to the existing area-agnostic phrasing this same function already uses
elsewhere in its own fallback branch: "HOW MUCH IS THIS LIMITING YOU?" —
don't splice free-text into the all-caps template at all. Keep the
area-name splice only for the fixed preset list, where the grammar is
guaranteed to work.

---

## Resolved — confirmed intentional

### P2-2 — "Gunshow" (`planChangeProducer.ts:171-172`, `CATEGORY_COPY.accessories`)

```
label: "Accessories", sub: "Gunshow or prehab - small muscles, big payoff"
```

Originally flagged as possibly a leaked internal QA nickname rather than
deliberate copy — `docs/audits/GROUPCD_WORKLIST_2026-07-22.md` line 42
independently refers to a *different* screen as "the FRI 'Gunshow' sheet,"
which raised the question of whether the term originated as team-internal
slang and got typed into shipped copy by accident.

**Confirmed intentional brand voice (Sam, 2026-07-23).** No replacement
copy needed — the app's casual-Australian voice ("Made in Australia for
footballers") supports this kind of slang deliberately. A female-friendly
session variant for the same slot is on the post-v1 roadmap; not a copy fix,
not part of this audit. This finding is closed and requires no engineering
action.

---

## Confirmed clean — no findings

For completeness, these areas were read in full and produced no tone/jargon/
raw-code findings: `GuidedInjuryFlowSheet.tsx`, `EquipmentLimitationSheet.tsx`,
all safety-note and confirm-copy in the injury flow, the full onboarding
sequence's core question/subtitle copy (Welcome through Review/Complete),
and the vast majority of `PlanChangeSheet.tsx`'s menu-option and confirm-copy
strings. The app's baseline voice — plain, second-person, footy-casual — is
consistently well executed outside the specific findings above.

---

## Dead-code copy debt (not fixed, catalogued for the record)

The 21 files under `src/screens/program/`, `src/screens/workout/`, and
`src/screens/journal/` contain a full, unreachable UI's worth of copy —
generic fitness-app phrasing ("No active program", "Total Volume", "Personal
Records") that predates the current footy-specific product voice and
doesn't match it (compare "Personal Records" / "Total Volume" against the
live app's "Done. Session moved to Wednesday." register — noticeably more
generic/templated). Per `docs/audits/JOURNAL_2026-07-22.md`, this is
tracked as an unreachable-feature finding, not a copy finding — no
replacement copy is proposed here, since rewriting copy on screens no
athlete can reach is not a useful use of this pass. If/when Journal is
un-shelved (`SUPPORTED_ATHLETE_ACTIONS.md` backlog entry), this copy should
be rewritten from scratch against the current voice rather than lightly
edited, given how far it's drifted.

`src/screens/profile/FeedbackScreen.tsx`'s existing copy (star-rating UI,
generic submit flow) is superseded by the Group D execution plan's D1 item,
which replaces this screen's content entirely — no replacement copy
proposed here since the screen's structure itself is being rebuilt, not
edited.
