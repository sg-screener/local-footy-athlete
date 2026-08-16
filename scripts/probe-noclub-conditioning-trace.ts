/**
 * FIRST TRACE — the no-club conditioning/sprint gap, one world at a time.
 *
 *   npx sucrase-node scripts/probe-noclub-conditioning-trace.ts
 *
 * Wraps THREE live seams and prints what each one saw. Nothing here builds a
 * second plan:
 *
 *   - `weeklyScheduler.scheduleWeek`        — what the scheduler AUTHORISED
 *   - `materialiseAuthoredSessions`         — what the specialist SUPPLIED
 *   - `validateGeneratedWeek`               — what the gate MEASURED
 *
 * The point is to separate "the scheduler never asked" from "the specialist
 * refused" from "the gate did not require it".
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as schedulerModule from '../src/rules/weeklyScheduler';
import * as materialiseModule from '../src/rules/materialiseAuthoredSessions';
import * as validatorModule from '../src/rules/validateGeneratedWeek';

const schedules: any[] = [];
const materialisations: any[] = [];
const validations: any[] = [];

const realSchedule = (schedulerModule as any).scheduleWeek;
(schedulerModule as any).scheduleWeek = function wrapped(input: any) {
  const out = realSchedule(input);
  schedules.push({ input, out });
  return out;
};
const realMaterialise = (materialiseModule as any).materialiseAuthoredSessions;
(materialiseModule as any).materialiseAuthoredSessions = function wrapped(args: any) {
  const out = realMaterialise(args);
  materialisations.push({ args, out });
  return out;
};
const realValidate = (validatorModule as any).validateGeneratedWeek;
(validatorModule as any).validateGeneratedWeek = function wrapped(input: any) {
  const out = realValidate(input);
  validations.push({ input, out });
  return out;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');

const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
  equipment: ['Full Gym'],
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  teamTrainingDays: [] as string[],
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WORLDS = (process.argv[2] ? [process.argv[2]] : ['Pre-season', 'In-season']);

for (const seasonPhase of WORLDS) {
  schedules.length = 0; materialisations.length = 0; validations.length = 0;
  const profile = { ...BASE, seasonPhase };
  let threw: any = null;
  let program: any = null;
  try {
    program = generateProgramLocally(profile as never, {
      todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
    } as never);
  } catch (err: any) { threw = err; }

  console.log(`\n${'#'.repeat(78)}`);
  console.log(`# ${seasonPhase} / 4 gym days (Mon Tue Thu Fri) / NO CLUB / Full Gym / Sat game`);
  console.log('#'.repeat(78));
  console.log(`GENERATION: ${threw ? `REFUSED — ${threw.message}` : 'BUILT'}`);
  for (const f of threw?.findings ?? []) {
    console.log(`   ${f.severity} ${f.clause}: expected=${JSON.stringify(f.expected)} actual=${JSON.stringify(f.actual)}`);
  }

  const sched = schedules[schedules.length - 1];
  if (sched) {
    console.log('\n── 1. WHAT THE SCHEDULER AUTHORISED ──────────────────────────');
    for (const d of sched.out.days ?? []) {
      console.log(
        `  ${DAY_NAMES[d.dayOfWeek]}  owner=${String(d.owner).padEnd(12)} purpose=${String(d.purpose ?? '-').padEnd(12)}`
        + ` cond=${String(d.conditioning ?? '-').padEnd(18)} condCat=${String(d.conditioningCategory ?? '-').padEnd(16)}`
        + ` role=${String(d.conditioningRole ?? '-').padEnd(10)} club=${d.clubTraining ? 'Y' : '.'} game=${d.game ? 'Y' : '.'}`
        + ` clause=${d.clauseId}`,
      );
    }
  }

  const mat = materialisations[materialisations.length - 1];
  if (mat) {
    console.log('\n── 2. WHAT THE CONDITIONING SPECIALIST SUPPLIED ──────────────');
    for (const m of mat.out ?? []) {
      const t = m.conditioningTemplate;
      console.log(
        `  ${DAY_NAMES[m.dayOfWeek]}  template=${t ? `"${t.name}"` : 'NONE'}`
        + (t ? `  quality=${t.quality} work=${t.work ?? '-'} rest=${t.rest ?? '-'} sets=${t.sets ?? '-'}`
          + ` intensity=${t.intensity ?? '-'} wr=${t.workRest ?? '-'}` : '')
        + `  role=${m.conditioningRole ?? '-'} unmaterialised=${m.unmaterialised ?? '-'}`,
      );
    }
  }

  const val = validations[validations.length - 1];
  if (val) {
    const c = val.input.contract ?? {};
    const l = val.out.ledger ?? {};
    console.log('\n── 3. WHAT THE GATE REQUIRED AND MEASURED ────────────────────');
    console.log(`  CONTRACT KEYS: ${Object.keys(c).join(', ')}`);
    console.log(`  contract = ${JSON.stringify(c, null, 2).split('\n').slice(0, 40).join('\n  ')}`);
    console.log(`  LEDGER: mainStrength=${l.mainStrengthSessions} coreConditioning=${l.coreConditioningExposures}`
      + ` sprintNights=${l.sprintNights} appPrescribedSprintDays=${JSON.stringify(l.appPrescribedSprintDays)}`
      + ` hardDays=${l.hardDays} fullRest=${l.fullRestDays}`);
    console.log(`  VERDICT: ${val.out.verdict}`);
  }

  if (program) {
    console.log('\n── 4. WHAT THE ATHLETE ACTUALLY RECEIVES ─────────────────────');
    for (const w of program.microcycles?.[0]?.workouts ?? []) {
      console.log(`  ${DAY_NAMES[w.dayOfWeek]}  "${w.name}"  sessionType=${w.sessionType ?? '-'}`
        + ` condCat=${w.conditioningCategory ?? '-'} condFlavour=${w.conditioningFlavour ?? '-'}`
        + ` speedBlock=${w.speedBlock ? JSON.stringify(w.speedBlock) : '-'}`);
      for (const ex of (w.exercises ?? [])) {
        const keys = Object.keys(ex).filter((k) => /condition|template|modality|quality|work|rest|intens|dose|provenance/i.test(k));
        console.log(`      · ${String(ex.name).padEnd(34)} sets=${ex.sets} reps=${ex.reps}`
          + ` cat=${ex.category ?? '-'} ${keys.map((k) => `${k}=${JSON.stringify((ex as any)[k])}`).join(' ')}`);
      }
    }
  }
}
