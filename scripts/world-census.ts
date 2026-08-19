/**
 * PER-WORLD CENSUS — the instrument a refusal claim actually needs.
 *
 * A 405-suite failure comparison cannot answer "did any world newly refuse":
 * its unit is the SUITE, not the world, and a suite can stay green while the
 * worlds under it swap built for refused. So this walks the same world grid the
 * wide ladder census walks and emits ONE LINE PER WORLD:
 *
 *     <world id>\t<built|refused>\t<refusal family>\t<delivered sessions>
 *
 * Same grid, same profile base, same generation call as
 * `ladderCoverageWideCensusTests.ts` — so the two agree by construction rather
 * than by my reading of them. Run it on two tips and diff the output.
 */
import { generateProgramLocally } from '../src/services/api/generateProgram';

const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
};
const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'],
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const KITS: string[][] = [['Full Gym'], ['Bodyweight Only'], ['Dumbbells', 'Bands']];

/** The typed family of a refusal — never the free-text message, which carries ids. */
function refusalFamily(error: unknown): string {
  if (!(error instanceof Error)) return 'non_error';
  const code = (error as { code?: string }).code;
  if (code) return `${error.name}:${code}`;
  const signature = (error as { result?: { failureSignature?: string | null } }).result?.failureSignature;
  return signature ? `${error.name}:${signature}` : error.name;
}

for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season']) {
  for (const trainingDaysPerWeek of [2, 3, 4, 5, 6]) {
    for (const club of [true, false]) {
      for (const equipment of KITS) {
        for (const week of [1, 2]) {
          const preferredTrainingDays = DAYS[trainingDaysPerWeek];
          const profile = {
            ...BASE,
            seasonPhase,
            trainingDaysPerWeek,
            preferredTrainingDays,
            equipment,
            teamTrainingDays: club
              ? ['Tuesday', 'Thursday'].filter((day) => preferredTrainingDays.includes(day))
              : [],
          };
          const id = `${seasonPhase}/${trainingDaysPerWeek}d/${club ? 'club' : 'noclub'}`
            + `/${equipment[0]}/w${week}`;
          let program: any;
          try {
            program = generateProgramLocally(profile as never, {
              todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
            } as never);
          } catch (error) {
            console.log(`${id}\trefused\t${refusalFamily(error)}\t0`);
            continue;
          }
          const workouts = program?.microcycles?.[week - 1]?.workouts ?? [];
          const delivered = workouts.filter((w: any) => (w.exercises ?? []).length > 0).length;
          console.log(`${id}\tbuilt\t-\t${delivered}`);
        }
      }
    }
  }
}
