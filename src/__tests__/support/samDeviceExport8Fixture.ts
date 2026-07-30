/**
 * SAM'S DEVICE, AS A CONFORMANCE TARGET — not a seed.
 *
 * SAM'S RULING (2026-07-30): seeding a harness from a device export is
 * SAMPLING, not coverage. It proves things about one state and quietly implies
 * things about the space around it, and the space is where the defects live.
 * Hand-built state fixtures for athlete-facing suites are deprecated as a class
 * (AGENTS.md, beside the fixture-fidelity law).
 *
 * So these bytes have exactly ONE job. The action-sequence walker
 * (`athleteActionWalkerTests`) reaches every state it asserts over by
 * performing real athlete actions from a fresh install. This file is the
 * assertion that its ACTION VOCABULARY IS COMPLETE ENOUGH TO REACH A REAL
 * DEVICE: if no sequence of real actions can produce a state of this shape,
 * the walker is missing an action a real athlete really has, and THAT is the
 * red — a defect in the harness, not in the app.
 *
 * Transcribed from `device-export-8.json` (captured 2026-07-29T07:30:51Z,
 * revision 37); the export itself is deleted with the commit that adds this.
 *
 * WHAT THE ATTEMPT AT SEEDING TAUGHT, recorded so it is not repeated. The
 * export is a SUMMARY: it carries the profile and calendar in full, but only
 * the SHAPE of three other surfaces — `dateOverrideDates` (dates, not
 * workouts), `weekScopedOverlayWeeks` (keys, not content) and
 * `userRemovalConstraintCount` (a count). Rebuilding the rest from his profile
 * produced a week scoring squat 0 / hinge 0 / push 2 / pull 1, which §18 cannot
 * repair and which threw straight through the tap door — a state his device
 * demonstrably was NOT in, because it held a materialised overlay for that very
 * week. A seed that cannot restore what it claims to restore manufactures
 * defects, and a manufactured defect costs a device round trip. The walker has
 * no such failure mode: every state it reaches, it reached by acting.
 *
 * The one fact worth keeping from that attempt: the matrix's synthetic athlete
 * differed from Sam in season phase, team days, game-day style, experience,
 * equipment, strength and calendar. That is why the walker generates over an
 * onboarding answer SPACE rather than one answer set.
 */

import type { OnboardingData } from '../../types/domain';

/** The capture instant. His "today" was a Wednesday. */
export const SAM_EXPORT_8_CAPTURED_AT = '2026-07-29T07:30:51.664Z';
export const SAM_EXPORT_8_TODAY_ISO = '2026-07-29';

/** The Monday of the week he was looking at, and of the week after it. */
export const SAM_EXPORT_8_CURRENT_WEEK = '2026-07-27';
export const SAM_EXPORT_8_NEXT_WEEK = '2026-08-03';

/**
 * All 23 answers, exactly as exported. `usualGameDay` and `gameDay` are ABSENT
 * on purpose — that absence is a fact about him, and it is why his fixtures are
 * explicit calendar marks rather than the resolver's virtual game day. Writing
 * a plausible Saturday in here would erase the very thing that made four of his
 * five taps take a different path from the synthetic seed's.
 */
export function samExport8Profile(): OnboardingData {
  return {
    benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good',
    equipment: [
      'barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
      'cable_machine', 'hamstring_curl', 'knee_extension', 'bands',
    ],
    experienceLevel: '5+ years',
    firstName: 'Sam',
    heightCm: 184,
    injuries: [],
    motivation: 'Dominate your level, Feel fresh on game day',
    position: 'inside_mid',
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    recentTrainingLoad: 'Very consistent',
    seasonPhase: 'Pre-season',
    sprintExposure: '2+ times per week',
    squatStrength: '1.5x bodyweight',
    teamTrainingDays: ['Monday', 'Wednesday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Moderate',
    trainingDaysPerWeek: 5,
    trainingDaysUnsure: false,
    trainingLocation: 'Commercial gym',
    twoKmTimeTrial: { recordedOn: '2026-07-29', seconds: 420, source: 'onboarding' },
    weightKg: 90,
  } as unknown as OnboardingData;
}

/**
 * His calendar, verbatim. Two explicit fixtures and two rest marks — note that
 * 2026-07-31 is the Friday before the 08-01 game (his G-1) and carries a rest
 * mark, and 2026-07-28 is a Tuesday rest.
 */
export const SAM_EXPORT_8_MARKED_DAYS: Readonly<Record<string, 'game' | 'rest'>> = {
  '2026-07-28': 'rest',
  '2026-07-31': 'rest',
  '2026-08-01': 'game',
  '2026-08-08': 'game',
};

/** Accepted-state facts, verbatim. */
export const SAM_EXPORT_8_ACCEPTED_REVISION = 37;
export const SAM_EXPORT_8_LAST_TRANSACTION = 'override:set:2026-08-06';

/** Shape-only surfaces — dates and counts, never content. See the header. */
export const SAM_EXPORT_8_OVERRIDE_DATES: readonly string[] = ['2026-08-02', '2026-08-06'];
export const SAM_EXPORT_8_OVERLAY_WEEKS: readonly string[] = ['2026-07-27', '2026-08-03'];
export const SAM_EXPORT_8_REMOVAL_CONSTRAINT_COUNT = 5;

/**
 * The five taps, read off the 200-entry tape rather than reconstructed. Each
 * carries the trace's own dates and the internal code the device recorded, so
 * a cell that claims to reproduce one of them can be checked against what
 * actually happened instead of against what it would be convenient to assume.
 */
export interface SamExport8Tap {
  id: string;
  at: string;
  action: 'add_session' | 'move_session';
  sourceDate: string;
  targetDate: string;
  /** What the device recorded at the preview boundary. */
  deviceCode: string | null;
  /** What Sam saw, in his words. */
  sawOnDevice: string;
  /** Whether this tap is one of the four he reported as broken. */
  broken: boolean;
}

export const SAM_EXPORT_8_TAPS: readonly SamExport8Tap[] = [
  {
    id: 'add-strength-onto-g-plus-1',
    at: '07:24:03', action: 'add_session',
    sourceDate: '2026-08-02', targetDate: '2026-08-02',
    deviceCode: null,
    sawOnDevice: 'copy said added; the screen showed Recovery + Recovery',
    broken: true,
  },
  {
    id: 'move-team-wednesday-onto-thursday',
    at: '07:25:04', action: 'move_session',
    sourceDate: '2026-07-29', targetDate: '2026-07-30',
    deviceCode: 'protected_anchor_day',
    sawOnDevice: 'generic "that change did not go through"',
    broken: true,
  },
  {
    id: 'move-tuesday-onto-g-minus-1',
    at: '07:25:59', action: 'move_session',
    sourceDate: '2026-07-28', targetDate: '2026-07-31',
    deviceCode: 'g1_route_required',
    sawOnDevice: 'the G-1 ask — correct, and he backed out',
    broken: false,
  },
  {
    id: 'move-tuesday-onto-thursday',
    at: '07:26:05', action: 'move_session',
    sourceDate: '2026-07-28', targetDate: '2026-07-30',
    deviceCode: null,
    sawOnDevice: 'worked',
    broken: false,
  },
  {
    id: 'add-hard-conditioning-onto-occupied-day',
    at: '07:26:35', action: 'add_session',
    sourceDate: '2026-07-30', targetDate: '2026-07-30',
    deviceCode: 'section18_week_rejected',
    sawOnDevice: 'refused',
    broken: true,
  },
  {
    id: 'add-light-conditioning-onto-occupied-day',
    at: '07:27:55', action: 'add_session',
    sourceDate: '2026-08-06', targetDate: '2026-08-06',
    deviceCode: null,
    sawOnDevice: 'it worked, and the confirmation said "okay, moved Upper Pull"',
    broken: true,
  },
];


/**
 * THE CONFORMANCE TARGET. The walker must be able to reach a state of this
 * shape by acting. Deliberately a SHAPE — counts and kinds — and not a state:
 * asserting his exact overlay content would be seeding again, and the export
 * does not carry it anyway.
 */
export const SAM_EXPORT_8_CONFORMANCE_SHAPE = {
  profile: samExport8Profile,
  onboardingAnswerCount: 23,
  markedDays: SAM_EXPORT_8_MARKED_DAYS,
  acceptedRevision: SAM_EXPORT_8_ACCEPTED_REVISION,
  dateOverrideCount: SAM_EXPORT_8_OVERRIDE_DATES.length,
  overlayWeekCount: SAM_EXPORT_8_OVERLAY_WEEKS.length,
  removalConstraintCount: SAM_EXPORT_8_REMOVAL_CONSTRAINT_COUNT,
} as const;

export function describeConformanceShape(): string {
  const shape = SAM_EXPORT_8_CONFORMANCE_SHAPE;
  return `reached his shape: ${shape.onboardingAnswerCount} answers, `
    + `${Object.keys(shape.markedDays).length} calendar marks, `
    + `${shape.dateOverrideCount} overrides / ${shape.overlayWeekCount} overlays / `
    + `${shape.removalConstraintCount} constraints outstanding`;
}
