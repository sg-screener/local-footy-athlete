import type { DayOfWeek, OnboardingData, SeasonPhase } from '../../types/domain';

export const YEAR_WEEKS = 52;
export const YEAR_START = '2026-07-13';
export const DAY_NAMES: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const plusDays = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export interface Archetype {
  id: string;
  gender: 'male' | 'female';
  days: DayOfWeek[];
  experience: NonNullable<OnboardingData['experienceLevel']>;
  equipment: 'commercial' | 'home' | 'bodyweight';
  initialPhase: SeasonPhase;
  clubDays: DayOfWeek[];
  gameDay: DayOfWeek | null;
  extraGame: boolean;
}

// Athlete answers, not invented stored programs. Staggered entry phases make
// an early Off-season refusal visible without hiding every other phase.
export const ARCHETYPES: readonly Archetype[] = [
  { id: 'male-2-novice-bodyweight', gender: 'male', days: ['Monday', 'Thursday'], experience: 'Complete beginner', equipment: 'bodyweight', initialPhase: 'Off-season', clubDays: [], gameDay: null, extraGame: false },
  { id: 'female-3-novice-home', gender: 'female', days: ['Monday', 'Wednesday', 'Friday'], experience: 'Complete beginner', equipment: 'home', initialPhase: 'Pre-season', clubDays: ['Tuesday'], gameDay: 'Sunday', extraGame: false },
  { id: 'male-3-experienced-gym', gender: 'male', days: ['Monday', 'Wednesday', 'Friday'], experience: '5+ years', equipment: 'commercial', initialPhase: 'Pre-season', clubDays: ['Tuesday', 'Thursday'], gameDay: 'Saturday', extraGame: false },
  { id: 'female-4-experienced-gym', gender: 'female', days: ['Monday', 'Tuesday', 'Thursday', 'Friday'], experience: '2-5 years', equipment: 'commercial', initialPhase: 'In-season', clubDays: ['Tuesday', 'Thursday'], gameDay: 'Sunday', extraGame: false },
  { id: 'male-5-two-fixtures', gender: 'male', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], experience: '5+ years', equipment: 'commercial', initialPhase: 'In-season', clubDays: ['Tuesday', 'Thursday'], gameDay: 'Saturday', extraGame: true },
  { id: 'female-5-home', gender: 'female', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], experience: '1-2 years', equipment: 'home', initialPhase: 'Off-season', clubDays: ['Tuesday'], gameDay: 'Saturday', extraGame: false },
  { id: 'male-6-no-standing-fixture', gender: 'male', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], experience: '5+ years', equipment: 'commercial', initialPhase: 'Pre-season', clubDays: [], gameDay: null, extraGame: true },
  { id: 'female-6-sunday-fixture', gender: 'female', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], experience: '5+ years', equipment: 'commercial', initialPhase: 'In-season', clubDays: ['Wednesday'], gameDay: 'Sunday', extraGame: false },
];

export function yearTimeline(archetype: Archetype) {
  const phases: SeasonPhase[] = ['Off-season', 'Pre-season', 'In-season'];
  const first = phases.indexOf(archetype.initialPhase);
  const ordered = [...phases.slice(first), ...phases.slice(0, first)];
  const duration: Record<SeasonPhase, number> = { 'Off-season': 12, 'Pre-season': 16, 'In-season': 24 };
  return ordered.flatMap((phase) => Array.from({ length: duration[phase] }, (_, i) => ({ phase, phaseWeek: i + 1 })))
    .map((week, index) => ({ ...week, index, weekStart: plusDays(YEAR_START, index * 7) }));
}

export function athleteAnswers(archetype: Archetype): OnboardingData {
  const full = archetype.equipment === 'commercial';
  const home = archetype.equipment === 'home';
  const tags = Object.fromEntries([
    'barbell', 'dumbbells', 'cables', 'machine', 'bands', 'bench', 'pullup_bar', 'kettlebell', 'foam_roller', 'plyo_box',
  ].filter((tag) => full || (home && ['dumbbells', 'bands', 'bench', 'pullup_bar'].includes(tag)))
    .map((tag) => [tag, 'have']));
  const modalities = Object.fromEntries((full ? ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'] : []).map((tag) => [tag, 'have']));
  return {
    firstName: archetype.id, ageRange: '22-26', gender: archetype.gender,
    position: 'inside_mid', heightCm: 178, weightKg: 80,
    motivation: 'Get stronger', goals: ['stronger_and_fitter'],
    seasonPhase: archetype.initialPhase,
    seasonFinishedOn: archetype.initialPhase === 'Off-season' ? plusDays(YEAR_START, -1) : undefined,
    trainingDaysPerWeek: archetype.days.length, preferredTrainingDays: [...archetype.days],
    teamTrainingDays: archetype.initialPhase === 'Off-season' ? [] : [...archetype.clubDays],
    teamTrainingDaysPerWeek: archetype.initialPhase === 'Off-season' ? 0 : archetype.clubDays.length,
    usualGameDay: archetype.initialPhase === 'In-season' ? archetype.gameDay ?? undefined : undefined,
    gameDay: archetype.initialPhase === 'In-season' ? archetype.gameDay ?? undefined : undefined,
    trainingLocation: full ? 'Commercial gym' : 'Home',
    equipment: full ? ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine', 'hamstring_curl', 'knee_extension', 'bands']
      : home ? ['dumbbells', 'bands', 'bench', 'pullup_bar'] : ['Bodyweight Only'],
    equipmentAnswer: { tags, modalities, answeredOn: YEAR_START },
    injuries: [], experienceLevel: archetype.experience,
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good', sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 480, recordedOn: YEAR_START, source: 'onboarding' },
  } as OnboardingData;
}
