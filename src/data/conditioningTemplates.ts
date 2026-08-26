/**
 * Conditioning templates — the 55 authored doses, as typed data.
 *
 * SOURCE OF TRUTH: `docs/CONDITIONING_TEMPLATES_FINAL_2026-07-25.xlsx`
 * (Sam, AUTHORED FINAL, sign-off 2026-07-25/27). Paired physiology:
 * `docs/CONDITIONING_FRAMEWORK_SAM_2026-07-25.md`.
 *
 * This module is a TYPED PROJECTION of that workbook, not an independent
 * authority. The Programming Bible is explicit that it does not restate these
 * doses: "Conditioning doses are NOT defined in this Bible ... Doses come from
 * the templates sheet. A layer that invents its own conditioning dose is a
 * defect." Every field below is copied verbatim from the sheet, and
 * `conditioningTemplateEqualityTests` holds the two in lockstep in both
 * directions — so a Sam edit to the workbook fails the build until this file
 * matches. Do not hand-tune a number here; change the sheet.
 *
 * Dose strings stay STRINGS on purpose. "≈2 s (10 m)", "45–60 s walk-back
 * (full recovery)" and "4–6 × 60 s / 2 min" carry ranges, approximations and
 * qualifiers that no numeric type models without discarding authored meaning.
 * Rendering layers parse what they need; nothing re-derives a dose.
 *
 * Selection-time behaviour lives in `properties` — the six scope rules Sam
 * asked to be machine-readable rather than buried in prose. They bind at
 * SELECTION time and are never written into the dose.
 *
 * NOT WIRED YET: this module lands alongside the current generation path.
 * Stage B switches selection onto it. See LEGACY_CONDITIONING_FORMAT_MAP for
 * how each pre-template format resolves.
 */

/* ── Qualities ── */

/** The eight quality tabs of the authored sheet, in sheet order. */
export type ConditioningQuality =
  | 'acceleration'
  | 'top_end_speed'
  | 'repeat_sprint'
  | 'cod_decel'
  | 'anaerobic'
  | 'aerobic_power'
  | 'aerobic_capacity'
  | 'flush';

export const CONDITIONING_QUALITY_TABS: readonly ConditioningQuality[] = [
  'acceleration',
  'top_end_speed',
  'repeat_sprint',
  'cod_decel',
  'anaerobic',
  'aerobic_power',
  'aerobic_capacity',
  'flush',
];

/** How a session may be measured. Time-first; distance and calories are allowed per rule 1. */
export type TemplateBaseUnit = 'time' | 'distance' | 'reps' | 'time_or_calories';

/** A conditioning modality the app can render a session on. */
export type ConditioningModality = 'run' | 'bike' | 'air_bike' | 'ski' | 'row';

/* ── The six selection properties ── */

/**
 * A property limits WHEN or HOW a template may be prescribed. It binds at
 * selection time and is never written into the dose.
 */
export type TemplateProperty =
  /** Short-intermittent MAS rule: a block runs ≤ ~4–5 min, with rest between blocks. */
  | 'set_length_max_4_5_min'
  /** Never prescribed as the session itself — finisher only, ergs only, single set. */
  | 'finisher_role_only'
  /** Only for athletes with genuinely no equipment; never in-season or pre-season. */
  | 'fallback_only'
  /** Prescribe only in weeks with NO team training; cut first when something must give. */
  | 'availability_gate_no_team_training'
  /** The athlete may rotate modality between rounds inside one session. Flush only. */
  | 'mid_session_mixing_flush_only'
  /** Ski and Row cannot spin the flywheel up inside a sub-10-second effort. */
  | 'no_ski_row_flywheel'
  /**
   * A warm-up dose rides on a session the athlete is already doing; it is
   * never prescribed as a session in its own right (Sam's ruling 5,
   * `docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md`).
   */
  | 'warmup_rider_only';

/**
 * The authored wording each property kind was recognised from, retained so the
 * equality suite can prove the typed kind still corresponds to sheet text
 * rather than to a mapping that drifted.
 */
export const TEMPLATE_PROPERTY_SOURCE_TEXT: Readonly<Record<TemplateProperty, string>> = {
  set_length_max_4_5_min: 'SET LENGTH <= 4-5 min',
  finisher_role_only: 'FINISHER ROLE ONLY',
  fallback_only: 'FALLBACK ONLY (no-equipment athletes)',
  availability_gate_no_team_training: 'AVAILABILITY GATE',
  mid_session_mixing_flush_only: 'MID-SESSION MIXING ALLOWED (flush-only)',
  no_ski_row_flywheel: 'NO SKI / ROW (flywheel spin-up)',
  warmup_rider_only: 'WARM-UP RIDER ONLY (never a standalone session)',
};

/* ── A template ── */

export interface ConditioningTemplate {
  /** Authored name. The selection vocabulary; never rewritten for display. */
  readonly name: string;
  readonly quality: ConditioningQuality;
  /** The six schema values. A template missing any of these is not shippable. */
  readonly workPeriod: string;
  readonly restPeriod: string;
  readonly setsRounds: string;
  readonly intensity: string;
  readonly workToRest: string;
  readonly totalSessionTime: string;
  /** Selection-time scope rules. Empty means unrestricted. */
  readonly properties: readonly TemplateProperty[];
  /** Sam's authored athlete-facing cue for how the effort should feel. */
  readonly effortCue: string;
  readonly baseUnit: TemplateBaseUnit;
  /** Which modalities may render this row, and any per-row exception. */
  readonly modalityNotes: string;
  /** Why the dose sits in band, including any named exemption. Provenance. */
  readonly frameworkCheck: string;
  /** Where the dose came from: Bible section, framework session, or Sam ruling. */
  readonly source: string;
  /** What this pass did to the row. Traces to the Change Log tab. */
  readonly changeMark: string;
}

/* ── Governing quality table ── */

export interface GoverningQualityRow {
  readonly id: string;
  readonly label: string;
  /** Authored effort-length band, verbatim. */
  readonly effort: string;
  /** Authored work-to-rest band, verbatim. */
  readonly workToRest: string;
  readonly objective: string;
  /**
   * Sprint-family exemption: for alactic sprint work the upper W:R ceiling is
   * NOT binding — full recovery at 1:10–1:15+ is allowed. The floor still holds.
   */
  readonly sprintFamilyExemption: boolean;
  /** The W:R floor that holds regardless of the exemption, as a ratio denominator. */
  readonly workToRestFloor: number | null;
}

/**
 * Sam's governing table. Note THE CLASSIFICATION LAW that governs how it is
 * read: INTENSITY CLASSIFIES, W:R IS ONLY A PROPERTY. A ratio outside a band
 * is a property of that session, not a misfiling — never re-file or re-dose a
 * session to make its ratio fit.
 */
export const GOVERNING_QUALITY_TABLE: readonly GoverningQualityRow[] = [
  {
    id: 'anaerobic_power_alactic',
    label: 'Anaerobic power (alactic)',
    effort: '3–10 s',
    workToRest: '1:6–1:12',
    objective: 'maximum speed and explosiveness',
    sprintFamilyExemption: true,
    workToRestFloor: 6,
  },
  {
    id: 'repeated_sprint_ability',
    label: 'Repeated-sprint ability',
    effort: '4–10 s',
    workToRest: '1:3–1:5',
    objective: 'repeat high-speed efforts',
    sprintFamilyExemption: false,
    workToRestFloor: 3,
  },
  {
    id: 'anaerobic_capacity_glycolytic',
    label: 'Anaerobic capacity (glycolytic)',
    effort: '15–60 s',
    workToRest: '1:2–1:5',
    objective: 'sustain hard work through fatigue',
    sprintFamilyExemption: false,
    workToRestFloor: 2,
  },
  {
    id: 'aerobic_power',
    label: 'Aerobic power',
    effort: '1–5 min',
    workToRest: '1:1–2:1',
    objective: 'high aerobic output',
    sprintFamilyExemption: false,
    workToRestFloor: 1,
  },
  {
    id: 'aerobic_capacity',
    label: 'Aerobic capacity',
    effort: 'longer or continuous',
    workToRest: '3:1 to continuous',
    objective: 'total sustainable aerobic work',
    sprintFamilyExemption: false,
    workToRestFloor: null,
  },
];

/** Which framework quality each tab maps to. Two tabs are deliberately unbanded. */
export const QUALITY_FRAMEWORK_MAPPING: Readonly<
  Record<ConditioningQuality, { readonly frameworkRow: string | null; readonly note: string }>
> = {
  acceleration: {
    frameworkRow: 'anaerobic_power_alactic',
    note: 'Also holds the one non-run alactic row, Air Bike Accelerations (ruling 4).',
  },
  top_end_speed: { frameworkRow: 'anaerobic_power_alactic', note: '' },
  repeat_sprint: { frameworkRow: 'repeated_sprint_ability', note: '' },
  cod_decel: {
    frameworkRow: null,
    note: 'No framework row — a gated mechanics quality, not a trained quality. Unbanded by design.',
  },
  anaerobic: {
    frameworkRow: 'anaerobic_capacity_glycolytic',
    note: 'Grind is dissolved in here (Sam’s ruling).',
  },
  aerobic_power: { frameworkRow: 'aerobic_power', note: '' },
  aerobic_capacity: { frameworkRow: 'aerobic_capacity', note: '' },
  flush: {
    frameworkRow: null,
    note: 'No framework row — recovery, not a trained quality. 7 rows, confirmed.',
  },
};

/* ── Standing modality rendering rules ── */

export interface ModalityRenderingRule {
  readonly id: string;
  /** The authored rule text, verbatim from the Architecture & Rules tab. */
  readonly rule: string;
  /** Modalities that share a nominal distance without conversion. */
  readonly sharedDistance?: readonly ConditioningModality[];
  /** Bike covers this multiple of the nominal distance. */
  readonly bikeDistanceMultiplier?: number;
  /** Air Bike is time-based: this many metres ≈ one minute. */
  readonly airBikeMetresPerMinute?: number;
  /** Hard cap on a single work interval for erg modalities, in minutes. */
  readonly ergCapMinutes?: number;
  /** Preferred single-interval length below the cap, in minutes. */
  readonly ergPreferredMinutes?: number;
  /** Modalities exempt from the interval cap. */
  readonly uncappedModalities?: readonly ConditioningModality[];
  /** Modalities excluded outright by this rule. */
  readonly excludedModalities?: readonly ConditioningModality[];
  /** Effort length at or below which the exclusion applies, in seconds. */
  readonly appliesAtOrBelowSeconds?: number;
  /** Modalities that carry the work once others are excluded. */
  readonly carriers?: readonly ConditioningModality[];
  /** Named exceptions to a blanket rule. */
  readonly namedExceptions?: readonly string[];
}

/**
 * The seven standing rendering rules. Rule 7 is the classification law, which
 * is a reading instruction rather than a modality mapping — it is carried here
 * because the sheet carries it here, and because a layer that re-files a
 * session by its ratio is the exact defect it forbids.
 */
export const MODALITY_RENDERING_RULES: readonly ModalityRenderingRule[] = [
  {
    id: 'time_first',
    rule: 'TIME-FIRST. Distance is allowed for short/speed work and mid-length reps; calories for EMOM-class erg work.',
  },
  {
    id: 'shared_distance',
    rule: 'Run/Ski/Row share the nominal distance. Bike = distance × 2. Air Bike is time-based: 250 m ≈ 1 min.',
    sharedDistance: ['run', 'ski', 'row'],
    bikeDistanceMultiplier: 2,
    airBikeMetresPerMinute: 250,
  },
  {
    id: 'erg_interval_cap',
    rule: 'Work intervals over 8 min: Run and Bike only. Ski/Row/Air Bike cap at 8 min, prefer 6. Encoded per row.',
    ergCapMinutes: 8,
    ergPreferredMinutes: 6,
    uncappedModalities: ['run', 'bike'],
    excludedModalities: ['ski', 'row', 'air_bike'],
  },
  {
    id: 'sprint_family_run_only',
    rule: 'Sprint-family templates are run-only, with THREE named exceptions encoded in Modality Notes.',
    namedExceptions: [
      'Air Bike Accelerations (ruling 4 — an alactic air-bike row inside Acceleration)',
      "the 30 m repeats' Air-Bike-extra rendering (5 s effort / 30 s super-light)",
      'anything under 10 s of sprinting staying on running or the Air Bike',
    ],
  },
  {
    id: 'no_sleds',
    rule: 'NO SLEDS anywhere. GRIND folded into ANAEROBIC. Jump work lives in the POWER SYSTEM only (ruling 4).',
  },
  {
    id: 'mid_session_mixing_flush_only',
    rule: 'MID-SESSION MIXING — FLUSH-ONLY PROPERTY (ruling 5). On the three Flush Intervals rows the athlete may rotate machines and/or running BETWEEN ROUNDS within one session. This is the only place in the sheet where a single session spans modalities; everywhere else one session renders on one modality.',
  },
  {
    id: 'classification_law',
    rule: 'INTENSITY CLASSIFIES, W:R IS ONLY A PROPERTY (Sam, V3-final). Do not re-file a session because its ratio sits outside a band, and do not re-dose it to fit one.',
  },
  {
    id: 'no_ski_row_sub_10s',
    rule: 'Ski and Row are excluded from every sub-10-second template, including the 10-second rows. The flywheel cannot spin up inside the effort, so the rep produces no real work. Air Bike, Bike and Run carry the short templates.',
    excludedModalities: ['ski', 'row'],
    appliesAtOrBelowSeconds: 10,
    carriers: ['air_bike', 'bike', 'run'],
  },
];

/* ── Effort-length assumptions ── */

export interface EffortLengthAssumption {
  readonly label: string;
  readonly approxEffort: string;
}

/**
 * The distance -> effort-length conversions used to compute work periods and
 * ratios on distance rows. These remain ASSUMPTIONS carried from the sheet's
 * Architecture tab; several computed ratios inherit them.
 */
export const EFFORT_LENGTH_ASSUMPTIONS: readonly EffortLengthAssumption[] = [
  { label: '10 m', approxEffort: '≈2 s' },
  { label: '20 m', approxEffort: '≈3 s' },
  { label: '20 m shuttle (2×10 m)', approxEffort: '≈4 s' },
  { label: '30 m', approxEffort: '≈4.5 s' },
  { label: '40–60 m', approxEffort: '≈6–8 s' },
  { label: '20+20 fly', approxEffort: '≈6 s' },
  { label: '30+30 fly', approxEffort: '≈8 s' },
  { label: '100 m @65–75%', approxEffort: '≈16 s' },
  { label: '150 m', approxEffort: '≈22 s' },
  { label: '200 m', approxEffort: '≈30 s' },
  { label: '400 m', approxEffort: '≈75–80 s' },
  { label: '1 km', approxEffort: '≈3.5–4 min' },
];

/* ── The 55 authored templates ── */

/**
 * Every dose below is verbatim from the authored workbook. Generated from the
 * sheet and held to it by `npm run test:conditioning-templates`.
 */
export const CONDITIONING_TEMPLATES: readonly ConditioningTemplate[] = [

  /* ── Acceleration ── */
  {
    name: '10 m Acceleration Reps',
    quality: 'acceleration',
    workPeriod: '≈2 s (10 m)',
    restPeriod: '45–60 s walk-back (full recovery)',
    setsRounds: '6–10 reps',
    intensity: '95–100% maximal — crisp first step',
    workToRest: '1:25 (approx)',
    totalSessionTime: '≈8–11 min (work ≈20 s)',
    properties: [],
    effortCue: 'Quick and light off the ground — not a max sprint, a crisp first-step drill.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'IN BAND — SPRINT-FAMILY EXEMPTION (Sam\'s V3 ruling 1): full recovery at 1:10–1:15+ is allowed above the table\'s 1:12 ceiling for alactic sprint work.',
    source: 'Bible Sect.7 Acceleration L1547; rest + W:R + total computed in v2',
    changeMark: 'kept · Sam V3 ruling 1: ⚑ RATIO flag cleared',
  },
  {
    name: '20 m Acceleration Reps',
    quality: 'acceleration',
    workPeriod: '≈3 s (20 m)',
    restPeriod: '90 s (passive / very easy)',
    setsRounds: '8 reps',
    intensity: '95–100% maximal',
    workToRest: '1:30 (framework labels this session \'1:10+\')',
    totalSessionTime: '≈13 min (work ≈24 s)',
    properties: [],
    effortCue: 'Drive phase should look the same on rep 1 and rep 8 — stop if it doesn\'t.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'IN BAND — SPRINT-FAMILY EXEMPTION (Sam\'s V3 ruling 1): full recovery at 1:10–1:15+ is allowed above the table\'s 1:12 ceiling for alactic sprint work.',
    source: 'Framework, Anaerobic power sessions (\'8×20 m maximal, 90 s rest, 1:10+\'); was 4–8 reps / \'full recovery\' (Bible L1548)',
    changeMark: 'FRAMEWORK-ALIGNED — reps/rest set to the framework\'s 8×20 m maximal (90 s) · Sam V3 ruling 1: ⚑ RATIO flag cleared',
  },
  {
    name: '30 m Acceleration Reps',
    quality: 'acceleration',
    workPeriod: '≈4.5 s (30 m)',
    restPeriod: '2 min (full recovery)',
    setsRounds: '4–6 reps',
    intensity: '95–100% maximal (Sam\'s FINAL ruling 2 — technique work lives in warm-ups, not the session)',
    workToRest: '1:27 (approx)',
    totalSessionTime: '≈11 min (work ≈27 s)',
    properties: [],
    effortCue: 'Longer accel, still no top-end — but the effort is maximal, not a technique rehearsal.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'IN BAND (3–10 s, alactic; ceiling exempt per ruling 1). Intensity raised to 95–100% by Sam\'s FINAL ruling 2 — the old 80–90% reading is retired.',
    source: 'Bible Sect.7 Acceleration L1549; intensity set by Sam\'s FINAL ruling 2; rest + W:R + total computed in v2',
    changeMark: 'kept',
  },
  {
    name: 'Hill Acceleration',
    quality: 'acceleration',
    workPeriod: '6 s uphill',
    restPeriod: '60–90 s walk-down',
    setsRounds: '8 reps',
    intensity: '95–100% maximal uphill',
    workToRest: '1:10–1:15 (framework)',
    totalSessionTime: '≈10–13 min (work 48 s)',
    properties: [],
    effortCue: 'Hill takes the top-end off the table for you — just drive and go.',
    baseUnit: 'time',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering. Hill terrain required.',
    frameworkCheck: 'IN BAND (3–10 s, 1:6–1:12; ceiling exempt per ruling 1)',
    source: 'Framework, Anaerobic power sessions (\'hill sprints 8×6 s, 60–90 s, 1:10–1:15\')',
    changeMark: 'FRAMEWORK-ALIGNED — dose replaced by the framework\'s hill-sprint session (8×6 s)',
  },
  {
    name: 'Air Bike Accelerations',
    quality: 'acceleration',
    workPeriod: '6 s maximal',
    restPeriod: '60 s easy spin',
    setsRounds: '8 reps',
    intensity: '95–100% maximal — wattage-gated (drop ≈5% —> extend recovery or stop)',
    workToRest: '1:10',
    totalSessionTime: '≈9 min (work 48 s)',
    properties: [],
    effortCue: 'Flat out for six seconds, then spin easy — if the wattage drops off, the session is over.',
    baseUnit: 'time',
    modalityNotes: 'AIR BIKE — NAMED EXCEPTION to the run-only rule 4 (Sam V3 ruling 4). Late-session HR drift toward anaerobic power is ACCEPTABLE (Sam) — it does not turn this into a capacity session.',
    frameworkCheck: 'IN BAND (3–10 s, 1:6–1:12)',
    source: 'Framework, Anaerobic power sessions (\'bike power 8×6 s maximal, 60 s easy, 1:10\') + Sam\'s V3 ruling 4',
    changeMark: 'NEW — Sam V3 ruling 4: the framework\'s \'bike power 8×6 s\' now has a home row. Resolves the v2 taxonomy flag as OPTION A (alactic non-run variant lives in Acceleration via Modality Notes; no new tab).',
  },
  {
    name: 'Team-Training Warm-Up Dose',
    quality: 'acceleration',
    workPeriod: '2–3 s (10–20 m)',
    restPeriod: '≈60 s walk-back inside the warm-up',
    setsRounds: '3–4 reps',
    intensity: '95–100% maximal, short',
    workToRest: '1:22 (approx)',
    totalSessionTime: '≈4–5 min, inside the TT warm-up',
    properties: ['warmup_rider_only'],
    effortCue: 'Piggyback this on the warm-up you\'re already doing — don\'t add a separate session for it.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'IN BAND — SPRINT-FAMILY EXEMPTION (Sam\'s V3 ruling 1): full recovery at 1:10–1:15+ is allowed above the table\'s 1:12 ceiling for alactic sprint work.',
    source: 'Bible L1704; rest + W:R + total computed in v2',
    changeMark: 'kept · Sam V3 ruling 1: ⚑ RATIO flag cleared',
  },
  {
    name: 'Return-to-Speed Ladder',
    quality: 'acceleration',
    workPeriod: '2–3 s (10–20 m)',
    restPeriod: '90 s–2 min (full recovery)',
    setsRounds: '3–6 reps',
    intensity: '90–95% — first exposure back, mechanics-gated',
    workToRest: '1:35 (approx)',
    totalSessionTime: '≈6–12 min',
    properties: [],
    effortCue: 'First exposure back — err on the side of too easy, not too hard.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'IN BAND — SPRINT-FAMILY EXEMPTION (Sam\'s V3 ruling 1): full recovery at 1:10–1:15+ is allowed above the table\'s 1:12 ceiling for alactic sprint work.',
    source: 'Bible L1756; rest + W:R + total computed in v2',
    changeMark: 'kept · Sam V3 ruling 1: ⚑ RATIO flag cleared',
  },

  /* ── Top End Speed ── */
  {
    name: 'Fly 20 (20+20)',
    quality: 'top_end_speed',
    workPeriod: '≈6 s (20 m build + 20 m fly)',
    restPeriod: '2–4 min (full recovery)',
    setsRounds: '3–6 reps',
    intensity: '95–100% max velocity',
    workToRest: '1:20–1:40',
    totalSessionTime: '≈10–25 min (work ≈36 s)',
    properties: [],
    effortCue: 'Build smooth, don\'t force top speed — let it arrive by the fly zone. Full recovery every rep.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'IN BAND — SPRINT-FAMILY EXEMPTION (Sam\'s V3 ruling 1): full recovery at 1:10–1:15+ is allowed above the table\'s 1:12 ceiling for alactic sprint work.',
    source: 'Bible Sect.7 Max velocity L1584 + framework\'s \'6×20 m flying (2–3 min, 1:12+)\'; Flying/Quality Sprints (L1587–88) folded in',
    changeMark: 'MERGED — folds in \'Flying Sprints\' + ⚑ \'Quality Sprints\' (same stimulus, census naming only) · Sam V3 ruling 1: ⚑ RATIO flag cleared',
  },
  {
    name: 'Fly 30 (30+30)',
    quality: 'top_end_speed',
    workPeriod: '≈8 s (30 m build + 30 m fly)',
    restPeriod: '2–4 min (full recovery)',
    setsRounds: '3–6 reps',
    intensity: '95–100% max velocity',
    workToRest: '1:15–1:30',
    totalSessionTime: '≈10–25 min (work ≈48 s)',
    properties: [],
    effortCue: 'Same idea, longer build — stop the moment speed drops off.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'IN BAND — SPRINT-FAMILY EXEMPTION (Sam\'s V3 ruling 1): full recovery at 1:10–1:15+ is allowed above the table\'s 1:12 ceiling for alactic sprint work.',
    source: 'Bible Sect.7 Max velocity L1585; W:R + total computed in v2',
    changeMark: 'kept · Sam V3 ruling 1: ⚑ RATIO flag cleared',
  },
  {
    name: 'Progressive Sprint Exposure',
    quality: 'top_end_speed',
    workPeriod: '6–8 s (40–60 m)',
    restPeriod: '2–3 min (full recovery)',
    setsRounds: '3–6 reps',
    intensity: 'Smooth build to top speed, 90–100%',
    workToRest: '1:20–1:30',
    totalSessionTime: '≈8–20 min',
    properties: [],
    effortCue: 'This is exposure, not a time trial — smooth and fast beats fast and scrappy.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'IN BAND — SPRINT-FAMILY EXEMPTION (Sam\'s V3 ruling 1): full recovery at 1:10–1:15+ is allowed above the table\'s 1:12 ceiling for alactic sprint work.',
    source: 'Bible Sect.7 Max velocity L1586; rest + W:R + total filled in v2',
    changeMark: 'kept · Sam V3 ruling 1: ⚑ RATIO flag cleared',
  },
  {
    name: 'Off-Season Speed Reintroduction',
    quality: 'top_end_speed',
    workPeriod: '≈6 s (flying sprint)',
    restPeriod: '3–4 min (extended recovery)',
    setsRounds: '2–4 reps',
    intensity: '90–95% — mechanics first, speed follows',
    workToRest: '1:30–1:40',
    totalSessionTime: '≈6–16 min',
    properties: [],
    effortCue: 'Building back gently — mechanics first, speed follows.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'IN BAND — SPRINT-FAMILY EXEMPTION (Sam\'s V3 ruling 1): full recovery at 1:10–1:15+ is allowed above the table\'s 1:12 ceiling for alactic sprint work.',
    source: 'Bible L1757; rest made numeric + W:R + total computed in v2',
    changeMark: 'kept · Sam V3 ruling 1: ⚑ RATIO flag cleared',
  },

  /* ── Repeat Sprint ── */
  {
    name: '20 m Shuttle Repeats',
    quality: 'repeat_sprint',
    workPeriod: '≈4 s (20 m shuttle = 2×10 m)',
    restPeriod: '≈21 s (depart every 25 s)',
    setsRounds: '2 sets × 8 reps, 4 min between sets',
    intensity: 'Maximal repeat efforts on incomplete recovery',
    workToRest: '1:5',
    totalSessionTime: '≈11 min (work ≈64 s)',
    properties: [],
    effortCue: 'Recovery is the walk, not a rest — keep moving between reps.',
    baseUnit: 'distance',
    modalityNotes: 'RUN ONLY per Sam: \'would not use this on Row/Ski/Bike/Air Bike\'.',
    frameworkCheck: 'IN BAND (4–10 s, 1:3–1:5)',
    source: 'Framework, RSA sessions (\'2×8×20 m shuttle departing every 25 s, 4 min between\'); was 10–15 × 20 m walk-back (Bible L1654 / L616)',
    changeMark: 'FRAMEWORK-ALIGNED + MERGED — folds in ⚑ \'Generic Sprint Intervals\' (same stimulus, looser numbers)',
  },
  {
    name: '30 m Repeats',
    quality: 'repeat_sprint',
    workPeriod: '≈4.5 s (30 m)',
    restPeriod: '≈21–26 s (depart every 25–30 s)',
    setsRounds: '2 sets × 6 reps, 4 min between sets',
    intensity: 'Maximal repeat efforts on incomplete recovery',
    workToRest: '1:5',
    totalSessionTime: '≈10 min (work ≈54 s)',
    properties: ['no_ski_row_flywheel'],
    effortCue: 'Recovery is the walk, not a rest — keep moving between reps. (Cue held identical to the 20 m session per Sam.)',
    baseUnit: 'distance',
    modalityNotes: 'Run. Air Bike EXTRA ONLY, per Sam\'s own rendering: 5 s effort / 30 s very light spin, repeat. Ski/Row excluded (flywheel spin-up); Bike excluded on this row by Sam\'s earlier note.',
    frameworkCheck: 'IN BAND (4–10 s, 1:3–1:5)',
    source: 'Framework, RSA sessions (\'2×6×30 m departing every 25–30 s, 4 min between\'); was 10 × 30 m walk-back (Bible L1655 / L617). Air Bike rendering + cue reuse are Sam\'s edits',
    changeMark: 'FRAMEWORK-ALIGNED',
  },
  {
    name: 'Sprint Sets (3×5×6 s)',
    quality: 'repeat_sprint',
    workPeriod: '6 s sprint',
    restPeriod: '24 s between reps; 3 min between sets',
    setsRounds: '3 sets × 5 reps',
    intensity: 'Maximal — sets should mirror each other',
    workToRest: '1:4',
    totalSessionTime: '≈14 min (work 90 s)',
    properties: ['no_ski_row_flywheel'],
    effortCue: 'Sets should feel similar to each other — if set 3 falls apart, that\'s the end point.',
    baseUnit: 'time',
    modalityNotes: 'Run or Air Bike — Sam\'s rule: short sprint work stays on running or the Air Bike. Ski/Row excluded (flywheel spin-up).',
    frameworkCheck: 'IN BAND (4–10 s, 1:3–1:5)',
    source: 'Framework, RSA sessions (\'3×5×6 s sprint, 24 s recovery, 3 min between\') + Sam\'s edit note on the old \'Sprint Sets (3x3-5)\' row (Bible L1656 / L618)',
    changeMark: 'SCHEMA-FILLED — answers Sam\'s \'what distance? what rest?\' with the framework\'s own RSA set session',
  },
  {
    name: '10 s Max Sprint Repeats',
    quality: 'repeat_sprint',
    workPeriod: '10 s max sprint',
    restPeriod: '50 s (start every minute)',
    setsRounds: '6 reps',
    intensity: 'Maximal — a 50 s rest means the effort must be maximal (Sam)',
    workToRest: '1:5',
    totalSessionTime: '6 min (work 60 s)',
    properties: ['no_ski_row_flywheel'],
    effortCue: 'Short and violent — 10 seconds flat out, then off. You get 50 seconds\' rest, so the efforts must be maximal.',
    baseUnit: 'time',
    modalityNotes: 'Air Bike (native), Bike, Run. SKI/ROW EXCLUDED — Sam\'s flywheel-spin-up rule: an erg flywheel cannot produce real work inside a 10 s effort.',
    frameworkCheck: 'IN BAND (4–10 s, 1:3–1:5)',
    source: 'Bible Sect.7 L1658 + L1340; Sam\'s maximal-effort cue addition',
    changeMark: 'MERGED — folds in \'Air Bike 10s Small Dose\' (MOVED from Anaerobic) + ⚑ \'10s On/20s Off EMOM\' (whose structure was actually 10 s / 50 s)',
  },
  {
    name: '10 s Repeat Efforts',
    quality: 'repeat_sprint',
    workPeriod: '10 s hard',
    restPeriod: '30 s easy',
    setsRounds: '8 rounds',
    intensity: 'Very hard — the rest is real, so the 10 s must count',
    workToRest: '1:3',
    totalSessionTime: '≈5.5 min (work 80 s)',
    properties: ['no_ski_row_flywheel'],
    effortCue: 'More rest, so make the 10 seconds actually count.',
    baseUnit: 'time',
    modalityNotes: 'Air Bike, Bike, Run. SKI/ROW EXCLUDED — Sam\'s flywheel-spin-up rule (the 10 s effort is over before the flywheel is up).',
    frameworkCheck: 'IN BAND (4–10 s, 1:3–1:5).',
    source: 'Structure authored by Sam, FINAL ruling 4 (2026-07-25); was census \'Inverse Tabata\' with assumed timing',
    changeMark: 'RESTRUCTURED + RENAMED by Sam\'s FINAL ruling 4 — 10 s on / 30 s off (was ⚑ \'Inverse Tabata\', 10 s / 20 s). At 1:3 it is no longer an inverse Tabata and the name no longer claims to be one. Sam-authored: the ⚑ INFERRED mark is retired.',
  },

  /* ── Change of Direction-Decel ── */
  {
    name: 'Up-Back Shuttle',
    quality: 'cod_decel',
    workPeriod: '≈11 s (30 m out, 180° turn, 30 m back)',
    restPeriod: '≈30–40 s walk',
    setsRounds: '15–20 reps inside 10–15 min',
    intensity: 'Hard but controlled — turn quality is the governor',
    workToRest: '≈1:3',
    totalSessionTime: '10–15 min after warm-up',
    properties: ['availability_gate_no_team_training'],
    effortCue: 'Turn should be sharp and controlled, not a slide — plant and go.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'No framework band — COD/Decel is not a row in Sam\'s governing table (mechanics quality). W:R shown for information only. Dose APPROVED AS DRAFTED by Sam\'s FINAL ruling 5.',
    source: 'Bible Sect.7 L1627–1632 / L606–611 (the only structured COD example the Bible gives); rest, reps, W:R computed in v2',
    changeMark: 'kept · FINAL ruling 5: availability gate applied',
  },
  {
    name: 'Low-Intensity Deceleration Drills',
    quality: 'cod_decel',
    workPeriod: '≈5 s (jog in, controlled stop over 15–20 m)',
    restPeriod: '30–45 s walk-back',
    setsRounds: '2–4 reps',
    intensity: 'Low intensity — braking under control',
    workToRest: '≈1:8',
    totalSessionTime: '≈3–5 min',
    properties: ['availability_gate_no_team_training'],
    effortCue: 'This is about braking under control, not stopping like you hit a wall.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'No framework band — COD/Decel is not a row in Sam\'s governing table (mechanics quality). W:R shown for information only. Dose APPROVED AS DRAFTED by Sam\'s FINAL ruling 5.',
    source: 'Bible names this for building-back athletes (L1758) with no dose; structure drafted here and APPROVED by Sam\'s FINAL ruling 5',
    changeMark: 'kept · FINAL ruling 5: dose approved as drafted; availability gate applied',
  },
  {
    name: 'Deceleration and Landing Work',
    quality: 'cod_decel',
    workPeriod: '3–5 s per rep (jump-land-stick / run-and-stick)',
    restPeriod: '45–60 s',
    setsRounds: '3–4 reps',
    intensity: 'Controlled landings, quiet feet — quality-gated',
    workToRest: '≈1:12',
    totalSessionTime: '≈4–5 min',
    properties: ['availability_gate_no_team_training'],
    effortCue: 'Stick the landing — quiet feet, not a crash.',
    baseUnit: 'reps',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'No framework band — COD/Decel is not a row in Sam\'s governing table (mechanics quality). W:R shown for information only. Dose APPROVED AS DRAFTED by Sam\'s FINAL ruling 5. STAYS IN COD per Sam\'s V3-final ruling 3: landing MECHANICS, not jump training (the deleted repeated-jumps session was jump training).',
    source: 'Bible names this (L1739) with no dose; structure drafted here and APPROVED by Sam\'s FINAL ruling 5',
    changeMark: 'kept (V3-final ruling 3) · FINAL ruling 5: dose approved as drafted; availability gate applied',
  },
  {
    name: '45-Degree Cut Reps',
    quality: 'cod_decel',
    workPeriod: '≈4 s (10 m in / cut / 10 m out)',
    restPeriod: '60–90 s (full recovery)',
    setsRounds: '4–6 reps',
    intensity: 'Maximal-intent cut, mechanics-gated',
    workToRest: '≈1:20',
    totalSessionTime: '≈5–9 min',
    properties: ['availability_gate_no_team_training'],
    effortCue: 'Plant foot stays under you — if the knee caves, stop the session.',
    baseUnit: 'distance',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering.',
    frameworkCheck: 'No framework band — COD/Decel is not a row in Sam\'s governing table (mechanics quality). W:R shown for information only. Dose APPROVED AS DRAFTED by Sam\'s FINAL ruling 5.',
    source: 'Standard COD drill, not in the Bible; dose drafted here and APPROVED by Sam\'s FINAL ruling 5',
    changeMark: 'kept · FINAL ruling 5: dose approved as drafted; availability gate applied',
  },

  /* ── Anaerobic ── */
  {
    name: '20 s Max Sprint — Small Dose',
    quality: 'anaerobic',
    workPeriod: '20 s flat out',
    restPeriod: '100 s (start every 2 min)',
    setsRounds: '3 reps',
    intensity: 'Maximal — a 1:40 rest means the efforts must be maximal (Sam)',
    workToRest: '1:5',
    totalSessionTime: '6 min (hard work 60 s)',
    properties: [],
    effortCue: 'All-out for 20 seconds, then really recover. You get 1 min 40 rest, so the efforts must be maximal.',
    baseUnit: 'time',
    modalityNotes: 'Air Bike (native), Row, Ski, Bike — time-based, renders directly. Run: use the Repeat Sprint distance templates instead.',
    frameworkCheck: 'IN BAND (15–60 s, 1:2–1:5). Note: 60 s total hard work sits below the framework\'s 3–8 min — deliberate in-season small dose (Bible L1340).',
    source: 'Bible Sect.7 L1658 / L1340 / L619; Sam\'s maximal-effort cue addition',
    changeMark: 'MOVED from Repeat Sprint (a 20 s effort is glycolytic length, not 4–10 s RSA) + MERGED — \'Assault Bike 20s Repeat\' and \'Air Bike 20s Small Dose\' were one template',
  },
  {
    name: 'Erg Short-Burst Repeats (15–20 s)',
    quality: 'anaerobic',
    workPeriod: '15–20 s hard',
    restPeriod: '45–60 s easy spin/paddle',
    setsRounds: '8–10 reps',
    intensity: 'Very hard — quality reps, not a grind',
    workToRest: '1:3',
    totalSessionTime: '≈8–13 min (hard work 2–3.5 min)',
    properties: [],
    effortCue: 'Short, sharp, honest efforts — quality reps, not a grind.',
    baseUnit: 'time',
    modalityNotes: 'Air Bike, Row, Ski, Bike — time-based, all inside the 8 min cap. Calorie-target rendering is erg-only (Row/Ski/Air Bike/Bike have counters); Run uses the time-only version. The 10 s end of the folded-in rows now lives in Repeat Sprint per Sam\'s under-10 s rule.',
    frameworkCheck: 'IN BAND (15–60 s, 1:2–1:5)',
    source: 'Bible L1273 / L561 / L1340 (assault bike/rower/ski bundled); rest made numeric, W:R + total computed this pass',
    changeMark: 'MERGED — folds in \'Ski/Row Short Bursts\', ⚑ \'Assault Bike Ramp Bursts\', ⚑ \'Short Shuttle Bursts (off-feet analogue)\', ⚑ \'Bike Sprint Micro-Dose\' and ⚑ \'Calorie Burst EMOM\' (one stimulus, five machine/naming variants)',
  },
  {
    name: 'Tabata Finisher',
    quality: 'anaerobic',
    workPeriod: '20 s hard',
    restPeriod: '10 s easy',
    setsRounds: '8 rounds',
    intensity: 'MAXIMAL glycolytic — the last two rounds should hurt',
    workToRest: '2:1',
    totalSessionTime: '4 min, SINGLE SET (hard work 160 s)',
    properties: ['finisher_role_only'],
    effortCue: '20 on, 10 off, eight times — the last two rounds should hurt.',
    baseUnit: 'time',
    modalityNotes: 'ERG ONLY (Row / Ski / Air Bike / Bike) — not prescribed on Run. One set, 4 min max, finisher role only — never the session itself.',
    frameworkCheck: 'IN BAND. CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property). Its true intensity is maximal glycolytic, which files it in Anaerobic; the work-heavy 2:1 is a property of the protocol (Sam FINAL ruling 6).',
    source: 'census \'Tabata Intervals\'; classic protocol, ruled and scoped by Sam\'s FINAL ruling 6',
    changeMark: 'RULED by Sam (FINAL ruling 6): KEEP as ERG-ONLY, FINISHER-ROLE-ONLY, single set, 4 min max, filed Anaerobic. Dose approved — the ⚑ INFERRED mark is retired.',
  },
  {
    name: '30 s Very Hard Repeats',
    quality: 'anaerobic',
    workPeriod: '30 s',
    restPeriod: '90 s easy',
    setsRounds: '6 reps',
    intensity: 'Very hard, not maximal — heavy burn, mechanics stay acceptable',
    workToRest: '1:3',
    totalSessionTime: '12 min (hard work 3 min)',
    properties: [],
    effortCue: 'Long enough that a pure sprint won\'t hold — settle into a hard, honest pace.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities (time-based). Erg rendering absorbed the 20–30 s rower/ski repeat-sprint templates.',
    frameworkCheck: 'IN BAND (15–60 s, 1:2–1:5) — resolves the state sheet\'s own \'anaerobic / aerobic-power boundary\' question at 1:3.',
    source: 'Framework, Anaerobic capacity sessions (\'6×30 s bike very hard, 90 s easy, 1:3\'); Bible L1272 / L1659 / L620',
    changeMark: 'MOVED from Aerobic Power (⚑ \'30s Hard / 30-60s Easy\' — at 1:2–1:3 this is the framework\'s glycolytic 6×30 s session, not aerobic power) + MERGED — folds in \'Rower Repeat Sprint\' + \'Ski Erg Repeat Sprint\' (MOVED from Repeat Sprint; 20–30 s efforts)',
  },
  {
    name: '45 s Hard Repeats',
    quality: 'anaerobic',
    workPeriod: '45 s hard',
    restPeriod: '2 min easy',
    setsRounds: '5 reps',
    intensity: 'Hard — heavy burn, clear freshness drop',
    workToRest: '1:2.7',
    totalSessionTime: '≈13 min (hard work 3.75 min)',
    properties: [],
    effortCue: 'The work stays honest every rep — that\'s the test.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities (time-based).',
    frameworkCheck: 'IN BAND (15–60 s, 1:2–1:5) The descending-rest variant was DROPPED by Sam\'s FINAL ruling 7; the base row stands alone.',
    source: 'Framework, Anaerobic capacity sessions (\'5×45 s hard, 2 min easy, ~1:2.7\'); the ⚑ INFERRED descending-rest variant it replaced is dropped outright (FINAL ruling 7)',
    changeMark: 'RENAMED + FRAMEWORK-ALIGNED (was ⚑ \'Descending Rest Grind\') — GRIND DISSOLVED into Anaerobic per Sam · FINAL ruling 7: descending-rest variant dropped',
  },
  {
    name: '60 s Max Sustained Effort',
    quality: 'anaerobic',
    workPeriod: '60 s all-out',
    restPeriod: '2 min (Sam\'s 1:2 ruling)',
    setsRounds: '4–6 reps',
    intensity: 'All-out sustained — unpleasant by 45 s',
    workToRest: '1:2 (Sam)',
    totalSessionTime: '12–18 min (hard work 4–6 min)',
    properties: [],
    effortCue: 'This is the zone the Bible means by \'grind for up to 1 min\' — it should feel unpleasant by 45 seconds in.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities (time-based). Run: the 150–200 m repeats below are the running-native equivalent.',
    frameworkCheck: 'IN BAND (15–60 s, 1:2–1:5) — the FINAL ruling 8 cap puts the effort length inside the glycolytic column outright.',
    source: 'Bible L1483 (\'grind for up to 1 min\') + Sam\'s edit \'1:2 work to rest ratio\'',
    changeMark: 'MOVED (GRIND DISSOLVED) + MERGED — folds in ⚑ \'1-Minute Effort Ladder\'. Rest per Sam\'s 1:2 ruling · FINAL ruling 8: CAPPED AT 60 s (was 60–90 s).',
  },
  {
    name: '150–200 m Hard Repeats',
    quality: 'anaerobic',
    workPeriod: '22–30 s (150–200 m)',
    restPeriod: 'Remainder of a 2:00 departure cycle (≈90–98 s)',
    setsRounds: '6 reps, departing every 2:00',
    intensity: 'Hard — same pace every rep',
    workToRest: '1:3 (200 m) to 1:4.5 (150 m); Sam\'s ruling: ~1:3–1:4',
    totalSessionTime: '12 min (hard work 2.2–3 min)',
    properties: [],
    effortCue: 'Hold your pace — don\'t let rep 1 write a cheque the last rep can\'t cash. The clock is the rest: you leave every 2:00.',
    baseUnit: 'distance',
    modalityNotes: 'Run/Ski/Row: same nominal distance. Bike: distance ×2 (300–400 m). Air Bike: time via 250 m ≈ 1 min (≈36–48 s).',
    frameworkCheck: 'IN BAND (15–60 s, 1:2–1:5). Sam V3 ruling 2 changed the STRUCTURE, not the label: a fixed 2:00 departure replaces the old \'2–3 min rest\', which is what puts the true ratio in band.',
    source: 'Framework, Anaerobic capacity sessions (\'6×150 m hard\'), re-structured by Sam\'s V3 ruling 2; Bible L1261 / L566',
    changeMark: 'SPLIT from Aerobic Power\'s \'200m/400m Repeats\' (200 m ≈30 s is glycolytic; the 400 m half stayed in Aerobic Power) · SAM V3 RULING 2: DEPARTING EVERY 2:00 — ⚑ RATIO flag cleared, now genuinely in band',
  },
  {
    name: 'Hill Repeats — hard sustained',
    quality: 'anaerobic',
    workPeriod: '40–60 s hill effort (short variant: 15–20 s over 50–100 m)',
    restPeriod: 'Walk-down, 2–3 min (short variant ≈60–90 s)',
    setsRounds: '4–6 reps (short variant 6–10)',
    intensity: 'Hard and honest, NOT a max sprint',
    workToRest: '1:2–1:3 (short variant ≈1:4)',
    totalSessionTime: '≈12–18 min',
    properties: [],
    effortCue: 'A hard, honest grind up the hill — not a flat-out sprint, and every rep looks the same.',
    baseUnit: 'time',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering. Hill terrain required. Distinct from Acceleration\'s Hill Acceleration (8×6 s alactic).',
    frameworkCheck: 'IN BAND (15–60 s, 1:2–1:5)',
    source: 'Bible L1550 / L1738 re-read for fatigue use; doses reconciled this pass (both source rows were ⚑ INFERRED)',
    changeMark: 'MOVED (GRIND DISSOLVED) + MERGED — folds ⚑ \'Hill Sprint Repeats (fatigue-resistance use)\' + ⚑ \'Long Hill Repeats\' into one row. Cue rewritten to stand alone (Sam\'s note).',
  },
  {
    name: 'Bodyweight Circuit (no-equipment fallback)',
    quality: 'anaerobic',
    workPeriod: '30–40 s per movement × 4 movements',
    restPeriod: '15–20 s transitions; 90 s between rounds',
    setsRounds: '4–5 rounds',
    intensity: 'Sustained hard — honest effort throughout',
    workToRest: '≈2:1',
    totalSessionTime: '≈12–15 min',
    properties: ['fallback_only'],
    effortCue: 'No equipment excuse for this one — just sustained honest effort.',
    baseUnit: 'time',
    modalityNotes: 'Modality-agnostic bodyweight work — doesn\'t route through the Run/Bike/Ski/Row/Air Bike rendering rules. USE ONLY when there is genuinely no equipment; never in-season or pre-season (Sam).',
    frameworkCheck: 'IN BAND. CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property). Sustained hard circuit intensity classifies it in Anaerobic; the work-heavy ratio is a property of the circuit format.',
    source: 'Standard MetCon-style circuit, not in the Bible or the framework; dose approved and scoped by Sam\'s FINAL ruling 9',
    changeMark: 'MOVED (GRIND DISSOLVED) + RESTRICTED per Sam · FINAL ruling 9: KEPT with a FALLBACK-ONLY property. Dose approved — the ⚑ INFERRED mark is retired.',
  },

  /* ── Aerobic Power ── */
  {
    name: 'Classic 4×4',
    quality: 'aerobic_power',
    workPeriod: '4 min hard',
    restPeriod: '3 min complete rest',
    setsRounds: '4 reps',
    intensity: '90–100% MAS; HR 90–95% max late',
    workToRest: '4:3 (1.33:1)',
    totalSessionTime: '28 min (hard work 16 min)',
    properties: [],
    /* ⚠ **RE-SIGNED BY SAM, 2026-08-26, VERBATIM.** The longer 2026-08-20 cue
     * made this card too long. His simulator ruling replaces it with this one
     * sentence; this is a source change, not projection punctuation repair. */
    effortCue: 'Choose a pace you can repeat across all 4 rounds.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities — 4 min is inside the 8 min erg cap; Air Bike is time-native.',
    frameworkCheck: 'IN BAND (1–5 min, 1:1–2:1)',
    source: 'Framework, Aerobic power session 1 (\'Classic 4×4 — 4×4 min hard, 3 min easy\'); Bible L557 / L1269 / L573',
    changeMark: 'MERGED — folds in \'4min Hard / 2-3min Easy\', \'4min Hard / 3min Easy\', ⚑ \'Bike VO2\', ⚑ \'4x4 VO2\'. The framework RESOLVES the state sheet\'s flagged rest discrepancy at 3 min.',
  },
  {
    name: 'Three-Minute Intervals',
    quality: 'aerobic_power',
    workPeriod: '3 min hard',
    restPeriod: '2 min easy',
    setsRounds: '6 reps',
    intensity: '90–100% MAS; HR 90–95% max late',
    workToRest: '3:2 (1.5:1)',
    totalSessionTime: '30 min (hard work 18 min)',
    properties: [],
    effortCue: 'Full-body effort, held honest — let the legs drive, and hold the pace rather than surviving it.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities — 3 min is inside the 8 min erg cap (and inside the preferred 6 min).',
    frameworkCheck: 'IN BAND (1–5 min, 1:1–2:1)',
    source: 'Framework, Aerobic power session 2 (\'6×3 min hard, 2 min easy\'); Bible L572 / L574 / L575',
    changeMark: 'MERGED — folds in ⚑ \'Ski Intervals (hard)\', ⚑ \'Row Intervals (hard)\', \'Assault Bike Hard Intervals\' (same stimulus, machine only) + FRAMEWORK-ALIGNED to 6×3 min / 2 min',
  },
  {
    name: 'Two-Minute Repeats',
    quality: 'aerobic_power',
    workPeriod: '2 min hard',
    restPeriod: '2 min easy',
    setsRounds: '6–8 reps',
    // Re-signed plain by Sam 2026-08-05 (ruling 1,
    // docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md): same shape and reasoning
    // as the 15:15 cell — no function citation in a signed cell.
    intensity: '≈100% MAS',
    workToRest: '1:1',
    totalSessionTime: '24–32 min (hard work 12–16 min)',
    properties: [],
    effortCue: 'This is engine work — pace it off your actual MAS, not what feels good on rep 1.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities — inside the erg cap.',
    frameworkCheck: 'IN BAND (1–5 min, 1:1–2:1)',
    source: 'Framework, Aerobic power session 3 (\'6–8×2 min hard, 2 min easy\'); Bible L565 / L1359',
    changeMark: 'RENAMED + SCHEMA-FILLED (was \'MAS Intervals (longer-rep)\', which described \'1-4 min reps, standard rest\' and could not carry a concrete schema) — dosed to the framework\'s session 3',
  },
  {
    name: 'MAS 15:15 Blocks',
    quality: 'aerobic_power',
    workPeriod: '15 s hard',
    restPeriod: '15 s easy',
    setsRounds: '8 rounds × 2–3 blocks, 2 min between blocks',
    // Re-signed plain by Sam 2026-08-05 (docs/MAS_CELL_RESIGN_RULING_2026-08-05.md):
    // no function citation; a POINT value, not a range, so per-athlete
    // distance derives exactly at render when MAS wiring lands.
    intensity: '110% MAS',
    workToRest: '1:1',
    totalSessionTime: '≈12–19 min (hard work 4–6 min)',
    properties: ['set_length_max_4_5_min'],
    effortCue: '15 seconds is short enough to go hard — actually go hard.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities — time-based, well inside the cap.',
    frameworkCheck: 'CONFIRMED by Sam (FINAL ruling 1): high-%MAS short reps build aerobic power PROVIDED THE SET STAYS CONTAINED — set/block <= ~4–5 min. This row already complies: 8 rounds = a 4 min block. CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property).',
    source: 'Bible L1271 / L1260 / L559; census \'MAS 15:15 Blocks\'; framework\'s short-intermittent 100–110% MAS intensity line; set-length rule confirmed by Sam\'s FINAL ruling 1',
    changeMark: 'MOVED from Anaerobic — 1:1 at 110% MAS is the framework\'s short-intermittent aerobic-power family (its own 30:15 session), not glycolytic 1:2–1:5 + MERGED — folds in ⚑ \'Broken 15s Ladder\'',
  },
  {
    name: '30:30 Hard Intermittent',
    quality: 'aerobic_power',
    workPeriod: '30 s hard',
    restPeriod: '30 s easy; 2–3 min between blocks',
    setsRounds: '2 blocks × 5 rounds (5 min per block)',
    intensity: '100–110% MAS — hard and repeatable',
    workToRest: '1:1',
    totalSessionTime: '≈12–13 min (hard work 5 min)',
    properties: ['set_length_max_4_5_min'],
    effortCue: 'Hard, but it has to be repeatable for every round of the block — not a sprint.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities. Distinguish clearly from Aerobic Capacity\'s controlled 30:30, which is a tempo template.',
    frameworkCheck: 'CONFIRMED by Sam (FINAL ruling 1): high-%MAS short reps build aerobic power PROVIDED THE SET STAYS CONTAINED — set/block <= ~4–5 min. RESTRUCTURED to comply: 8–10 unbroken rounds ran 8–10 min, over the cap, so the session is now 2 blocks of 5 rounds. CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property).',
    source: 'Bible L1341 read as the harder variant; framework\'s 100–110% MAS short-intermittent line; blocked to Sam\'s FINAL ruling 1 set-length rule',
    changeMark: 'MOVED from Anaerobic (was ⚑ \'30:30 Short Circuit\') — 1:1 with repeatable-hard intent is aerobic-power-shaped, not glycolytic',
  },
  {
    name: 'Footy Shuttles',
    quality: 'aerobic_power',
    workPeriod: '1 min hard shuttle',
    restPeriod: '1 min walk/jog',
    setsRounds: '3 sets × 5 reps, 3 min between sets',
    intensity: 'Hard, controlled — finish near the aerobic ceiling, not merely fatigued',
    workToRest: '1:1',
    totalSessionTime: '36 min (hard work 15 min)',
    properties: [],
    effortCue: 'Hard passages with real walk-jog recovery — the last set should look like the first.',
    baseUnit: 'time',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering. (shuttle format).',
    frameworkCheck: 'IN BAND (1–5 min, 1:1–2:1)',
    source: 'Framework, Aerobic power session 5 (\'Footy shuttles — 3×5 reps 1 min hard shuttle, 1 min walk/jog, 3 min between sets\')',
    changeMark: 'MOVED (GRIND DISSOLVED — was ⚑ \'Shuttle Grind\') + FRAMEWORK-ALIGNED to the framework\'s own footy-shuttle session',
  },
  {
    name: '1 km Repeats',
    quality: 'aerobic_power',
    workPeriod: '3.5–4 min (1 km)',
    restPeriod: 'up to 3 min controlled',
    setsRounds: '4–6 reps',
    intensity: '90–100% MAS — even splits',
    workToRest: '≈1.3:1',
    totalSessionTime: '≈26–42 min',
    properties: [],
    effortCue: 'Even splits beat a fast first rep and a crawl on the last.',
    baseUnit: 'distance',
    modalityNotes: 'Run/Ski/Row: same nominal distance (1 km). Bike: 2 km. Air Bike: time via 250 m ≈ 1 min —> ≈4 min work.',
    frameworkCheck: 'IN BAND (1–5 min, 1:1–2:1)',
    source: 'Bible L558 / L1270; census \'6x1km\' / \'1km Repeat Intervals\'',
    changeMark: 'kept',
  },
  {
    name: '400 m Repeats',
    quality: 'aerobic_power',
    workPeriod: '75–80 s (400 m)',
    restPeriod: 'Remainder of a 3:00 departure cycle (≈100–105 s)',
    setsRounds: '4–6 reps, departing every 3:00',
    intensity: 'Hard, controlled — should genuinely hurt by rep 3',
    workToRest: '≈1:1.3 (1:1 for an athlete running ≈90 s)',
    totalSessionTime: '12–18 min',
    properties: [],
    effortCue: 'Hold your pace — it should genuinely hurt by rep 3, and rep 6 should still look like rep 1. The clock is the rest: you leave every 3:00.',
    baseUnit: 'distance',
    modalityNotes: 'Run/Ski/Row: same nominal distance. Bike: 800 m. Air Bike: time via 250 m ≈ 1 min (≈96 s).',
    frameworkCheck: 'IN BAND. CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property). Aerobic-power intensity classifies it here, and Sam\'s V3-final ruling 2 (departing every 3:00) brings the ratio to ~1:1-ish as well. Ratio flag cleared.',
    source: 'Bible L1261 / L566; census \'200m/400m Repeat Runs\'; re-structured by Sam\'s V3-final ruling 2',
    changeMark: 'MOVED (GRIND DISSOLVED) + MERGED with the 400 m half of \'200m/400m Repeats\' · SAM V3-FINAL RULING 2: structure changed to DEPARTING EVERY 3:00 — ⚑ RATIO flag cleared',
  },
  {
    name: 'Erg EMOM',
    quality: 'aerobic_power',
    workPeriod: '40 s hard',
    restPeriod: '20 s (remainder of the minute); 2–3 min between blocks',
    setsRounds: '2–3 blocks × 5 rounds (5 min per block)',
    intensity: 'Hard — the clock is the rest',
    workToRest: '2:1',
    totalSessionTime: '≈12–21 min (hard work 6.7–10 min)',
    properties: ['set_length_max_4_5_min'],
    effortCue: 'The clock is the rest — don\'t waste the front of the minute.',
    baseUnit: 'time_or_calories',
    modalityNotes: 'Ski, Row, Air Bike, Bike (Bible names it cross-modality). Run works too.',
    frameworkCheck: 'CONFIRMED by Sam (FINAL ruling 1): high-%MAS short reps build aerobic power PROVIDED THE SET STAYS CONTAINED — set/block <= ~4–5 min. RESTRUCTURED to comply: 10–15 unbroken rounds ran 10–15 min, over the cap, so the session is now blocks of 5 rounds. CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property).',
    source: 'Bible L576; the 40 s / 20 s split was drafted here and is CONFIRMED by Sam\'s FINAL ruling 1; blocked to the set-length rule',
    changeMark: 'SPLIT CONFIRMED by Sam (FINAL ruling 1) — the ⚑ INFERRED mark is retired · RESTRUCTURED into blocks to meet the set-length rule',
  },

  /* ── Aerobic Capacity ── */
  {
    name: 'Continuous Aerobic Run',
    quality: 'aerobic_capacity',
    workPeriod: '30–50 min continuous (duration menu: 30 / 40 / 50 / 60 min — Sam\'s D12 convention preserved)',
    restPeriod: 'none (continuous)',
    setsRounds: '1 block',
    intensity: '65–80% MAS; 70–85% HRmax; conversational',
    workToRest: 'continuous',
    totalSessionTime: '30–60 min',
    properties: [],
    effortCue: 'Steady the whole way — if you\'re racing the last 10 minutes, you started too easy.',
    baseUnit: 'time',
    modalityNotes: 'Run/Bike ONLY (a continuous block far above the 8 min erg cap). Ski/Row/Air Bike substitute \'Steady Blocks\' below.',
    frameworkCheck: 'IN BAND (longer/continuous, 3:1–continuous)',
    source: 'Framework, Aerobic capacity session 1 (\'Continuous aerobic run — 30–50 min comfortable\'); census \'Long Run\'; PROGRAMMING_DESIGN_SESSION D12 duration menu',
    changeMark: 'MOVED from Flush (⚑ \'Long Run\') + MERGED — folds in \'Longer Aerobic Base (35-60min)\' and ⚑ \'Duration Menu (30/40/50/60min)\'. 30–60 min at 65–80% MAS is the framework\'s aerobic-capacity session 1; Flush is recovery-intent.',
  },
  {
    name: 'Long Aerobic Intervals',
    quality: 'aerobic_capacity',
    workPeriod: '10 min steady',
    restPeriod: '2 min easy',
    setsRounds: '3 reps',
    intensity: '70–80% MAS; 70–85% HRmax',
    workToRest: '5:1',
    totalSessionTime: '34 min',
    properties: [],
    effortCue: 'This should feel comfortably hard, not a race — near-identical output on all three.',
    baseUnit: 'time',
    modalityNotes: 'Run/Bike ONLY (10 min > the 8 min erg cap). Ski/Row/Air Bike use \'Steady Blocks\' below.',
    frameworkCheck: 'IN BAND (longer/continuous, 3:1–continuous)',
    source: 'Framework, Aerobic capacity session 2 (\'3×10 min steady, 2 min easy\'); Bible L1221',
    changeMark: 'RENAMED + SCHEMA-FILLED (was \'Cruise Intervals\' — \'controlled repeat efforts, standard rest\' carried no numbers) — dosed to the framework\'s session 2',
  },
  {
    name: 'Steady Blocks (3×8 min or 4×6 min)',
    quality: 'aerobic_capacity',
    workPeriod: '6–8 min',
    restPeriod: '1–2 min easy',
    setsRounds: '3 × 8 min, or 4 × 6 min',
    intensity: '65–75% MAS, easy-moderate — steady, not surging',
    workToRest: '4:1–8:1',
    totalSessionTime: '26–30 min',
    properties: [],
    effortCue: 'Steady, not surging — find a pace you could hold for the full block.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities. 8 min is the HARD cap on Ski/Row/Air Bike with no margin — prefer the 4×6 min rendering there (rule 3).',
    frameworkCheck: 'IN BAND (longer/continuous, 3:1–continuous)',
    source: 'Bible L522 / L523 / L1231; off-feet cap L1318 / L1319 / L4102; census \'Bike/Row/Ski Tempo Intervals\'',
    changeMark: 'MERGED — folds in \'4x6min Blocks\', ⚑ \'Ski Erg Tempo Blocks\', ⚑ \'Row Tempo Blocks\' (same stimulus; the two erg rows were machine renderings of this template)',
  },
  {
    name: 'Controlled 10–20 min Blocks',
    quality: 'aerobic_capacity',
    workPeriod: '10–20 min',
    restPeriod: '2–3 min easy',
    setsRounds: '1–2 blocks',
    intensity: '70–80% MAS controlled tempo',
    workToRest: '5:1–10:1',
    totalSessionTime: '12–43 min',
    properties: [],
    effortCue: 'Hold the pace, don\'t let it drift into \'easy\' by minute 15.',
    baseUnit: 'time',
    modalityNotes: 'Run/Bike ONLY per the 8 min cap (rule 3). Ski/Row/Air Bike substitute \'Steady Blocks\'.',
    frameworkCheck: 'IN BAND (longer/continuous, 3:1–continuous)',
    source: 'Bible L1231; rest + W:R + total filled this pass',
    changeMark: 'kept',
  },
  {
    name: 'Steady 5 min Blocks',
    quality: 'aerobic_capacity',
    workPeriod: '5 min',
    restPeriod: '1 min easy',
    setsRounds: '5 reps',
    intensity: '65–80% MAS steady-moderate — tempo zone, not VO2',
    workToRest: '5:1',
    totalSessionTime: '29 min',
    properties: [],
    effortCue: 'Moderate-hard, not hard-hard — this is the tempo zone, not VO2.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities (5 min is inside the erg cap and the preferred 6 min).',
    frameworkCheck: 'IN BAND (longer/continuous, 3:1–continuous)',
    source: 'Framework, Aerobic capacity session 5 (\'Bike/rower capacity — 5×5 min steady-moderate, 1 min easy\'); Bible L1238',
    changeMark: 'RENAMED + FRAMEWORK-ALIGNED (was \'3-5min Moderate Blocks\' with \'easy recovery between\') — dosed to the framework\'s session 5',
  },
  {
    name: 'Aerobic Shuttles',
    quality: 'aerobic_capacity',
    workPeriod: '6 min controlled shuttle',
    restPeriod: '90 s easy',
    setsRounds: '4 reps',
    intensity: '65–75% MAS — controlled, NOT the COD shuttle at max',
    workToRest: '4:1',
    totalSessionTime: '≈28.5 min',
    properties: [],
    effortCue: 'Controlled means controlled — this isn\'t the COD shuttle at max effort.',
    baseUnit: 'time',
    modalityNotes: 'Run-only (field sprint/cutting mechanics; rule 4). No machine rendering. (shuttle format). Other modalities: use \'Steady Blocks\'.',
    frameworkCheck: 'IN BAND (longer/continuous, 3:1–continuous)',
    source: 'Framework, Aerobic capacity session 4 (\'Aerobic shuttles — 4×6 min controlled, 90 s easy\'); Bible L1222',
    changeMark: 'SCHEMA-FILLED (was ⚑ \'Controlled Shuttles\' with no dose) — dosed to the framework\'s session 4',
  },
  {
    name: 'Extensive Tempo (100 m repeats)',
    quality: 'aerobic_capacity',
    workPeriod: '≈16 s per 100 m',
    restPeriod: '30 s walk between reps; 2–3 min between sets',
    setsRounds: '2 sets × 8 reps',
    intensity: '65–75% — game-speed rhythm, same pace every rep',
    workToRest: '≈1:2',
    totalSessionTime: '≈15 min',
    properties: [],
    effortCue: 'Same pace every rep — that\'s the actual test here. Think game-speed rhythm, not a track session.',
    baseUnit: 'distance',
    modalityNotes: 'Run/Ski/Row: same nominal distance. Bike: 200 m. Air Bike: time via 250 m ≈ 1 min (≈24 s).',
    frameworkCheck: 'CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property). Controlled tempo intensity (65–80% MAS) puts this in Aerobic Capacity; its aerobic-power-shaped W:R is a property of the session, not a misfiling. Sam V3-final ruling 1 — ratio flag cleared. Ratio label corrected to ~1:2 by V3 ruling 3 (the framework\'s \'~2:1\' was a labelling error); the session is unchanged.',
    source: 'Framework, Aerobic capacity session 3 (\'Extensive tempo — 2×8×100 m @65–75%, walk 30 s, 2–3 min between sets\'), ratio label corrected per Sam V3 ruling 3; Bible L1223 / L1224',
    changeMark: 'SCHEMA-FILLED + MERGED — folds in ⚑ \'Footy-Style Run-Throughs\' (controlled run-throughs are this stimulus); dosed to the framework\'s session 3',
  },
  {
    name: '2 min On / 1 min Easy',
    quality: 'aerobic_capacity',
    workPeriod: '2 min',
    restPeriod: '1 min easy',
    setsRounds: '6–8 rounds',
    intensity: '70–80% MAS — builds, doesn\'t fully recover',
    workToRest: '2:1',
    totalSessionTime: '18–24 min',
    properties: [],
    effortCue: 'The rest is short on purpose — this should build, not fully recover.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities (time-based, inside the cap).',
    frameworkCheck: 'CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property). Controlled tempo intensity (65–80% MAS) puts this in Aerobic Capacity; its aerobic-power-shaped W:R is a property of the session, not a misfiling. Sam V3-final ruling 1 — ratio flag cleared.',
    source: 'Bible L1230 / L1226–1230; census \'Assault Bike Intervals\' / \'Air Bike Sprints\'',
    changeMark: 'MERGED — folds in ⚑ \'Assault Bike / Air Bike Tempo Intervals\' (machine rendering of this exact structure; its 30:30 alternative folds into the 30:30 row below)',
  },
  {
    name: '30:30 Controlled Tempo Blocks',
    quality: 'aerobic_capacity',
    workPeriod: '30 s on',
    restPeriod: '30 s easy',
    setsRounds: '10–16 rounds',
    intensity: '65–80% MAS — controlled, NOT max',
    workToRest: '1:1',
    totalSessionTime: '10–16 min',
    properties: [],
    effortCue: 'Controlled, not max — you should be able to hold a conversation in three words by the end, not one.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities. Distinguish clearly from Aerobic Power\'s 30:30 Hard Intermittent.',
    frameworkCheck: 'CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property). Controlled tempo intensity (65–80% MAS) puts this in Aerobic Capacity; its aerobic-power-shaped W:R is a property of the session, not a misfiling. Sam V3-final ruling 1 — ratio flag cleared.',
    source: 'Bible L1228; census \'30:30 Tempo Blocks\'',
    changeMark: 'kept (absorbs the 30:30 alternative from the merged Air Bike tempo row)',
  },
  {
    name: '1 min On / 1 min Easy Tempo',
    quality: 'aerobic_capacity',
    workPeriod: '1 min',
    restPeriod: '1 min easy',
    setsRounds: '8–12 rounds',
    intensity: '65–80% MAS controlled tempo',
    workToRest: '1:1',
    totalSessionTime: '16–24 min',
    properties: [],
    effortCue: 'Same idea as the 30:30, longer rhythm — settle into it.',
    baseUnit: 'time',
    modalityNotes: 'All 5 modalities (time-based, inside the cap).',
    frameworkCheck: 'CLASSIFIED BY INTENSITY (Sam\'s V3-final law: intensity classifies, W:R is only a property). Controlled tempo intensity (65–80% MAS) puts this in Aerobic Capacity; its aerobic-power-shaped W:R is a property of the session, not a misfiling. Sam V3-final ruling 1 — ratio flag cleared.',
    source: 'Bible L1229; census \'Tempo Intervals (1min on / 1min easy)\'',
    changeMark: 'kept',
  },

  /* ── Flush ── */
  {
    name: 'Short Flush',
    quality: 'flush',
    workPeriod: '10–20 min continuous easy',
    restPeriod: 'none (continuous)',
    setsRounds: '1 block',
    intensity: 'Very easy, 3–4/10 — finish better than you started',
    workToRest: 'continuous',
    totalSessionTime: '10–20 min',
    properties: [],
    effortCue: 'In and done — should finish feeling better than you started, full stop.',
    baseUnit: 'time',
    modalityNotes: 'Run/Bike continuous. Ski/Row: one continuous 8–10 min block is the cap-compliant option (rule 3); Air Bike allowed (ruling 5).',
    frameworkCheck: 'No framework band — Flush is recovery, not a trained quality, and has no row in Sam\'s governing table.',
    source: 'Bible L1500 / L1189 / L527; census \'Flush Run\'',
    changeMark: 'CONFIRMED by Sam (V3 ruling 5) — draft marker removed. MERGED — folds in \'8-12min Easy Flush (Run)\' + \'Short Flush (15-25min)\'',
  },
  {
    name: 'Easy Aerobic Flush',
    quality: 'flush',
    workPeriod: '20–30 min continuous, or a run/walk mix',
    restPeriod: 'none (continuous)',
    setsRounds: '1 block',
    intensity: 'Easy, 3–6/10; full-conversation pace',
    workToRest: 'continuous',
    totalSessionTime: '20–30 min',
    properties: [],
    effortCue: 'Comfortable pace the whole way — walk-jog is a legitimate choice here, not a cop-out.',
    baseUnit: 'time',
    modalityNotes: 'Run (grass preferred where available), Bike — both continuous, no cap issue. Ski/Row/Air Bike: use the erg or interval flushes below.',
    frameworkCheck: 'No framework band — Flush is recovery, not a trained quality, and has no row in Sam\'s governing table.',
    source: 'Bible L508–511 / L516 / L1190 / L528; Recovery + Easy aerobic sections; census \'Easy Bike\'',
    changeMark: 'CONFIRMED by Sam (V3 ruling 5) — draft marker removed. MERGED — folds in \'Easy Run / Walk-Jog\', \'Normal Easy Aerobic (25-40min)\' (capped at 30 min here), \'Controlled Easy Grass Run\' (grass becomes a surface note), \'Easy Bike\', ⚑ \'Zone 2 Bike\'',
  },
  {
    name: 'Nasal-Paced Easy',
    quality: 'flush',
    workPeriod: '20–40 min continuous, nasal-breathing-paced',
    restPeriod: 'none (continuous)',
    setsRounds: '1 block',
    intensity: 'Self-limiting — nasal breathing sets the ceiling',
    workToRest: 'continuous',
    totalSessionTime: '20–40 min',
    properties: [],
    effortCue: 'If you have to open your mouth to breathe, you\'re going too hard.',
    baseUnit: 'time',
    modalityNotes: 'Run/Bike — nasal pacing doesn\'t translate to erg work.',
    frameworkCheck: 'No framework band — Flush is recovery, not a trained quality, and has no row in Sam\'s governing table.',
    source: 'Bible L510; census \'Long Nasal Run\'; duration filled in v2',
    changeMark: 'CONFIRMED by Sam (V3 ruling 5) — draft marker removed. kept as a distinct method (was \'Long Nasal Run\'); duration made numeric',
  },
  {
    name: 'Erg Flush Blocks',
    quality: 'flush',
    workPeriod: '8 min easy (or one continuous 8–10 min block on Ski/Row)',
    restPeriod: '2 min',
    setsRounds: '3 blocks, rotating bike / ski / row',
    intensity: 'Easy — low intensity even though it\'s a rotation',
    workToRest: '4:1',
    totalSessionTime: '26 min',
    properties: [],
    effortCue: 'Rotate through the ergs so nothing gets boring or overloaded — and keep it genuinely easy.',
    baseUnit: 'time',
    modalityNotes: 'Ski/Row/Bike rotation; Air Bike allowed. 8 min sits exactly at the cap with no margin (rule 3).',
    frameworkCheck: 'No framework band — Flush is recovery, not a trained quality, and has no row in Sam\'s governing table. Already mixes machines by construction (see the mid-session mixing property, ruling 5).',
    source: 'Bible L497 / L1318 / L1319 / L4102 / L1341; census \'Easy Ski\' / \'Easy Row\' / \'Light Circuits\'',
    changeMark: 'CONFIRMED by Sam (V3 ruling 5) — draft marker removed. MERGED — folds in \'3x8min Easy Mixed Erg Blocks\', \'Single Continuous Block, 8-10min max (Ski/Row)\', ⚑ \'Light Circuits\'',
  },
  {
    name: 'Flush Intervals 30:30',
    quality: 'flush',
    workPeriod: '30 s',
    restPeriod: '30 s easy',
    setsRounds: '15–30 rounds (to fill 15–30 min)',
    intensity: '3–4/10 MAX (Sam)',
    workToRest: '1:1',
    totalSessionTime: '15–30 min',
    properties: ['mid_session_mixing_flush_only'],
    effortCue: 'Easy flushout — mix of ergos and/or running.',
    baseUnit: 'time',
    modalityNotes: 'ANY modality. MID-SESSION MIXING ALLOWED (flush-only property, Sam V3 ruling 5): rotate machines and/or running BETWEEN ROUNDS — row a round, bike a round, jog a round. No cap issue: no work interval exceeds 2 min.',
    frameworkCheck: 'No framework band — Flush is recovery, not a trained quality, and has no row in Sam\'s governing table. Intensity is capped at 3–4/10 by Sam\'s ruling, which is what keeps an interval structure a FLUSH and not a tempo session (cf. the Aerobic Capacity 30:30).',
    source: 'Sam-authored, V3 ruling 5 (2026-07-25)',
    changeMark: 'NEW — Sam-authored (V3 ruling 5)',
  },
  {
    name: 'Flush Intervals 1:1 (1 min / 1 min)',
    quality: 'flush',
    workPeriod: '1 min',
    restPeriod: '1 min easy',
    setsRounds: '8–15 rounds (to fill 15–30 min)',
    intensity: '3–4/10 MAX (Sam)',
    workToRest: '1:1',
    totalSessionTime: '16–30 min',
    properties: ['mid_session_mixing_flush_only'],
    effortCue: 'Easy flushout — mix of ergos and/or running.',
    baseUnit: 'time',
    modalityNotes: 'ANY modality. MID-SESSION MIXING ALLOWED (flush-only property, Sam V3 ruling 5): rotate machines and/or running BETWEEN ROUNDS — row a round, bike a round, jog a round. No cap issue: no work interval exceeds 2 min.',
    frameworkCheck: 'No framework band — Flush is recovery, not a trained quality, and has no row in Sam\'s governing table. Intensity is capped at 3–4/10 by Sam\'s ruling, which is what keeps an interval structure a FLUSH and not a tempo session (cf. the Aerobic Capacity 30:30).',
    source: 'Sam-authored, V3 ruling 5 (2026-07-25)',
    changeMark: 'NEW — Sam-authored (V3 ruling 5)',
  },
  {
    name: 'Flush Intervals 2:1 (2 min / 1 min)',
    quality: 'flush',
    workPeriod: '2 min',
    restPeriod: '1 min easy',
    setsRounds: '5–10 rounds (to fill 15–30 min)',
    intensity: '3–4/10 MAX (Sam)',
    workToRest: '2:1',
    totalSessionTime: '15–30 min',
    properties: ['mid_session_mixing_flush_only'],
    effortCue: 'Easy flushout — mix of ergos and/or running.',
    baseUnit: 'time',
    modalityNotes: 'ANY modality. MID-SESSION MIXING ALLOWED (flush-only property, Sam V3 ruling 5): rotate machines and/or running BETWEEN ROUNDS — row a round, bike a round, jog a round. No cap issue: no work interval exceeds 2 min.',
    frameworkCheck: 'No framework band — Flush is recovery, not a trained quality, and has no row in Sam\'s governing table. Intensity is capped at 3–4/10 by Sam\'s ruling, which is what keeps an interval structure a FLUSH and not a tempo session (cf. the Aerobic Capacity 30:30).',
    source: 'Sam-authored, V3 ruling 5 (2026-07-25)',
    changeMark: 'NEW — Sam-authored (V3 ruling 5)',
  },
];

/* ── Legacy format map ── */

/**
 * How each pre-template conditioning format resolves once Stage B switches
 * selection onto the authored sheet.
 *
 * Recorded rather than inferred: a name that quietly stops resolving is how a
 * session silently changes shape. `retired` entries name the ruling that
 * retired them so nothing is dropped without provenance.
 */
export type LegacyFormatResolution =
  | { readonly kind: 'template'; readonly templateName: string; readonly note: string }
  | { readonly kind: 'retired'; readonly ruling: string };

export interface LegacyConditioningFormat {
  /** The name or shape as the pre-template generation path referred to it. */
  readonly legacyName: string;
  readonly resolution: LegacyFormatResolution;
}

export const LEGACY_CONDITIONING_FORMAT_MAP: readonly LegacyConditioningFormat[] = [
  {
    legacyName: 'Easy Aerobic Flush',
    resolution: {
      kind: 'template',
      templateName: 'Easy Aerobic Flush',
      note: 'Name survives unchanged into the Flush tab.',
    },
  },
  {
    legacyName: 'Short Flush',
    resolution: { kind: 'template', templateName: 'Short Flush', note: 'Survives unchanged.' },
  },
  {
    legacyName: 'Continuous Aerobic Run',
    resolution: {
      kind: 'template',
      templateName: 'Continuous Aerobic Run',
      note: 'Survives unchanged into Aerobic Capacity.',
    },
  },
  {
    legacyName: 'Classic 4x4',
    resolution: {
      kind: 'template',
      templateName: 'Classic 4×4',
      note: 'ASCII "4x4" becomes the authored "4×4" (multiplication sign).',
    },
  },
  {
    legacyName: 'MetCon',
    resolution: {
      kind: 'retired',
      ruling:
        'Sam FINAL ruling 20 — MetCon stays dead as a conditioning name; both copies removed and the name retired from the conditioning vocabulary.',
    },
  },
  {
    legacyName: 'Grind',
    resolution: {
      kind: 'retired',
      ruling:
        'Sam ruling — the Grind tab is DISSOLVED into Anaerobic. Sessions survive under anaerobic capacity; the quality name does not.',
    },
  },
  {
    legacyName: 'Repeated Jumps (5×3 broad jumps)',
    resolution: {
      kind: 'retired',
      ruling:
        'Sam V3 ruling 4 — deleted entirely from conditioning; jump work lives in the POWER SYSTEM only.',
    },
  },
  {
    legacyName: 'Resisted Band Acceleration',
    resolution: { kind: 'retired', ruling: 'Sam FINAL ruling 11 — BINNED.' },
  },
  {
    legacyName: 'Inverse Tabata',
    resolution: {
      kind: 'template',
      templateName: '10 s Repeat Efforts',
      note: 'Sam FINAL ruling 12 — restructured to 10 s / 30 s and renamed; now an RSA row.',
    },
  },
  {
    legacyName: 'Tabata',
    resolution: {
      kind: 'template',
      templateName: 'Tabata Finisher',
      note: 'Sam FINAL ruling 14 — erg-only, finisher-role-only, single set, 4 min max. Run removed.',
    },
  },
  {
    legacyName: 'Short COD Circuit',
    resolution: { kind: 'retired', ruling: 'Sam FINAL ruling 13 — binned; COD keeps 4 rows.' },
  },
  {
    legacyName: 'COD Finisher',
    resolution: { kind: 'retired', ruling: 'Sam FINAL ruling 13 — binned; COD keeps 4 rows.' },
  },
  {
    legacyName: '60-90 s Max Sustained',
    resolution: {
      kind: 'template',
      templateName: '60 s Max Sustained Effort',
      note: 'Sam FINAL ruling 16 — capped at 60 s; effort length sits inside the glycolytic column.',
    },
  },
  {
    legacyName: '45 s Hard Repeats (descending-rest variant)',
    resolution: {
      kind: 'template',
      templateName: '45 s Hard Repeats',
      note: 'Sam FINAL ruling 15 — descending-rest variant dropped; the base row stands.',
    },
  },
  {
    legacyName: 'Bike power 8×6 s',
    resolution: {
      kind: 'template',
      templateName: 'Air Bike Accelerations',
      note: 'Sam V3 ruling 4 — the framework session now has a home row inside Acceleration.',
    },
  },
];

/**
 * Framework sessions Sam named that still have NO template row. Listed rather
 * than invented — a dose the sheet does not carry must not be manufactured
 * here, per the Bible's "a layer that invents its own conditioning dose is a
 * defect".
 */
export const FRAMEWORK_SESSIONS_WITHOUT_TEMPLATE: readonly string[] = [
  '30:15 intervals',
  'hard shuttles 2×4×30 s',
  'footy repeat efforts 3×4×20 s',
];
