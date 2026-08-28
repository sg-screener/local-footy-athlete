# Short flushes and onboarding — candidate 263369ba

Owner: programming-remedy. Product checkpoint: `263369ba6873008cef28fab1a7f831dfc5989e4f`.
Continues verified product `38457383` and report checkpoint `df8f8428`; does not
replace the architecture or discard the original rcsteps evidence.
Exact-candidate release checks are green; physical acceptance remains open.
**Not installed. Neither phone touched. Installation hold remains.**

## Implemented decisions

- The incomplete Bodyweight Circuit is excluded from automatic quality/tier
  pools and fallback selection. Its catalogue identity, original prescription
  and saved-reference lookup remain. No four exercises were invented.
- Seven flush identities now have concrete easy timed doses. The whole timer
  includes preparation and every rest/transition, including the last recovery.
  No extra warm-up is appended. No distance format is used in this revision.
- Bike, Air Bike, RowErg and SkiErg are explicitly permitted for flushes, subject
  to the existing actual-equipment, injury and availability owners. One machine
  or the displayed ordered rotation is used. No running/circuit fallback is
  manufactured when suitable machines are absent.
- G+2 placement, optional versus required recovery, team/conditioning-day
  suppression and no fitness-conditioning credit retain their existing owners.
- All 55 templates declare permitted modalities. Eligibility no longer infers
  permission from prose mentioning an excluded machine. Work-interval limits
  use the selected prescription, not an unused alternative. Hard-conditioning
  and flywheel limits remain in force.
- Flush selection history now records recovery demand. An old aerobic-labelled
  flush record is lifted on read without changing or deleting saved history.
- Steady Blocks already displayed four six-minute rounds but stored one round.
  Composition now uses that selected four-round prescription. Its work,
  intensity and recovery wording did not change.
- Actual year inspection on the first candidate found fixed intervals displayed
  as `60-60 sec`. The existing formatter now displays one target, preserves real
  ranges, and has an additional mutation guard. This is the only product-code
  difference between preliminary c12a8397 and final 263369ba.

| Saved flush identity | Work / complete recovery | Rounds | Entire timer |
| --- | --- | --- | --- |
| Short Flush | 1 min / 1 min | 4 | 8 min |
| Easy Aerobic Flush | 1 min / 1 min | 5 | 10 min |
| Nasal-Paced Easy | 1 min / 1 min | 5 | 10 min |
| Erg Flush Blocks | 2 min / 1 min | 4 | 12 min |
| Flush Intervals 30:30 | 30 s / 30 s | 10 | 10 min |
| Flush Intervals 1:1 | 1 min / 1 min | 6 | 12 min |
| Flush Intervals 2:1 | 2 min / 1 min | 4 | 12 min |

Every flush displays easy 2–3/10, full conversation throughout. Preparation is
inside the first timed round; machine changes are inside recovery. The total
timer is the stop instruction, not an estimate to which transitions are added.
`flushPrescriptionTruth` independently compares displayed work/recovery/total,
numeric rows and option duration. `flushRestartJourney` reaches all seven
identities through real block rollover on each of four single-machine answers,
for both male and female profiles.

## Failures first, and what changed

Evidence root: `outputs/flush-remediation-2026-08-28/`. Previous evidence is
unchanged; unsuccessful runs have separate filenames.

- The first short-flush guard had 197 passing and 343 failing assertions on the
  old prescriptions. The old long doses and machine restrictions were measured
  before replacement (`baseline-failures.log`).
- Real rollover initially delivered only Short Flush in all eight athlete/kit
  worlds. Recording flush under ordinary aerobic demand prevented the existing
  rotation history from seeing it (`flush-restart-first.log`). The recorder/read-ingress repair
  makes all seven identities reachable; no new rotation cursor was added.
- The first numeric-drift mutation survived because the test compared two
  values derived from the same erroneous number. The guard now parses the
  displayed prescription independently. The preserved before/after mutation
  receipts show the same fault being caught.
- The removed-flush mutant first stopped at the newer `G+2 flush not reached`
  precondition, before the mutation runner's older expected assertion. The
  preserved first receipt is marked unproven, not silently replaced. The
  corrected runner directly invokes the unchanged `gPlusTwoFlushJourney` and
  now observes the expected failing assertion. Application and guard sources
  remain the exact frozen candidate; this is a test-harness targeting repair.
- A new no-credit assertion initially counted the week's game anchor, not just
  app conditioning. Its corrected unit is appCoreCount=0 plus one flush credit.
  Deliberately promoting the flush to core credit fails it.
- Removing the permissive empty-pool fallback exposed an unresolved off-leg
  preference reintroduced by the connector on no-machine days. The existing
  specialist now carries its kit-resolved preference through that connector.
  The lighter-day owner removes hard conditioning when no accepted suitable
  machine exists; it does not invent a running flush. Strength and Undo remain
  covered by the canonical journey.

## Onboarding: app geometry versus automation

The original failed No tap used bounds `[20,364][382,449]`, tapping y=406.
The settled No target was `[20,426][382,511]`: y=406 was actually inside Yes.
The original 2 km skip tap had the same 62-point pre-inset displacement.
The old native SafeAreaView applied its inset after accessibility had exposed
the answer bounds during the screen transition.

The shared onboarding shell now uses its existing context insets on its first
render. Navigation, answer values and save callbacks are unchanged. Stable
identifiers name the existing Skip/No controls and Review values. Normal
automation waits for the new screen and settled animation before a single tap,
then checks the saved answers on Review. A separate fast-text-tap regression
retains the original sequence without those extra animation waits.

The revised diagnostic fast run measured Skip at `[20,408][382,467]` and No at
`[20,426][382,511]`, and Review retained both intended answers. The revisit
journey entered 6:45, verified it, returned, skipped with the keyboard open,
verified the cleared answer and No issues, generated and restarted without
clearing data. This is stronger evidence than an unchanged successful retry.

Separate automation/setup failures are retained: a development reload
contaminated one early reproduction; an isolated Expo entry failed with
symlinked dependencies; the first revisit ID was hidden by its parent tap
target; and the first final runner invocation lacked the configured Java PATH.
These are not reported as app-answer defects or successful journeys. The first
native build also lacked generated dependency files; locked code generation
was rerun before the clean-build retry.

## Original 22 items

“Automated” means implemented and covered by named checks, not physical-device
acceptance. The detailed original-item evidence remains in
`docs/PROGRAMMING_FOLLOWUP_2026-08-28.md`; its open Bodyweight/flush decisions are
superseded by this report, not by a silent edit to the historical receipt.

| Item | Current implementation / regression owner |
| --- | --- |
| P01 | 55-template output review; incomplete automatic circuit retired. `conditioningClarity`, `flushPrescriptionTruth`. |
| P02 | Actual-kit lower-day fallback and single-leg work retained. `unilateralPriorityJourney`. |
| P03 | Fixture-qualified automatic extras only; manual Add preserved. `spareCapacityOfferTests`. |
| P04 | Power rest remains in domain data, hidden in screen/year display. Input truth and year audit. |
| P05 | Whole-week spacing and durable selection history preserved; flush history category corrected. Input truth/restart journeys. |
| P06 | Leg Press and conventional Deadlift remain manual/suitable fallbacks. `programmingSelectionDecisions`. |
| P07 | Non-flush recovery wording unchanged; settled flush recovery/doses explicitly replaced. 110-variant comparison. |
| P08 | Advanced loaded-curl preference with legitimate band fallback preserved. Input truth/mutation. |
| P09 | Actual typed machine/order displayed; no unspecified mixed prescription. Clarity and flush matrices. |
| P10 | Existing whole-week/cyclic spacing within fixtures, kit and availability preserved. Annual/canonical gates. |
| P11 | Row in lift names is not rewritten to Bike. Existing identity/modality journey. |
| P12 | Rollover/projection identity protection retained. Annual and restart gates. |
| P13 | Painful pressing handled by trigger-family legality through the compiler; accumulated modifiers, Clear, dose retention and restart preserved. `injuryRecompositionTests` and year audit. |
| P14 | Explicit eligible-machine pools and actual resolved work interval; no max-machine preference. Input truth/flush matrix. |
| P15 | Existing approved club acceleration/preseason flying-sprint policy retained; no invented in-season extra dose. Typed speed/history guards. |
| P16 | Necessary bilateral fallback does not replace both lower days' single-leg work. `unilateralPriorityJourney`. |
| P17 | Agreed jumps remain in the normal pool with current kit/injury safeguards. Power-pool/input truth guards. |
| P18 | Agreed G+2 optional/core recovery rule preserved, now with short easy actual doses. `gPlusTwoFlushJourney` and flush/restart matrices. |
| P19 | Explosive Landmine Press retains its existing approved strength role; no new power dose invented. |
| P20 | Cross-cutting input, output, logging, modifier and restart checks retained. Final receipts below; device acceptance outstanding. |
| P21 | Receiver-combination ranking preserved; year comparisons use identical dated athlete inputs. |
| P22 | Separate Mobility/Recovery additions exclude all drills already present that day, including strength warm-ups; separate completion, Undo and restart retained. Low-load and canonical journeys. |

No programming decision remains unanswered. Do not read this table as all 22
items physically accepted or permission to install.

## Exact-version verification and delivered years

Completed evidence on final product 263369ba:

- `npm run test:release`: 20/20 release units green, covering 23 contracts;
  exit 0. Annual acceptance reached 416/416 required athlete-weeks across eight
  distinct athletes, with zero distinct failure keys.
- All 2,351 tracked files in the isolated candidate matched their Git blobs
  before, during and after verification. The first final release attempt was
  interrupted because generated reports contaminated the revision's dirty-state
  metadata; that evidence remains. The completed run excludes generated output
  locally and reports the exact unsuffixed candidate revision.
- Flush matrix: 1,794 assertions / seven distinct templates; real-history
  journey: 288 assertions / eight athlete-machine worlds / 56 restarts. Every
  template is reached on each supported single-machine answer for both genders.
- Three repeated real onboarding journeys passed: original fast text taps;
  normal onboarding plus modifier Clear and phase change; time entry, Review
  revisit and keyboard-open Skip. Saved answers are checked on Review. Two
  no-clear restart checks retain the generated program and, in the phase
  journey, Off-season with zero active modifiers.
- A clean Release build succeeded and deep/strict signature verification
  passed with system trust-store access. The first sandboxed trust check is
  preserved separately. **Built, not installed.** Simulator journeys use the
  existing development client with frozen candidate JavaScript; they are not
  represented as Release-runtime tests on a phone.
- Four report years passed their artifact audits: each has 52 weeks, 364
  projected athlete-days and 52 successful restarts. Each has zero trainable
  painful presses in the measured shoulder window, corrupt names, empty lifting
  doses, missing conditioning modes, invalid flush rows or retired automatic
  circuit rows. Each has 20 flush dates and six distinct flush identities; the
  separate seven-block matrix reaches the seventh, rather than forcing a quota
  into these years.

[Male commercial-gym year](/Users/samgeurts/Documents/local-footy-athlete/outputs/flush-remediation-2026-08-28/candidate-263369ba/delivered-years/corrected-commercial-male-year.html)
· [Female commercial-gym year](/Users/samgeurts/Documents/local-footy-athlete/outputs/flush-remediation-2026-08-28/candidate-263369ba/delivered-years/corrected-commercial-female-year.html)
· [All four years and comparison](/Users/samgeurts/Documents/local-footy-athlete/outputs/flush-remediation-2026-08-28/candidate-263369ba/delivered-years/year-comparison.html).

The comparison asserts identical athlete profiles, dated actions and phase
inputs against verified 38457383. Displayed row placements remain 1807/1961
(partial-kit male/female) and 1853/2024 (commercial male/female), each over 364
athlete-days. Each gains five distinct displayed names from working flush
rotation; adjacent same-part calendar pairs remain 15 in each world. These are
row placements and calendar pairs, not sets, selection calls or avoidability
claims. The full review covers 55 templates / 110 variants, with 54 automatic
templates and all 55 saved identities retained.

Three additional native regression flows passed: conditioning prescription and
logging/restart; readiness load retention/Clear/restart; replacement load/restart.
The year exporter also now carries optional conditioning from the existing
component completion policy, so a core strength day does not make its optional
flush appear required. This is a reporting-only correction; application code
remains the frozen 263369ba checkpoint. The initial reports remain as evidence.
Each delivered report has 20 optional flush row placements on 20 distinct dates,
and zero required flush rows for these particular inputs (no qualifying mild
report at those flush opportunities). Required-flush behaviour is tested by the
separate soreness/clear/restart journey, not manufactured in the report inputs.

All 53 deliberate mutations are caught, including the 38 prior regression
mutants and 15 new flush/onboarding mutants. `mutations-final-receipt.json`
combines the retained 52 first-run catches with the explicit G+2 recheck above;
the first unproven receipt remains alongside it.

[Consolidated exact-version receipt](/Users/samgeurts/Documents/local-footy-athlete/outputs/flush-remediation-2026-08-28/candidate-263369ba/final-verification.json)
pins the release log, annual result, mutations, report audits, source identity
and native build/flow evidence. The follow-up save changes only this report,
the seat status, the report's optional-label adapter and the mutation runner's
witness targeting. Application code and release-gated assertions remain at
263369ba; neither helper correction is disguised as a new app candidate.

## What catches the next defect

The release-gated compiler witness executes the new flush dose/eligibility and
real rollover/restart matrices plus the retained accumulated P13/modifier/Add
journeys. All seven flush identities are checked across machine subsets,
shoulder/knee/combined restrictions, combined lifting days and modality changes.
Displayed strings are parsed independently of numeric dose fields. Retirement
is checked at selection, including a retired preferred identity. Deliberate
mutants target dose, intensity, transition, warm-up, eligibility, retirement,
history, credit and onboarding bindings; the earlier regression mutants remain.
Native repeat journeys check saved answers, not just successful taps.

## NOT COVERED / remaining work

- Physical iPhone acceptance: neither phone was installed to, reset or wiped.
  Keep the installation hold; no claim that the whole original list is done.
- Four pre-existing C12 flavour-map source-anchor failures in the diagnostic
  template suite reproduce on untouched 38457383. They are not removed,
  weakened, or presented as a current release-gate failure.
- Every native Add permutation and native guided painful-trigger entry remain
  outside these simulator flows; their accepted compiler/transaction behaviour
  is exercised by the accumulated release witnesses. All device sizes/orientations, real OS-kill
  fault injection, remote persistence, clinical validation and exhaustive
  Cartesian coverage remain outside these measured runs.
- HTML layout has not been browser-rendered in this pass; report content,
  emitted prescriptions, labels and restart equivalence were audited directly.
