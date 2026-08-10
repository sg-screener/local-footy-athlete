/**
 * THE 2KM LEAD, RUN RATHER THAN ARGUED — one variable, `twoKmTimeTrial`.
 *
 * THE FIRST VERSION OF THIS PROBE READ ZERO CONDITIONING IN BOTH ARMS while the
 * device screenshot showed "Strength + Conditioning" on the same Monday. A
 * measurement that reads the same in both arms cannot distinguish them, and a
 * count that names the instrument's unit instead of the domain's is not
 * evidence. The generator does not carry conditioning as a component row: it
 * rides the workout as `hasCombinedConditioning` / `conditioningBlock` /
 * `attachedConditioningKind`. Those are the fields the app's own day card reads.
 */
import { DEV_E2E_STANDARD_PROFILE } from './src/dev/e2e/devE2EStandardProfile';
import { generateProgramLocally } from './src/services/api/generateProgram';
import type { OnboardingData } from './src/types/domain';

function generate(profile: OnboardingData) {
  return generateProgramLocally(profile, {
    weekAcceptance: 'forward_decision', todayISO: '2026-07-13', blockNumber: 1,
    previousProgram: null, activeConstraints: [], readinessSignal: null,
    microcycleLimit: 4,
  } as never) as any;
}

const isStrength = (w: any) =>
  w.workoutType === 'Strength' || w.workoutType === 'Mixed'
  || (w.strengthPatternContributions?.length ?? 0) > 0;
const hasConditioning = (w: any) =>
  !!w.hasCombinedConditioning || !!w.conditioningBlock
  || !!w.attachedConditioningKind || !!w.conditioningFlavour;

function report(label: string, program: any) {
  const workouts = (program.microcycles ?? []).flatMap((m: any) => m.workouts ?? []);
  const cond = workouts.filter(hasConditioning);
  const both = workouts.filter((w: any) => hasConditioning(w) && isStrength(w));
  console.log(`\n=== ${label}`);
  console.log(`  workouts:                ${workouts.length}`);
  console.log(`  carrying conditioning:   ${cond.length}`);
  console.log(`  strength AND conditioning on one day: ${both.length}   <-- Sam's day shape`);
  console.log('  week 1:');
  for (const w of (program.microcycles?.[0]?.workouts ?? [])) {
    console.log(`    dow ${w.dayOfWeek}  ${String(w.workoutType).padEnd(14)} ${String(w.name).padEnd(34)}`
      + ` combined=${!!w.hasCombinedConditioning} kind=${w.attachedConditioningKind ?? '-'}`
      + ` flavour=${w.conditioningFlavour ?? '-'} role=${w.section18ConditioningRole ?? '-'}`);
  }
  return { workouts: workouts.length, cond: cond.length, both: both.length };
}

const withoutTime: OnboardingData = { ...DEV_E2E_STANDARD_PROFILE };
delete (withoutTime as { twoKmTimeTrial?: unknown }).twoKmTimeTrial;

const armA = report("WITH the 2km time (today's seed profile)", generate(DEV_E2E_STANDARD_PROFILE));
const armB = report('WITHOUT the 2km time (every seed before 2026-08-10)', generate(withoutTime));

console.log('\n=== VERDICT');
if (armA.cond === armB.cond && armA.both === armB.both) {
  console.log('  REFUTED — the 2km time changes NEITHER how much conditioning the week');
  console.log('  carries NOR whether it shares a day with strength. The impossible');
  console.log('  profile and the day-shape defect are SEPARATE threads.');
} else {
  console.log('  CONFIRMED — the profile without a 2km time generates a structurally');
  console.log(`  different week: conditioning ${armB.cond} vs ${armA.cond}, both-on-one-day ${armB.both} vs ${armA.both}.`);
}
