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
| `coach-my-status.yaml` | 2026-08-10 | PASS — end to end, including the not-yet caption |
| `day-card-dropdowns.yaml` | 2026-08-10 | PASS — collapsed, expanded, collapsed |
| `day-readiness-profile-type.yaml` | 2026-08-11 | PASS — direct three-choice Tired, illness-only Sick, matching Developer/Support/Legal type |
| `day-week-profile.yaml` | 2026-08-10 | PASS — day, week, profile, coach |
| `dev-launch-refusal-speaks.yaml` | 2026-08-10 | PASS — the refusal speaks and clears |
| `profile-setup-equipment.yaml` | 2026-08-11 | PASS — Commercial gym summary, nested editor, full scroll to Save |
| `standard-program-week.yaml` | 2026-08-10 | PASS — seven rows, a count, and a row opening in place |
| `explorer-all-nine.yaml` | NOT RUN | Never run this pass. Carried as debt, not as a claim. |
| `fixture-move.yaml` | NOT RUN | RED on the dead `fixture-actions-open` id (pre-existing). |
| `injury-case` (seed, via `reset-seed`) | 2026-08-10 | **WITNESS FAILURE GONE.** Now blocked behind the calendar-storage durability defect — a DIFFERENT problem, priced in the slice 3 boundary addendum 4. |
| `lower-body-deletion.yaml` | NOT RUN | Never run this pass. |
| `one-set-feedback.yaml` | NOT RUN | Re-aimed 2026-08-10, never executed since. |
| `reload-standard-week.yaml` | NOT RUN | Blocked behind the seeded world's durability (4 game days in memory, 1 on disk). |

**SEVEN OF TWELVE HAVE RUN. THAT IS THE HONEST NUMBER** and it is written here rather
than implied by seven green ones. `NOT RUN` is a state this table carries on
purpose: a receipt that only recorded successes would make the rig look alive
while half of it was dark, which is precisely the failure this law names.
