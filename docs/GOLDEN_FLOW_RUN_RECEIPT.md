# GOLDEN FLOW RUN RECEIPT

**THIS FILE IS THE ONLY THING THAT CAN ENFORCE `LAW-instrumentation-alive`, and
it is a RECEIPT, not a plan.** Every other cell in the chain reads source and
passes on a flow that has not been executed since 18 July. A blocked instrument
does not hide zero defects — it hides an unknown number, and nine were found in
two days once the rig ran.

**HOW IT IS ENFORCED.** `test:repo-law-guards` reads the table below and reds
when a golden flow is missing from it, or when the newest `LAST RUN` date is more
than **7 days** old. Seven days because the founding case was **23** — the alarm
has to fire three times over before that number is reachable again.

**HOW TO UPDATE IT.** Run the flows, then edit the date and outcome you actually
saw. **A row edited without a run is the one thing this file cannot survive**, and
it is the same trust the LOOP CHECK line runs on.

    PATH="$HOME/.maestro/bin:$PATH" E2E_METRO_URL=http://127.0.0.1:8081 \
      scripts/dev-e2e/run-maestro-ios.sh .maestro/golden/<flow>.yaml

**NEVER `npx maestro` (a different npm package) and never bare `maestro test`** —
without the runner the `-e` binding is missing and the app is handed the literal
string `${E2E_METRO_URL}`.

## LAST RUN

| Flow | LAST RUN | Outcome |
| --- | --- | --- |
| `add-a-game-in-season.yaml` | 2026-08-13 | **PASS, END TO END — the on-glass proof of item 19, including Sam's week-only ruling.** Run on `standard-in-season-week`, which ALREADY HAS a Saturday game. The DAY screen does not carry the control (Sam, 2026-08-13: *"add a game button should only be on week screen - not day screen"*); the WEEK screen does, reading "Add a game" on a week that already has one — it used to vanish the moment a week had a fixture — with the old "No game this week - add one" copy gone. Tapping opens the day picker, and Wednesday and Sunday both come back as `fixture-target-*`, so a SECOND game has somewhere to go. **TWO INSTRUMENT FAULTS FOUND AND FIXED HERE, BOTH OF WHICH BLAMED THE PRODUCT FIRST:** `scrollUntilVisible` on the control's ID at 60% matched it in the view hierarchy while it was still BELOW the fold and never scrolled, so the tap hit nothing; and in picker mode a day row is `fixture-target-<date>`, not `day-row-<weekday>`, so the obvious row assertion could never pass. Screenshots: `artifacts/ui-walk/item19-day-screen-has-no-add-button.png`, `item19-add-a-game-with-a-game.png`, `item19-second-game-picker.png`. |
| `coach-my-status.yaml` | 2026-08-13 | PASS — end to end. Re-run for SEAT_INBOX item 16: the day notice now appears once a real "cooked week" report exists, opens My Status from Program, and the ZERO-state assertion above it deliberately still asserts the notice is absent. |
| `program-modifier-notice.yaml` | 2026-08-13 | **PASS, END TO END — the on-glass proof of item 16, re-run after Sam ruled *"add the popup"*.** Zero shows nothing on BOTH Program shapes; the readiness door makes one; the day's small card and the week's one line both appear; **each now opens the "Your session has been modified" sheet, whose "Not now" returns to the session and whose "Go to my status" reaches My Status** — both hops walked, and the sheet proven gone after the tab change. Program never carries the list. Screenshots: `artifacts/ui-walk/item16-day-zero.png`, `item16-day-notice.png`, `item16-week-notice.png`, `item16-week-opens-status.png`. |
| `day-card-dropdowns.yaml` | 2026-08-10 | PASS — collapsed, expanded, collapsed |
| `day-readiness-profile-type.yaml` | 2026-08-11 | PASS — direct three-choice Tired, illness-only Sick, matching Developer/Support/Legal type |
| `day-week-profile.yaml` | 2026-08-10 | PASS — day, week, profile, coach |
| `dev-launch-refusal-speaks.yaml` | 2026-08-10 | PASS — the refusal speaks and clears |
| `profile-setup-equipment.yaml` | 2026-08-11 | PASS — Commercial gym summary, nested editor, full scroll to Save |
| `standard-program-week.yaml` | 2026-08-13 | **RED, AND FURTHER IN THAN IT HAS EVER REACHED.** Its modifier door (`equipment-preset-open`) produced nothing, so everything below it had been dark; re-routed onto the readiness door, it now passes the day shape, the real modifier, and `assertVisible: modifiers-strip-day`. It then fails at `program-week-previous` → "Return to this week", which a NO-MODIFIER control run reproduced exactly: the seed holds ONE week, so that control is inert and the label never changes. **Pre-existing, newly visible, and it belongs to that seed — not to the notice.** The item-16 week assertion sits after it and is therefore not reached here; `program-modifier-notice.yaml` is where the week line is actually proven. |
| `explorer-all-nine.yaml` | NOT RUN | Never run this pass. Carried as debt, not as a claim. |
| `fixture-move.yaml` | NOT RUN | RED on the dead `fixture-actions-open` id (pre-existing). |
| `injury-case` (seed, via `reset-seed`) | 2026-08-10 | **WITNESS FAILURE GONE.** Now blocked behind the calendar-storage durability defect — a DIFFERENT problem, priced in the slice 3 boundary addendum 4. |
| `lower-body-deletion.yaml` | 2026-08-12 | **PASS, END TO END — and it is the on-glass proof of the seed fix.** The conditioning part is visible BEFORE the deletion (it was not, in every seeded world, until `stabilizeMicrocycle` learned to carry row-id references). Then: strength scope deleted → conditioning remains; whole day deleted → the day is rest; and rest survives a checkpoint + relaunch. **Two things the re-run taught, both now commented at the code:** a day offering ONE scope SKIPS the "remove what?" step and lands on its confirm, and `stableTestIdToken` turns `whole_day` into `whole-day`, so the underscore never reaches the tree. |
| `one-set-feedback.yaml` | NOT RUN | Re-aimed 2026-08-10, never executed since. |
| `reload-standard-week.yaml` | NOT RUN | Blocked behind the seeded world's durability (4 game days in memory, 1 on disk). |
| `session-move.yaml` | 2026-08-12 | PASS — whole session moved onto the empty Sunday, Monday redrawn as rest, Sunday as scheduled, and both survive a checkpoint + relaunch. First run, no iteration. |
| `readiness-adjust-and-clear.yaml` | 2026-08-12 | PASS — severe illness adjusts the week (fact, adjustment and programming-effect witnesses all appear), "Clear adjustment — I'm good now" takes it back, and the clear survives a relaunch. |

**TWELVE OF SIXTEEN HAVE RUN. THAT IS THE HONEST NUMBER** and it is written here rather
than implied by the green ones. `NOT RUN` is a state this table carries on
purpose: a receipt that only recorded successes would make the rig look alive
while half of it was dark, which is precisely the failure this law names.

**AND "HAS RUN" IS NOT "PASSES" — 2026-08-13 IS THE FIRST ROW TO PROVE IT.**
`standard-program-week.yaml` had a green row on 2026-08-10 and was, on that same
date, dying at a door no product source could open. Its row now reads RED, which
is a BETTER receipt than the green one it replaces: the flow reaches further than
it ever has and reports a real defect at the end of it. **A table that only ever
moves toward PASS is a table being edited toward comfort.**

**CORRECTED 2026-08-12 — THEY WERE NOT A CONCURRENT AGENT, THEY WERE WEDGED
PROCESSES, AND I REPORTED THE WRONG CAUSE FIRST.** Three `maestro test` processes
were holding this device and I recorded them as another agent running flows
alongside me. `ps -o etime` says otherwise: **one had been running for 1 day 12
hours, another for 1 day 10, a fourth `maestro hierarchy` for 22 DAYS.** They
were abandoned runs still holding the iOS driver, not work in progress. Killed;
the owed run then passed first time.

**THE STANDING LESSON IS STILL THE SHARED DEVICE, JUST NOT THE SHARED AGENT.**
Two Maestro sessions on one simulator interleave taps into the same app, so a run
that collides is "unknown", not "red" — stop it rather than record it. **AND
BEFORE BLAMING A COLLISION, ASK `ps` HOW OLD THE OTHER PROCESS IS**: an elapsed
time is the difference between "someone is working" and "something died here a
fortnight ago".
