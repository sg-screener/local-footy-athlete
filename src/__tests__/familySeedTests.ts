/**
 * R-360 — A NEW LIFT BORROWS ITS FIRST WEIGHT FROM A LOGGED LIFT IN ITS
 * FAMILY, WITH A CAP.
 *
 * Sam, 2026-09-03: "yes with a cap". Every loaded lift already hangs off one
 * of two anchors (squat, bench) with a fixed ratio, so a logged sibling
 * implies the anchor and the anchor implies the new lift. The borrowed
 * weight is capped at FAMILY_SEED_CAP_MULTIPLIER × the onboarding estimate,
 * because a small-ratio sibling (a dumbbell press) amplifies into a very
 * large barbell number — measured on the cohort's beginner: DB bench 35
 * implied a 93.5 kg bench press when he actually reached 75.
 *
 * Run: npm run test:family-seed
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { ARCHETYPES, athleteAnswers } from './compilerYear/catalog';
import {
  familySeedFromRecord, FAMILY_SEED_CAP_MULTIPLIER, estimateStartingWeight, startingWeightForAthlete,
} from '../utils/loadEstimation';
import { resolveComposedLoad } from '../rules/composedDose';
import { decideBlockBoundaryLoads, readBlockHistory } from '../rules/blockBoundaryProgression';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const beginner = { ...(athleteAnswers((ARCHETYPES as unknown as { id: string }[])
  .find((entry) => entry.id === 'male-2-novice-home') as never) as object), experienceLevel: '2-5 years' } as never;

(async () => {
  // ── the borrow, at the unit ──
  {
    const fromBox = familySeedFromRecord('Back Squat', beginner, { 'High Box Squat': 67.5 });
    check('R-360: Back Squat borrows from a logged High Box Squat 67.5 -> 50 kg (67.5 / 1.08 × 0.8)', fromBox === 50, String(fromBox));
    const estimate = estimateStartingWeight('Bench Press', beginner)!;
    const fromDb = familySeedFromRecord('Bench Press', beginner, { 'DB Bench Press': 35 });
    check('R-360: Bench Press from a logged DB Bench 35 is CAPPED at the multiplier × the estimate',
      fromDb !== null && fromDb <= estimate * FAMILY_SEED_CAP_MULTIPLIER && fromDb > estimate,
      `${fromDb} vs estimate ${estimate}, cap ${estimate * FAMILY_SEED_CAP_MULTIPLIER}`);
    check('CONTROL: no logged sibling -> no borrow', familySeedFromRecord('Back Squat', beginner, { 'Bench Press': 60 }) === null);
    check('CONTROL: the lift\'s own record is not a borrow (the record itself outranks everything upstream)',
      familySeedFromRecord('Back Squat', beginner, { 'Back Squat': 80 }) === null);
    const weakSibling = familySeedFromRecord('Back Squat', beginner, { 'Goblet Squat': 8 });
    const plainEstimate = startingWeightForAthlete('Back Squat', beginner)!;
    check('R-360: a weak sibling borrows DOWN as honestly as a strong one borrows up',
      weakSibling !== null && weakSibling < plainEstimate, `${weakSibling} vs ${plainEstimate}`);
  }

  // ── the composer's base load: record, then family, then estimate ──
  {
    const kit = ['barbell', 'dumbbells', 'squat_rack', 'bench', 'rack', 'pullup_bar'];
    const common = {
      identity: 'Back Squat', isMainLift: true, poolSlot: 'squat' as never,
      seasonPhase: 'In-season' as const, offseasonSubphase: null, profile: beginner, kit,
    };
    const fresh = resolveComposedLoad(common);
    const borrowed = resolveComposedLoad({ ...common, recordedLoads: { 'High Box Squat': 67.5 } } as never);
    check('R-360: the composed Back Squat borrows 50 from the box squat record', borrowed === 50, `${borrowed} (fresh ${fresh})`);
    const own = resolveComposedLoad({ ...common, recordedLoads: { 'High Box Squat': 67.5, 'Back Squat': 80 } } as never);
    check('CONTROL: the lift\'s own record still wins over the family', own === 80, String(own));
  }

  // ── the block boundary: a lift with no record of its own seeds from its family ──
  {
    const history = readBlockHistory({
      feedbackByDate: {
        '2027-01-04': { dateStr: '2027-01-04', completion: 'full', strength: [
          { exerciseName: 'High Box Squat', weightKg: 67.5, prescribedSets: 3, prescribedRepsMax: 5, actualReps: 5, completion: 'full' },
        ] } as never,
      },
      blockStartISO: '2027-01-04', blockEndISO: '2027-01-31', requiredStrengthSessions: 0,
    });
    const row = {
      id: 'r1', exerciseId: 'r1', workoutId: 'w', exerciseOrder: 1, prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 5,
      prescribedWeightKg: 0, exercise: { name: 'Back Squat' }, section18Evidence: { role: 'main_strength', slot: 'squat' },
    };
    const workout = { id: 'w', workoutType: 'Strength', exercises: [row] } as never;
    const decisions = decideBlockBoundaryLoads({ history, nextBlockWorkouts: [workout], onboardingData: beginner });
    const back = decisions.find((decision) => decision.exerciseName === 'Back Squat');
    check('R-360: at the block boundary a first Back Squat seeds 50 from the box squat record, not the 47.5 estimate',
      back?.nextLoadKg === 50, JSON.stringify(back));
  }

  console.log(`\nFamily seed: ${passed} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  process.exit(1);
});
