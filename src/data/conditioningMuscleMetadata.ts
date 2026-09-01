/**
 * CONDITIONING MUSCLE + EXPERIENCE — Sam's signed sheet, as typed data.
 *
 * SOURCE OF TRUTH: `docs/MUSCLE_EXPERIENCE_CONDITIONING_PROPOSED_2026-08-05.xlsx`
 * (Sam, SIGNED IN FULL 2026-08-05 — "all looks good"; per-row status cells read
 * SIGNED). The signing and the architecture behind it:
 * `docs/MUSCLE_SHEET_SIGNING_2026-08-05.md`.
 *
 * A typed projection, held to the workbook in BOTH directions by
 * `conditioningMuscleEqualityTests`. Do not hand-edit a muscle or a gate here;
 * change the sheet.
 *
 * ── THE ARCHITECTURE SAM DIRECTED ──
 *
 * "They're all going to be the same no matter what session it is." A machine
 * session loads the MACHINE's muscles, not the template's — so the workbook has
 * two authored surfaces and this module has two exports:
 *
 *   1. `MODALITY_MUSCLE_MAP` — one authored row per rendering (Bike, Air Bike,
 *      Row, Ski, and `Mixed — rotating`). A machine-rendered session DERIVES
 *      its muscles from the modality that renders it. Stored once, derived
 *      everywhere.
 *   2. `CONDITIONING_MUSCLE_METADATA` — the 53 template rows. The 26 run-based
 *      templates carry their own muscles, because running load varies with the
 *      quality (top-end is hamstring-dominant, acceleration is glute/quad). The
 *      27 machine-agnostic templates carry NONE and set `derivesFromModality`:
 *      storing one AND deriving one would be two answers to one question.
 *
 * Ask `conditioningSessionMuscles` — never compose an answer at a surface.
 *
 * VOCABULARY, RULED: Sam's words for Row were "lower back, glutes, hammies,
 * shoulders, wrist". `Wrist` is NOT in the muscle vocabulary and was NOT added;
 * `Grip` is the signed stand-in. Adding `Wrist` remains open to Sam — do not
 * add it unprompted (`docs/MUSCLE_SHEET_SIGNING_2026-08-05.md`).
 *
 * NOT IN THIS SHEET, and must not be re-derived from it: `MAS 15:15 Blocks` and
 * `Erg EMOM`, which Sam signed earlier on the exercise master sheet and which
 * keep their rows in `muscleExperienceMetadata.ts`.
 */

import type { MuscleGroup } from './muscleExperienceMetadata';
import type { ExperienceGate } from '../rules/experienceCrosswalk';
import type { ConditioningModality } from './conditioningTemplates';
import type { ConditioningOption } from '../types/domain';

/* ── The modality map ── */

/**
 * The vocabulary the map is KEYED BY — one key per authored map row that
 * carries muscles. It is the template vocabulary's machines plus `mixed`.
 *
 * `mixed` is here because Sam ruled it there (2026-08-05, "3a whole-body"): a
 * session that rotates machines by design has no single machine row, and the
 * answer he chose was one more AUTHORED row, not a code fallback that picks
 * a machine or unions two. `run` is absent for the same reason it is absent
 * from the sheet — running load lives on the per-template rows.
 */
export type MuscleMapModality = Exclude<ConditioningModality, 'run'> | 'mixed';

/**
 * What a GENERATED session says its conditioning rendered on
 * (`ConditioningOption.modality`, stamped by the switchover). It spells two
 * things differently from the template vocabulary — `running` for `run`, and
 * no `air_bike` (an air bike stamps as `bike`) — so this owner takes both
 * spellings at its door and normalises once, rather than letting each caller
 * cast.
 */
type OptionModality = NonNullable<ConditioningOption['modality']>;

/**
 * BUILD-FAILING BIND: every rendering a generated option can carry must either
 * key a map row or be the run spelling that defers to the per-template rows.
 * If `ConditioningOption.modality` ever gains a word, this stops compiling
 * until the sheet answers for it — which is Sam's authorship, not a fallback.
 */
type _EveryOptionRenderingIsAnswered =
  Exclude<OptionModality, MuscleMapModality | 'running'> extends never ? true : never;
const _optionRenderingsAnswered: _EveryOptionRenderingIsAnswered = true;
void _optionRenderingsAnswered;

export interface ModalityMuscleEntry {
  /** The typed modality key. */
  readonly modality: MuscleMapModality;
  /** The sheet's own word for the row. */
  readonly label: string;
  readonly primary: readonly MuscleGroup[];
  readonly secondary: readonly MuscleGroup[];
  /** Sam's authored note, verbatim. */
  readonly note: string;
}

/**
 * One authored row per rendering. `Run` is deliberately absent: the sheet's Run
 * row says "(per template row)" because running load varies by quality, so run
 * templates keep their own muscles on the first tab.
 */
export const MODALITY_MUSCLE_MAP: readonly ModalityMuscleEntry[] = [
  {
    modality: 'bike',
    label: 'Bike',
    primary: ['Quads'],
    secondary: ['Calves', 'Knee', 'Glutes'],
    note: 'Sam\'s words 2026-08-05: \'bike is quads, calves, knee\'.',
  },
  {
    modality: 'air_bike',
    label: 'Air Bike',
    primary: ['Quads'],
    secondary: ['Shoulders', 'Triceps', 'Calves'],
    note: 'Arms drive adds upper body over Bike.',
  },
  {
    modality: 'row',
    label: 'Row',
    primary: ['Low back', 'Glutes', 'Hamstrings'],
    secondary: ['Shoulders', 'Upper back', 'Grip'],
    note: 'Sam\'s words 2026-08-05: \'row is lower back, glutes, hammies, shoulders, wrist\' — vocab has no Wrist; Grip is the closest signed word. Add Wrist to the vocabulary instead if you want it.',
  },
  {
    modality: 'ski',
    label: 'Ski',
    primary: ['Lats', 'Triceps', 'Midline'],
    secondary: ['Shoulders', 'Low back', 'Grip'],
    note: 'Ski erg pull-down: trunk drives every stroke (Midline primary per Sam 2026-08-05); sustained handle grip like Row.',
  },
  {
    modality: 'mixed',
    label: 'Mixed — rotating',
    primary: ['Quads', 'Glutes', 'Midline'],
    secondary: ['Hamstrings', 'Calves', 'Shoulders', 'Upper back', 'Low back'],
    note: 'Sam\'s ruling 2026-08-05: whole-body — a rotating session loads everything; vocabulary rendering by the review seat, Sam-authorized (\'3a whole-body\').',
  },
];

/** The sheet's Run marker, kept so the gate can prove Run still defers. */
export const MODALITY_MAP_RUN_DEFERS_TEXT = '(per template row)';

/* ── The 53 template rows ── */

export interface ConditioningMuscleEntry {
  readonly exercise: string;
  /** The quality tab the template sits on, as the conditioning sheet spells it. */
  readonly quality: string;
  readonly pool: string;
  /** Authored muscles. EMPTY when `derivesFromModality` — the map owns them. */
  readonly primary: readonly MuscleGroup[];
  readonly secondary: readonly MuscleGroup[];
  /**
   * The sheet said "— from map —": this session's muscles are the MACHINE's,
   * derived at render from the modality, never stored per template.
   */
  readonly derivesFromModality: boolean;
  readonly experienceGate: ExperienceGate;
  /** Sam's authored note, verbatim. */
  readonly note: string;
  /** The note carries a ⚑ — a gate Sam considers debatable, not a blocker. */
  readonly flagged: boolean;
}

export const CONDITIONING_MUSCLE_METADATA: readonly ConditioningMuscleEntry[] = [
  {
    exercise: '10 m Acceleration Reps',
    quality: 'acceleration',
    pool: 'Conditioning',
    primary: ['Glutes', 'Quads', 'Calves'],
    secondary: ['Hamstrings', 'Hips'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint/cutting mechanics. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: '20 m Acceleration Reps',
    quality: 'acceleration',
    pool: 'Conditioning',
    primary: ['Glutes', 'Quads', 'Calves'],
    secondary: ['Hamstrings', 'Hips'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint/cutting mechanics. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: '30 m Acceleration Reps',
    quality: 'acceleration',
    pool: 'Conditioning',
    primary: ['Glutes', 'Quads', 'Calves'],
    secondary: ['Hamstrings', 'Hips'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint/cutting mechanics. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Air Bike Accelerations',
    quality: 'acceleration',
    pool: 'Conditioning',
    primary: ['Glutes', 'Quads', 'Calves'],
    secondary: ['Hamstrings', 'Hips'],
    derivesFromModality: false,
    experienceGate: 'everyone',
    note: 'machine modality — no field sprint mechanics.',
    flagged: false,
  },
  {
    exercise: 'Hill Acceleration',
    quality: 'acceleration',
    pool: 'Conditioning',
    primary: ['Glutes', 'Quads', 'Calves'],
    secondary: ['Hamstrings', 'Hips'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint/cutting mechanics. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Return-to-Speed Ladder',
    quality: 'acceleration',
    pool: 'Conditioning',
    primary: ['Glutes', 'Quads', 'Calves'],
    secondary: ['Hamstrings', 'Hips'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint/cutting mechanics. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Team-Training Warm-Up Dose',
    quality: 'acceleration',
    pool: 'Conditioning',
    primary: ['Glutes', 'Quads', 'Calves'],
    secondary: ['Hamstrings', 'Hips'],
    derivesFromModality: false,
    experienceGate: 'everyone',
    note: 'warm-up dose ridden onto a team night — never a standalone session (ruling 5, 2026-08-05).',
    flagged: false,
  },
  {
    exercise: 'Fly 20 (20+20)',
    quality: 'top_end_speed',
    pool: 'Conditioning',
    primary: ['Hamstrings', 'Glutes'],
    secondary: ['Calves', 'Hips', 'Quads'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Fly 30 (30+30)',
    quality: 'top_end_speed',
    pool: 'Conditioning',
    primary: ['Hamstrings', 'Glutes'],
    secondary: ['Calves', 'Hips', 'Quads'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Off-Season Speed Reintroduction',
    quality: 'top_end_speed',
    pool: 'Conditioning',
    primary: ['Hamstrings', 'Glutes'],
    secondary: ['Calves', 'Hips', 'Quads'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Progressive Sprint Exposure',
    quality: 'top_end_speed',
    pool: 'Conditioning',
    primary: ['Hamstrings', 'Glutes'],
    secondary: ['Calves', 'Hips', 'Quads'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: '10 s Max Sprint Repeats',
    quality: 'repeat_sprint',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'machine/erg rendering — no field sprint mechanics. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: '10 s Repeat Efforts',
    quality: 'repeat_sprint',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'machine/erg rendering — no field sprint mechanics. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: '20 m Shuttle Repeats',
    quality: 'repeat_sprint',
    pool: 'Conditioning',
    primary: ['Hamstrings', 'Glutes', 'Quads'],
    secondary: ['Calves', 'Hips'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: '30 m Repeats',
    quality: 'repeat_sprint',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'machine/erg rendering — no field sprint mechanics. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Sprint Sets (3×5×6 s)',
    quality: 'repeat_sprint',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'machine/erg rendering — no field sprint mechanics. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: '45-Degree Cut Reps',
    quality: 'cod_decel',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Groin'],
    secondary: ['Calves', 'Hamstrings', 'Knee'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint/cutting mechanics. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Change of Direction',
    quality: 'cod_decel',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Groin'],
    secondary: ['Calves', 'Hamstrings', 'Knee'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: 'Combined Run-only COD session. Its visible section rows retain their own authored muscle metadata.',
    flagged: false,
  },
  {
    exercise: 'Low-Intensity Deceleration Drills',
    quality: 'cod_decel',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes'],
    secondary: ['Knee', 'Calves', 'Hamstrings'],
    derivesFromModality: false,
    experienceGate: 'everyone',
    note: 'low-intensity mechanics / landing work — teachable to everyone.',
    flagged: false,
  },
  {
    exercise: 'Up-Back Shuttle',
    quality: 'cod_decel',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Groin'],
    secondary: ['Calves', 'Hamstrings', 'Knee'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint/cutting mechanics. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: '150–200 m Hard Repeats',
    quality: 'anaerobic',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: '20 s Max Sprint — Small Dose',
    quality: 'anaerobic',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: '30 s Very Hard Repeats',
    quality: 'anaerobic',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'erg-only — hard, but mechanically safe. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: '45 s Hard Repeats',
    quality: 'anaerobic',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'erg-only — hard, but mechanically safe. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: '60 s Max Sustained Effort',
    quality: 'anaerobic',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Bodyweight Circuit (no-equipment fallback)',
    quality: 'anaerobic',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Erg Short-Burst Repeats (15–20 s)',
    quality: 'anaerobic',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'everyone',
    note: 'machine modality — no field sprint mechanics.',
    flagged: false,
  },
  {
    exercise: 'Hill Repeats — hard sustained',
    quality: 'anaerobic',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Tabata Finisher',
    quality: 'anaerobic',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: '1 km Repeats',
    quality: 'aerobic_power',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: '30:30 Hard Intermittent',
    quality: 'aerobic_power',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'erg-only — hard, but mechanically safe. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: '400 m Repeats',
    quality: 'aerobic_power',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Classic 4×4',
    quality: 'aerobic_power',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'erg-only — hard, but mechanically safe. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Footy Shuttles',
    quality: 'aerobic_power',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Three-Minute Intervals',
    quality: 'aerobic_power',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'erg-only — hard, but mechanically safe. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Two-Minute Repeats',
    quality: 'aerobic_power',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'erg-only — hard, but mechanically safe. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: '1 min On / 1 min Easy Tempo',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: '2 min On / 1 min Easy',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: '30:30 Controlled Tempo Blocks',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Aerobic Shuttles',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: ['Quads', 'Glutes', 'Hamstrings'],
    secondary: ['Calves'],
    derivesFromModality: false,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed.',
    flagged: false,
  },
  {
    exercise: 'Continuous Aerobic Run',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Controlled 10–20 min Blocks',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Extensive Tempo (100 m repeats)',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Long Aerobic Intervals',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Steady 5 min Blocks',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Steady Blocks (3×8 min or 4×6 min)',
    quality: 'aerobic_capacity',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'aerobic intensity — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Easy Aerobic Flush',
    quality: 'flush',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'recovery flush — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Erg Flush Blocks',
    quality: 'flush',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'recovery flush — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Flush Intervals 1:1 (1 min / 1 min)',
    quality: 'flush',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'recovery flush — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Flush Intervals 2:1 (2 min / 1 min)',
    quality: 'flush',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'recovery flush — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Flush Intervals 30:30',
    quality: 'flush',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'recovery flush — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Nasal-Paced Easy',
    quality: 'flush',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'recovery flush — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
  {
    exercise: 'Short Flush',
    quality: 'flush',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    derivesFromModality: true,
    experienceGate: 'everyone',
    note: 'recovery flush — no gate needed. Muscles derive from the Modality Muscle Map tab (whichever machine renders); no per-template tag needed.',
    flagged: false,
  },
];

/* ── The ONE owner of "which muscles does this session load" ── */

export interface SessionMuscles {
  readonly primary: readonly MuscleGroup[];
  readonly secondary: readonly MuscleGroup[];
  /** Where the answer came from — a stored row, or the modality map. */
  readonly source: 'template_row' | 'modality_map';
}

const byExercise = new Map<string, ConditioningMuscleEntry>(
  CONDITIONING_MUSCLE_METADATA.map((entry) => [entry.exercise, entry]),
);

const byModality = new Map<string, ModalityMuscleEntry>(
  MODALITY_MUSCLE_MAP.map((entry) => [entry.modality, entry]),
);

/**
 * The one place the two spellings meet. `running` is the generated option's
 * word for the sheet's Run row, which defers — so it normalises to `run` and
 * is answered by deferral, never by a map lookup.
 */
function toMapKey(
  modality: ConditioningModality | OptionModality,
): MuscleMapModality | 'run' {
  return modality === 'running' ? 'run' : modality;
}

/** The signed row for a conditioning template, or null when the sheet has none. */
export function conditioningMuscleEntry(
  exercise: string,
): ConditioningMuscleEntry | null {
  return byExercise.get(exercise) ?? null;
}

/**
 * Which muscles a conditioning session loads.
 *
 * ONE OWNER (Sam's architecture, 2026-08-05): a run template answers from its
 * own signed row; a machine-rendered session answers from the machine's row in
 * the modality map. No surface composes its own answer, and nothing stores the
 * derived one.
 *
 * A ROTATING session answers from Sam's authored `Mixed — rotating` row
 * (ruling 2026-08-05). It is a map row like any other: nothing here unions two
 * machines or picks one, because that would be a code answer to a question the
 * sheet now answers.
 *
 * `null` means the sheet does not cover this session — the honest answer for
 * legacy names and for the two rows signed on the exercise master sheet. A
 * machine-agnostic template asked WITHOUT a modality also returns null: its
 * muscles are not knowable until the rendering modality is. So does one asked
 * with a RUN rendering, which the sheet defers to the per-template rows.
 *
 * Takes either spelling — the template vocabulary's or the generated option's
 * — and normalises once, so no caller has to cast at this door.
 */
export function conditioningSessionMuscles(args: {
  readonly exercise: string;
  readonly modality?: ConditioningModality | OptionModality | null;
}): SessionMuscles | null {
  const entry = byExercise.get(args.exercise);
  if (!entry) return null;
  if (!entry.derivesFromModality) {
    return { primary: entry.primary, secondary: entry.secondary, source: 'template_row' };
  }
  if (!args.modality) return null;
  const key = toMapKey(args.modality);
  if (key === 'run') return null;
  const mapped = byModality.get(key);
  if (!mapped) return null;
  return { primary: mapped.primary, secondary: mapped.secondary, source: 'modality_map' };
}
