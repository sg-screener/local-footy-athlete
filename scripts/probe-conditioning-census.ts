/**
 * THE CONDITIONING CENSUS — what the athlete actually RECEIVES, per world.
 *
 *   npx sucrase-node scripts/probe-conditioning-census.ts [out.json]
 *
 * The refusal census answers "did the week build?". This answers the question
 * that mission actually cares about: **how many conditioning exposures reached
 * the athlete, which authored qualities, and did a hard session survive to the
 * final week?**
 *
 * It reads the FINAL workouts (`generateProgramLocally`'s own output), never
 * the scheduler's intent — an intent that is overwritten downstream is exactly
 * the defect this instrument exists to catch, and reading intent would hide it.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { writeFileSync } from 'fs';
import { generateProgramLocally } from '../src/services/api/generateProgram';

const WEEK_MONDAY = '2026-07-13';

/**
 * A clock that puts the target week at `phaseWeekNumber` inside its phase.
 *
 * ⚠ WITHOUT THIS THE SWEEP NEVER LEAVES WEEK 1, and week 1 of Off-season is the
 * `early_optional` block whose authored answer is *"no required running, light
 * aerobic/off-leg only"*. A sweep pinned to week 1 therefore reports ZERO
 * off-season conditioning and calls it a defect, when it is the contract
 * working. Later off-season has to be asked for by name.
 */
function clockAtPhaseWeek(selectedPhase: string, phaseWeekNumber: number) {
  const entry = new Date(`${WEEK_MONDAY}T12:00:00`);
  entry.setDate(entry.getDate() - (phaseWeekNumber - 1) * 7);
  return {
    protocolVersion: 1,
    selectedPhase,
    phaseEntryWeekStartISO: `${entry.getFullYear()}-${String(entry.getMonth() + 1)
      .padStart(2, '0')}-${String(entry.getDate()).padStart(2, '0')}`,
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  };
}

/**
 * ⚠ **1, 3, 6 — AND WEEKS 4 AND 8 ARE DELIBERATELY NOT HERE.** A block is three
 * build weeks plus a deload, so weeks 4 and 8 ARE deloads, and the scheduler
 * correctly refuses to add hard conditioning in one. Sweeping 1/4/8 reported
 * "HARD=0" for late pre-season and late off-season and looked like a defect; it
 * was the readiness floor working. 1 = early block, 3 = mid, 6 = late build.
 */
const PHASE_WEEKS = [1, 3, 6];

const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
};

const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'],
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
};

/** Categories the approved source treats as HARD conditioning. */
const HARD = new Set(['vo2', 'glycolytic']);

interface Row {
  label: string;
  phase: string;
  phaseWeek: number;
  days: number;
  clubNights: number;
  game: boolean;
  built: boolean;
  exposures: number;
  categories: string[];
  hardCount: number;
  sprintCount: number;
}

const rows: Row[] = [];

for (const phase of ['Pre-season', 'In-season', 'Off-season']) {
 for (const phaseWeek of PHASE_WEEKS) {
  for (const dayCount of [2, 3, 4, 5]) {
    for (const clubNights of [0, 1, 2]) {
      for (const game of [true, false]) {
        const preferredTrainingDays = DAYS[dayCount];
        const teamTrainingDays = ['Tuesday', 'Thursday', 'Wednesday']
          .filter((d) => preferredTrainingDays.includes(d)).slice(0, clubNights);
        if (teamTrainingDays.length !== clubNights) continue;
        const label = `${phase}/w${phaseWeek}/${dayCount}d/${clubNights}club/${game ? 'game' : 'nogame'}`;
        const profile = {
          ...BASE,
          seasonPhase: phase,
          trainingDaysPerWeek: dayCount,
          preferredTrainingDays,
          equipment: ['Full Gym'],
          teamTrainingDays,
          ...(game ? { gameDay: 'Saturday' } : {}),
        };
        try {
          const program: any = generateProgramLocally(profile as never, {
            todayISO: WEEK_MONDAY,
            blockNumber: 1,
            microcycleLimit: 1,
            seasonPhaseClock: clockAtPhaseWeek(phase, phaseWeek),
          } as never);
          const week = program.microcycles?.[0]?.workouts ?? [];
          const categories: string[] = [];
          for (const w of week) {
            const cat = (w as any).conditioningCategory;
            const hasBlock = !!(w as any).conditioningBlock;
            if (cat && hasBlock) categories.push(String(cat));
            else if (cat) categories.push(`${cat}!NOBLOCK`);
          }
          rows.push({
            label, phase, phaseWeek, days: dayCount, clubNights, game, built: true,
            exposures: categories.filter((c) => !c.endsWith('!NOBLOCK')).length,
            categories,
            hardCount: categories.filter((c) => HARD.has(c)).length,
            sprintCount: categories.filter((c) => c === 'sprint').length,
          });
        } catch {
          rows.push({
            label, phase, phaseWeek, days: dayCount, clubNights, game, built: false,
            exposures: 0, categories: [], hardCount: 0, sprintCount: 0,
          });
        }
      }
    }
  }
 }
}

const built = rows.filter((r) => r.built);
console.log(`\nCONDITIONING CENSUS — ${rows.length} worlds, ${built.length} built\n`);

// ⚠ A CATEGORY WITHOUT A BLOCK IS THE DEFECT THIS INSTRUMENT WAS BUILT FOR.
const orphaned = built.flatMap((r) =>
  r.categories.filter((c) => c.endsWith('!NOBLOCK')).map((c) => `${r.label}: ${c}`));
console.log(`AUTHORED CATEGORIES THAT REACHED THE ATHLETE WITH NO SESSION: ${orphaned.length}`);
for (const o of orphaned) console.log(`   ${o}`);

const byPhase = new Map<string, Row[]>();
for (const r of built) {
  const key = `${r.phase} w${r.phaseWeek}`;
  byPhase.set(key, [...(byPhase.get(key) ?? []), r]);
}
console.log('\nPER PHASE:');
for (const [phase, list] of byPhase) {
  const hard = list.filter((r) => r.hardCount > 0).length;
  const sprint = list.filter((r) => r.sprintCount > 0).length;
  const avg = (list.reduce((sum, r) => sum + r.exposures, 0) / list.length).toFixed(2);
  console.log(`  ${phase.padEnd(15)} worlds=${String(list.length).padStart(2)}`
    + `  app exposures avg=${avg}  worlds with HARD=${hard}  worlds with SPRINT=${sprint}`);
}

console.log('\nEVERY BUILT WORLD:');
for (const r of built) {
  console.log(`  ${r.label.padEnd(38)} app=${r.exposures} hard=${r.hardCount}`
    + ` sprint=${r.sprintCount}  [${r.categories.join(', ')}]`);
}

const allCats = new Set(built.flatMap((r) => r.categories));
console.log(`\nDISTINCT AUTHORED QUALITIES DELIVERED: ${[...allCats].sort().join(', ')}`);

if (process.argv[2]) {
  writeFileSync(process.argv[2], JSON.stringify({ rows }, null, 2), 'utf8');
  console.log(`\nwrote ${process.argv[2]}`);
}
