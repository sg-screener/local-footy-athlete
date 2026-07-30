import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import type { InjuryBucket } from './injuryAdjustmentEngine';
import { resolveInjuryRegion } from '../data/injuryRegions';
import {
  classifyBibleInjurySeverity,
  injurySeverityPausesAffectedTraining,
  injurySeverityRecommendsPhysio,
} from '../rules/injurySeverityBands';
import { todayISOLocal } from './appDate';

export type GuidedInjuryRegion = 'upper_body' | 'lower_body' | 'back_midline' | 'other';
export type GuidedInjurySeverityBand = 'mild' | 'slight' | 'moderate' | 'avoid';
export type GuidedInjuryAdjustmentLevel =
  | 'minimal'
  | 'slight'
  | 'moderate'
  | 'avoid_affected'
  | 'training_paused';

export interface GuidedInjuryFlowResult {
  region: GuidedInjuryRegion;
  area: string;
  severity: number;
  severityBand: GuidedInjurySeverityBand;
  adjustmentLevel: GuidedInjuryAdjustmentLevel;
  triggers: string[];
  seriousSymptoms: boolean;
  seriousSymptom?: string;
}

export const GUIDED_INJURY_REGION_OPTIONS: Array<{ id: GuidedInjuryRegion; label: string }> = [
  { id: 'upper_body', label: 'Upper body' },
  { id: 'lower_body', label: 'Lower body' },
  { id: 'back_midline', label: 'Back / midline' },
  { id: 'other', label: 'Other' },
];

/**
 * EVERY ROW RESOLVES TO A BUCKET (Sam's ruling, 2026-07-30, option 1).
 *
 * "Other upper body" and "Other lower body" are GONE. They matched no pattern in
 * `guidedInjuryBucketForArea`, so tapping either produced a stored injury with a null
 * bucket — one that changed the week's DOSE through its severity and filtered no
 * movement at all. An athlete could reach that state without typing a word, through a
 * ruled menu, which is why this is a totality rule and not a free-text rule.
 *
 * "Other midline" STAYS because it resolves (`/midline/` → lowerBack). Sam named the
 * upper and lower rows specifically, and a row that works is not a row to delete.
 *
 * AND EVERY ROW IS NOW ONE AUTHORED REGION, which is what wiring the door to Sam's matrix
 * (his ruling, 2026-07-30) actually required:
 *
 *   "Hip / groin"   SPLIT into Hip and Groin — they are two of his 13 regions, and one
 *                   row could not say which the athlete meant.
 *   "Chest / ribs"  SPLIT into Chest and Ribs. Ribs became its own region on 2026-07-28,
 *                   and this row is the exact thing the matrix owner's header calls out:
 *                   "`guidedInjuryControl` sent 'rib' to the shoulder, which stopped being
 *                   true the moment ribs became a region."
 *   "Abs / side"    GONE — no authored region routes it. "Other midline" likewise.
 *   "Quad"          unchanged as a label, but it now reaches the QUAD column instead of
 *                   being proxied to knee.
 *
 * The rows that keep a slash — "Wrist / hand", "Calf / Achilles", "Ankle / foot" — are the
 * ones where BOTH words route to the SAME region, so the label lists two body parts and
 * still asks one question. Sam's routing is single-target and these rows respect it.
 *
 * COPY: the two splits and the two removals are athlete-facing changes. PROPOSED, NOT
 * SIGNED — they go to Sam with the copy batch.
 *
 * The athlete whose area is genuinely none of these picks the CLOSEST one — the sheet says
 * so in Sam's own words — or asks the coach. `guidedInjuryMenuTotality` below is the gate,
 * and it holds in both directions.
 */
export const GUIDED_INJURY_AREA_OPTIONS: Record<Exclude<GuidedInjuryRegion, 'other'>, string[]> = {
  upper_body: ['Neck', 'Shoulder', 'Chest', 'Ribs', 'Elbow', 'Wrist / hand'],
  lower_body: ['Hip', 'Groin', 'Hamstring', 'Quad', 'Knee', 'Calf / Achilles', 'Ankle / foot'],
  back_midline: ['Lower back', 'Upper back', 'Neck'],
};

/**
 * The refusal, at the point of answering (Sam's ruling, option 3).
 *
 * SAM-AUTHORED, quoted from the ruling. A free-text area the app cannot program around
 * is refused HERE rather than stored and pretended about: a stored answer that filters
 * nothing was the worst of the three outcomes on the table, and it is the one the app
 * used to produce.
 */
export const GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL =
  "I can't program around that one — pick the closest area or ask the coach";

/** Sam's instruction on the area step, quoted from the same ruling. */
export const GUIDED_INJURY_AREA_HINT = 'Pick the closest area';

/**
 * Can the app actually program around this answer?
 *
 * The single predicate both the sheet and the constraint builder ask, so the door and
 * the writer cannot disagree about what is answerable.
 */
export function guidedInjuryAreaIsProgrammable(area: string): boolean {
  return guidedInjuryBucketForArea(area) !== null;
}

/**
 * THE TOTALITY GATE'S SUBJECT, exported so the assertion reads the real menu.
 *
 * Both directions, because one alone is satisfiable by the wrong menu:
 *   forward  every offered row resolves to a bucket — no row can store nothing
 *   reverse  every bucket the exercise tags can filter on is REACHABLE from some row —
 *            a bucket no row reaches is a filter the athlete can never trigger
 */
export function guidedInjuryMenuTotality(): {
  rows: string[]; unresolved: string[]; reachableBuckets: InjuryBucket[];
} {
  const rows = Object.values(GUIDED_INJURY_AREA_OPTIONS).flat();
  const unresolved = rows.filter((row) => !guidedInjuryAreaIsProgrammable(row));
  const reachableBuckets = Array.from(new Set(
    rows.map((row) => guidedInjuryBucketForArea(row)).filter((b): b is InjuryBucket => !!b),
  ));
  return { rows, unresolved, reachableBuckets };
}

export const GUIDED_INJURY_TRIGGER_OPTIONS = [
  'Sprinting',
  'Change of direction',
  'Kicking',
  'Running',
  'Jumping / landing',
  'Heavy lifting',
  'Squatting / lunging',
  'Hinging / bending',
  'Pressing',
  'Pulling',
  'Contact / games',
  'Always there',
  'Other',
] as const;

export const GUIDED_INJURY_SEVERITY_OPTIONS: Array<{
  label: string;
  sub: string;
  severity: number;
  severityBand: GuidedInjurySeverityBand;
  adjustmentLevel: GuidedInjuryAdjustmentLevel;
}> = [
  {
    label: '1-3 / 10',
    sub: 'Mild - I can train through it',
    severity: 2,
    severityBand: 'mild',
    adjustmentLevel: 'minimal',
  },
  {
    label: '4-5 / 10',
    sub: 'Annoying - needs a slight adjustment',
    severity: 5,
    severityBand: 'slight',
    adjustmentLevel: 'slight',
  },
  {
    label: '6-7 / 10',
    sub: 'Limiting - needs a moderate adjustment',
    severity: 7,
    severityBand: 'moderate',
    adjustmentLevel: 'moderate',
  },
  {
    label: '8-10 / 10',
    sub: 'Bad - avoid affected work',
    severity: 9,
    severityBand: 'avoid',
    adjustmentLevel: 'training_paused',
  },
];

function normaliseKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

/**
 * WIRED TO SAM'S AUTHORED MATRIX (his ruling, 2026-07-30 — "wire the guided door to
 * Sam's authored neck matrix column").
 *
 * `data/injuryRegions.ts` is THE single owner of body-part routing: 13 regions,
 * GENERATED from `docs/INJURY_MATRIX_RULINGS_2026-07-28.json`, single-target by his
 * 2026-07-28 ruling. Its own header names five divergent copies it replaced — and
 * `utils/guidedInjuryControl` is on that list. **The owner landed; this door never got
 * wired to it.** So the eleven patterns below were not one of three accidental maps: they
 * were a copy that survived its own consolidation.
 *
 * WHAT THAT COST, in the owner's own words: "`guidedInjuryControl` sent 'rib' to the
 * shoulder, which stopped being true the moment ribs became a region" — and a neck
 * complaint could not reach the neck column at all. `guidedInjuryMenuTotalityTests` found
 * the neck half from the other side, as an authored filter no answer could trigger.
 *
 * `InjuryRegion` and `InjuryBucket` are the same thirteen keys (`keyof InjuryProfile`),
 * so this is a delegation and not a translation — which is the point. A translation is
 * what the copies were.
 */
export function guidedInjuryBucketForArea(area: string): InjuryBucket | null {
  const direct = resolveInjuryRegion(area);
  if (direct) return direct as InjuryBucket;
  // A LABEL MAY LIST TWO WORDS FOR ONE REGION ("Wrist / hand"). Splitting and asking the
  // owner about each part is parsing the label, not translating it — and it is safe
  // precisely because no remaining row straddles two regions, so the first part that
  // routes is the only region the label can mean. It also catches free text typed the
  // same way ("calf/achilles").
  for (const part of area.split('/')) {
    const routed = resolveInjuryRegion(part);
    if (routed) return routed as InjuryBucket;
  }
  return null;
}

function guidedSeverityBandForSeverity(severity: number): GuidedInjurySeverityBand {
  switch (classifyBibleInjurySeverity(severity).band) {
    case 'avoid_trigger_1_3':
      return 'mild';
    case 'reduce_affected_4_5':
      return 'slight';
    case 'restrict_and_refer_6_7':
      return 'moderate';
    case 'pause_affected_8_10':
      return 'avoid';
  }
}

function guidedAdjustmentForSeverity(severity: number): GuidedInjuryAdjustmentLevel {
  switch (classifyBibleInjurySeverity(severity).band) {
    case 'avoid_trigger_1_3':
      return 'minimal';
    case 'reduce_affected_4_5':
      return 'slight';
    case 'restrict_and_refer_6_7':
      return 'moderate';
    case 'pause_affected_8_10':
      return 'training_paused';
  }
}

function displayArea(area: string): string {
  return area.trim().replace(/\s*\/\s*/g, ' / ').toLowerCase();
}

function severityDescriptor(result: GuidedInjuryFlowResult): string {
  if (result.adjustmentLevel === 'training_paused') return '8-10 / 10';
  if (result.severityBand === 'mild') return 'mild';
  if (result.severityBand === 'slight') return 'annoying';
  if (result.severityBand === 'moderate') return 'moderate';
  return 'high-limitation';
}

function triggerClause(triggers: readonly string[]): string {
  const clean = triggers.map((trigger) => trigger.toLowerCase()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return ` triggered by ${clean[0]}`;
  return ` triggered by ${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

function rulesFor(result: GuidedInjuryFlowResult): string[] {
  if (result.adjustmentLevel === 'training_paused' || result.seriousSymptoms) {
    return ['affected training until reviewed', 'hard work around the affected area'];
  }
  const rules = result.triggers.length > 0
    ? result.triggers.map((trigger) => trigger.toLowerCase())
    : [`training that aggravates ${displayArea(result.area)}`];
  if (result.severityBand === 'mild') {
    return rules.map((rule) => `monitor ${rule}`);
  }
  if (result.severityBand === 'slight') {
    return rules.map((rule) => `reduce ${rule}`);
  }
  if (result.severityBand === 'moderate') {
    return rules.map((rule) => `limit ${rule}`);
  }
  return rules.map((rule) => `avoid ${rule}`);
}

function safeFocusFor(region: GuidedInjuryRegion, serious: boolean): string[] {
  if (serious) return ['Stop affected training', 'Seek medical or physio advice'];
  if (region === 'upper_body') return ['Lower body training where suitable', 'Easy conditioning', 'Unaffected midline work'];
  if (region === 'lower_body') return ['Upper body training where suitable', 'Low-impact conditioning', 'Unaffected midline work'];
  if (region === 'back_midline') return ['Supported upper body work', 'Easy conditioning', 'Unaffected low-risk work'];
  return ['Unaffected training only', 'Recovery work'];
}

function modifierBody(result: GuidedInjuryFlowResult): string {
  if (result.adjustmentLevel === 'training_paused' || result.seriousSymptoms) {
    return "You rated this as 8-10 / 10, so affected training is paused until you're ready or cleared to train.";
  }
  const area = displayArea(result.area);
  return `Your program is being adjusted around a ${severityDescriptor(result)} ${area} issue${triggerClause(result.triggers)}.`;
}

export function buildGuidedInjuryConstraint(
  result: GuidedInjuryFlowResult,
  opts: { todayISO: string; existingId?: string } = { todayISO: todayISOLocal() },
): ActiveInjuryConstraint {
  const now = new Date().toISOString();
  const bucket = guidedInjuryBucketForArea(result.area);
  // UNREPRESENTABLE, not merely refused upstream (Sam's ruling, 2026-07-30).
  //
  // The sheet refuses an unprogrammable area at the point of answering, and this is the
  // second half of the same boundary: a null bucket cannot become a stored constraint
  // through this builder at all. Without it, the refusal would be a UI convention that
  // the next caller of this function could quietly bypass — and the state it produced
  // (stored, dose-changing, filtering nothing) is the one Sam called the worst outcome.
  if (!bucket) {
    throw new Error(
      `Guided injury area "${result.area}" resolves to no injury bucket, so no exercise `
      + 'filter could act on it. The area step must refuse it instead: see '
      + 'GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL.',
    );
  }
  const key = bucket;
  const bandFromSeverity = guidedSeverityBandForSeverity(result.severity);
  const adjustmentFromSeverity = guidedAdjustmentForSeverity(result.severity);
  const trainingPaused = injurySeverityPausesAffectedTraining(result.severity) || result.seriousSymptoms;
  const effectiveResult: GuidedInjuryFlowResult = {
    ...result,
    severityBand: trainingPaused ? 'avoid' : bandFromSeverity,
    adjustmentLevel: trainingPaused ? 'training_paused' : adjustmentFromSeverity,
  };
  return {
    id: opts.existingId ?? `injury-${key}`,
    type: 'injury',
    bodyPart: displayArea(result.area),
    bucket,
    severity: trainingPaused ? Math.max(8, result.severity) : result.severity,
    status: 'active',
    startDate: opts.todayISO,
    lastUpdatedAt: now,
    source: 'guided_injury_flow',
    region: result.region,
    severityBand: effectiveResult.severityBand,
    adjustmentLevel: effectiveResult.adjustmentLevel,
    triggers: [...result.triggers],
    seriousSymptoms: result.seriousSymptoms,
    seriousSymptom: result.seriousSymptom,
    modifierTitle: trainingPaused ? 'Training paused for injury' : undefined,
    modifierBody: modifierBody(effectiveResult),
    modifierAffects: ['current_week', 'future_generation'],
    rules: rulesFor(effectiveResult),
    safeFocus: safeFocusFor(result.region, trainingPaused),
    advice: trainingPaused
      ? ['Stop affected training and get proper medical or physio advice.']
      : injurySeverityRecommendsPhysio(result.severity)
        ? ['Get medical or physio advice if this is not already being managed.']
        : [],
  };
}

export function guidedInjuryResultFromConstraint(
  constraint: ActiveInjuryConstraint | null | undefined,
): Partial<GuidedInjuryFlowResult> | undefined {
  if (!constraint) return undefined;
  return {
    region: constraint.region,
    area: constraint.bodyPart,
    severity: constraint.severity,
    severityBand: constraint.severityBand,
    adjustmentLevel: constraint.adjustmentLevel,
    triggers: constraint.triggers ?? [],
    seriousSymptoms: constraint.seriousSymptoms ?? false,
    seriousSymptom: constraint.seriousSymptom,
  };
}
