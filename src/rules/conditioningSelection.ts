/**
 * CONDITIONING SELECTION + COMPOSITION — the one owner that turns Sam's 52
 * signed templates into the athlete's conditioning and speed sessions.
 *
 * Stage B's switchover (prediction:
 * `docs/STAGE_B_STAGE2_SWITCHOVER_PREDICTION_2026-08-05.md`). Before this
 * module, the generation path authored its own doses in twelve places and
 * named sessions in a vocabulary nobody signed. The Bible is explicit:
 * "Conditioning doses are NOT defined in this Bible ... Doses come from the
 * templates sheet. A layer that invents its own conditioning dose is a
 * defect." This module never writes a number that did not come from the
 * sheet: quantities are read through `parseConditioningDose` — the single
 * ingress — and every athlete-visible word on the headline row is the
 * authored string verbatim.
 *
 * WHAT THIS MODULE DECIDES (selection policy — allowed):
 *   - which quality tabs serve each of the app's demand categories;
 *   - which tab rows count as tempo vs steady inside Aerobic Capacity
 *     (the one tab that serves two demand categories);
 *   - which template a given day gets, deterministically, with the same
 *     seeds the old path used (mini-cycle-stable index, else date hash).
 *
 * WHAT IT NEVER DECIDES (doses — forbidden): work, rest, sets, intensity,
 * session time. Those are the sheet's, field for field.
 *
 * L14: pure. No store, no clock beyond the dateStr it is handed, no React.
 */

import {
  CONDITIONING_TEMPLATES,
  LEGACY_CONDITIONING_FORMAT_MAP,
  MODALITY_RENDERING_RULES,
  type ConditioningModality,
  type ConditioningQuality,
  type ConditioningTemplate,
} from '../data/conditioningTemplates';
import {
  conditioningAthletePrescription,
  conditioningDisplayTitleForName,
  conditioningDisplayText,
} from './conditioningDisplay';
import {
  doseMidpoint,
  doseSeconds,
  parseConditioningDose,
} from './conditioningDose';
import type { SeasonPhase, WorkoutExercise, WorkoutType } from '../types/domain';
import type { Section18ConditioningRole } from './weeklyExposureContractV2';
import {
  rankSelectedFirst,
  type AutomaticCandidateRejection,
  type AutomaticCandidateTrace,
  type AutomaticProgrammingSelectionTrace,
} from './programmingSelectionTrace';
import { stableDecisionChoice, stableDecisionOrder } from './stableDecisionDiversity';

/* ── The surviving demand vocabulary ── */

/**
 * The app's conditioning demand categories (allocation vocabulary).
 *
 * `recovery_flush` is the SELECTION module's word and is deliberately not a
 * sixth member of the stored `Workout['conditioningCategory']`: the stored
 * typed energy system of a recovery session is still aerobic. What is
 * different is which of Sam's tabs serves it, and that is this module's
 * question — see `demandCategoryFor`.
 */
export type AthleteConditioningCategory =
  | 'aerobic_base'
  | 'tempo'
  | 'sprint'
  | 'vo2'
  | 'glycolytic'
  | 'recovery_flush'
  /** COD / deceleration — see `OffseasonConditioningCategory` for the ruling. */
  | 'cod_decel';

/** Placement tier — the eligibility engine's vocabulary, unchanged. */
export type ConditioningSelectionTier = 'A' | 'B-high' | 'B-low' | 'C';

/** The role a conditioning block plays in its session. Selection-time only. */
export type ConditioningRole = 'standalone' | 'finisher' | 'component';

/**
 * Which attached conditioning goes off-feet (R-339, Sam 2026-09-02, and Bible
 * :147 *"Hard running and top-end work pair with UPPER days. LOWER days pair
 * with off-leg conditioning"*):
 *
 * - a lower or full-body lift owns the legs, so its attached work is off-feet;
 * - in-season, every app-added exposure is off-feet — two club nights and the
 *   game already supply the running (*"any extra conditioning should be off
 *   leg"*);
 * - a flush is off-feet by nature;
 * - the one authored COD session is running mechanics and never a machine;
 * - otherwise (an upper day in Off-season or Pre-season) the session RUNS.
 *
 * The old policy sent every combined non-sprint session to a machine ("the
 * lift owns the legs"), which put twelve pre-season hard interval sessions on a
 * bike on upper-body days. No ruling recorded that policy; the Bible says the
 * opposite.
 */
export function combinedConditioningMustBeOffFeet(args: {
  readonly category: AthleteConditioningCategory;
  readonly strengthRegion: 'lower' | 'upper' | 'full' | undefined;
  readonly hasAvailableMachine: boolean;
  readonly seasonPhase?: SeasonPhase | null;
}): boolean {
  if (!args.hasAvailableMachine) return false;
  if (args.category === 'cod_decel') return false;
  if (args.category === 'recovery_flush') return true;
  if (args.seasonPhase === 'In-season') return args.category !== 'sprint';
  if (args.strengthRegion === 'lower' || args.strengthRegion === 'full') return true;
  return false;
}

/* ── Tier ← quality (placement policy, declared once) ── */

/**
 * Which tier each quality tab's sessions occupy in the eligibility engine.
 * Placement policy, not dose: A = maximal/sprint-family + glycolytic work,
 * B-high = aerobic power, B-low = aerobic capacity, C = flush/recovery.
 */
export const TIER_FOR_QUALITY: Readonly<Record<ConditioningQuality, ConditioningSelectionTier>> = {
  acceleration: 'A',
  top_end_speed: 'A',
  repeat_sprint: 'A',
  cod_decel: 'A',
  anaerobic: 'A',
  aerobic_power: 'B-high',
  aerobic_capacity: 'B-low',
  flush: 'C',
};

/* ── Category ← quality pools ── */

const byName = new Map<string, ConditioningTemplate>(
  CONDITIONING_TEMPLATES.map((template) => [template.name, template]),
);

function mustExist(names: readonly string[]): readonly string[] {
  for (const name of names) {
    if (!byName.has(name)) {
      throw new Error(
        `conditioningSelection names a template the sheet does not carry: "${name}" — `
        + 'the equality gate holds the sheet and module in lockstep, so this name is stale.',
      );
    }
  }
  return names;
}

/**
 * Aerobic Capacity is the one tab serving TWO demand categories. The split is
 * selection policy declared here once; the names are checked against the
 * sheet at module init so a Sam rename cannot leave a dangling reference.
 */
const TEMPO_CAPACITY_TEMPLATES = mustExist([
  '30:30 Controlled Tempo Blocks',
  '1 min On / 1 min Easy Tempo',
  '2 min On / 1 min Easy',
  'Extensive Tempo (100 m repeats)',
  'Aerobic Shuttles',
]);

const STEADY_CAPACITY_TEMPLATES = mustExist([
  'Continuous Aerobic Run',
  'Steady Blocks (3×8 min or 4×6 min)',
  'Long Aerobic Intervals',
  'Controlled 10–20 min Blocks',
  'Steady 5 min Blocks',
]);

function templatesOfQuality(...qualities: ConditioningQuality[]): ConditioningTemplate[] {
  return CONDITIONING_TEMPLATES.filter((template) => template.automaticSelection !== 'retired' && qualities.includes(template.quality));
}

/**
 * THE WAIST, MADE EXPLICIT AND TOTAL — every authored quality declares where it
 * can be REQUESTED from, or declares that it cannot.
 *
 * ## The defect this exists to make impossible
 *
 * Sam's sheet authors EIGHT conditioning qualities. The selector offers SIX
 * categories. The stored domain object offers FIVE. **8 -> 6 -> 5, narrowed at
 * two joints, and nothing reported the loss.** A quality with no category cannot
 * be asked for by any planner, so its templates are unreachable no matter how
 * many `case` branches exist — which is precisely what an attempt on 2026-08-13
 * measured: all four links wired, and the athlete still received ZERO COD
 * sessions.
 *
 * The app's own comment already knew the failure mode
 * (`section18OfferPlacement.ts:501-504`): *"an unknown category silently empties
 * `poolForCategory` and the selector throws on it."* **The code knew and nothing
 * enforced it.**
 *
 * ## Why a Record and not a switch
 *
 * A `switch` with a default is satisfied by silence; a total `Record` is not. The
 * compiler now refuses a new authored quality that nobody has decided how to
 * request — which is the enforcement the two narrowings never had. Sam's
 * standing instruction is to fix the class, not the instance.
 *
 * `cod_decel` used to be the missing waist. It now has one explicit category
 * and one combined session, so it cannot disappear merely because nobody gave
 * the planner a word for it.
 */
export const REQUESTABLE_CATEGORIES_FOR_QUALITY:
  Readonly<Record<ConditioningQuality, readonly AthleteConditioningCategory[]>> = {
  // Sprint-family qualities are reached through the one `sprint` category.
  acceleration: ['sprint'],
  top_end_speed: ['sprint'],
  repeat_sprint: ['sprint'],
  // One explicit request reaches the one combined COD session.
  cod_decel: ['cod_decel'],
  anaerobic: ['glycolytic'],
  aerobic_power: ['vo2'],
  // A LIST, NOT ONE VALUE, AND A CELL TAUGHT ME THAT. My first version mapped
  // this to `aerobic_base` alone and the reachability cell immediately named
  // five templates it could not reach: capacity work is SPLIT by two named
  // lists, so five of these sit in the `tempo` pool and the rest in
  // `aerobic_base`. The quality does not decide the category on its own — a
  // THIRD narrowing nobody had written down, found by asserting the map instead
  // of trusting it.
  aerobic_capacity: ['aerobic_base', 'tempo'],
  flush: ['recovery_flush'],
};

/** Qualities Sam authored that no planner can ask for. Empty is the goal. */
export const UNREQUESTABLE_AUTHORED_QUALITIES: readonly ConditioningQuality[] =
  (Object.keys(REQUESTABLE_CATEGORIES_FOR_QUALITY) as ConditioningQuality[])
    .filter((quality) => REQUESTABLE_CATEGORIES_FOR_QUALITY[quality].length === 0);

function poolForCategory(category: AthleteConditioningCategory): ConditioningTemplate[] {
  switch (category) {
    case 'aerobic_base':
      return STEADY_CAPACITY_TEMPLATES.map((name) => byName.get(name)!);
    case 'tempo':
      return TEMPO_CAPACITY_TEMPLATES.map((name) => byName.get(name)!);
    case 'vo2':
      return templatesOfQuality('aerobic_power');
    case 'glycolytic':
      return templatesOfQuality('anaerobic');
    case 'sprint':
      return templatesOfQuality('acceleration', 'top_end_speed', 'repeat_sprint');
    case 'recovery_flush':
      return templatesOfQuality('flush');
    case 'cod_decel':
      return templatesOfQuality('cod_decel');
  }
}

/** The pool a category resolves to, exposed so a cell can prove reachability. */
export function poolForCategoryPublic(
  category: AthleteConditioningCategory,
): ConditioningTemplate[] {
  return poolForCategory(category);
}

/**
 * WHICH DEMAND A PLAN ENTRY IS ACTUALLY ASKING FOR — one owner.
 *
 * The allocator has already DECIDED that a session is recovery: it stamps a
 * §18 role of `optional_recovery_aerobic` or `optional_flush`, drops the tier
 * to optional and the stress to low. That decision has to reach selection,
 * because Sam authored a whole quality tab for it — the switchover's own words
 * were "no cool-down row: recovery is the Flush tab's job."
 *
 * Before this function the decision did not reach here. A recovery session
 * asked for `aerobic_base`, drew from the steady aerobic-capacity pool, and
 * the athlete got a 50-minute continuous run in a slot the planner had marked
 * light. What used to hide it was the old code-authored name — 'Aerobic Flush'
 * — which said recovery in a word while the typed demand said aerobic base.
 * The authored names carry no such word, so the mismatch became visible.
 * Same class as the switchover's two unpredicted movements: A NAME CARRYING A
 * DECISION THAT SHOULD HAVE BEEN TYPED.
 */
export function demandCategoryFor(
  base: AthleteConditioningCategory | undefined,
  role: Section18ConditioningRole | undefined,
): AthleteConditioningCategory | undefined {
  if (role === 'optional_recovery_aerobic' || role === 'optional_flush') {
    return 'recovery_flush';
  }
  return base;
}

/** The tier pools the eligibility engine selects from. */
export function templatesForTier(tier: ConditioningSelectionTier): ConditioningTemplate[] {
  return CONDITIONING_TEMPLATES.filter(
    (template) => template.automaticSelection !== 'retired' && TIER_FOR_QUALITY[template.quality] === tier,
  );
}

/* ── Modality renderability (read from the authored notes) ── */

/**
 * Which modalities a template's authored `modalityNotes` prose admits.
 * The notes are the only place per-row renderability is authored (a known
 * representation gap, same as `equipmentVocabulary`'s reader) — this reader
 * is deliberately conservative and mirrors Sam's own wording.
 */
/**
 * THE LONGEST WORK INTERVAL A ROW PRESCRIBES, in minutes — READ AT THE TOP.
 *
 * `workPeriod` is authored prose ("6–8 min", "8 min easy (or one continuous 8–10
 * min block on Ski/Row)"), so this reads every minute figure in it and takes the
 * LARGEST. The top of a range is what can actually ship, and the cap is a HARD
 * one — a row offering "8–10 min" can put ten minutes in front of an athlete.
 *
 * Second-based rows ("10 s hard", "≈6 s (20 m build)") yield null: they are not
 * minute-scale work and the cap does not reach them.
 */
export function longestWorkIntervalMinutes(template: ConditioningTemplate): number | null {
  if (template.intervalPrescription) return template.intervalPrescription.workSeconds / 60;
  // Selection safety reads the signed dose, never the athlete-facing wording.
  // The display may resolve an authored range to one clean instruction, but
  // that must not relax the largest interval the template is capable of.
  const found = [...String(template.workPeriod ?? '').matchAll(/(\d+)\s*(?:[–-]\s*(\d+)\s*)?min/g)]
    .flatMap((match) => [Number(match[1]), match[2] ? Number(match[2]) : Number.NaN])
    .filter((value) => Number.isFinite(value));
  return found.length > 0 ? Math.max(...found) : null;
}

/**
 * THE ERG CAP, ENFORCED AT LAST (census C3).
 *
 * Sam, Bible `:1297` and repeated per machine at `:1401` (Rower) and `:1402`
 * (Ski): *"Work intervals longer than 8 minutes are Run or Bike only. Ski, Row
 * and Air Bike have a HARD CAP of 8 minutes IN ANY ONE WORK INTERVAL... Anything
 * longer than 8 minutes must be Run or Bike."*
 *
 * The cap was fully encoded as data — `ergCapMinutes: 8`, `uncappedModalities`,
 * `excludedModalities` — and read by NOTHING but a test, while
 * `renderableModalities` decided Ski/Row from a prose regex that could not see
 * it. So a continuous ten-minute Ski or Row block could ship: over the ceiling,
 * on two machines he barred by name.
 *
 * "IN ANY ONE WORK INTERVAL" COVERS A CONTINUOUS BLOCK — the largest interval a
 * row can have. I first read a continuous block as exempt; that distinction is
 * nowhere in his text and would have dismissed the defect.
 */
function cappedErgModalities(
  template: ConditioningTemplate,
  modalities: ConditioningModality[],
): ConditioningModality[] {
  const longest = longestWorkIntervalMinutes(template);
  if (longest === null || longest <= ERG_CAP_MINUTES) return modalities;
  return modalities.filter((modality) => !ERG_CAPPED_MODALITIES.has(modality));
}

/**
 * SAM'S CAP, READ FROM WHERE HE AUTHORED IT — not re-typed here.
 *
 * The first cut of this enforcer DID re-type it (`= 8`, and the three machines
 * as a literal set), which left `ergCapMinutes` and `excludedModalities` still
 * "read by nothing but a test" — the exact complaint census C3 was raising.
 * Two owners for one number is how a cap drifts from the sheet that authored
 * it: change `erg_interval_cap` and the enforcement would have silently kept
 * the old ceiling. The rule row is the owner; this reads it.
 *
 * `erg_interval_cap` is a required row, so its absence is a data defect and not
 * a case to degrade quietly through — a missing cap must not read as "no cap".
 */
/**
 * THE SET/BLOCK CAP, ENFORCED AT SELECTION TIME (census C11).
 *
 * Sam: short-intermittent high-%MAS work keeps the set/block to ~4-5 minutes,
 * *"enforced at selection time, not written into the dose"*
 * (`CONDITIONING_FRAMEWORK_SAM_2026-07-25.md:58`, `:113`, `:127`). He confirmed
 * it needed building: *"okay it needs to be checked"*.
 *
 * THE PROPERTY EXISTED AND HAD NO READER — `set_length_max_4_5_min` appeared
 * five times in the data and nothing consulted it. Same shape as `ergCapMinutes`
 * before C3: authored, shipped, inert.
 *
 * ⚠ THE UNIT IS THE BLOCK, NOT THE WORK INTERVAL, AND READING THE WRONG ONE WAS
 * THE FIRST THING I TRIED. All three templates carrying this property use
 * SECOND-scale intervals ("15 s hard", "30 s hard", "40 s hard"), so
 * `longestWorkIntervalMinutes` returns null for every one of them and a filter
 * built on it would have been permanently inert. A BLOCK is
 * rounds x (work + rest) — for "8 rounds x 2-3 blocks" at 15s/15s that is four
 * minutes, which is exactly what his cap is about.
 */
const SET_BLOCK_CAP_MINUTES = 5;

/** Seconds in an authored period string ("15 s hard", "2 min"), or null. */
function periodSeconds(text: string | undefined): number | null {
  if (!text) return null;
  const sec = /(\d+)\s*s\b/.exec(text);
  if (sec) return Number(sec[1]);
  const min = /(\d+)\s*min/.exec(text);
  if (min) return Number(min[1]) * 60;
  return null;
}

/**
 * The length of ONE block, in minutes: rounds x (work + rest).
 *
 * `setsRounds` is authored prose. Two of the three templates state the answer
 * outright — "(5 min per block)" — and that stated number WINS, because a
 * derivation that disagreed with Sam's own text would be re-authoring it.
 */
export function blockLengthMinutes(template: ConditioningTemplate): number | null {
  const stated = /\(([\d.]+)\s*min per block\)/i.exec(template.setsRounds ?? '');
  if (stated) return Number(stated[1]);
  const rounds = /(\d+)\s*rounds?/i.exec(template.setsRounds ?? '');
  const work = periodSeconds(template.workPeriod);
  const rest = periodSeconds(template.restPeriod);
  if (!rounds || work === null || rest === null) return null;
  return (Number(rounds[1]) * (work + rest)) / 60;
}

const ERG_CAP_RULE = MODALITY_RENDERING_RULES.find((rule) => rule.id === 'erg_interval_cap');
if (ERG_CAP_RULE?.ergCapMinutes === undefined || ERG_CAP_RULE.excludedModalities === undefined) {
  throw new Error('conditioning_erg_interval_cap_rule_missing');
}
const ERG_CAP_MINUTES: number = ERG_CAP_RULE.ergCapMinutes;
const ERG_CAPPED_MODALITIES: ReadonlySet<ConditioningModality> =
  new Set<ConditioningModality>(ERG_CAP_RULE.excludedModalities);

/** Explicit eligibility, intersected with the resolved prescription's safety
 * limits. Notes can explain a restriction; they cannot grant permission. */
export function renderableModalities(template: ConditioningTemplate): ConditioningModality[] {
  const permitted = [...template.permittedModalities].filter(modality =>
    !template.properties.includes('no_ski_row_flywheel') || (modality !== 'ski' && modality !== 'row'));
  return template.quality === 'flush' ? permitted : cappedErgModalities(template, permitted);
}

export function rendersOffFeet(template: ConditioningTemplate): boolean {
  return renderableModalities(template).some((modality) => modality !== 'run');
}

export function rendersOnRun(template: ConditioningTemplate): boolean {
  return renderableModalities(template).includes('run');
}

/* ── Deterministic seeds (same as the retired path) ── */

export function conditioningSelectionHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/* ── Selection ── */

export interface ConditioningSelectionArgs {
  readonly category: AthleteConditioningCategory;
  readonly dateStr: string;
  /** Explicit scheduler quality request; repeat sprint cannot stand in for top speed. */
  readonly requestedSpeedQualities?: readonly ('acceleration' | 'top_end_speed')[];
  /** Block-stable rotation: stable within a mini-cycle, rotates at the boundary. */
  readonly miniCycleNumber?: number;
  /** Occurrence of this quality/category in the authored week, not call count. */
  readonly seatIndex?: number;
  /** Carry the specialist's choice through adapters when it is still feasible. */
  readonly preferredTemplateName?: string;
  /** Accepted selection facts, never a preview/call-count cursor. */
  readonly selectionContext?: {
    readonly blockStartISO: string;
    readonly history: readonly BlockConditioningSelection[];
  };
  /** The block must render off feet (run load caps, lower-body pairing). */
  readonly offFeet?: boolean;
  /** The athlete has no ergs — the template must render on run/bodyweight. */
  readonly runOnly?: boolean;
  /**
   * The machine modalities the athlete actually has. When present, a
   * template must render on run or on an owned machine to be selectable,
   * and an off-feet requirement must be satisfiable on an OWNED machine.
   */
  readonly availableMachines?: readonly ConditioningModality[];
  /** The week carries NO team training (lifts the availability gate). */
  readonly noTeamTrainingWeek?: boolean;
  readonly role?: ConditioningRole;
  /** Context copied into the compiler trace. It never participates in selection. */
  readonly traceContext?: {
    readonly weekStartISO: string;
    readonly phase: string;
    readonly experience: string | null;
    readonly injuries: readonly string[];
    readonly daysToGame: number | null;
    readonly equipment: readonly string[];
  };
}

/** One chosen identity per conditioning seat; dose remains owned by the sheet. */
export interface BlockConditioningSelection {
  readonly blockStartISO: string;
  readonly category: AthleteConditioningCategory;
  readonly seatIndex: number;
  readonly templateName: string;
}

/**
 * WHERE COD/DECEL IS ALLOWED AT ALL — SAM'S RULING, 2026-08-13, AS ONE RULE.
 *
 * HIS WORDS: *"So the athlete can only do COD work in late off season (after
 * first 4 weeks of off season), in christmas break or during pre season if no
 * team trainings (i.e some people play for cash a few hours away from home so
 * they don't train with the team). No COD required in season for anyone."*
 * And the premise underneath it: *"off season means NO team training, the
 * christmas break is essentially an off season inside pre season - there is
 * never team trainings here so these are the only times COD may be useful"*.
 *
 * WRITTEN AS ONE RULE, NOT THREE PHASE BRANCHES, BECAUSE HE ASKED FOR THAT AND
 * BECAUSE IT IS TRUE: no team training this week AND not in season AND not the
 * first four weeks of off-season. The three cases he named fall out of it —
 * late off-season, pre-season without a club, and the Christmas break, which
 * needs no case of its own precisely because it IS "pre-season with no team
 * training this week". A phase list would have needed a fourth branch and a new
 * phase; this needs neither.
 *
 * "AFTER FIRST 4 WEEKS" IS ALREADY THE CLOCK'S VOCABULARY — `early_offseason`
 * is weeks 1-2 and `mid_offseason` 3-4 (`seasonPhaseClock.ts:72-74`), so
 * `late_offseason` IS "after the first four weeks". Nothing new is minted.
 * The reason the first four weeks are excluded is RECOVERY, not team training.
 *
 * CLOSED WHEN THE PHASE IS UNKNOWN. COD is the category Sam calls "cut first";
 * offering it because we could not tell what phase an athlete is in would be
 * the least-informed state behaving as the most confident one.
 */
/*
 * WRITTEN AS AN ALLOWLIST, AND A SURVIVING MUTANT IS WHY.
 *
 * The first cut opened with `if (seasonPhase === 'In-season') return false;` —
 * the clearest line in Sam's ruling, spelled out. Deleting that whole branch
 * changed NOTHING and no cell reddened: in-season is neither of the two
 * permitted phases, so it was already refused by the closing `return false`.
 * The branch was decoration, and a cell asserting "in season is refused" passed
 * with or without it.
 *
 * So the refusal is stated the only way that can rot: as the DEFAULT. Every
 * phase is refused unless it is named here, which means a new phase, a typo, or
 * a missing value is CLOSED rather than open — and the mutation that flips this
 * default reds immediately. "No COD required in season for anyone" is now held
 * by the shape of the function instead of by a line that could be deleted
 * without consequence.
 */
export function codDecelPermitted(args: {
  /** Does THIS WEEK carry team training — not "does this athlete have a club". */
  readonly weekHasTeamTraining: boolean;
  readonly seasonPhase: string | null | undefined;
  readonly offseasonSubphase: string | null | undefined;
}): boolean {
  // The club does the change of direction. True in every phase, so it leads.
  if (args.weekHasTeamTraining) return false;
  // Off-season: only past the first four weeks — those are recovery, and that,
  // not team training, is why they are excluded.
  if (args.seasonPhase === 'Off-season') return args.offseasonSubphase === 'late_offseason';
  // Pre-season without a club — his "some people play for cash a few hours away
  // from home". The Christmas break arrives here too, as pre-season whose week
  // has had its team training cleared.
  if (args.seasonPhase === 'Pre-season') return true;
  // IN-SEASON, AND EVERY PHASE NOBODY HAS INVENTED YET.
  return false;
}

/** Parsed low end of the authored total session time, or null. */
function totalMinutesLow(template: ConditioningTemplate): number | null {
  const parsed = parseConditioningDose(template.totalSessionTime);
  if (!parsed.ok) return null;
  const seconds = doseSeconds(parsed.quantity);
  return seconds ? seconds.min / 60 : null;
}

/** Role caps: a finisher/component must not dominate its session. */
const ROLE_MAX_MINUTES: Readonly<Record<ConditioningRole, number | null>> = {
  standalone: null,
  finisher: 16,
  component: 32,
};

/**
 * Deterministically select the authored template serving a demand category.
 * Filters are selection policy; the returned template is Sam's, untouched.
 */
export function selectConditioningTemplateWithTrace(
  args: ConditioningSelectionArgs,
): { readonly template: ConditioningTemplate; readonly trace: AutomaticProgrammingSelectionTrace } {
  const role = args.role ?? 'standalone';
  const pool = poolForCategory(args.category);

  const filters: Array<(template: ConditioningTemplate) => boolean> = [
    (template) => args.category !== 'sprint' || !args.requestedSpeedQualities
      || (args.requestedSpeedQualities as readonly string[]).includes(template.quality),
    // Sam's ruling 5 (2026-08-05): a warm-up dose rides on a session the
    // athlete is already doing and is never a session in its own right. The
    // gate is the SHEET's authored property, read here — not a name filter.
    (template) =>
      !template.properties.includes('warmup_rider_only') || role !== 'standalone',
    (template) =>
      !template.properties.includes('finisher_role_only') || role === 'finisher',
    (template) =>
      !template.properties.includes('fallback_only') || args.runOnly === true,
    // C11: a template that declares the 4-5 min set cap must actually honour it.
    // The property was authored and read by nothing until 2026-08-13.
    (template) => {
      if (!template.properties.includes('set_length_max_4_5_min')) return true;
      const block = blockLengthMinutes(template);
      return block === null || block <= SET_BLOCK_CAP_MINUTES;
    },
    (template) =>
      !template.properties.includes('availability_gate_no_team_training')
      || args.noTeamTrainingWeek === true,
  ];
  const machineOwned = (modality: ConditioningModality): boolean =>
    args.availableMachines === undefined || args.availableMachines.includes(modality);
  if (args.offFeet) {
    filters.push((template) =>
      // An off-feet delivery cannot honestly retain an identity that promises
      // running. Continuous Aerobic Run is authored to permit Bike, but an
      // injured athlete was still shown "Run" beside "limit running". Choose
      // another same-quality authored machine template instead.
      !/\brun\b/i.test(template.name) &&
      renderableModalities(template).some((m) => m !== 'run' && machineOwned(m)));
  } else if (args.availableMachines !== undefined) {
    filters.push((template) =>
      renderableModalities(template).some((m) => m === 'run' || machineOwned(m)));
  }
  if (args.runOnly) filters.push(rendersOnRun);
  const cap = ROLE_MAX_MINUTES[role];
  const withinCap = (template: ConditioningTemplate): boolean => {
    if (cap === null) return true;
    const minutes = totalMinutesLow(template);
    return minutes === null || minutes <= cap;
  };

  let candidates = pool.filter((template) => filters.every((filter) => filter(template)));
  // P14: owning more machines does not make a template better. The feasibility
  // filter above establishes an actual usable off-leg route; rotation keeps
  // every such candidate instead of narrowing to the largest machine count.

  // A role cap is a preference, not a wall — when it empties the pool the
  // authored session runs long rather than a dose being invented short.
  const capped = candidates.filter(withinCap);
  if (capped.length > 0) candidates = capped;
  if (candidates.length === 0) throw new Error(`conditioning_no_eligible_template:${args.category}:${JSON.stringify({ date: args.dateStr, offFeet: args.offFeet, runOnly: args.runOnly, machines: args.availableMachines, role })}`);

  const preferred = candidates.find(template => template.name === args.preferredTemplateName);
  let selected: ConditioningTemplate;
  let selectionReason: string;
  if (preferred) {
    selected = preferred;
    selectionReason = 'preferred_specialist_identity';
  } else if (args.selectionContext) {
    const { blockStartISO, history } = args.selectionContext;
    const seat = args.seatIndex ?? 0;
    const relevant = history.filter(entry => entry.category === args.category
      && entry.blockStartISO <= blockStartISO);
    const recorded = relevant.find(entry => entry.blockStartISO === blockStartISO && entry.seatIndex === seat);
    const restored = candidates.find(template => template.name === recorded?.templateName);
    if (restored) {
      selected = restored;
      selectionReason = 'restored_recorded_selection';
    } else {
    // Choose the least-recently served QUALITY before the template within it.
    // Skipped block numbers and unrelated qualities never consume a turn.
    // Earlier seats in this very week are supplied explicitly by the boundary.
    const latest = (matches: (entry: BlockConditioningSelection) => boolean): string =>
      relevant.filter(matches).map(entry => entry.blockStartISO).sort().at(-1) ?? '';
    const qualityLast = (quality: ConditioningQuality): string => latest(entry =>
      resolveTemplateByName(entry.templateName)?.quality === quality);
    const nameLast = (name: string): string => latest(entry => entry.templateName === name);
      const stable = stableDecisionOrder(
        candidates,
        `${blockStartISO}|${args.category}|${seat}|${role}`,
        (template) => template.name,
      );
      selected = stable.sort((a, b) => qualityLast(a.quality).localeCompare(qualityLast(b.quality))
        || nameLast(a.name).localeCompare(nameLast(b.name)))[0];
      selectionReason = 'least_recent_quality_then_template';
    }
  } else {
    const decisionIdentity = args.miniCycleNumber !== undefined
      ? `${Math.max(1, args.miniCycleNumber)}|${args.category}|${Math.max(0, args.seatIndex ?? 0)}|${role}`
      : `${args.dateStr}|${args.category}|${role}`;
    selected = stableDecisionChoice(candidates, decisionIdentity, (template) => template.name)!;
    selectionReason = 'deterministic_rotation_without_recorded_history';
  }

  const candidateSet = new Set(candidates.map((candidate) => candidate.name));
  const routeSet = new Set(pool.map((candidate) => candidate.name));
  const history = args.selectionContext?.history ?? [];
  // Mutation cells deliberately inject schema-incomplete candidates to prove
  // an earlier eligibility gate rejects them. The observer must describe that
  // rejection without making the rejected row executable just to inspect it.
  const traceModalities = (template: ConditioningTemplate): ConditioningModality[] =>
    Array.isArray(template.permittedModalities) ? renderableModalities(template) : [];
  const candidateRows: AutomaticCandidateTrace[] = CONDITIONING_TEMPLATES.map((template) => {
    const rejectedBy: AutomaticCandidateRejection[] = [];
    if (template.automaticSelection === 'retired') rejectedBy.push('manual_or_special_use_only');
    else if (!routeSet.has(template.name)) rejectedBy.push('wrong_movement_or_quality');
    else if (!candidateSet.has(template.name)) {
      const modes = traceModalities(template);
      const owned = (mode: ConditioningModality) => args.availableMachines === undefined
        || args.availableMachines.includes(mode);
      if ((args.offFeet && !modes.some((mode) => mode !== 'run' && owned(mode)))
        || (args.runOnly && !modes.includes('run'))
        || (args.availableMachines !== undefined && !modes.some((mode) => mode === 'run' || owned(mode)))) {
        rejectedBy.push('equipment');
      } else {
        rejectedBy.push('role');
      }
    }
    const uses = history.filter((entry) => entry.templateName === template.name);
    const sameBlockUses = uses.filter((entry) => entry.blockStartISO === args.selectionContext?.blockStartISO).length;
    const relevantBlocks = [...new Set(history.map((entry) => entry.blockStartISO))].sort().reverse();
    const lastBlock = uses.map((entry) => entry.blockStartISO).sort().at(-1) ?? null;
    const blocksSince = lastBlock === null ? null : relevantBlocks.indexOf(lastBlock);
    return {
      name: template.name,
      eligible: candidateSet.has(template.name),
      rejectedBy,
      rank: null,
      score: {
        phasePriority: 0,
        athletePreference: template.name === args.preferredTemplateName,
        recentUsage: uses.filter((entry) => relevantBlocks.slice(0, 3).includes(entry.blockStartISO)).length,
        annualUsage: uses.length,
        weeksOrBlocksSinceUse: blocksSince < 0 ? null : blocksSince,
        weeklyUsage: sameBlockUses,
      },
      modalities: traceModalities(template),
    };
  });
  const context = args.traceContext;
  return {
    template: selected,
    trace: {
      schemaVersion: 1,
      decisionId: `conditioning:${args.dateStr}:${args.category}:${args.seatIndex ?? 0}`,
      kind: 'conditioning_template',
      owner: 'conditioningSelection',
      need: {
        dateISO: args.dateStr,
        weekStartISO: context?.weekStartISO ?? args.dateStr,
        dayOfWeek: new Date(`${args.dateStr}T12:00:00`).getDay(),
        phase: context?.phase ?? 'unknown',
        movementOrQuality: args.category,
        role,
        seatIndex: args.seatIndex ?? 0,
        equipment: context?.equipment ?? [...(args.availableMachines ?? [])],
        experience: context?.experience ?? null,
        injuries: context?.injuries ?? [],
        daysToGame: context?.daysToGame ?? null,
      },
      candidates: rankSelectedFirst(candidateRows, selected.name),
      selected: selected.name,
      selectionReason,
    },
  };
}

/** Compatibility wrapper for callers that need only the selected template. */
export function selectConditioningTemplate(args: ConditioningSelectionArgs): ConditioningTemplate {
  return selectConditioningTemplateWithTrace(args).template;
}

/**
 * The off-feet rendering of a session: an authored template of the SAME
 * quality that renders on a machine. Replaces the retired parallel dose
 * library (`switchToOffFeetModality`) — the run cap now swaps templates
 * inside the authored sheet instead of re-authoring the dose. Null when the
 * quality has no off-feet row (the sprint family — which is exactly the set
 * the old guard refused to convert).
 */
export function offFeetAlternative(
  name: string,
  dateStr: string,
  availableMachines?: readonly ConditioningModality[],
): ConditioningTemplate | null {
  const template = resolveTemplateByName(name);
  if (!template) return null;
  const pool = CONDITIONING_TEMPLATES.filter(
    (candidate) => candidate.automaticSelection !== 'retired' && candidate.quality === template.quality && renderableModalities(candidate)
      .some(modality => modality !== 'run' && (availableMachines === undefined || availableMachines.includes(modality))),
  );
  if (pool.length === 0) return null;
  // A usable selected template keeps its identity; changing modality alone
  // must not silently rotate the session to another prescription.
  return pool.find(candidate => candidate.name === template.name)
    ?? stableDecisionChoice(pool, `${dateStr}|off_feet|${template.quality}`, (candidate) => candidate.name);
}

/* ── Name resolution for stored/legacy content ── */

/**
 * Resolve a session name to an authored template: the authored vocabulary
 * first, then Sam's legacy-format map. `null` means the name is not the
 * template vocabulary's to render (stored legacy content keeps its words —
 * rendering them is not inventing a dose).
 */
export function resolveTemplateByName(name: string): ConditioningTemplate | null {
  const direct = byName.get(name);
  if (direct) return direct;
  // Visible projections carry Sam's plain athlete-facing title while storage
  // keeps the workbook identity. A reader handed the visible title must still
  // resolve the same authored template; this is the one reverse bridge and it
  // compares through the display owner rather than maintaining an alias table.
  const displayed = CONDITIONING_TEMPLATES.find(
    (template) => conditioningDisplayTitleForName(template.name) === name,
  );
  if (displayed) return displayed;
  const legacy = LEGACY_CONDITIONING_FORMAT_MAP.find((entry) => entry.legacyName === name);
  if (legacy && legacy.resolution.kind === 'template') {
    return byName.get(legacy.resolution.templateName) ?? null;
  }
  return null;
}

/**
 * The authored template whose ordered section this visible row is. A combined
 * session (R-331 Change of Direction) renders its typed sections as rows and
 * has no row carrying the template's own name; the section identity is the
 * typed link back, so audits credit the session it belongs to.
 */
export function resolveTemplateBySectionName(name: string): ConditioningTemplate | null {
  return CONDITIONING_TEMPLATES.find((template) =>
    template.sections?.some((section) => section.name === name)) ?? null;
}

/** Read-ingress lift for history written before flush demand was carried into
 * the recorder. Preserve names and blocks; split the old aerobic seats into
 * their actual categories without writing or deleting the athlete's history. */
export function normalizeConditioningSelectionHistory(history: readonly BlockConditioningSelection[]): BlockConditioningSelection[] {
  const oldBlocks = new Set(history.filter(entry => entry.category === 'aerobic_base'
    && resolveTemplateByName(entry.templateName)?.quality === 'flush').map(entry => entry.blockStartISO));
  return history.map(entry => {
    if (!oldBlocks.has(entry.blockStartISO)) return entry;
    const category = resolveTemplateByName(entry.templateName)?.quality === 'flush' ? 'recovery_flush' : entry.category;
    const siblings = history.filter(other => other.blockStartISO === entry.blockStartISO
      && (resolveTemplateByName(other.templateName)?.quality === 'flush' ? 'recovery_flush' : other.category) === category)
      .sort((a, b) => a.seatIndex - b.seatIndex);
    return { ...entry, category, seatIndex: siblings.indexOf(entry) };
  });
}

/* ── Composition (dose parse → rows) ── */

function nowISO(): string {
  return new Date().toISOString();
}

function conditioningRow(
  id: string,
  name: string,
  order: number,
  sets: number,
  rest: number,
  notes?: string,
  authoredAtISO?: string,
): WorkoutExercise {
  const now = authoredAtISO ?? nowISO();
  return {
    id,
    // THE EMITTER'S OWN MARKER (Stage B, rulings 4 + the switchover).
    // `isComposedPrescriptionRow` asks how a row was BUILT, never whether its
    // words happen to be registered — that would make the copy sheet the
    // authority over content. Every row this owner emits is named by an
    // authored source: the headline carries Sam's template name verbatim, the
    // warm-up carries his signed sentence. So the owner says so, once, here.
    nameProvenance: 'authored',
    // THE ROLE, SET AT THE ONE OWNER THAT EMITS THESE ROWS (Sam, 2026-08-13:
    // *"yes it should be its own thing and not count as a strength exercise"*).
    //
    // EXEMPTING THE ROLE ALONE WOULD HAVE CHANGED NOTHING AND I PROVED THAT
    // FIRST: `participatesInCounting` is `!row.role || !EXEMPT.has(row.role)`,
    // so an UNTAGGED row counts whatever the exempt set says — and these rows
    // carried no role at all. 550 of 570 generated rows are untagged, which is
    // why the default is the real hazard. Both halves are needed; either alone
    // is inert.
    role: 'conditioning',
    workoutId: '',
    exerciseId: id,
    exerciseOrder: order,
    prescribedSets: sets,
    prescribedRepsMin: 1,
    prescribedRepsMax: 1,
    restSeconds: rest,
    notes,
    exercise: {
      id,
      name,
      description: notes || name,
      muscleGroups: [],
      exerciseType: 'Cardio' as const,
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as const,
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** Sets for the headline row: the authored governing quantity, or 1. */
function headlineSets(template: ConditioningTemplate, opts: Pick<ComposeOptions, 'weekInBlock'> = {}): number {
  const parsed = parseConditioningDose(conditioningAthletePrescription(
    template,
    undefined,
    undefined,
    { weekInBlock: opts.weekInBlock },
  ).setsRounds);
  if (!parsed.ok) return 1;
  return Math.max(1, Math.round(doseMidpoint(parsed.quantity)));
}

/**
 * The LOW END of the authored quantity — a deload's reduced dose.
 *
 * Never below the sheet's own `min`, and never a number the sheet does not
 * contain. Falls back to `headlineSets` when the dose is a single value, so a
 * template with no range is simply not reduced.
 */
function headlineSetsLow(template: ConditioningTemplate): number {
  const parsed = parseConditioningDose(template.setsRounds);
  if (!parsed.ok) return headlineSets(template);
  return Math.max(1, Math.round(parsed.quantity.min));
}

/** Rest seconds for the headline row: the authored rest, when it is a time. */
function headlineRest(template: ConditioningTemplate): number {
  // Stored execution timing remains owned by the signed prescription. A
  // display phrase such as "Start every 2 min" is guidance, not 120 seconds
  // of recovery to write into the workout row.
  const parsed = parseConditioningDose(template.restPeriod);
  if (!parsed.ok) return 0;
  const seconds = doseSeconds(parsed.quantity);
  return seconds ? Math.round((seconds.min + seconds.max) / 2) : 0;
}

function joinNotes(...lines: Array<string | false | null | undefined>): string {
  return lines
    .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
    .join('\n');
}

/**
 * THE WARM-UP SENTENCE — Sam's signed words, 2026-08-05 (ruling 4,
 * `docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md`).
 *
 * The switchover shipped a bare `Warm-up` row with no copy, and said so: the
 * walker's `L-P2 SIGNED WORDS` red stood over exactly this row. Sam authored
 * the sentence; it lives HERE, at the emitter, and `rules/projectionCopy.ts`
 * imports it to register, so the words exist once and the sheet cannot drift
 * from what ships.
 */
export const CONDITIONING_WARMUP_COPY_ID = 'part.row.conditioning.warmup';

/** The warm-up row's name — the first word of the sentence Sam signed. */
export const CONDITIONING_WARMUP_ROW_NAME = 'Warm-up';

export const CONDITIONING_WARMUP_COPY =
  '10 min build-up\n'
  + 'Start with an easy jog, then progress into run-throughs, increasing the intensity as you go.';

export interface ComposeOptions {
  /** Reconstruction supplies the original timestamp; no fresh clock in replay. */
  readonly authoredAtISO?: string;
  readonly idPrefix?: string;
  readonly orderBase?: number;
  /** Skip the structural warm-up row (combined days warm up on the lift). */
  readonly omitWarmup?: boolean;
  /**
   * ── THE AUTHORED LOW END, FOR A DELOAD ────────────────────────────────────
   *
   * Sam, 2026-08-17: a deload may *"reduce sprint VOLUME using an authored
   * legal dose"*. `headlineSets` normally prescribes the MIDPOINT of the
   * sheet's range; this asks for its MINIMUM instead.
   *
   * **It is the sheet's own number or nothing.** `10 m Acceleration Reps` is
   * authored `6–10 reps`, so the ordinary week gets 8 and a deload gets 6 — the
   * same template, the same quality, one authored rung lower. When the sheet
   * states a single value there is no lower dose and the row is unchanged,
   * which is the honest answer rather than an invented one.
   */
  readonly authoredMinimumDose?: boolean;
  /** 1-based build week used to resolve exact prescription ladders. */
  readonly weekInBlock?: number;
  /**
   * The athlete's measured MAS in km/h, for the `Your pace` line. Optional and
   * OMITTED rather than guessed: an athlete with no recorded time trial is told
   * their intensity band and no pace at all.
   */
  readonly masKmh?: number | null;
}

/**
 * The template as rows. One structural `Warm-up` row with Sam's approved copy,
 * then the headline row: authored identity, materialised count/rest and the
 * approved athlete projection. No cool-down row — recovery is the Flush tab's
 * job.
 */
export function composeConditioningRows(
  template: ConditioningTemplate,
  dateStr: string,
  opts: ComposeOptions = {},
): WorkoutExercise[] {
  const prefix = opts.idPrefix ?? `cond-${dateStr}`;
  const base = opts.orderBase ?? 1;
  const rows: WorkoutExercise[] = [];
  if (!opts.omitWarmup && template.quality !== 'flush') {
    rows.push(conditioningRow(
      `${prefix}-warmup`, CONDITIONING_WARMUP_ROW_NAME, base, 1, 0,
      CONDITIONING_WARMUP_COPY,
      opts.authoredAtISO,
    ));
  }
  if (template.sections?.length) {
    for (const section of template.sections) {
      const parsedRest = parseConditioningDose(section.recovery);
      const restSeconds = parsedRest.ok ? doseSeconds(parsedRest.quantity) : null;
      rows.push(conditioningRow(
        `${prefix}-section-${rows.length}`,
        section.name,
        base + rows.length,
        section.prescribedReps,
        restSeconds ? Math.round((restSeconds.min + restSeconds.max) / 2) : 0,
        [
          `Work: ${section.work}`,
          `Recovery: ${section.recovery}`,
          `Reps: ${section.reps}`,
          `Intensity: ${section.intensity}`,
          section.cue,
        ].join('\n'),
        opts.authoredAtISO,
      ));
    }
    return rows;
  }
  const resolvedSetsRounds = template.intervalPrescription?.rounds ?? (opts.authoredMinimumDose
    ? headlineSetsLow(template)
    : headlineSets(template, opts));
  rows.push(
    conditioningRow(
      `${prefix}-main`,
      template.name,
      base + rows.length,
      resolvedSetsRounds,
      template.intervalPrescription?.recoverySeconds ?? headlineRest(template),
      /* ⚠ **THE SIX-FIELD PASTE IS GONE — SAM, 2026-08-20.** This built the
       * athlete's coaching copy by concatenating authored FIELDS, which is how
       * `Sets: 4 reps` reached an athlete counting rounds and how the sheet's
       * own maintenance note — *"All 5 modalities … inside the 8 min erg cap;
       * Air Bike is time-native"* — shipped as an instruction. The one
       * structured projection owns it now, so a wording fix lands on every
       * surface at once. */
      conditioningDisplayText({
        template,
        masKmh: opts.masKmh ?? null,
        resolvedSetsRounds,
        doseContext: {
          weekInBlock: opts.weekInBlock,
          authoredMinimumDose: opts.authoredMinimumDose,
        },
      }),
      opts.authoredAtISO,
    ),
  );
  if (template.intervalPrescription) {
    const row = rows[rows.length - 1];
    row.prescriptionType = 'duration';
    row.prescribedRepsMin = template.intervalPrescription.workSeconds;
    row.prescribedRepsMax = template.intervalPrescription.workSeconds;
  }
  return rows;
}

/* ── Session type (category-level, replacing the per-name map) ── */

export function workoutTypeForCategory(
  category: AthleteConditioningCategory | null,
  tier?: ConditioningSelectionTier,
): WorkoutType {
  if (tier === 'C') return 'Recovery';
  switch (category) {
    case 'sprint': return 'Sprint-Intervals';
    case 'tempo': return 'Tempo-Run';
    case 'aerobic_base': return 'Long-Run';
    // Flush work is tier C by `TIER_FOR_QUALITY`; naming it here too means a
    // caller that knows the demand but not the tier still gets the truth.
    case 'recovery_flush': return 'Recovery';
    default: return 'Conditioning';
  }
}

export function workoutTypeForTemplate(template: ConditioningTemplate): WorkoutType {
  const tier = TIER_FOR_QUALITY[template.quality];
  if (tier === 'C') return 'Recovery';
  if (
    template.quality === 'acceleration'
    || template.quality === 'top_end_speed'
    || template.quality === 'repeat_sprint'
  ) return 'Sprint-Intervals';
  if (TEMPO_CAPACITY_TEMPLATES.includes(template.name)) return 'Tempo-Run';
  if (STEADY_CAPACITY_TEMPLATES.includes(template.name)) return 'Long-Run';
  return 'Conditioning';
}

/* ── Speed (the sprint-family templates as SpeedBlock content) ── */

/**
 * The authored successor for every retired speed micro-dose (the Stage B
 * pins name it: `buildSprintMicroDose`, `buildSprintReducedVolume` and
 * `createQualitySpeedMicroDoseBlock` are all superseded by this row).
 */
export const SPEED_FALLBACK_TEMPLATE = '20 m Acceleration Reps';

/** Late-off-season speed selection, by the same position logic as before. */
export function lateOffseasonSpeedTemplateName(args: {
  position: number;
  preferAcceleration?: boolean;
}): string {
  if (args.position <= 1) return 'Hill Acceleration';
  if (args.position === 2) return '20 m Acceleration Reps';
  // Sam's ruling 0: only the step that LEAVES accelerations changes — a
  // power weakness holds the acceleration exposure instead of progressing
  // to the flying reintroduction. Earlier positions are identical either way.
  if (args.preferAcceleration) return '20 m Acceleration Reps';
  return 'Off-Season Speed Reintroduction';
}

mustExist([SPEED_FALLBACK_TEMPLATE, 'Hill Acceleration', 'Off-Season Speed Reintroduction']);

export function speedTemplateByName(name: string): ConditioningTemplate {
  const template = byName.get(name) ?? byName.get(SPEED_FALLBACK_TEMPLATE)!;
  return template;
}

/** Speed rows: structural warm-up + the authored template row. */
export function composeSpeedRows(
  templateName: string | undefined,
  dateStr: string,
  idSeed = '',
): WorkoutExercise[] {
  const template = speedTemplateByName(templateName ?? SPEED_FALLBACK_TEMPLATE);
  return composeConditioningRows(template, dateStr, {
    idPrefix: `speed-${dateStr}${idSeed ? `-${idSeed}` : ''}`,
  });
}

/** The authored template's whole-session length, for SpeedBlock display. */
export function templateDurationMinutes(template: ConditioningTemplate): number {
  if (template.intervalPrescription) {
    const { workSeconds, recoverySeconds, rounds } = template.intervalPrescription;
    return rounds * (workSeconds + recoverySeconds) / 60;
  }
  const parsed = parseConditioningDose(template.totalSessionTime);
  if (!parsed.ok) return 15;
  const seconds = doseSeconds(parsed.quantity);
  return seconds ? Math.max(1, Math.round((seconds.min + seconds.max) / 120)) : 15;
}

/** The authored dose as one line, authored fields joined, nothing rewritten. */
export function templatePrescriptionLine(template: ConditioningTemplate): string {
  return `${template.setsRounds} · ${template.workPeriod} · ${template.restPeriod}`;
}

/**
 * THE AUTHORED DOSE, AS THE ATHLETE READS IT — work, rest, sets/rounds, total.
 *
 * Sam, 2026-08-17: conditioning must show *"work time, rest time,
 * repetitions/rounds and useful duration"*. Every one of those four is already
 * an authored field on the template (`workPeriod`, `restPeriod`, `setsRounds`,
 * `totalSessionTime` — four of the six values `ConditioningTemplate` declares
 * unshippable-if-missing). **Nothing here composes a dose; it hands back the
 * sheet's own strings.**
 *
 * ## WHY IT LIVES AT THE EMITTER AND NOT AT THE PROJECTION
 *
 * `composeConditioningRows` already writes these same four values into the
 * row's `notes`, through `doseLineForDisplay`. A projection that formatted the
 * template itself would be a SECOND rendering of one authored dose, and the two
 * would drift the first time `doseLineForDisplay` learned a new shape — the
 * repeating defect this repo files as "one question, two owners". So the
 * accessor sits beside the composer, calls the same normaliser, and the
 * projection consumes it.
 *
 * `intensity` and `effortCue` are deliberately NOT here: they already reach the
 * athlete as the row's CUE (`exerciseCueCopyId`, registered from these same
 * authored fields), and a second copy on the dose would print the effort twice.
 *
 * `null` means the name is not the template vocabulary's — stored legacy and
 * coach-authored rows keep their own words rather than borrowing a dose that
 * was never prescribed for them (`resolveTemplateByName`'s own rule).
 */
export interface ConditioningVisibleDose {
  /**
   * The AUTHORED template's own name, which may differ from the name asked for.
   *
   * `resolveTemplateByName` also resolves Sam's legacy-format map, so a stored
   * row can carry a legacy name and still reach a real authored dose. Callers
   * that key anything off the template — the copy sheet does — must key it off
   * THIS name, not the one they passed in, or a legacy row silently finds no
   * entry and loses the dose it just successfully resolved.
   */
  readonly templateName: string;
  /** `workPeriod`, ratio-normalised exactly as the row's notes normalise it. */
  readonly work: string;
  /** `restPeriod`, same normalisation. */
  readonly rest: string;
  /** `setsRounds` verbatim — authored as "4 reps", "3 × 8 min, or 4 × 6 min". */
  readonly setsRounds: string;
  /** `totalSessionTime` verbatim — the "useful duration" Sam asked for. */
  readonly totalSessionTime: string;
}

export function conditioningVisibleDoseFor(name: string, modality?: import('../types/domain').ConditioningOption['modality']): ConditioningVisibleDose | null {
  const template = resolveTemplateByName(name);
  if (template) {
    const prescription = conditioningAthletePrescription(template, undefined, modality);
    return {
      templateName: template.name,
      work: prescription.work,
      rest: prescription.recovery,
      setsRounds: prescription.setsRounds,
      totalSessionTime: prescription.totalSessionTime,
    };
  }
  const section = CONDITIONING_TEMPLATES
    .flatMap((candidate) => candidate.sections ?? [])
    .find((candidate) => candidate.name === name);
  if (!section) return null;
  return {
    templateName: section.name,
    work: section.work,
    rest: section.recovery,
    setsRounds: section.reps,
    totalSessionTime: '',
  };
}
