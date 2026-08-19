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
// NO `declare global` HERE — the tests project already declares `__DEV__`, and
// re-declaring it is a block-scoped redeclaration error. Every other suite in
// this directory assigns without declaring; this one now matches them.
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
  /** Drives the same typed fatigue constraint the app's own readiness door writes. */
  lowReadiness?: boolean;
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
      // ⚠ **THROUGH THE REAL DOOR — an `activeConstraints` fatigue declaration.**
      // Passing a ready-made `generationConstraints` object does NOT work:
      // `buildGeneratedMicrocycles` branches on `args.activeConstraints` being
      // truthy and `generateProgramLocally` defaults it to `[]`, which IS
      // truthy — so a hand-built `generationConstraints` is silently discarded
      // and the athlete looks perfectly fresh. Measured: `lowReadiness=false,
      // gcReadiness=null`. Recorded in STATUS_CONDITIONING; not fixed here.
      ...(args.lowReadiness
        ? {
          activeConstraints: [{
            id: 'wc136-readiness',
            type: 'fatigue',
            severity: 8,
            reasonLabel: 'Absolutely cooked',
            startDate: WEEK_MONDAY,
            expiresAt: '2026-07-19',
          }],
        }
        : {}),
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
    /* ⚠ **THE GAME DAY IS READ OFF THE BUILT WEEK, NOT OFF THE REQUEST
     * (2026-08-20).**
     *
     * This returned `args.gameDay` — the day the PROFILE asked for. That is the
     * request, not the result, and the two are not the same thing: an Off-season
     * week has no fixture however the profile is written.
     *
     * **MEASURED:** once Off-season stopped publishing phantom Game and Team
     * Training anchors, `[48h]` reported 11 breaches, every one of them
     * `Off-season/...`, all of the form "hard conditioning too close to the
     * game" — **in weeks containing no game at all**. The guard was measuring
     * proximity to a fixture that had just been correctly removed, and it read
     * exactly like the conditioning author had regressed.
     *
     * Reading the week's own `Game` workout makes the cell correct in every
     * phase instead of needing an Off-season special case: where there is no
     * fixture, `gameDay` is null, `gOffset` is null, and nothing is "inside the
     * window" — which is the truth. */
    const fixtureDay = week.find((w: any) =>
      w?.workoutType === 'Game' || w?.workoutType === 'Practice Match');
    return {
      built: true,
      exposures,
      strengthDays,
      gameDay: fixtureDay ? fixtureDay.dayOfWeek : null,
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
// ⚠ **ONE WORLD COULD NOT REACH THIS GATE AND THE MUTATION PROVED IT.** With a
// Saturday fixture the conditioning days are chosen earliest-first, and the
// earliest days are the FURTHEST from the game — so deleting the 48-hour rule
// changed nothing and the cell stayed green. A MIDWEEK fixture is what puts a
// conditioning day inside the window, so the claim is swept over fixture days
// rather than asserted on one convenient week.
const FIXTURE_SWEEP: Array<{ gymDays: string[]; gameDay: string }> = [];
for (const gymDays of [
  ['Monday', 'Wednesday', 'Friday'],
  ['Monday', 'Wednesday', 'Thursday', 'Friday'],
  ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
]) {
  for (const gameDay of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday']) {
    FIXTURE_SWEEP.push({ gymDays, gameDay });
  }
}
const sweepBreaches: string[] = [];
let sweepBuilt = 0;
let sweepHardSeen = 0;
let sweepInWindow = 0;
for (const world of FIXTURE_SWEEP) {
  for (const phase of ['Pre-season', 'Off-season']) {
    const w = build({
      phase, phaseWeek: 6, gymDays: world.gymDays, clubNights: [], gameDay: world.gameDay,
    });
    if (!w.built) continue;
    sweepBuilt += 1;
    for (const e of w.exposures) {
      const off = gOffset(e.dayOfWeek, w.gameDay);
      const insideWindow = off !== null && off >= -2 && off <= 1;
      if (insideWindow) sweepInWindow += 1;
      if (e.hard) sweepHardSeen += 1;
      if (e.hard && insideWindow) {
        sweepBreaches.push(`${phase}/${world.gymDays.length}d/game=${world.gameDay}`
          + ` day=${e.dayOfWeek} gOffset=${off} ${e.category}`);
      }
    }
  }
}
ok('[48h non-vacuity] the sweep built worlds, saw hard sessions AND saw exposures '
  + 'inside the 48-hour window — so the gate is reachable',
  sweepBuilt >= 20 && sweepHardSeen >= 10 && sweepInWindow >= 1,
  `built=${sweepBuilt} hard=${sweepHardSeen} inWindow=${sweepInWindow}`);
ok('[48h] no hard conditioning within 48 hours of the game (G-2, G-1, G, G+1)',
  sweepBreaches.length === 0,
  `${sweepBreaches.length} breaches: ${sweepBreaches.slice(0, 6).join(' | ')}`);

// ⚠ **THE WORLD HAS TO HAVE BUDGET LEFT OR THE RULE IS UNREACHABLE.** My first
// version used two club nights AND a fixture, which spends the whole minimum on
// anchors: the budget is zero, no day gets conditioning, and the cell passes
// whether or not the club-night rule exists. Deleting the rule reddened NOTHING.
// ONE club night and no fixture leaves budget to misplace.
const preseasonTwoClub = build({
  phase: 'Pre-season', phaseWeek: 3,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: ['Tuesday'],
  gameDay: null,
});
ok('[non-vacuity] the club-night world BUILDS, trains on its club night, and has budget',
  preseasonTwoClub.built
  && preseasonTwoClub.clubNights.length === 1
  && preseasonTwoClub.strengthDays.includes(preseasonTwoClub.clubNights[0])
  && preseasonTwoClub.exposures.length > 0,
  preseasonTwoClub.refusal
  ?? `club=${JSON.stringify(preseasonTwoClub.clubNights)} strength=${JSON.stringify(
    preseasonTwoClub.strengthDays)} exposures=${preseasonTwoClub.exposures.length}`);
ok('[club nights] the app never adds conditioning on a club-training day',
  preseasonTwoClub.exposures.every((e) => !preseasonTwoClub.clubNights.includes(e.dayOfWeek)),
  `club=${JSON.stringify(preseasonTwoClub.clubNights)} exposures=${JSON.stringify(
    preseasonTwoClub.exposures.map((e) => e.dayOfWeek))}`);

// ── THE ANCHOR CREDIT IS SPENT FIRST ───────────────────────────────────────
const preseasonAnchorHeavy = build({
  phase: 'Pre-season', phaseWeek: 3,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: ['Tuesday', 'Thursday'],
  gameDay: 'Saturday',
});
ok('[non-vacuity] the anchor-heavy week BUILDS with two club nights and a fixture',
  preseasonAnchorHeavy.built && preseasonAnchorHeavy.clubNights.length === 2,
  preseasonAnchorHeavy.refusal);
ok('[anchor credit] more anchors means FEWER app-authored exposures',
  preseasonAnchorHeavy.exposures.length < preseasonNoClub.exposures.length,
  `noclub=${preseasonNoClub.exposures.length} anchorheavy=${preseasonAnchorHeavy.exposures.length}`);

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

// ── WC-060: THE SHORTFALL LEAVES THE GYM DAYS WHEN IT MUST ────────────────
//
// TWO gym days that are BOTH club nights, no fixture. Every gym day is barred
// from carrying app conditioning (correctly), the two club nights supply two
// exposures against a minimum of three, and the only legal answer is a
// standalone equipment-free exposure on a day the athlete does not lift.
// **This exact shape refused for 8 worlds before WC-060's own "or conditioning"
// clause was honoured.**
const bothGymDaysAreClubNights = build({
  phase: 'Pre-season', phaseWeek: 6,
  gymDays: ['Tuesday', 'Thursday'],
  clubNights: ['Tuesday', 'Thursday'],
  gameDay: null,
});
// ⚠ ASSERTED ON THE GYM DAYS THE ATHLETE ASKED FOR, not on `strengthDays` —
// that field counts any day carrying rows, and the standalone conditioning this
// very cell is about carries rows, so it reported Mon and Fri as "strength" and
// made the non-vacuity claim false about its own success.
const CLUB_GYM_DAYS = [DAY_NUM.Tuesday, DAY_NUM.Thursday];
ok('[WC-060 non-vacuity] every gym day IS a club night in this world',
  bothGymDaysAreClubNights.built
  && CLUB_GYM_DAYS.every((d) => bothGymDaysAreClubNights.clubNights.includes(d)),
  bothGymDaysAreClubNights.refusal
  ?? `gym=${JSON.stringify(CLUB_GYM_DAYS)} `
  + `club=${JSON.stringify(bothGymDaysAreClubNights.clubNights)}`);
ok('[WC-060] the week still BUILDS — the shortfall is placed off the gym days',
  bothGymDaysAreClubNights.built, bothGymDaysAreClubNights.refusal);
ok('[WC-060] ...and that exposure is OUTSIDE the gym days entirely',
  bothGymDaysAreClubNights.exposures.length > 0
  && bothGymDaysAreClubNights.exposures.every((e) => !CLUB_GYM_DAYS.includes(e.dayOfWeek)),
  JSON.stringify(bothGymDaysAreClubNights.exposures));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[the readiness floor — Block Two, defence in depth]');
// ═══════════════════════════════════════════════════════════════════════════

// The SAME athlete and the SAME week, once healthy and once cooked.
//
// ⚠ **THESE CELLS DO NOT RED WHEN THE SCHEDULER'S OWN READINESS CLAUSE IS
// DELETED** — measured, 47 low-readiness worlds, 0 carrying hard conditioning
// without it, because the readiness owner upstream already strips it. They are
// kept as a BEHAVIOURAL statement of the Block Two rule, not as a receipt for
// that one line. The line's own status is documented where it lives.
const HARD_WORLD = {
  phase: 'Pre-season', phaseWeek: 6,
  gymDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  clubNights: [] as string[], gameDay: 'Saturday',
};
const healthyWeek = build(HARD_WORLD);
const lowRecoveryWeek = build({ ...HARD_WORLD, lowReadiness: true });
ok('[readiness non-vacuity] the healthy week BUILDS and DOES author a hard session',
  healthyWeek.built && healthyWeek.exposures.some((e) => e.hard),
  healthyWeek.refusal ?? JSON.stringify(healthyWeek.exposures));
ok('[readiness non-vacuity] the low-recovery week still BUILDS',
  lowRecoveryWeek.built, lowRecoveryWeek.refusal);
ok('[readiness] low recovery carries NO hard conditioning — same athlete, one flag',
  lowRecoveryWeek.exposures.every((e) => !e.hard),
  JSON.stringify(lowRecoveryWeek.exposures));
ok('[readiness] ...and the required conditioning is NOT deleted with it — a '
  + 'difficult quality is made achievable, never abandoned',
  lowRecoveryWeek.exposures.length > 0, JSON.stringify(lowRecoveryWeek.exposures));

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
