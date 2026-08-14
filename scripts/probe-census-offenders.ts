/**
 * THE CENSUS'S OWN OFFENDERS, PRINTED ROW BY ROW.
 *
 * Replicates `ladderCoverageWideCensusTests`' judging EXACTLY — same corpus, same
 * `microcycles[week-1]` selection, same `composedDeclaredSlots` read — and prints
 * every deficient day and every R-089 content offender with its rows.
 *
 * ⚠ IT EXISTS BECAUSE TWO OTHER PROBES DISAGREED WITH THE CENSUS AND WITH EACH
 * OTHER. `probe-world-detail.ts` indexes the composer calls by `week - 1`, which is
 * NOT the same thing as `microcycles[week - 1]` when generation composes more weeks
 * than it returns — so its `w2` output is week 1's composition wearing a w2 label.
 * `probe-validator-input.ts` prints the LAST validator call, which is a different
 * week again. **Neither is wrong about what it prints; both are wrong to be read as
 * the census's week.** This one reads the census's week.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const slots = require('../src/rules/sessionSlotCoverage');
const { sessionSlotCoverage, slotDayKindFor, slotsForExerciseName } = slots;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveEquipmentCapabilities } = require('../src/utils/equipmentAvailability');

const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
};
const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'], 3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const KITS: string[][] = [['Full Gym'], ['Bodyweight Only'], ['Dumbbells', 'Bands']];
const PAIRS = ['squat', 'hinge', 'single_leg_knee', 'single_leg_hip'];

for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season']) {
  for (const trainingDaysPerWeek of [2, 3, 4, 5, 6]) {
    for (const club of [true, false]) {
      for (const equipment of KITS) {
        for (const week of [1, 2]) {
          const preferredTrainingDays = DAYS[trainingDaysPerWeek];
          const profile = {
            ...BASE, seasonPhase, trainingDaysPerWeek, preferredTrainingDays, equipment,
            teamTrainingDays: club
              ? ['Tuesday', 'Thursday'].filter((d) => preferredTrainingDays.includes(d)) : [],
          };
          let program: any;
          try {
            program = generateProgramLocally(profile, {
              todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
            });
          } catch { continue; }
          const label = `${seasonPhase}/${trainingDaysPerWeek}d/${club ? 'club' : 'noclub'}`
            + `/${equipment[0]}/w${week}`;
          const kit = resolveEquipmentCapabilities(profile as any).tags;
          const workouts = program?.microcycles?.[week - 1]?.workouts ?? [];
          const deficientDays: string[] = [];
          const pairRows: string[] = [];
          const pairCounts: Record<string, number> = {
            squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0 };
          for (const w of workouts) {
            for (const row of (w.exercises ?? [])) {
              const name = String(row.exercise?.name ?? '');
              const filled: string[] = slotsForExerciseName(name) ?? [];
              const hit = PAIRS.find((s) => filled.includes(s));
              if (hit) {
                pairCounts[hit] += 1;
                pairRows.push(`      day ${w.dayOfWeek} ${name} -> ${hit} `
                  + `(slots=${JSON.stringify(filled)}, role=${row.section18Evidence?.role ?? '-'}, `
                  + `prov=${row.section18Evidence?.provenance ?? '-'})`);
              }
            }
            const declaredShape = (w as any).composedDayShape;
            const kind = declaredShape ?? slotDayKindFor(String(w.name ?? ''));
            if (!kind) continue;
            const declaredSlots = (w as any).composedDeclaredSlots;
            const cov = sessionSlotCoverage(w.exercises ?? [], kind, kit, declaredSlots);
            if (cov.missing.length > 0 || cov.duplicated.length > 0) {
              deficientDays.push(`    day ${w.dayOfWeek} [${kind}] declared=`
                + `${JSON.stringify(declaredSlots ?? '(from table)')} `
                + `missing=${JSON.stringify(cov.missing)} dup=${JSON.stringify(cov.duplicated)}`);
              for (const row of (w.exercises ?? [])) {
                const nm = String(row.exercise?.name ?? '');
                deficientDays.push(`        ${nm.padEnd(34)} slots=`
                  + `${JSON.stringify(slotsForExerciseName(nm) ?? [])} `
                  + `prov=${row.section18Evidence?.provenance ?? '-'}`);
              }
            }
          }
          const slkBad = pairCounts.single_leg_knee > pairCounts.single_leg_hip;
          const sqBad = pairCounts.squat > pairCounts.hinge;
          if (deficientDays.length > 0 || slkBad || sqBad) {
            console.log(`\n══ ${label} ══  sq${pairCounts.squat}/hi${pairCounts.hinge} `
              + `slk${pairCounts.single_leg_knee}/slh${pairCounts.single_leg_hip}`
              + `${slkBad ? '  <-- R-089 KNEE' : ''}${sqBad ? '  <-- R-089 SQUAT' : ''}`);
            for (const l of deficientDays) console.log(l);
            if (slkBad || sqBad) {
              console.log('    every pair-slot row in the week:');
              for (const l of pairRows) console.log(l);
            }
          }
        }
      }
    }
  }
}
