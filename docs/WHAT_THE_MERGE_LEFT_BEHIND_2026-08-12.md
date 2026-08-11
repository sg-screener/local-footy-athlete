# WHAT THE UI MERGE LEFT BEHIND — three censuses, one number each

LOOP CHECK `enforcement-deferred-then-forgotten` — sighting 7. **New organ
again: a MOVE nobody finished.** Sightings 1-4 were rules wired to a logger; 5-6
were values written to fields nobody reads; **this is code whose last CALLER was
deleted.** The compression in §4 is a gate, not a habit.

**Sam, 2026-08-12:** *"well how many things did codex changed that haven't been
seen and implemented properly cause thsat was not the only change we mad"* —
asked after he caught the seat saying the phase-shift sheet was still on the home
screen. **He was right, and he was right that it was not the only one.**

**Method:** three independent read-only censuses, one question each, `file:line`
required, each told a correction is worth as much as a confirmation. **All three
corrected the seat.** ~40 UI commits, 2026-08-08 → 2026-08-12.

---

## THE THREE NUMBERS

| Question | Answer |
| --- | --- |
| Controls an athlete can SEE, TAP, and get NOTHING from | **ZERO** |
| Moves that are HALF FINISHED | **5** (2 more looked like it and are correctly resolved) |
| Changed athlete-facing surfaces with NO CURRENT PICTURE | **7 of 8** |

**The good news is real and should be said first: nothing in the shipping app
lies to the athlete about what a tap will do.** The one class that did
(`c587b54f`) was caught, and the fix was then sharpened from per-screen to
per-action, so freeing a strand lights it up automatically. **That is the repo
working.**

---

## §1 THE FIVE HALF-FINISHED MOVES — ranked

### 1.1 THE COACH NOTE SHEETS CANNOT OPEN. THIS IS THE WORST ONE.

`handleCoachNoteAction` (`HomeScreenV2.tsx:350`) has **ZERO callers.** Commit
`31327099` deleted the single `onAction={handleCoachNoteAction}` line. Because
`setCoachNoteSheet` (`:362`) and `setInjuryFlowNote` (`:355`) are reachable ONLY
through it, **`<CoachNoteSheet>` at `:1190` and `<GuidedInjuryFlowSheet>` at
`:1198` are mounted and can never become visible.**

**And the comment defending it is FALSE.** `HomeScreenV2.tsx:2578` says the
helpers remain *"because the status actions still route athletes back to the four
working Program status controls."* **Program no longer renders the list at all**
— `coachTabSlice3Tests.ts:1298` ASSERTS its absence. There is no route back.

**DO NOT DELETE IT.** `ActiveModifiersSection.tsx:39` names this exact function as
what slice 3b must lift. **Move it; do not reap it.**

### 1.2 THE PHASE SHEET — the one Sam caught
Surface at `CoachTabScreen.tsx:479`; implementation still `HomeScreenV2.tsx:3352`
(~230 lines) behind a six-line re-export, `src/components/SeasonPhaseShiftSheet.tsx`
— **the only file under `src/components/` that imports from `src/screens/`.** The
state machine already moved (`hooks/useSeasonPhaseControl.ts`); only the JSX
stayed. Orphaned style `phaseCard` at `:4173`. **The gate has a hole:**
`coachTabSlice3Tests.ts` greps `styles.phaseCard` (usage), so the dead
DEFINITION passes. Finishing breaks nothing.

### 1.3 MY STATUS' MODIFIER ACTIONS — 7 of 8 inert, honestly
8 action kinds (`activeProgramModifiers.ts:63-71`); `LIVE_ACTION_KINDS =
['dismiss_note']` (`CoachStatusScreen.tsx:168`). The other 7 are dimmed,
`disabled`, captioned. **Visible, not tappable, not lying.**
**FINISHING THIS BREAKS A LAW GUARD:** `repoLawGuardsTests.ts:1510` pins
`ActiveModifiersSection.tsx` as `NOT_YET_SURFACE` and **requires** the not-yet
plumbing. **Retire the law cell in the same commit** — the gate encodes the
half-finished state as law.
Also `CoachTabScreen.tsx:466` passes `EMPTY_EQUIPMENT_FACT_IDS`, so this
surface's equipment testIDs are wrong by construction.

### 1.4 `ModifiersStrip` PROMISES THREE SURFACES, HAS ONE
`:2` — *"ONE COMPONENT, THREE SURFACES"*; `:41-43` types `'day' | 'week' |
'coach'`. Only mount is `CoachTabScreen.tsx:417`, and Program is **forbidden** to
mount it by two separate gates. Dead union members plus doc drift. Cheap.

### 1.5 "TEMPORARY" RELEASE DIAGNOSTICS, 12 DAYS PAST THEIR TRIGGER
`ProfileScreen.tsx:147` *"REMOVE once the cause is known"* (dated 2026-07-29),
rendered at `:622`, `:630` *"TEMPORARY, DELIBERATELY VISIBLE IN RELEASE"*,
`:1626`. ProfileScreen took +183 lines in this merge and these survived.
**OPEN-UNKNOWN: whether the 2026-07-29 cause was ever found.**

### CORRECTLY RESOLVED — do not count, do not "fix"
- `DayWorkoutScreen.tsx:32` — a wrapper preserving a named export after a
  COMPLETED deletion. Nothing stranded.
- **The hidden Journal** — implementation present, surface removed **by Sam's
  ruling**, one hide at the navigation owner, with `journalHiddenContractTests`
  ratcheting it shut. The mirror image of 1.2 and it is *correct*. **CORRECTED 2026-08-12: the seat wrongly flagged `JournalScreen.tsx` as
  "still being edited".** It is not. 21 commits built it 08-08 23:02 → 08-09
  05:33; Sam hid it 08-09 07:53 (`7f9e54ab`); since then **ONE commit touched it
  and changed ONE LINE** (`5f3bf336`: `feedback.gameFeel` →
  `feedback.game?.feel ?? feedback.gameFeel`) — a shared data-shape change its
  readers correctly followed. **Nothing to do, and nothing was done without
  Sam's knowledge.**

  **THE METHOD ERROR:** `git log --name-only` says a file was IN a commit, not
  that it was WORKED ON, and the seat quoted the file's 1,924-line size next to
  it as if that were the change. **Read `--numstat` or the diff before calling
  anything "edited", and never put a file size next to a change claim.**

---

## §2 THE 49 CONTROLS NOBODY CAN REACH — cheap for Sam, expensive for agents

| Surface | Receipt | Taps |
| --- | --- | --- |
| `HomeScreenClassic` | `HomeScreen.tsx:52` compile-time const | 32 |
| `HomeQuickActionSheet` | sole importer `HomeScreen.tsx:26`, rendered at `:440` **inside Classic** | 11 |
| `CoachScreen` (2,498 lines) | `CoachStackNavigator` defined `AppNavigator.tsx:94`, **never used as any `component=`** | 2 |
| `JournalScreen` | imported `AppNavigator.tsx:12`, never mounted | 4 |

**All 49 are inside `App.tsx`'s import closure, so TypeScript, the import graph
and dead-code analysis all call them live.** That is the cost: not athlete harm,
but every agent and every instrument mis-reading the app's size and shape.

**Route fiction, recounted:** `navigation.ts` declares **94** route keys, 33 are
mounted, **67 unmounted** — not "72 of 95"; the 95 counted two `LinkingConfig`
keys as routes. **`DeepLinkPath` has zero importers.** **And ZERO `navigate()`
calls anywhere target an unmounted route** — the fiction is type-level only and
costs the athlete nothing.

`HomeQuickActionSheet` also has three differently-labelled options — *"Move it to
another day"*, *"Skip it"*, *"Replace it with recovery"* (`:108`, `:113`, `:118`)
— **that all call the identical `openDayControls`.** A control lying about
itself, harmless only because it is dormant.

---

## §3 SEVEN OF EIGHT SURFACES HAVE NO CURRENT PICTURE

**Newest UI commit: 08-11 06:03. Newest screenshot anywhere: 08-11 05:20. Three
commits land after the last shutter click.**

**STALE — a picture exists and the code moved after it (3):** Day/Today (stale
3h50m; `9195c1b7` changed the **colour of the day status icon**, so every Day shot
shows the old colour), Week (3h57m), Coach + My Status (3h42m). **The two shots
`UI_STATE_2026-08-12.md:16-18` names as *the* pictures for Day and Week both
predate the code they claim to show.**

**NEVER PICTURED (4), by athlete exposure:**
1. **The sheets over Day — daily.** `PlanChangeSheet.tsx` (`f4f6b3b2` fixed a
   crash that stopped it OPENING — **there is no picture of it open, ever**),
   `EquipmentLimitationSheet.tsx` (five icon swaps, unphotographed on this
   surface), `SessionEquipmentSheet.tsx`, `HomeQuickActionSheet.tsx`.
2. **Onboarding** — a visible glyph swap (`c8916d5c`) plus a rewire of the whole
   23-screen type scale (`bc87cb74`). **Zero shots**, and no flow can walk it.
3. **World reset overlay** — `WorldResetNotice.tsx`, mounted globally
   (`RootNavigator.tsx:84`). Full-screen, zero shots.
4. **Keyboard accessory bar** — every text entry. OPEN-UNKNOWN, likely zero.

**CURRENT (1): Profile.** Its 05:17/05:20 shots postdate its code.

### The two findings that make the index itself unsafe
- **IT PINS ITSELF TO THE WRONG COMMIT.** `UI_STATE_2026-08-12.md:14` says "as
  they stand at `a9c82856`". **`a9c82856` is a DOCS-ONLY commit at 08-11 20:08 —
  14h48m after the newest shot.** The pin claims a freshness the artifacts do not
  have. **This is what let the seat cite a stale UI location with confidence.**
- **THE SHOTS ARE GITIGNORED** (`.gitignore:10` → `artifacts/`). **mtime is the
  only staleness receipt they will ever have, and it does not survive a clone.**

**Prose standing in for pictures:** `lawRegistry.ts:431` describes the Day card's
geometry, colours and status-icon tints in ~1,800 words — **currently the only
description of the current build.** Exactly the failure `UI_STATE:5-9` exists to
prevent.

---

## §4 THE COMPRESSION — make staleness MACHINE-VISIBLE, not remembered

Sam's standing instruction: never fix the edge case, make the class impossible.
**Re-shooting seven surfaces fixes today and rots by Friday.**

> **PROPOSED LAW — `LAW-picture-newer-than-code`: every surface in the picture
> index names the commit its shot was taken at, and a gate REDS when that
> surface's newest source commit is newer than its shot's commit.**

Implementation, all cheap and none of it dependent on mtime:
1. **Put the SHA in the filename** (`walk-1-day@9195c1b7.png`) — mtime is not
   durable, a SHA is.
2. **Commit the shots, or commit a manifest** mapping surface → files → SHA.
   Gitignored artifacts cannot carry evidence across a clone.
3. **One gate cell** reading that manifest against `git log` per surface.
4. **The index may not pin itself to a docs commit** — pin to the newest commit
   touching `src/screens` / `src/components`.

**This converts "has anyone looked at this lately" from something a person must
remember into a number that can only be made green by taking a picture.** It is
the same shape as §4 of `HOW_TO_BUILD_THIS_APP` — a value that exists but nothing
reads — one layer up: **evidence that exists but nothing checks.**

---

## NOT COVERED

- **Nothing here ran on a device or a simulator, and no picture was taken.**
- **Static reading cannot find the `LAW-L6-honest-actions` class** — a handler
  that fires, runs real code, and silently no-ops downstream is indistinguishable
  from a working one in source. **"Zero reachable dead controls" means zero
  UNWIRED, not zero INEFFECTIVE.** `LAW-L6` is also UNENFORCED
  (`lawRegistry.ts:927`).
- `LAW-L5-no-dead-affordances` is UNENFORCED (`lawRegistry.ts:916-923`) and its
  own receipt admits *"Nothing enumerates controls."* **This census has no
  ratchet behind it and will rot.**
- Onboarding's 12 `onContinue={() => {}}` are invisible because `hideFooter`
  suppresses the button (`OnboardingLayout.tsx:111`) — **source reading, not a
  device.**
- Whether `Button`/`Card`/`Badge` being defined TWICE (`components/common/` vs
  `components/ui/`, 51 screen-imports vs 9) predates the merge is OPEN-UNKNOWN
  and was not counted.
- The keyboard-accessory picture gap is inferred from filenames only.
