/**
 * `ConstraintPlan` — the SHAPE the coach reply composer reads. Nothing in
 * production builds one.
 *
 * WHAT THIS FILE USED TO BE. `buildConstraintPlans` turned the active
 * constraints into a four-line "Avoid / Sub in / Keep / advice" plan, and
 * `validateVisibleProgramAgainstConstraintPlans` re-validated the visible week
 * against those plans — a second reader-facing authority beside the exposure
 * engine, with ~570 lines of avoid/substitute/keep vocabulary of its own.
 *
 * IT HAD ZERO PRODUCTION EXECUTION. Both production importers
 * (`utils/verifiedCoachCommunication.ts`, `utils/coachReplyComposer.ts`) take
 * only this TYPE, so the module was erased at compile time. The single
 * production site that supplies the list, `utils/coachDispatchDeps.ts:113`,
 * passes `plans: []` — so the plan lines those two composers can draw have no
 * producer, and never had one on the live path.
 *
 * WHO OWNS THE BEHAVIOUR NOW.
 *   - deciding what a constraint blocks   `utils/exposureEngine.ts`
 *   - producing the constraints           `utils/coachConstraintProducers.ts`
 *   - validating the visible week         `exposureEngine.validateVisibleProgramAgainstConstraints`
 *   - what the coach may claim            `utils/verifiedCoachCommunication.ts`
 *
 * The type stays because those two live composers declare parameters with it.
 */

import type { ActiveConstraint } from '../store/coachUpdatesStore';
import type { Constraint } from './exposureEngine';

// ─── ConstraintPlan type ────────────────────────────────────────────

export interface ConstraintPlan {
  /** Stable id — mirrors the underlying constraint id. */
  id: string;
  /** Constraint origin — "injury" | "fatigue" | etc. */
  type: ActiveConstraint['type'];
  /** "Hammy pain — 7/10" / "Shoulder pain — 8/10" / "Fatigue — 7/10". */
  activeIssue: string;
  /**
   * Short, deduped, human-readable labels for what to avoid this block.
   * Derived from blockedExposures (severity-aware) so the spec the
   * card shows matches what the engine actually enforces.
   *
   * Examples: "Sprinting / max-speed running", "Heavy hinge / nordics / RDLs",
   * "Pressing / overhead", "Plyometrics / jumping".
   */
  avoid: string[];
  /**
   * What to substitute with — short labels, region-aware.
   * Examples: "Quad-dominant lower (goblet squats, leg press)",
   * "Trunk", "Easy bike / rower if pain-free".
   */
  substituteWith: string[];
  /** What's safe to keep doing — kept in alignment with engine safeFocus. */
  keep: string[];
  /** Closing advice (physio nudges, etc). */
  advice: string[];
  /** "Update coach when it improves, worsens, or clears." */
  updatePrompt: string;
  /** The underlying engine Constraint — used by the plan validator. */
  constraint: Constraint;
}
