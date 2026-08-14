/**
 * THE REFUSAL CENSUS — the 180-world corpus, every refusal captured with its
 * TYPED finding, not just counted.
 *
 * The same corpus `ladderCoverageWideCensusTests` sweeps (3 phases x 5 day
 * counts x club/no-club x 3 kits x 2 weeks), built through the SAME entry point
 * (`generateProgramLocally`) with the SAME profile shape. The difference is that
 * the census suite `continue`s on a throw; this reads the throw.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { writeFileSync } from 'fs';
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

interface Row {
  label: string;
  seasonPhase: string;
  days: number;
  club: boolean;
  kit: string;
  week: number;
  built: boolean;
  errName?: string;
  errMessage?: string;
  findings?: { clause: string; severity: string; detail: string; expected: unknown; actual: unknown }[];
  stack?: string;
}

const rows: Row[] = [];

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
          const label = `${seasonPhase}/${trainingDaysPerWeek}d/${club ? 'club' : 'noclub'}`
            + `/${equipment[0]}/w${week}`;
          try {
            generateProgramLocally(profile as never, {
              todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
            } as never);
            rows.push({
              label, seasonPhase, days: trainingDaysPerWeek, club, kit: equipment[0], week,
              built: true,
            });
          } catch (err: any) {
            rows.push({
              label, seasonPhase, days: trainingDaysPerWeek, club, kit: equipment[0], week,
              built: false,
              errName: err?.name ?? 'unknown',
              errMessage: String(err?.message ?? err),
              findings: err?.findings
                ? err.findings.map((f: any) => ({
                  clause: f.clause, severity: f.severity, detail: f.detail,
                  expected: f.expected, actual: f.actual,
                }))
                : undefined,
              stack: String(err?.stack ?? '').split('\n').slice(1, 8).join('\n'),
            });
          }
        }
      }
    }
  }
}

const built = rows.filter((r) => r.built).length;
const refused = rows.filter((r) => !r.built);
console.log(`\nCORPUS: ${rows.length} worlds — ${built} built, ${refused.length} refused\n`);

// ── FAMILY GROUPING: by the exact typed clause set, not by world ─────────────
const families = new Map<string, Row[]>();
for (const r of refused) {
  const key = r.findings && r.findings.length > 0
    ? r.findings.map((f) => `${f.clause}:${f.detail}`).sort().join(' || ')
    : `${r.errName}: ${r.errMessage}`;
  const list = families.get(key) ?? [];
  list.push(r);
  families.set(key, list);
}

console.log(`REFUSAL FAMILIES BY TYPED FINDING SET: ${families.size}\n`);
const sorted = [...families.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [key, list] of sorted) {
  const worlds = new Set(list.map((r) => `${r.seasonPhase}/${r.days}d/${r.club ? 'club' : 'noclub'}/${r.kit}`));
  console.log(`── ${list.length} occurrences, ${worlds.size} distinct worlds`);
  console.log(`   FINDINGS: ${key}`);
  console.log(`   WORLDS: ${[...worlds].join(' ; ')}`);
  console.log(`   sample stack:\n${list[0].stack?.split('\n').map((l) => `     ${l.trim()}`).join('\n')}`);
  console.log('');
}

// ── AND THE SAME BY CLAUSE ALONE, so a family is not split by a number in its detail
const byClause = new Map<string, Row[]>();
for (const r of refused) {
  const key = r.findings && r.findings.length > 0
    ? [...new Set(r.findings.map((f) => f.clause))].sort().join('+')
    : `THROW:${r.errName}`;
  const list = byClause.get(key) ?? [];
  list.push(r);
  byClause.set(key, list);
}
console.log('\nBY CLAUSE SET ALONE:');
for (const [key, list] of [...byClause.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const worlds = new Set(list.map((r) => `${r.seasonPhase}/${r.days}d/${r.club ? 'club' : 'noclub'}/${r.kit}`));
  console.log(`  ${String(list.length).padStart(3)} occ / ${String(worlds.size).padStart(2)} worlds  ${key}`);
  const byPhase: Record<string, number> = {};
  for (const r of list) byPhase[r.seasonPhase] = (byPhase[r.seasonPhase] ?? 0) + 1;
  const byDays: Record<string, number> = {};
  for (const r of list) byDays[`${r.days}d`] = (byDays[`${r.days}d`] ?? 0) + 1;
  const byKit: Record<string, number> = {};
  for (const r of list) byKit[r.kit] = (byKit[r.kit] ?? 0) + 1;
  const byClub: Record<string, number> = {};
  for (const r of list) byClub[r.club ? 'club' : 'noclub'] = (byClub[r.club ? 'club' : 'noclub'] ?? 0) + 1;
  console.log(`       phase=${JSON.stringify(byPhase)} days=${JSON.stringify(byDays)} kit=${JSON.stringify(byKit)} club=${JSON.stringify(byClub)}`);
}

writeFileSync(
  process.argv[2] ?? '/tmp/census.json',
  JSON.stringify({ total: rows.length, built, refused: refused.length, rows }, null, 2),
  'utf8',
);
console.log(`\nwrote ${process.argv[2] ?? '/tmp/census.json'}`);
