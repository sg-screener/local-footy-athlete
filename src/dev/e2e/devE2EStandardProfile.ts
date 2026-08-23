import type { OnboardingData } from '../../types/domain';

export const DEV_E2E_STANDARD_PROFILE: OnboardingData = {
  firstName: 'Sam',
  // R-130: gender is a required onboarding answer with no default. A seeded
  // world without it would be "an athlete the app would have refused"
  // (LAW-test-worlds-are-generated-or-real). Male ≙ the pre-R-130 app.
  gender: 'male',
  heightCm: 184,
  weightKg: 90,
  position: 'inside_mid',
  goals: ['stay_injury_free'],
  seasonPhase: 'In-season',
  gameDay: 'Saturday',
  usualGameDay: 'Saturday',
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingDuration: '90 minutes',
  teamTrainingIntensity: 'Moderate',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  equipment: [
    'barbell',
    'dumbbells',
    'squat_rack',
    'pullup_bar',
    'cable_machine',
    'hamstring_curl',
    'knee_extension',
    'bands',
  ],
  experienceLevel: '5+ years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.5x bodyweight+',
  /**
   * ADDED 2026-08-10, AND ITS ABSENCE WAS A REAL DEFECT — the third thing the
   * run-through instrument found, one step after the second was fixed.
   *
   * `TwoKmTimeTrial` is a REQUIRED onboarding step and it is `visible: always`.
   * Without this field the profile **fails the app's own completeness gate**, so
   * every seeded world this file has ever produced was built from a profile the
   * product would have refused from a real athlete — and nothing noticed,
   * because no seeded run ever reached the screen that would have shown it.
   *
   * That is exactly the rot Sam named: *"a fucking weekly template optimised for
   * that and that alone"*. `LAW-test-worlds-are-generated-or-real` says a test
   * world must be one the app would actually build; a profile the app would
   * turn away cannot produce one.
   *
   * A real time rather than the "haven't tested" answer (`seconds: null`),
   * because MAS and every running pace derive from it — a null would seed a
   * world with estimated paces and quietly narrow what the seeds cover.
   * 8:00 for 2km suits the Elite conditioning level below.
   */
  twoKmTimeTrial: {
    seconds: 480,
    recordedOn: '2026-07-01',
    source: 'onboarding',
  },
  conditioningLevel: 'Elite',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  biggestLimitation: 'Power & explosiveness',
  biggestFrustration: 'Getting a week that respects team training and game day.',
  successVision: 'A durable in-season week that keeps strength and conditioning ticking over without cooking the legs.',
};
