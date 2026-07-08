/**
 * injurySeverityBands.ts — the Programming Bible's canonical injury
 * severity bands (Section 8 / Section 17.G).
 *
 * Phase 1 rules kernel (READ-ONLY / NOT YET WIRED).
 *
 * ⚠ These bands are DEFINED here but deliberately NOT consumed by the
 * live injury engine yet. The live engine (exposureEngine.severityToTier,
 * injuryAdjustmentEngine) currently breaks at 4/7 with action thresholds
 * at 5/7/8. Migrating live behaviour onto these bands is the
 * injury/fatigue alignment phase (Phase 5) and needs its own plan —
 * approved decision 2026-07-08: Bible bands win long-term, no behaviour
 * change in Phase 1.
 *
 * Bible bands:
 *   1-3 /10  keep most training, avoid the exact trigger only
 *   4-5 /10  reduce affected work (load/volume/range/speed)
 *   6-7 /10  remove risky work + recommend physio/medical advice
 *   8-10/10  pause affected training (hard stop for that area)
 */

export type BibleInjurySeverityBand =
  | 'avoid_trigger_1_3'
  | 'reduce_affected_4_5'
  | 'restrict_and_refer_6_7'
  | 'pause_affected_8_10';

export interface BibleInjurySeverityBandInfo {
  band: BibleInjurySeverityBand;
  min: number;
  max: number;
  label: string;
  /** What the program response should be once behaviour migrates (Phase 5). */
  programResponse: string;
  recommendPhysio: boolean;
  pauseAffectedTraining: boolean;
}

export const BIBLE_INJURY_SEVERITY_BANDS: readonly BibleInjurySeverityBandInfo[] = [
  {
    band: 'avoid_trigger_1_3', min: 1, max: 3,
    label: 'Mild (1-3/10)',
    programResponse: 'Keep most training; avoid only the exact movement/trigger that flares it.',
    recommendPhysio: false,
    pauseAffectedTraining: false,
  },
  {
    band: 'reduce_affected_4_5', min: 4, max: 5,
    label: 'Moderate (4-5/10)',
    programResponse: 'Reduce load/volume/range/speed of affected work; swap obvious aggravators; keep safe work in.',
    recommendPhysio: false,
    pauseAffectedTraining: false,
  },
  {
    band: 'restrict_and_refer_6_7', min: 6, max: 7,
    label: 'Limiting (6-7/10)',
    programResponse: 'Remove risky work through the area; keep unaffected work; recommend physio/medical advice.',
    recommendPhysio: true,
    pauseAffectedTraining: false,
  },
  {
    band: 'pause_affected_8_10', min: 8, max: 10,
    label: 'Severe (8-10/10)',
    programResponse: 'Pause affected training entirely; rest/recovery or clearly unaffected work only; recommend physio/medical advice.',
    recommendPhysio: true,
    pauseAffectedTraining: true,
  },
] as const;

/** Classify a 1-10 severity into the Bible band. Values are clamped to 1-10. */
export function classifyBibleInjurySeverity(severity: number): BibleInjurySeverityBandInfo {
  const s = Math.min(10, Math.max(1, Math.round(severity)));
  const info = BIBLE_INJURY_SEVERITY_BANDS.find((b) => s >= b.min && s <= b.max);
  // Bands cover 1-10 exhaustively; fallback keeps TS happy.
  return info ?? BIBLE_INJURY_SEVERITY_BANDS[BIBLE_INJURY_SEVERITY_BANDS.length - 1];
}
