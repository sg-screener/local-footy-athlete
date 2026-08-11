LOOP CHECK: one visible state with multiple writers — sighting 3 — compress

# CODEX UI, SESSION FEEDBACK AND RELOAD BOUNDARY — 2026-08-11

## What Sam ordered

This unit follows Sam's complete eye pass from the seven-day Renee card match
through Profile, readiness, missed sessions and the in-session feedback flow.
The final two decisions were explicit: remove the redundant `DONE` badge and
show a tick, not a pulse, beside `Session complete`.

## Options compared before implementation

### Screen and feedback structure

1. Keep the old cards and feedback form, then add visual exceptions for each
   screenshot.
2. Give Week one seven-day card owner, Day one component-row owner, and the live
   session one checklist/outcome owner shared by its rows and feedback summary.

Option 2 landed. It removes selected-day and component-specific forks instead of
asking visually similar branches to stay aligned by memory.

### Reload durability

1. Persist every rendered Game Day row into the calendar mirror and keep that
   mirror synchronised with the onboarding answer and decision ledger.
2. Persist the athlete's inputs once: recurring game day in Profile, one-off
   fixture changes in the decision ledger, and only actual calendar facts in
   Calendar. Rebuild the visible week after launch.

Option 2 landed. It is the North Star ownership model and removes the duplicate
fixture projection that produced four game days in memory and one on disk.

## What changed

- Week uses Renee's compact card head for all seven days. Today is highlighted
  but starts closed. Rest and Game Day use shorter centred cards. The week date
  controls sit below the Today/Week toggle and Today has no week browsing.
- A card chevron reveals the whole session inline as a simple numbered list.
- Day uses component icons as its markers, includes Mobility / Warm-up and any
  Conditioning, has no left accent rail and no coach notes.
- My Status is always present in Coach, opens the real status screen, owns
  season phase and active modifiers, and still renders an honest empty state.
- Profile shows only the onboarding equipment setting, moves equipment editing
  into the setup-change route, removes duplicate coach adjustments and removes
  Clear coach chat.
- The quick state actions are Tired, Away, Sick, Injured and Equipment. Tired
  directly opens exactly Bit tired today / Pretty flat / Totally cooked. Sick
  contains no flat or injury branch.
- The missed-session prompt has exactly Did it / Skipped it / Move it forward,
  routed to the existing survey, skip result and move-session route.
- A live session is split into collapsible components with per-exercise checks.
  Checked work becomes quiet, partial completion is retained, and the feedback
  summary reports which components were completed, partial or skipped.
- Effort is 1–5 on one line, from very easy to very hard.
- The completed Day card has no `DONE` badge. It says `Session complete` once,
  with a green tick, and offers View summary.

## First-run findings — reported before repair

1. The first real reload stopped before the calendar question: a compatibility
   Profile writer replaced a completed 28-answer profile with an empty profile.
   The explicit boot input alone did not close it, so the protection moved to
   the disk writer. Bare compatibility writes can no longer overwrite material
   Profile data; an explicit reset remains allowed.
2. With Profile protected, the original inbox defect became visible exactly:
   four derived Game Day marks in memory and one on Calendar disk.
3. Filtering the Calendar store was insufficient because the accepted-state
   transaction had a second serializer. The new Calendar ownership cell failed
   on that writer immediately; it now uses the same input-only selector.
4. The first corrected simulator reload reached the app but the iOS
   accessibility driver crashed before reading the opening screen. That run is
   instrument failure, not app evidence, and was retried.
5. The next reload passed persistence but its final assertion still assumed
   Week opened automatically. That was an obsolete test expectation: Sam had
   explicitly ruled that Today opens collapsed. The tape now taps Week before
   checking the Saturday fixture.

## Receipts

- Calendar ownership: 8 named cells run, 8 passed. They guard the input-only
  persisted shape and both known serializers.
- Quiescent boot: 5 named cells run, 5 passed. The visible week survives a
  relaunch by derivation, the ledger is byte-identical, and the generating
  Profile survives acceptance.
- Profile quarantine: 7 named cells run, 7 passed. Material disk state survives
  an unowned bare write while explicit reset still erases it.
- Session execution checklist: 97 named checks run across checklist, optional
  mobility and persistent result ownership, all passed.
- The corrected reload tape completed on the iOS simulator: cold seed,
  checkpoint, process stop, relaunch, semantic convergence, Week tap and visible
  Saturday Game Day card. The final screenshot is
  `artifacts/ui-walk/reload-standard-week-end.png`.
- The live checklist tape completed on the iOS simulator: one exercise checked,
  partial component outcome, 1–5 effort selection, saved feedback, and completed
  Day card. Screenshots are
  `artifacts/ui-walk/session-checklist-partial.png`,
  `artifacts/ui-walk/session-feedback-one-to-five.png`, and
  `artifacts/ui-walk/session-complete-day-card.png`.
- The completed-card screenshot was visually inspected: CORE remains the only
  badge and the green completion icon is a tick.
- The typecheck baseline gate passed with 35 product, 51 development-tool and
  373 test diagnostics — 459 total against the recorded baseline, zero new
  diagnostics.

## What catches the next defect of this class

The profile disk guard fails if a non-owner can erase material answers. The
Calendar ownership cells fail if either serializer starts persisting a derived
fixture projection. The quiescent-boot cell rebuilds from inputs and compares
the visible world. The reload tape kills and relaunches the process, then checks
the fixture on the rendered Week screen. The session checklist cells guard the
meaning of partial/full/skipped work, while the simulator tape catches a
source-correct control that is not reachable or does not fit.

## North Star

Toward it. The persistence fix deletes a stored representation from Calendar:
Profile and the decision ledger retain decisions; the visible week is derived.
The UI work also reduces owners: one week-card head and one checklist outcome
model replace branches that previously had to agree by accident.

## NOT COVERED

- Sam's physical iPhone. Athlete-facing acceptance remains open until he checks
  the checkpoint there.
- A migration survey over every legacy device envelope containing only Calendar
  `game` / `noGame` marks. The supported current path stores recurring fixtures
  in Profile and one-off decisions in the ledger; legacy calendar-only worlds
  were not enumerated in this unit.
- Every possible long, accumulated session checklist. The live tape covers a
  partial one-set session and the source cells cover the state combinations; a
  deep device walk across weeks was not run.
- An in-progress checklist after a force-quit. Checkmarks are a screen draft;
  per-exercise results become durable when Save & Finish commits the outcome.
- The pre-existing optional-power aggregate contradictions in the older session
  feedback suite. They predate this unit and were not reinterpreted silently.
- Full `test:bible`, which is deliberately red until the remaining registered
  laws receive guards.
