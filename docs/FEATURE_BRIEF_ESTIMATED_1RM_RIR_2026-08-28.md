# Estimated 1RM — last-set RIR and selectable lifts

Owner: this intake chat (recording only).
Status: direction discussed with Sam and saved at his request; **not implemented**.

This is a future feature brief, separate from programming-remedy's current QA
work and the new-exercise intake. Sam asked to keep track of the idea, not to
start building it. It does not change current runtime policy or release scope.

## Purpose

Show an Estimated 1RM trend from normal training, without requiring max tests.
Athletes should be able to compare performance more usefully when prescriptions
change between, for example, 3 × 3, 3 × 5 and 4 × 8. Do not promise that the
estimate removes all effects of fatigue, rep scheme or exercise technique.

## Direction Sam agreed to retain

### Four configurable Progress charts

| Default tracked lift | Proposed alternative |
| --- | --- |
| Bench Press | OHP |
| Pull-Up | Lat Pulldown |
| Back Squat | Bulgarian Split Squat |
| RDL | Trap-Bar Deadlift |

These are chart-selection pairings, not claims that the exercises or their
loads are equivalent. Changing a tracked lift changes the chart, not the program.
Preserve each exercise's separate history; switching back restores that history.
Do not join different exercises or variations into one continuous strength line.

### Optional feedback for the last completed working set

Sam explicitly chose the **last completed working set**, overriding the first-set
instruction in the pasted proposal. Do not silently switch back to the first set.

Show one question for each selected tracked lift actually completed in the
session, not for every prescribed exercise and not for skipped lifts.

Example copy/layout:

> Bench Press · Skip
>
> Last set: 100 kg × 5 reps
>
> How many more clean reps could you have done?

- Reuse the existing lime effort-slider interaction, snapping to whole answers:
  **0, 1, 2, 3, 4, 5+**.
- Start unanswered. An untouched slider is not zero and has no assumed RIR.
- The number/highlight follows the drag, not just finger release.
- Put a small Skip label beside the heading, with a usable tap target.
- Use the actual last set's weight and completed reps; allow correction if needed.
- If skipped, record no RIR-based estimate for this lift/session. Workout logging
  and other feedback still work normally. Existing historical points remain.
- Save 5+ as an open-ended answer, not exactly five; do not generate a precise
  estimate from it.
- Count only additional reps possible with good technique. This question is
  separate from whole-session RPE and must not overwrite it.

### Honest estimation and history

- Pair load, reps and RIR from the **same identifiable working set**. Never use
  the last set's RIR with the best set's load or a whole-exercise summary.
- Do not silently turn the upper end of a prescribed rep range into actual reps.
- Call the metric **Estimated 1RM**, never actual/tested 1RM.
- Preserve raw performance, set identity, exercise/variation identity, RIR and
  calculation version/provenance so the result can be audited and corrected.
- Keep old non-RIR estimates distinguishable. A new formula or RIR capture must
  not manufacture a PB or apparent strength jump across the method change.
- Do not automatically change training loads from this feature. Such behaviour
  would be a separate programming decision.

## Scientific caveat and calculation proposal

The supplied proposal uses completed reps + RIR, then interpolates a general
or Bench Press reps-to-%1RM curve to estimate load at 1RM. It proposes rounding
display to whole kilograms, excluding effective reps above 15 and special
confidence/PB handling. Preserve this as the candidate method, not an already
validated final implementation contract.

Original supplied proposal:
[/Users/samgeurts/.codex/attachments/c9e31b9b-8d11-460e-adbe-b9f803988ce2/pasted-text.txt](/Users/samgeurts/.codex/attachments/c9e31b9b-8d11-460e-adbe-b9f803988ce2/pasted-text.txt)

The population research behind the proposed curves extracted first-set data and
excluded later sets because of fatigue. Applying those curves to Sam's chosen
last-set input is an approximation. More prior sets or different rest can lower
the estimate without a loss of underlying strength; RIR does not correct that
away. This is a practical trend feature, not a validated fresh-max test.

Sources reviewed in this discussion:

- [Nuzzo et al., maximal repetitions and %1RM meta-regression](https://link.springer.com/article/10.1007/s40279-023-01937-7).
- [Refalo et al., Bench Press RIR prediction accuracy](https://pubmed.ncbi.nlm.nih.gov/37967832/).

Do not automatically label every RIR 0–3 result “good confidence.” Accuracy of
the RIR answer is not the same as accuracy of the resulting 1RM across all eight
lifts. Before implementation, verify the proposed numerical curve points,
define transparent eligibility/confidence/PB criteria and distinguish engineering
cutoffs from research-validated thresholds. Do not silently swap in another
formula and describe it as the approved pasted method.

## Exercise-specific details to resolve before building

- Pull-ups: retain bodyweight as recorded at the session plus added load; report
  clearly whether the estimate means added load or total load. Do not recalculate
  old sessions using today's bodyweight. Assisted pull-ups need separate handling,
  especially bands with non-constant assistance.
- Bulgarian Split Squats: reps are per leg, not both legs added together. Define
  a consistent side convention and total external-load convention (including two
  dumbbells). Do not combine one side's RIR with the other side's performance.
- Lat Pulldown: compare like-for-like machine/setup records; the same stack
  number on different machines is not necessarily equivalent resistance.
- Preserve exact variation and technique context where it changes comparability;
  do not claim the general curve is equally validated for every lift.
- Identify the last actual working set reliably, including partial sessions,
  warm-ups, back-off sets and missing per-set detail. Missing data needs honest
  confirmation or no estimate, not fabricated completed performance.

## Existing implementation to extend

Read at source during this discussion, **not runtime-verified in this turn**:

- `src/rules/estimatedOneRepMax.ts`: current Brzycki calculation, low-rep gate,
  best-set selection and bodyweight-plus-added-load pull-up handling.
- `src/rules/progressMainLiftStrength.ts`: fixed four main-lift histories and
  weekly best estimates, including legacy fallbacks.
- `src/utils/strengthLogging.ts`: logged-set aggregation and estimate basis;
  also contains prescribed-performance fallbacks which cannot serve as silently
  observed last-set performance for this feature.
- `src/components/SessionFeedbackPanel.tsx`: existing feedback/logging path.
- `src/components/DiscreteSlider.tsx` and `EffortSlider.tsx`: existing slider.
- `src/types/domain.ts` / `src/store/workoutLogStore.ts`: existing set records.
- `src/__tests__/progressTabOwnershipTests.ts`: current estimate/chart guards.

Preferred approach: extend the existing logs, feedback, pure estimate calculation
and Progress projections. A parallel estimate store or separate feedback system
would duplicate ownership without solving the data-quality problem.

## Protection expected when implementation is authorised

Add targeted tests without weakening the existing release gate. Cover actual
last-set selection, multiple tracked lifts, partial/skipped completion, null
and 5+ answers, load/reps corrections, chart swaps without history loss, exact
exercise identities, bodyweight-at-session, unilateral load conventions,
method-version changes and restart. Verify the slider on-device and prove the
new tests fail for deliberately mismatched set data and assumed RIR values.

## NOT COVERED

No code or runtime data changed; no tests, simulator flows or phone builds run
for this feature. Numerical curve transcription, exercise-specific validation,
final confidence/PB policy, loading edge cases and implementation remain open.
