/**
 * LR-27 — the injury body-part routing CONVERGENCE GATE.
 *
 * `data/injuryRegions.ts` is THE owner of body-part routing (generated from
 * Sam's ruling sheet), and its own header records why it exists: five
 * divergent copies of this mapping, and "five copies is precisely why none of
 * that was visible."
 *
 * HISTORY. This gate landed 2026-08-01 as a DIVERGENCE gate: three surviving
 * copies plus the sessionBuilder tag map, each source-pinned, with their
 * divergence sets against the owner equality-pinned (11/11/11/3) — the
 * differential had proved no copy was reproducible from the owner by
 * composition, so every row was ROUTING POLICY belonging to Sam. Sam ruled
 * the whole table on 2026-08-02 (docs/PARKED_QUESTIONS_2026-08-01.md §5):
 * **the owner's sheet wins every row** — glute→hip, hip→hip, neck→neck,
 * quad→quad, upper back→shoulder, achilles→calf (single-target), shin ADDED
 * →calf, quadricep singular corrected to quad. All four doors converged on
 * 2026-08-03 and every divergence pin dropped to zero in the commit that
 * converged its door.
 *
 * WHAT THE GATE IS NOW — three directions, all behavioural:
 *
 *   direction 1 — the retired copies stay GONE: a body-part literal regrowing
 *     in a converged file is a red, not a drift;
 *   direction 2 — every door is asked its whole vocabulary and must answer
 *     exactly what the owner answers (divergence pinned at ZERO forever),
 *     plus refuse what the owner refuses;
 *   direction 3 — the owner's own routable set is pinned, so the generated
 *     file regenerating differently is a visible event.
 *
 * Behavioural on purpose: a gate that parses source is coupled to the code's
 * SHAPE, and refactoring changes shape by definition (AGENTS.md, the
 * de-duplication law). These doors are asked through their exported surfaces.
 *
 * Run: npm run test:injury-routing-divergence
 */

process.env.TZ = 'Australia/Melbourne';

import * as fs from 'fs';
import * as path from 'path';
import {
  resolveInjuryRegion,
  routableBodyParts,
  type InjuryRegion,
} from '../data/injuryRegions';
import { resolveInjuryBucket } from '../utils/programAdjustmentEngine';
import { extractInjuryContext } from '../utils/injuryAdjustmentEngine';
import { BODY_PARTS } from '../utils/injuryClarificationGuard';
import { buildSorenessConstraintFromIntent } from '../utils/coachConstraintProducers';
import { injuryTagsForBodyArea } from '../utils/sessionBuilder';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

const SRC = path.join(__dirname, '..');

function read(file: string): string {
  return fs.readFileSync(path.join(SRC, file), 'utf8');
}

/**
 * The rename the tag door is allowed: region -> the pool filter's InjuryTag
 * word. This is the TEST'S OWN copy of the expectation, kept independent of
 * sessionBuilder's, so the door's rename cannot drift and approve itself.
 * Total over InjuryRegion — a new region must be named here deliberately.
 */
const REGION_TO_TAG: Readonly<Record<InjuryRegion, string>> = {
  groin: 'groin', hip: 'hip', quad: 'quad', hamstring: 'hamstring', knee: 'knee',
  calf: 'calf', 'ankle/foot': 'ankle', ribs: 'ribs', lowerBack: 'lower_back',
  neck: 'neck', shoulder: 'shoulder', elbow: 'elbow', 'wrist/hand': 'wrist',
};

interface DoorDivergence {
  phrase: string;
  door: string;
  copyAnswer: string;
  ownerRegion: string;
}

const UNROUTABLE_SAMPLES = ['torso', 'spleen', 'left everything', ''] as const;

/** coachConstraintProducers' door, asked through its exported producer. */
function sorenessBucketFor(phrase: string): string | null {
  const constraint = buildSorenessConstraintFromIntent(
    { payload: { bodyPart: phrase, severity: 5 } } as never,
    '2026-08-03T09:00:00.000Z',
  );
  return constraint?.bucket ?? null;
}

/** sessionBuilder's tag door: single-target ruling, renamed per the table. */
function sessionBuilderTagFor(phrase: string): string | null {
  const tags = injuryTagsForBodyArea(phrase);
  if (tags.length === 0) return null;
  // The single-target ruling (Sam 2026-07-28, reaffirmed 2026-08-02 on
  // achilles and shin): one phrase, ONE tag. Two tags is a divergence however
  // they are spelled.
  if (tags.length > 1) return [...tags].sort().join('+');
  const region = resolveInjuryRegion(phrase);
  if (region !== null && tags[0] === REGION_TO_TAG[region]) return region;
  return tags[0];
}

/**
 * A CONVERGED door: its copy is deleted and its resolver delegates to the
 * owner. Divergence is computed BEHAVIOURALLY (ask the door every routable
 * phrase and a sample of unroutable ones) so the pin holds at zero by
 * measurement, not by construction.
 */
function convergedDoorDivergences(
  door: string,
  resolve: (phrase: string) => string | null,
): DoorDivergence[] {
  const out: DoorDivergence[] = [];
  for (const phrase of routableBodyParts()) {
    const answer = resolve(phrase);
    const region = resolveInjuryRegion(phrase);
    if (answer !== region) {
      out.push({ phrase, door, copyAnswer: String(answer), ownerRegion: String(region) });
    }
  }
  for (const phrase of UNROUTABLE_SAMPLES) {
    if (resolve(phrase) !== null) {
      out.push({ phrase, door, copyAnswer: String(resolve(phrase)), ownerRegion: 'UNROUTABLE' });
    }
  }
  return out.sort((a, b) => a.phrase.localeCompare(b.phrase));
}

/**
 * injuryAdjustmentEngine's door, measured END TO END: its extraction
 * vocabulary is BODY_PARTS, and every extracted token's bucket must be the
 * owner's answer. This asks the real message path, not a map.
 */
function injuryAdjustmentEngineDivergences(): DoorDivergence[] {
  const out: DoorDivergence[] = [];
  // "is sore", not "hurts": "chest hurts" trips the RED-FLAG guard (a cardiac
  // symptom is refused upstream of routing, by design) and would read as a
  // false divergence. The probe measures routing, not the medical guard.
  for (const part of BODY_PARTS) {
    const context = extractInjuryContext(`my ${part} is sore 6/10`);
    const answer = context?.bucket ?? null;
    const region = resolveInjuryRegion(part);
    if (answer !== region) {
      out.push({
        phrase: part, door: 'injuryAdjustmentEngine',
        copyAnswer: String(answer), ownerRegion: String(region),
      });
    }
  }
  const refused = extractInjuryContext('my torso is sore 6/10');
  if ((refused?.bucket ?? null) !== null) {
    out.push({
      phrase: 'torso', door: 'injuryAdjustmentEngine',
      copyAnswer: String(refused?.bucket), ownerRegion: 'UNROUTABLE',
    });
  }
  return out.sort((a, b) => a.phrase.localeCompare(b.phrase));
}

// ── Direction 1: the retired copies stay gone. ──
run('the converged doors hold no body-part copy of their own', () => {
  const retired: Array<[string, RegExp]> = [
    ['utils/programAdjustmentEngine.ts', /BODY_PART_TO_BUCKET\s*[:=]/],
    ['utils/injuryAdjustmentEngine.ts', /BODY_PART_TO_BUCKET\s*[:=]/],
    ['utils/coachConstraintProducers.ts', /BODY_PART_TO_BUCKET\s*[:=]/],
    ['utils/sessionBuilder.ts', /INJURY_BODY_AREA_MAP\s*[:=]/],
  ];
  for (const [file, literal] of retired) {
    assert(!literal.test(read(file)),
      `${file} holds a body-part literal again — the copy was retired `
      + 'onto data/injuryRegions.ts (LR-27, Sam 2026-08-02) and must not regrow');
  }
});

// ── Direction 3: the owner's routable set, pinned. ──
run('the owner routes exactly the ruled phrase set', () => {
  // 61 -> 63 on 2026-08-03: Sam's LR-27 ruling (2026-08-02, parked §5) added
  // shin/shins -> calf to the sheet and the owner regenerated.
  assert(routableBodyParts().length === 63,
    `the owner routes ${routableBodyParts().length} phrases, pin says 63 — the `
    + 'generated file changed; re-pin deliberately with the ruling that changed it');
});

// ── Direction 2: every door equal to the owner, pinned at zero forever. ──
// Founding measurement 2026-08-01: 11/11/11/3. Sam ruled every row on
// 2026-08-02 (the owner's sheet wins), the doors converged 2026-08-03, and
// each door's pin dropped to zero in the commit that converged it. Zero is
// where these pins END: a divergence reappearing anywhere is a defect, never
// new debt to declare.
const DIVERGENCE_PINS: Readonly<Record<string, number>> = {
  programAdjustmentEngine: 0,
  injuryAdjustmentEngine: 0,
  coachConstraintProducers: 0,
  sessionBuilderTags: 0,
};

const allDivergences = [
  ...convergedDoorDivergences('programAdjustmentEngine', resolveInjuryBucket),
  ...injuryAdjustmentEngineDivergences(),
  ...convergedDoorDivergences('coachConstraintProducers', sorenessBucketFor),
  ...convergedDoorDivergences('sessionBuilderTags', sessionBuilderTagFor),
];

for (const [door, pinnedCount] of Object.entries(DIVERGENCE_PINS)) {
  run(`${door} diverges from the owner in exactly ${pinnedCount} phrases`, () => {
    const divergences = allDivergences.filter((entry) => entry.door === door);
    assert(divergences.length === pinnedCount,
      `${door}: ${divergences.length} divergences vs pinned ${pinnedCount} —\n`
      + divergences.map((entry) =>
        `      ${entry.phrase}: door says "${entry.copyAnswer}", owner region "${entry.ownerRegion}"`,
      ).join('\n')
      + '\n      The owner is the only vocabulary (LR-27, Sam 2026-08-02): fix the door '
      + 'or, for a genuinely new route, amend the ruling sheet and regenerate.');
  });
}

console.log(`\nInjury routing divergence totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
