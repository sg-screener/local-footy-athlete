/**
 * Pending lists as STATES, and the Stage B pin.
 *
 * SAM'S RULING (2026-07-28): "a pending list must distinguish 'ruled empty by
 * Sam' from 'never populated' — absence must never render as approval anywhere
 * the gate looks."
 *
 * The defect that produced the ruling: `LOAD_RULING_PENDING` is an empty Set,
 * and a passing assertion reads "nothing is parked awaiting a load ruling."
 * True, and misleading — nothing is parked because nothing was ever put there.
 * 71 of the 77 entries in EXERCISE_LOAD_MAP predate the park and have never
 * been ruled. The empty list was doing the work of a completed review without
 * anyone having done one.
 *
 * That is `inj()` defaulting to 'good' one layer up: ABSENCE RENDERED AS
 * APPROVAL. A default must not impersonate a ruling; an empty list must not
 * impersonate a finished one. So emptiness now has to say which kind it is.
 */

import fs from 'fs';
import path from 'path';

/* ══ Pending lists ══ */

/** Who ruled, when, and where it can be checked. Same shape as the registry's. */
export interface PendingAttribution {
  /** ISO date of the ruling. */
  readonly ruledOn: string;
  /** Repo-relative path that records it. Must exist. */
  readonly where: string;
}

/**
 * `never_populated` is the state an empty array used to occupy without
 * admitting it. It is not a failure of the list — it is an accurate report
 * that nobody has done the work yet, and the gate treats it as one.
 */
export type PendingList =
  | { readonly status: 'populated'; readonly entries: readonly string[] }
  | { readonly status: 'ruled_empty'; readonly attribution: PendingAttribution }
  | { readonly status: 'never_populated' };

export const PENDING_LISTS: Record<string, PendingList> = {
  /**
   * Sam ruled every parked name in the load-ruling changeset and the queue
   * genuinely emptied. That is a real completed review, so it is recorded as
   * one — with the document that proves it.
   *
   * NOTE this covers only names that were ever PARKED. The 71 unruled ratios
   * already sitting in EXERCISE_LOAD_MAP were never parked, so this list says
   * nothing about them. They are tracked in PROVENANCE_INVENTORY_2026-07-28.md
   * and are Unit 3's subject. Recording that distinction is the entire point
   * of the ruling: this list is honest about its own scope.
   */
  load_ruling: {
    status: 'ruled_empty',
    attribution: {
      ruledOn: '2026-07-25',
      where: 'docs/LOAD_RULINGS_LITERAL_LOCK_PURGE_REPORT_2026-07-25.md',
    },
  },

  /**
   * Equipment minimums. Sam ruled barbell 20 and kettlebell 8 alongside the
   * floor-out four, then closed the table with dumbbell 1, cable 2.5 and
   * machine 10. Every equipment kind now carries a ruled minimum AND a ruled
   * lattice in one owner, so there is nothing left to park.
   */
  equipment_minimums: {
    status: 'ruled_empty',
    attribution: {
      ruledOn: '2026-07-28',
      where: 'docs/PROVENANCE_INVENTORY_2026-07-28.md',
    },
  },

  /**
   * The exercise-name literal lock's `awaiting_sam_ruling` kind. Sam ruled all
   * six cueless names surfaced by the live "Add exercise" table.
   */
  exercise_name_literal: {
    status: 'ruled_empty',
    attribution: {
      ruledOn: '2026-07-25',
      where: 'docs/EXERCISE_NAME_LOCK_REPORT_2026-07-25.md',
    },
  },
};

/** Problems that make a `ruled_empty` claim unverifiable. */
export function pendingListProblems(repoRoot: string): string[] {
  const problems: string[] = [];
  for (const [name, list] of Object.entries(PENDING_LISTS)) {
    if (list.status !== 'ruled_empty') continue;
    const { ruledOn, where } = list.attribution;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ruledOn)) {
      problems.push(`${name}: ruledOn "${ruledOn}" is not an ISO date`);
    }
    if (!where || !fs.existsSync(path.join(repoRoot, where))) {
      problems.push(`${name}: where "${where}" does not exist`);
    }
  }
  return problems;
}

/* ══ The Stage B pin ══ */

/**
 * Conditioning, speed and COD dose machinery that Stage B deletes when it
 * switches selection onto the authored templates.
 *
 * SAM'S RULING (2026-07-28): doomed values must not reach his ruling queue —
 * ruling on a number that is about to be deleted is wasted time. These 118
 * decisions are pinned rather than pending.
 *
 * The pin is load-bearing in both directions, which is what stops it becoming
 * a hiding place:
 *   - while Stage B is unlanded, every pinned symbol must still exist;
 *   - once Stage B lands, every pinned symbol must be GONE. A survivor is a
 *     second conditioning-dose authority sitting beside the equality-bound
 *     one, which is the precise defect the sheet exists to remove.
 *
 * `supersededBy` names the authored template that takes over, and the gate
 * checks that template actually exists in the sheet. A pin without a real
 * replacement is just a wish that something will replace it.
 */
export interface StageBPin {
  /** Path relative to `src/`. */
  readonly file: string;
  readonly symbol: string;
  /** Name of the authored template in conditioningTemplates.ts that replaces it. */
  readonly supersededBy: string;
}

export const STAGE_B_DOOMED: readonly StageBPin[] = [
  // ── sessionBuilder: the bulk of the live conditioning/speed dose authorship
  { file: 'utils/sessionBuilder.ts', symbol: 'machineSprintPrescription', supersededBy: 'Erg Short-Burst Repeats (15–20 s)' },
  { file: 'utils/sessionBuilder.ts', symbol: 'buildConditioningTemplateRaw', supersededBy: 'Classic 4×4' },
  { file: 'utils/sessionBuilder.ts', symbol: 'buildCombinedConditioningTemplate', supersededBy: 'Steady Blocks (3×8 min or 4×6 min)' },
  { file: 'utils/sessionBuilder.ts', symbol: 'aerobicErgPrescription', supersededBy: 'Erg Flush Blocks' },
  { file: 'utils/sessionBuilder.ts', symbol: 'buildAttachedConditioningComponentTemplate', supersededBy: 'Two-Minute Repeats' },
  { file: 'utils/sessionBuilder.ts', symbol: 'switchToOffFeetModality', supersededBy: 'Classic 4×4' },
  { file: 'utils/sessionBuilder.ts', symbol: 'buildSprintMicroDose', supersededBy: '20 m Acceleration Reps' },
  { file: 'utils/sessionBuilder.ts', symbol: 'buildSprintReducedVolume', supersededBy: '20 m Acceleration Reps' },
  { file: 'utils/sessionBuilder.ts', symbol: 'conditioningFlavourToExerciseName', supersededBy: 'Classic 4×4' },
  { file: 'utils/sessionBuilder.ts', symbol: 'conditioningCategoryToExerciseName', supersededBy: 'Classic 4×4' },
  { file: 'utils/sessionBuilder.ts', symbol: 'conditioningWorkoutType', supersededBy: 'Classic 4×4' },
  { file: 'utils/sessionBuilder.ts', symbol: 'TEMPLATE_CATEGORY', supersededBy: 'Classic 4×4' },

  // ── speed / COD doses elsewhere in the live path
  { file: 'data/defaultProgram.ts', symbol: 'buildExercisesForSpeedBlock', supersededBy: 'Hill Acceleration' },
  { file: 'rules/speedTemplates.ts', symbol: 'LATE_OFFSEASON_SPEED_TEMPLATES', supersededBy: 'Off-Season Speed Reintroduction' },
  { file: 'utils/coachingEngine.ts', symbol: 'createQualitySpeedMicroDoseBlock', supersededBy: '20 m Acceleration Reps' },

  // ── coach-authored conditioning doses
  { file: 'utils/coachRevisionTemplates.ts', symbol: 'TEMPLATE_DEFINITIONS', supersededBy: 'Steady Blocks (3×8 min or 4×6 min)' },
  { file: 'utils/coachRevisionTemplates.ts', symbol: 'conditioningRowsForTemplate', supersededBy: 'Steady Blocks (3×8 min or 4×6 min)' },
  { file: 'utils/coachPlan.ts', symbol: 'sprintAdditionSelection', supersededBy: '20 s Max Sprint — Small Dose' },
  { file: 'utils/coachPlan.ts', symbol: 'aerobicAdditionSelection', supersededBy: 'Continuous Aerobic Run' },
  { file: 'utils/coachPlan.ts', symbol: 'buildConditioningPrescription', supersededBy: 'Classic 4×4' },
];

/**
 * Has Stage B landed?
 *
 * Stage B is defined by BEHAVIOUR, not by a flag someone remembers to flip:
 * the authored templates module stops being inert and starts being read by the
 * generation path. A flag can be set while the wiring is half-done; an import
 * cannot.
 */
export function isStageBLanded(srcDir: string): boolean {
  const consumers = [
    'utils/sessionBuilder.ts',
    'data/defaultProgram.ts',
    'utils/conditioningRules.ts',
    'utils/coachPlan.ts',
  ];
  return consumers.some((rel) => {
    const file = path.join(srcDir, rel);
    if (!fs.existsSync(file)) return false;
    return /from\s+'[^']*conditioningTemplates'/.test(fs.readFileSync(file, 'utf8'));
  });
}
