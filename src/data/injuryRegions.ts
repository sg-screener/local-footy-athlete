/**
 * Injury regions — THE single owner of the region vocabulary and of body-part
 * routing.
 *
 * GENERATED from docs/INJURY_MATRIX_RULINGS_2026-07-28.json by
 * scripts/build-injury-region-owner.js. Do not hand-edit: change the ruling file
 * and regenerate, so the sheet stays the source of truth.
 *
 * ── Why this file exists ──
 *
 * Five divergent copies of this mapping used to exist:
 *   utils/programAdjustmentEngine, utils/injuryAdjustmentEngine,
 *   utils/guidedInjuryControl, utils/exerciseFilter, utils/coachConstraintProducers
 *
 * They disagreed with each other and with Sam's ruling. `exerciseFilter` sent
 * "achilles" to the ankle while Sam ruled it to the calf; `guidedInjuryControl`
 * sent "rib" to the shoulder, which stopped being true the moment ribs became a
 * region; `injuryAdjustmentEngine` knew nothing about wrist, elbow or neck, so a
 * neck complaint could not reach the neck column at all. Five copies is precisely
 * why none of that was visible.
 *
 * Routing is SINGLE-TARGET by Sam's ruling (2026-07-28): one phrase resolves to
 * exactly one region. Duals (hip flexor -> hip+quad, achilles -> calf+ankle/foot,
 * upper back -> shoulder+neck) were considered and ruled out, so episode-identity
 * semantics — which compare regions for equality — stay simple. Revisit only if
 * athlete complaints expose a coverage gap.
 *
 * A region nobody can reach is a region that does not exist: `pubalgia` was
 * authored on 34 exercises and no free text ever resolved to it.
 */
import type { InjuryProfile } from './exerciseTags';

/** One of Sam's 13 authored injury regions. */
export type InjuryRegion = keyof InjuryProfile;

/** Every region, in Sam's authored order. */
export const INJURY_REGIONS: readonly InjuryRegion[] = [
  'groin',
  'hip',
  'quad',
  'hamstring',
  'knee',
  'calf',
  'ankle/foot',
  'ribs',
  'lowerBack',
  'neck',
  'shoulder',
  'elbow',
  'wrist/hand',
];

/**
 * Free-text body part -> region. Sam's ruled routes, plus the phrase coverage
 * inherited from the five retired copies.
 */
const BODY_PART_TO_REGION: Readonly<Record<string, InjuryRegion>> = {
  // -> groin
  adductor: 'groin',
  adductors: 'groin',
  groin: 'groin',
  'osteitis pubis': 'groin',
  pubalgia: 'groin',
  'sports hernia': 'groin',

  // -> hip
  glute: 'hip',
  glutes: 'hip',
  hip: 'hip',
  'hip flexor': 'hip',
  hips: 'hip',

  // -> quad
  quad: 'quad',
  quadricep: 'quad',
  quadriceps: 'quad',
  quads: 'quad',

  // -> hamstring
  hamie: 'hamstring',
  hammie: 'hamstring',
  hammies: 'hamstring',
  hammstring: 'hamstring',
  hammy: 'hamstring',
  hamstring: 'hamstring',
  hamstrings: 'hamstring',
  hamstrng: 'hamstring',
  hamy: 'hamstring',

  // -> knee
  knee: 'knee',
  knees: 'knee',

  // -> calf
  achilles: 'calf',
  calf: 'calf',
  calves: 'calf',
  shin: 'calf',
  shins: 'calf',

  // -> ankle/foot
  ankle: 'ankle/foot',
  ankles: 'ankle/foot',
  feet: 'ankle/foot',
  foot: 'ankle/foot',

  // -> ribs
  rib: 'ribs',
  ribs: 'ribs',

  // -> lowerBack
  back: 'lowerBack',
  'lower back': 'lowerBack',
  'lower-back': 'lowerBack',
  'lower_back': 'lowerBack',
  lowerback: 'lowerBack',

  // -> neck
  neck: 'neck',

  // -> shoulder
  chest: 'shoulder',
  pec: 'shoulder',
  pecs: 'shoulder',
  shoulder: 'shoulder',
  shoulders: 'shoulder',
  'upper back': 'shoulder',

  // -> elbow
  bicep: 'elbow',
  biceps: 'elbow',
  elbow: 'elbow',
  elbows: 'elbow',
  forearm: 'elbow',
  forearms: 'elbow',
  tricep: 'elbow',
  triceps: 'elbow',

  // -> wrist/hand
  fingers: 'wrist/hand',
  hand: 'wrist/hand',
  hands: 'wrist/hand',
  thumb: 'wrist/hand',
  wrist: 'wrist/hand',
  wrists: 'wrist/hand',
};

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolve a free-text body part to a region, or null when nothing matches.
 *
 * Returning null is deliberate and load-bearing: an unroutable complaint must be
 * visible as unrouted rather than quietly assigned somewhere plausible.
 */
export function resolveInjuryRegion(bodyPart: string): InjuryRegion | null {
  const key = normalise(bodyPart);
  const direct = BODY_PART_TO_REGION[key];
  if (direct) return direct;
  const collapsed = key.replace(/[\s-]+/g, '');
  for (const [phrase, region] of Object.entries(BODY_PART_TO_REGION)) {
    if (phrase.replace(/[\s-]+/g, '') === collapsed) return region;
  }
  return null;
}

/** Every phrase that routes somewhere — for gates and diagnostics. */
export function routableBodyParts(): readonly string[] {
  return Object.keys(BODY_PART_TO_REGION);
}
