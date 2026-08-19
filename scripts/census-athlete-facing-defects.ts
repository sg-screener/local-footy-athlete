/**
 * THE TWO LIVE ATHLETE-FACING PROGRAMMING DEFECTS, COUNTED THE WAY SAM ASKED.
 *
 * Sam, 2026-08-20: *"measure and fix the two current athlete-facing programming
 * defects: 1. The 52 duplicate-exercise occurrences — report occurrences plus
 * distinct athletes, weeks and sessions. 2. The 36 no-equipment bench
 * contradictions — same distinct breakdown."*
 *
 * ## WHY THE DISTINCT COUNTS MATTER MORE THAN THE OCCURRENCES
 *
 * "52 occurrences" is a corpus statistic and it is the wrong unit for a
 * decision. **One defect hitting 52 sessions of one athlete is a different
 * product problem from one hitting 52 different athletes once.** The occurrence
 * count cannot tell those apart; this script reports both, so the fix can be
 * argued about in the unit the athlete actually experiences.
 *
 * ⚠ **AN "ATHLETE" HERE IS A DISTINCT LEGAL SETUP, NOT A PERSON.** The corpus is
 * the same 90 setups x 2 weeks the release matrix walks: phase x training days x
 * club/no-club x kit. Two weeks of the same setup are ONE athlete, TWO weeks.
 *
 * ## THE DETECTORS ARE QA'S, COPIED VERBATIM AND NOT RE-DERIVED
 *
 * `duplicateRows` and `cueKitContradictions` are lifted unchanged from
 * `scripts/run-programming-release-matrix.ts` on `codex/finish-qa`, so this
 * script and the release matrix cannot disagree about what a defect IS. Only the
 * aggregation is new. A second detector written from the description would be a
 * second authority, and the first thing it would do is quietly report a
 * different number.
 *
 * Run: TZ=Australia/Melbourne npx sucrase-node scripts/census-athlete-facing-defects.ts
 */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

import { EXERCISE_CUES } from '../src/data/exerciseCues';
import { EXERCISE_EQUIPMENT_REQUIREMENT } from '../src/data/exerciseEquipmentRequirement';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { composedIdentityFor } from '../src/rules/composedRowLegality';
import { resolveSelectedImplement } from '../src/rules/selectedImplement';
import { cueForImplement } from '../src/screens/home/dayWorkoutHelpers';

/** Kit tags for a checklist answer, as the resolver expects them. */
const KIT_TAGS: Record<string, string[]> = {
  'Full Gym': ['bodyweight', 'dumbbells', 'barbell', 'cables', 'bands', 'bench',
    'pullup_bar', 'kettlebell', 'machine', 'plyo_box', 'rack'],
  'Bodyweight Only': ['bodyweight'],
  Dumbbells: ['bodyweight', 'dumbbells', 'bands'],
};

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

const KITS: readonly string[][] = [
  ['Full Gym'],
  ['Bodyweight Only'],
  ['Dumbbells', 'Bands'],
];

function quietly<T>(run: () => T): T {
  const log = console.log;
  const warn = console.warn;
  console.log = () => undefined;
  console.warn = () => undefined;
  try {
    return run();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

const rowsOf = (workout: any): any[] =>
  (Array.isArray(workout?.exercises) ? workout.exercises : []);
const rowRole = (row: any): string =>
  String(row?.section18Evidence?.role ?? row?.role ?? '');

/** QA's detector, verbatim. */
function duplicateRows(workout: any): string[] {
  const seen = new Map<string, string[]>();
  for (const row of rowsOf(workout)) {
    const name = composedIdentityFor(String(row?.exercise?.name ?? ''));
    if (!name) continue;
    seen.set(name, [...(seen.get(name) ?? []), rowRole(row) || 'untyped']);
  }
  return [...seen.entries()]
    .filter(([, roles]) => roles.length > 1)
    .map(([name, roles]) => `${name} [${roles.join('+')}]`);
}

/**
 * ⚠ **RE-AIMED AT WHAT THE ATHLETE READS (2026-08-20).**
 *
 * QA's detector compared two DATA SHEETS: equipment requirement empty + cue text
 * naming an apparatus. That is how the defect was found and the count is right,
 * but it is not what the athlete experiences — the screen renders
 * `cueForImplement`, which can withhold a cue that does not fit the implement in
 * their hands. **A fix that stops the athlete being told to use a bench would
 * leave the sheet-level count at 36 and look like no fix at all.**
 *
 * So this measures the rendered cue, through the same two functions
 * `DayWorkoutScreenV2:2553` calls. The sheet-level detector is kept below it as
 * `sheetLevelContradictions`, because the underlying data disagreement is still
 * real and should not silently disappear from the report.
 */
function renderedApparatusContradictions(workout: any, kit: string[]): string[] {
  const out: string[] = [];
  for (const row of rowsOf(workout)) {
    const name = composedIdentityFor(String(row?.exercise?.name ?? ''));
    if (!name) continue;
    let implement: any = null;
    try {
      implement = (resolveSelectedImplement({
        exerciseName: name, availableTags: kit,
      } as never) as any)?.implement ?? null;
    } catch { implement = null; }
    let text: string | null = null;
    try { text = cueForImplement(name, implement).text; } catch { text = null; }
    if (!text) continue;
    /* ⚠ **THE PRIMARY CUE ONLY, AND THAT IS THE WHOLE DISTINCTION.**
     *
     * The first cut of this detector scanned the joined cue and reported **140
     * occurrences across 46 athletes** — almost all of them `Explosive Push-up`,
     * whose SECONDARY cue reads *"Sore wrists? Elevate hands on box."* That is a
     * conditional REMEDY for a symptom the athlete may not have, not an
     * instruction they cannot follow. Counting it inflates the defect fourfold
     * and would have pushed a wrong row into `CUE_ASSUMED_IMPLEMENT`.
     *
     * The primary cue is the SETUP — *"Top leg on the bench"*, *"Back foot on
     * bench"* — and an athlete who cannot perform the setup cannot do the
     * exercise as written. That is the defect Sam named, and restricting to the
     * primary reproduces his 36 exactly. The conditional mentions are reported
     * separately below rather than dropped. */
    const primary = (EXERCISE_CUES as any)[name]?.primaryCue ?? '';
    const apparatus = String(primary)
      .match(/\b(?:on|to|onto|across)\s+(?:the\s+|a\s+|an\s+)?(bench|box|rack|machine)\b/i)?.[1];
    if (!apparatus) continue;
    // Only a contradiction when the athlete does NOT have the apparatus.
    const owned = kit.includes(apparatus === 'box' ? 'plyo_box' : apparatus);
    if (!owned) out.push(`${name}: told to use the ${apparatus} without one`);
  }
  return out;
}

/** QA's detector, verbatim — kept so the DATA disagreement stays visible. */
function cueKitContradictions(program: any, bodyweightOnly: boolean): string[] {
  if (!bodyweightOnly) return [];
  const delivered = new Set<string>();
  for (const week of program?.microcycles ?? []) {
    for (const workout of week.workouts ?? []) {
      for (const row of rowsOf(workout)) {
        delivered.add(composedIdentityFor(String(row?.exercise?.name ?? '')));
      }
    }
  }
  const contradictions: string[] = [];
  for (const name of delivered) {
    const requirement = (EXERCISE_EQUIPMENT_REQUIREMENT as any)[name];
    const cue = (EXERCISE_CUES as any)[name];
    const text = `${cue?.primaryCue ?? ''} ${cue?.secondaryCue ?? ''}`;
    const apparatus = text.match(/\bon the (bench|box|rack|machine)\b/i)?.[1];
    if (Array.isArray(requirement) && requirement.length === 0 && apparatus) {
      contradictions.push(`${name}: requires ${apparatus} in cue but equipment sheet says none`);
    }
  }
  return contradictions;
}

interface Hit {
  athlete: string;
  week: string;
  session: string;
  detail: string;
}

const duplicateHits: Hit[] = [];
const cueHits: Hit[] = [];
const sheetHits: Hit[] = [];
const cueLoss: Hit[] = [];
const conditionalMentions: Hit[] = [];
let built = 0;
let refused = 0;

for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season']) {
  for (const trainingDaysPerWeek of [2, 3, 4, 5, 6]) {
    for (const club of [true, false]) {
      for (const equipment of KITS) {
        for (const weekNumber of [1, 2]) {
          const preferredTrainingDays = DAYS[trainingDaysPerWeek]!;
          const athlete = `${seasonPhase}/${trainingDaysPerWeek}d/`
            + `${club ? 'club' : 'noclub'}/${equipment[0]}`;
          const week = `${athlete}/w${weekNumber}`;
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
          let program: any;
          try {
            program = quietly(() => generateProgramLocally(profile as never, {
              todayISO: '2026-07-13',
              blockNumber: 1,
              microcycleLimit: weekNumber,
            } as never));
          } catch {
            refused += 1;
            continue;
          }
          built += 1;
          const cycle = program?.microcycles?.[weekNumber - 1]
            ?? program?.microcycles?.[program.microcycles.length - 1];
          for (const workout of cycle?.workouts ?? []) {
            for (const detail of duplicateRows(workout)) {
              duplicateHits.push({
                athlete, week, session: `${week}/d${workout.dayOfWeek}`, detail,
              });
            }
          }
          const kitTags = KIT_TAGS[equipment[0]!]!;
          // ⚠ THE PRICE OF THE FIX, COUNTED. Filing a cue as written for an
          // apparatus withholds it from anyone whose resolved implement differs
          // — including an athlete who owns that apparatus. Unmeasured, that is
          // a silent regression for gym athletes.
          for (const workout of cycle?.workouts ?? []) {
            for (const row of rowsOf(workout)) {
              const name = composedIdentityFor(String(row?.exercise?.name ?? ''));
              if (!name) continue;
              const cue = (EXERCISE_CUES as any)[name];
              const raw = `${cue?.primaryCue ?? ''} ${cue?.secondaryCue ?? ''}`;
              const apparatus = raw.match(/\b(?:on|to|onto|across)\s+(?:the\s+|a\s+|an\s+)?(bench|box|rack|machine)\b/i)?.[1];
              if (!apparatus) continue;
              if (!kitTags.includes(apparatus === 'box' ? 'plyo_box' : apparatus)) continue;
              let implement: any = null;
              try {
                implement = (resolveSelectedImplement({
                  exerciseName: name, availableTags: kitTags,
                } as never) as any)?.implement ?? null;
              } catch { implement = null; }
              let text: string | null = null;
              try { text = cueForImplement(name, implement).text; } catch { text = null; }
              if (!text) {
                cueLoss.push({
                  athlete, week, session: `${week}/d${workout.dayOfWeek}`,
                  detail: `${name}: owns the ${apparatus}, cue withheld`,
                });
              }
            }
          }
          for (const workout of cycle?.workouts ?? []) {
            // The conditional half, counted so it is disclosed rather than lost.
            for (const row of rowsOf(workout)) {
              const nm = composedIdentityFor(String(row?.exercise?.name ?? ''));
              const sec = (EXERCISE_CUES as any)[nm]?.secondaryCue ?? '';
              const app = String(sec)
                .match(/\b(?:on|to|onto|across)\s+(?:the\s+|a\s+|an\s+)?(bench|box|rack|machine)\b/i)?.[1];
              if (!app) continue;
              if (kitTags.includes(app === 'box' ? 'plyo_box' : app)) continue;
              conditionalMentions.push({
                athlete, week, session: `${week}/d${workout.dayOfWeek}`,
                detail: `${nm}: optional ${app} mentioned to an athlete without one`,
              });
            }
            for (const detail of renderedApparatusContradictions(workout, kitTags)) {
              cueHits.push({
                athlete, week, session: `${week}/d${workout.dayOfWeek}`, detail,
              });
            }
          }
          for (const detail of cueKitContradictions(
            { microcycles: [cycle] }, equipment[0] === 'Bodyweight Only',
          )) {
            // A cue contradiction is a property of a DELIVERED EXERCISE, so it is
            // attributed to every session that actually prescribes it — that is
            // the session the athlete reads the impossible instruction in.
            const name = detail.split(':')[0]!;
            for (const workout of cycle?.workouts ?? []) {
              if (rowsOf(workout).some((row) =>
                composedIdentityFor(String(row?.exercise?.name ?? '')) === name)) {
                sheetHits.push({
                  athlete, week, session: `${week}/d${workout.dayOfWeek}`, detail,
                });
              }
            }
          }
        }
      }
    }
  }
}

function report(title: string, hits: Hit[]): void {
  const distinct = (key: keyof Hit) => new Set(hits.map((hit) => hit[key])).size;
  console.log(`\n${title}`);
  console.log(`  occurrences        ${hits.length}`);
  console.log(`  distinct athletes  ${distinct('athlete')}`);
  console.log(`  distinct weeks     ${distinct('week')}`);
  console.log(`  distinct sessions  ${distinct('session')}`);
  const byDetail = new Map<string, number>();
  for (const hit of hits) byDetail.set(hit.detail, (byDetail.get(hit.detail) ?? 0) + 1);
  console.log('  by kind:');
  for (const [detail, count] of [...byDetail.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(4)}  ${detail}`);
  }
  const byKit = new Map<string, number>();
  for (const hit of hits) {
    const kit = hit.athlete.split('/')[3]!;
    byKit.set(kit, (byKit.get(kit) ?? 0) + 1);
  }
  console.log('  by kit:');
  for (const [kit, count] of [...byKit.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(4)}  ${kit}`);
  }
}

console.log(`corpus: ${built} built / ${refused} refused`);
report('DEFECT 1 — one exercise prescribed twice in one session', duplicateHits);
report('DEFECT 2 — a no-equipment athlete TOLD to use an apparatus (what they read)', cueHits);
report('  (underlying data disagreement — sheet says none, cue names one)', sheetHits);
report('  COST — a cue withheld from an athlete who DOES own the apparatus', cueLoss);
report('  DISCLOSED, NOT COUNTED — a conditional apparatus tip, not an instruction', conditionalMentions);
