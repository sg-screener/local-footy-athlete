/**
 * WC-136 — PHASE-OWNED CONDITIONING, GUARDED ON REAL GENERATED PROGRAMS.
 *
 *   npm run test:conditioning-phase-authorship
 *
 * **EVERY CELL RUNS `generateProgramLocally` AND READS THE FINAL WORKOUTS.**
 * That is not a style preference here, it is the whole point: the defect this
 * unit fixed was an authored `vo2` session that the scheduler AUTHORISED, the
 * specialist MATERIALISED without refusing, and a legacy post-validation then
 * silently erased before the athlete ever saw it. A cell reading the
 * scheduler's intent would have been green throughout.
 *
 * So a session counts here only when the final workout carries BOTH its
 * category and a real `conditioningBlock`. `conditioningCategory` alone is
 * exactly the ghost state that hid the bug for a whole session.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  INSEASON_OVERLAY,
  OFFSEASON_OVERLAYS,
  PRESEASON_OVERLAY,
  overlayForPhase,
  hardConditioningQualityFor,
} from '../rules/weeklyProgrammingContract';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const WEEK_MONDAY = '2026-07-13';
/** Categories the approved source treats as HARD conditioning. */
const HARD = new Set(['vo2', 'glycolytic']);

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

interface Exposure {
  dayOfWeek: number;
  category: string;
  hard: boolean;
  offFeet: boolean;
  /** True when the day also carries a strength session. */
  combined: boolean;
}

interface Built {
  built: boolean;
  refusal?: string;
  exposures: Exposure[];
  gameDay: number | null;
  clubNights: number[];
  /** Days carrying a strength session, by purpose-ish name. */
  strengthDays: number[];
}

const DAY_NUM: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

/** ⚠ WEEKS 4 AND 8 ARE DELOADS (3 build + 1 deload) — never use them for "may add". */
function build(args: {
  phase: string;
  phaseWeek: number;
  gymDays: string[];
  clubNights?: string[];
  gameDay?: string | null;
  equipment?: string[];
}): Built {
  const profile = {
    trainingLocation: 'Commercial gym',
    equipmentSelectionCompleteness: 'complete',
    recentTrainingLoad: 'Pretty consistent',
    conditioningLevel: 'Average',
    seasonPhase: args.phase,
    trainingDaysPerWeek: args.gymDays.length,
    preferredTrainingDays: args.gymDays,
    equipment: args.equipment ?? ['Full Gym'],
    teamTrainingDays: args.clubNights ?? [],
    ...(args.gameDay ? { gameDay: args.gameDay } : {}),
  };
  try {
    const program: any = generateProgramLocally(profile as never, {
      todayISO: WEEK_MONDAY,
      blockNumber: 1,
      microcycleLimit: 1,
      seasonPhaseClock: clockAtPhaseWeek(args.phase, args.phaseWeek),
    } as never);
    const week = program.microcycles?.[0]?.workouts ?? [];
    const exposures: Exposure[] = [];
    const strengthDays: number[] = [];
    for (const w of week) {
      const cat = (w as any).conditioningCategory;
      // BOTH, ALWAYS. A category with no block is the ghost this suite exists for.
      if (cat && (w as any).conditioningBlock) {
        exposures.push({
          dayOfWeek: w.dayOfWeek,
          category: String(cat),
          hard: HARD.has(String(cat)),
          offFeet: (w as any).conditioningOffFeet === true,
          combined: ((w as any).exercises ?? []).length > 0,
        });
      }
      if (((w as any).exercises ?? []).length > 0) strengthDays.push(w.dayOfWeek);
    }
    return {
      built: true,
      exposures,
      strengthDays,
      gameDay: args.gameDay ? DAY_NUM[args.gameDay] : null,
      clubNights: (args.clubNights ?? []).map((d) => DAY_NUM[d]),
    };
  } catch (err: any) {
    return {
      built: false,
      refusal: String(err?.message ?? err),
      exposures: [],
      strengthDays: [],
      gameDay: args.gameDay ? DAY_NUM[args.gameDay] : null,
      clubNights: (args.clubNights ?? []).map((d) => DAY_NUM[d]),
    };
  }
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const orderIndex = (day: number) => WEEK_ORDER.indexOf(day);
/** Days between `day` and the game, negative before. Cyclic within the week. */
function gOffset(day: number, gameDay: number | null): number | null {
  if (gameDay === null) return null;
  return orderIndex(day) - orderIndex(gameDay);
}

armTotalsOrRed();
console.log('\nWC-136 — phase-owned conditioning, on real generated programs\n');

// ═══════════════════════════════════════════════════════════════════════════
console.log('[the three in-season shapes]');
// ═══════════════════════════════════════════════════════════════════════════

// ── SHAPE 1: the normal in-season game week ────────────────────────────────
const normalGameWeek = build({
  phase: 'In-season', phaseWeek: 6,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: ['Tuesday', 'Thursday'],
  gameDay: 'Saturday',
});
ok('[non-vacuity] the normal in-season game week BUILDS and has a fixture',
  normalGameWeek.built && normalGameWeek.gameDay === 6, normalGameWeek.refusal);
ok('[shape 1] a normal in-season game week authors NO hard conditioning',
  normalGameWeek.exposures.every((e) => !e.hard),
  JSON.stringify(normalGameWeek.exposures));
ok('[shape 1 non-vacuity] ...and the club nights genuinely carry no app conditioning',
  normalGameWeek.exposures.every((e) => !normalGameWeek.clubNights.includes(e.dayOfWeek)),
  `club=${JSON.stringify(normalGameWeek.clubNights)} exposures=${JSON.stringify(
    normalGameWeek.exposures.map((e) => e.dayOfWeek))}`);

// ── SHAPE 2: the no-club in-season game week ───────────────────────────────
const noClubGameWeek = build({
  phase: 'In-season', phaseWeek: 6,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: [],
  gameDay: 'Saturday',
});
ok('[non-vacuity] the no-club in-season game week BUILDS',
  noClubGameWeek.built, noClubGameWeek.refusal);
const sprints = noClubGameWeek.exposures.filter((e) => e.category === 'sprint');
ok('[shape 2] a no-club in-season game week DOES get its sprint',
  sprints.length === 1, JSON.stringify(noClubGameWeek.exposures));
ok('[shape 2] ...placed G-3 or earlier',
  sprints.every((e) => (gOffset(e.dayOfWeek, noClubGameWeek.gameDay) ?? -99) <= -3),
  sprints.map((e) => `day=${e.dayOfWeek} gOffset=${gOffset(e.dayOfWeek, noClubGameWeek.gameDay)}`).join(', '));
ok('[shape 2] ...and every OTHER exposure stays easy/controlled',
  noClubGameWeek.exposures.filter((e) => e.category !== 'sprint').every((e) => !e.hard),
  JSON.stringify(noClubGameWeek.exposures));

// ── SHAPE 3: the healthy bye / no-game week ────────────────────────────────
const byeWeek = build({
  phase: 'In-season', phaseWeek: 6,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: ['Tuesday'],
  gameDay: null,
});
ok('[non-vacuity] the in-season bye week BUILDS and genuinely has no fixture',
  byeWeek.built && byeWeek.gameDay === null, byeWeek.refusal);
ok('[shape 3] a healthy in-season BYE week IS permitted hard conditioning',
  byeWeek.exposures.some((e) => e.hard), JSON.stringify(byeWeek.exposures));
ok('[shape 3 vs shape 1] the SAME athlete gets hard work on the bye and none on the game week',
  byeWeek.exposures.some((e) => e.hard)
  && normalGameWeek.exposures.every((e) => !e.hard));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[the 48-hour rule, the club night, and the readiness floor]');
// ═══════════════════════════════════════════════════════════════════════════

const preseasonNoClub = build({
  phase: 'Pre-season', phaseWeek: 3,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: [],
  gameDay: 'Saturday',
});
ok('[non-vacuity] the pre-season no-club week BUILDS and DOES author a hard session',
  preseasonNoClub.built && preseasonNoClub.exposures.some((e) => e.hard),
  preseasonNoClub.refusal ?? JSON.stringify(preseasonNoClub.exposures));
ok('[48h] no hard conditioning within 48 hours of the game (G-2, G-1, G, G+1)',
  preseasonNoClub.exposures.filter((e) => e.hard).every((e) => {
    const off = gOffset(e.dayOfWeek, preseasonNoClub.gameDay);
    return off !== null && off <= -3;
  }),
  preseasonNoClub.exposures.filter((e) => e.hard)
    .map((e) => `day=${e.dayOfWeek} gOffset=${gOffset(e.dayOfWeek, preseasonNoClub.gameDay)}`).join(', '));

const preseasonTwoClub = build({
  phase: 'Pre-season', phaseWeek: 3,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: ['Tuesday', 'Thursday'],
  gameDay: 'Saturday',
});
ok('[non-vacuity] the two-club pre-season week BUILDS and has two club nights',
  preseasonTwoClub.built && preseasonTwoClub.clubNights.length === 2,
  preseasonTwoClub.refusal);
ok('[club nights] the app never adds conditioning on a club-training day',
  preseasonTwoClub.exposures.every((e) => !preseasonTwoClub.clubNights.includes(e.dayOfWeek)),
  `club=${JSON.stringify(preseasonTwoClub.clubNights)} exposures=${JSON.stringify(
    preseasonTwoClub.exposures.map((e) => e.dayOfWeek))}`);

// ── THE ANCHOR CREDIT IS SPENT FIRST ───────────────────────────────────────
ok('[anchor credit] more club nights means FEWER app-authored exposures',
  preseasonTwoClub.exposures.length < preseasonNoClub.exposures.length,
  `noclub=${preseasonNoClub.exposures.length} twoclub=${preseasonTwoClub.exposures.length}`);

// ── LOWER DAYS STAY OFF-LEG ────────────────────────────────────────────────
// ⚠ ONE CLUB NIGHT, NOT ZERO. An athlete with NO club AND NO fixture has no
// anchor at all, and that world refuses at BASE `1248be77` in every phase —
// measured, and unrelated to this unit. A cell built on it would be red for
// somebody else's reason.
const offLegWorld = build({
  phase: 'Pre-season', phaseWeek: 3,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: ['Tuesday'], gameDay: null,
});
ok('[non-vacuity] the off-leg world BUILDS with at least one exposure',
  offLegWorld.built && offLegWorld.exposures.length > 0, offLegWorld.refusal);
ok('[WC-115] every conditioning exposure that rides a LOWER strength day is off-leg',
  offLegWorld.exposures.filter((e) => e.combined && e.offFeet !== undefined)
    .every((e) => e.category !== 'sprint' || !e.combined),
  JSON.stringify(offLegWorld.exposures));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[the off-season progression]');
// ═══════════════════════════════════════════════════════════════════════════

// THREE gym days, one club night: four off-season gym days trip
// `main_strength_permitted_maximum` at BASE, which is not this unit's defect.
const earlyOff = build({
  phase: 'Off-season', phaseWeek: 1,
  gymDays: ['Monday', 'Wednesday', 'Friday'],
  clubNights: ['Wednesday'], gameDay: null,
});
ok('[non-vacuity] the early off-season week BUILDS', earlyOff.built, earlyOff.refusal);
ok('[early off-season] weeks 1-2 author NO hard conditioning at all',
  earlyOff.exposures.every((e) => !e.hard), JSON.stringify(earlyOff.exposures));
ok('[early off-season] ...and no app-authored running exposure is required of them',
  earlyOff.exposures.length === 0, JSON.stringify(earlyOff.exposures));
ok('[early off-season] ...and no sprint/high-speed either',
  earlyOff.exposures.every((e) => e.category !== 'sprint'),
  JSON.stringify(earlyOff.exposures));

const lateOff = build({
  phase: 'Off-season', phaseWeek: 6,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: ['Tuesday'], gameDay: null,
});
ok('[non-vacuity] the late off-season week BUILDS', lateOff.built, lateOff.refusal);
ok('[late off-season] contains a GENUINE authored hard conditioning session',
  lateOff.exposures.some((e) => e.hard), JSON.stringify(lateOff.exposures));
ok('[off-season progression] early has no hard session and late does — same athlete',
  earlyOff.exposures.every((e) => !e.hard) && lateOff.exposures.some((e) => e.hard));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[no ghost sessions — the defect this unit fixed]');
// ═══════════════════════════════════════════════════════════════════════════

const WORLDS = [
  { phase: 'Pre-season', phaseWeek: 3 }, { phase: 'Pre-season', phaseWeek: 6 },
  { phase: 'In-season', phaseWeek: 3 }, { phase: 'In-season', phaseWeek: 6 },
  { phase: 'Off-season', phaseWeek: 1 }, { phase: 'Off-season', phaseWeek: 6 },
];
let ghosts = 0;
let sweptExposures = 0;
let sweptWorlds = 0;
for (const world of WORLDS) {
  for (const clubNights of [[], ['Tuesday'], ['Tuesday', 'Thursday']]) {
    for (const gameDay of ['Saturday', null]) {
      const profile = {
        trainingLocation: 'Commercial gym',
        equipmentSelectionCompleteness: 'complete',
        recentTrainingLoad: 'Pretty consistent',
        conditioningLevel: 'Average',
        seasonPhase: world.phase,
        trainingDaysPerWeek: 4,
        preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
        equipment: ['Full Gym'],
        teamTrainingDays: clubNights,
        ...(gameDay ? { gameDay } : {}),
      };
      try {
        const program: any = generateProgramLocally(profile as never, {
          todayISO: WEEK_MONDAY, blockNumber: 1, microcycleLimit: 1,
          seasonPhaseClock: clockAtPhaseWeek(world.phase, world.phaseWeek),
        } as never);
        sweptWorlds += 1;
        for (const w of program.microcycles?.[0]?.workouts ?? []) {
          const cat = (w as any).conditioningCategory;
          if (!cat) continue;
          if ((w as any).conditioningBlock) sweptExposures += 1;
          else ghosts += 1;
        }
      } catch { /* refusals are the refusal census's business, not this cell's */ }
    }
  }
}
ok('[non-vacuity] the ghost sweep genuinely built worlds and saw exposures',
  sweptWorlds >= 20 && sweptExposures >= 20, `worlds=${sweptWorlds} exposures=${sweptExposures}`);
ok('[no ghosts] no authored conditioning category reaches the athlete without a session',
  ghosts === 0, `${ghosts} ghost categories across ${sweptWorlds} worlds`);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[the contract itself]');
// ═══════════════════════════════════════════════════════════════════════════

ok('[contract] the overlay resolver returns the phase overlay it was asked for',
  overlayForPhase('Pre-season', null) === PRESEASON_OVERLAY
  && overlayForPhase('In-season', null) === INSEASON_OVERLAY
  && overlayForPhase('Off-season', 'early_optional') === OFFSEASON_OVERLAYS.early_optional
  && overlayForPhase('Off-season', 'normal_build') === OFFSEASON_OVERLAYS.normal_build);
ok('[contract] an unresolved off-season subphase reads as normal build, never a reduction',
  overlayForPhase('Off-season', null) === OFFSEASON_OVERLAYS.normal_build);
ok('[contract] pre-season targets FOUR conditioning exposures, not the global three',
  PRESEASON_OVERLAY.conditioningTarget.min === 4);
ok('[contract] in-season hard conditioning requires a week with no game',
  INSEASON_OVERLAY.hardConditioning.requiresNoGameWeek === true
  && INSEASON_OVERLAY.hardConditioning.count === 1);
ok('[contract] early off-season authors no hard quality at all',
  OFFSEASON_OVERLAYS.early_optional.hardConditioning.count === 0
  && OFFSEASON_OVERLAYS.early_optional.hardConditioning.qualities.length === 0);
ok('[contract] the late off-season hard quality ROTATES at the block boundary',
  hardConditioningQualityFor(OFFSEASON_OVERLAYS.normal_build, 1)
  !== hardConditioningQualityFor(OFFSEASON_OVERLAYS.normal_build, 2),
  `${hardConditioningQualityFor(OFFSEASON_OVERLAYS.normal_build, 1)} vs `
  + `${hardConditioningQualityFor(OFFSEASON_OVERLAYS.normal_build, 2)}`);
ok('[contract] a zero-count allowance always answers null, whatever the block',
  [1, 2, 3, 4].every((n) => hardConditioningQualityFor(OFFSEASON_OVERLAYS.early_optional, n) === null));

const total = passed + failures.length;
console.log(`\nConditioning phase authorship: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
