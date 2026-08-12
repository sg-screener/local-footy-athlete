/**
 * IS THIS A WEEK SAM WOULD WRITE? — the question the 17 scenarios never asked.
 *
 * ## WHY THIS EXISTS
 *
 * **Sam, seat item 5, and it is his oldest fear:** *"I don't want to get 2 weeks
 * down the line and realise that a weekly template optimised for that and that
 * alone."*
 *
 * The scenario harness answers **"is this week legal"** — hard limits, validator
 * findings, refusals. It has never answered **"is this the week he asked for"**,
 * which is why item 4's finding (his 4-hard-plus-1-moderate shape occurs in 2 of
 * 17 weeks, and in ZERO fixture weeks) sat unseen for months. The instrument
 * existed. The question was never put to it.
 *
 * ## THE SCORE IS A COUNT OF RULED PREFERENCES, NOT AN INVENTED WEIGHTING
 *
 * A weighted score would be this file inventing coaching policy — deciding that
 * a missing moderate day is worth twice a fifth hard day, which nobody ruled.
 * **So the score is the number of Sam's RULED preferences a week satisfies**,
 * and each axis names itself in the row. Two axes today, both quoted:
 *
 * - **`hardDaysWithinPreferred`** — *"4 hard days plus 1 moderate/easy day is
 *   prefered but 5 hard days is okay"* (2026-08-12). Five is not a defect; it is
 *   not the preference either. The contract already carries both numbers
 *   (`preferredHardDayRange.max`, `permittedHardDayMaximum`), so this axis reads
 *   them rather than hard-coding 4 and 5.
 * - **`hasModerateDay`** — the other half of the same sentence, and the half
 *   with no reader anywhere: `achievedModerateDayCount` is written and consumed
 *   by nothing.
 *
 * When he rules a third preference it becomes a third axis and the score's range
 * changes with it. That is the intended shape: **the score is a projection of
 * the rulings, never a policy of its own.**
 *
 * ## WHAT A HARD VIOLATION IS, AND WHY IT IS NOT A LOW SCORE
 *
 * Exceeding `permittedHardDayMaximum` is illegal, not merely unpreferred. The
 * two are reported separately and never averaged together: an average would let
 * a legal-but-unpreferred week and an illegal one land on the same number, and
 * the whole point of this file is to stop one question standing in for another.
 */

/** The numbers a §18 effective-week evaluation already produces. */
export interface WeekShapeInputs {
  readonly scenarioId: string;
  readonly hardDays: number;
  readonly anchorHardDays: number;
  readonly moderateDays: number;
  readonly preferredHardDayMax: number;
  readonly permittedHardDayMax: number;
}

/** One scenario's answer to "is this a week Sam would write". */
export interface WeekPreferenceRow {
  readonly scenarioId: string;
  readonly hardDays: number;
  readonly anchorHardDays: number;
  readonly moderateDays: number;
  readonly preferredHardDayMax: number;
  readonly permittedHardDayMax: number;
  /** Illegal, not unpreferred. Reported apart from the score, never inside it. */
  readonly hardViolation: boolean;
  /** Which of Sam's ruled preferences this week satisfies, by name. */
  readonly preferencesMet: readonly string[];
  /** How many it satisfies, out of `PREFERENCE_AXES.length`. */
  readonly score: number;
  /** Both halves of his sentence at once — the shape item 4 measured. */
  readonly samShapeMet: boolean;
}

/** Every ruled preference this file knows about. Grows when Sam rules one. */
export const PREFERENCE_AXES = ['hardDaysWithinPreferred', 'hasModerateDay'] as const;

export type PreferenceAxis = (typeof PREFERENCE_AXES)[number];

/** Pure: one scenario's row. No policy beyond the two quoted rulings. */
export function preferenceRow(inputs: WeekShapeInputs): WeekPreferenceRow {
  const met: PreferenceAxis[] = [];
  if (inputs.hardDays <= inputs.preferredHardDayMax) met.push('hardDaysWithinPreferred');
  if (inputs.moderateDays >= 1) met.push('hasModerateDay');
  return {
    scenarioId: inputs.scenarioId,
    hardDays: inputs.hardDays,
    anchorHardDays: inputs.anchorHardDays,
    moderateDays: inputs.moderateDays,
    preferredHardDayMax: inputs.preferredHardDayMax,
    permittedHardDayMax: inputs.permittedHardDayMax,
    hardViolation: inputs.hardDays > inputs.permittedHardDayMax,
    preferencesMet: met,
    score: met.length,
    samShapeMet: met.length === PREFERENCE_AXES.length,
  };
}

/** What happened to one scenario between two runs. */
export type ScenarioVerdict =
  | 'hard_failure'
  | 'preference_regression'
  | 'preference_improvement'
  | 'unchanged'
  | 'new_scenario'
  | 'missing_scenario';

export interface ScenarioComparison {
  readonly scenarioId: string;
  readonly verdict: ScenarioVerdict;
  readonly baselineScore: number | null;
  readonly currentScore: number | null;
  readonly detail: string;
}

export interface PreferenceRunComparison {
  readonly scenarios: readonly ScenarioComparison[];
  readonly hardFailures: readonly string[];
  readonly regressions: readonly string[];
  readonly improvements: readonly string[];
  /**
   * SAM'S FEAR, MADE MECHANICAL. A change that lifts one scenario while pushing
   * more scenarios down is over-fitting — *"optimised for that and that alone"*
   * — and the order says it is REJECTED, not celebrated.
   */
  readonly overFitting: boolean;
  /** True when nothing blocks: no hard failure, no unexplained regression. */
  readonly clean: boolean;
}

/**
 * Pure: the before/after verdict across the whole set.
 *
 * THE THREE OUTCOMES THE ORDER NAMES ARE KEPT APART, and the middle one is the
 * reason this returns data rather than a boolean: a **hard failure** blocks, a
 * **preference regression** continues only with a stated reason (which a human
 * writes into the report — no script can supply it), and an **intentional
 * change** is a baseline update carrying its evidence. Collapsing them into
 * pass/fail would make the second indistinguishable from the third, which is
 * exactly how a preference quietly erodes.
 */
export function comparePreferenceRuns(
  baseline: readonly WeekPreferenceRow[],
  current: readonly WeekPreferenceRow[],
): PreferenceRunComparison {
  const byId = new Map(baseline.map((row) => [row.scenarioId, row]));
  const seen = new Set<string>();
  const scenarios: ScenarioComparison[] = [];

  for (const row of current) {
    seen.add(row.scenarioId);
    const before = byId.get(row.scenarioId);
    if (!before) {
      scenarios.push({
        scenarioId: row.scenarioId,
        verdict: 'new_scenario',
        baselineScore: null,
        currentScore: row.score,
        detail: `not in the baseline; scored ${row.score}/${PREFERENCE_AXES.length}`,
      });
      continue;
    }
    if (row.hardViolation && !before.hardViolation) {
      scenarios.push({
        scenarioId: row.scenarioId,
        verdict: 'hard_failure',
        baselineScore: before.score,
        currentScore: row.score,
        detail: `${row.hardDays} hard days exceeds the permitted maximum of ${row.permittedHardDayMax}`,
      });
      continue;
    }
    if (row.score < before.score) {
      scenarios.push({
        scenarioId: row.scenarioId,
        verdict: 'preference_regression',
        baselineScore: before.score,
        currentScore: row.score,
        detail: `lost ${before.preferencesMet.filter((axis) => !row.preferencesMet.includes(axis)).join(', ')}`,
      });
      continue;
    }
    if (row.score > before.score) {
      scenarios.push({
        scenarioId: row.scenarioId,
        verdict: 'preference_improvement',
        baselineScore: before.score,
        currentScore: row.score,
        detail: `gained ${row.preferencesMet.filter((axis) => !before.preferencesMet.includes(axis)).join(', ')}`,
      });
      continue;
    }
    scenarios.push({
      scenarioId: row.scenarioId,
      verdict: 'unchanged',
      baselineScore: before.score,
      currentScore: row.score,
      detail: '',
    });
  }

  // A SCENARIO THAT VANISHED IS NOT A PASS. Silently dropping the week that
  // failed is the cheapest way to make any set of preferences look satisfied.
  for (const row of baseline) {
    if (seen.has(row.scenarioId)) continue;
    scenarios.push({
      scenarioId: row.scenarioId,
      verdict: 'missing_scenario',
      baselineScore: row.score,
      currentScore: null,
      detail: 'in the baseline, absent from this run',
    });
  }

  const hardFailures = scenarios.filter((s) => s.verdict === 'hard_failure')
    .map((s) => s.scenarioId);
  const regressions = scenarios.filter((s) => s.verdict === 'preference_regression')
    .map((s) => s.scenarioId);
  const improvements = scenarios.filter((s) => s.verdict === 'preference_improvement')
    .map((s) => s.scenarioId);
  const missing = scenarios.filter((s) => s.verdict === 'missing_scenario')
    .map((s) => s.scenarioId);

  return {
    scenarios,
    hardFailures,
    regressions,
    improvements,
    overFitting: improvements.length > 0 && regressions.length > improvements.length,
    clean: hardFailures.length === 0 && regressions.length === 0 && missing.length === 0,
  };
}

/** The printable table — one line per scenario, baseline beside current. */
export function preferenceTable(
  comparison: PreferenceRunComparison,
  current: readonly WeekPreferenceRow[],
): string[] {
  const byId = new Map(current.map((row) => [row.scenarioId, row]));
  const lines = [
    'scenario | hard | anchor | moderate | pref<=| score | verdict',
  ];
  for (const entry of comparison.scenarios) {
    const row = byId.get(entry.scenarioId);
    lines.push([
      entry.scenarioId.padEnd(8),
      String(row?.hardDays ?? '-').padStart(4),
      String(row?.anchorHardDays ?? '-').padStart(6),
      String(row?.moderateDays ?? '-').padStart(8),
      String(row?.preferredHardDayMax ?? '-').padStart(5),
      `${entry.currentScore ?? '-'}/${PREFERENCE_AXES.length}`.padStart(5),
      `${entry.verdict}${entry.detail ? ` — ${entry.detail}` : ''}`,
    ].join(' | '));
  }
  return lines;
}
