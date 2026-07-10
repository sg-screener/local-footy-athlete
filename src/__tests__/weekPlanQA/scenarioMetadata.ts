import type { DayOfWeek, OnboardingData, SeasonPhase } from '../../types/domain';

export interface WeekPlanQAScenarioMetadata {
  id: string;
  humanName: string;
  phase: SeasonPhase;
  scenarioIntent: string;
  gameDay: string;
  teamTrainingDays: string[];
  availabilitySummary: string;
  notes?: string;
}

export const WEEK_PLAN_QA_SCENARIO_METADATA: WeekPlanQAScenarioMetadata[] = [
  {
    id: 'S1',
    humanName: 'In-season, Saturday game, two team trainings',
    phase: 'In-season',
    scenarioIntent: 'Baseline in-season structure with Saturday game protection and Tuesday/Thursday team training.',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '5 available days: Monday-Friday',
    notes: 'Baseline scenario for edit-driven game changes.',
  },
  {
    id: 'S2',
    humanName: 'In-season, Sunday game, six-day availability',
    phase: 'In-season',
    scenarioIntent: 'Guards Sunday-game G-1/G+1 reshaping with Saturday available.',
    gameDay: 'Sunday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '6 available days: Monday-Saturday',
  },
  {
    id: 'S3',
    humanName: 'In-season, Friday night game',
    phase: 'In-season',
    scenarioIntent: 'Guards early-game-week protection when the game is Friday.',
    gameDay: 'Friday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '5 available days: Monday-Thursday and Saturday',
  },
  {
    id: 'S4',
    humanName: 'In-season bye week',
    phase: 'In-season',
    scenarioIntent: 'Guards no-game in-season structure and Saturday training availability.',
    gameDay: 'none',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '6 available days: Monday-Saturday',
  },
  {
    id: 'S5',
    humanName: 'Off-season, five days, team Tuesday/Thursday',
    phase: 'Off-season',
    scenarioIntent: 'Guards off-season structure when club training still anchors two days.',
    gameDay: 'none',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '5 available days: Monday-Friday',
  },
  {
    id: 'S6',
    humanName: 'Early off-season four-day low availability',
    phase: 'Off-season',
    scenarioIntent: 'Guards week-one strength/support structure with no running, sprint/COD or hard conditioning.',
    gameDay: 'none',
    teamTrainingDays: [],
    availabilitySummary: '4 available days: Monday, Wednesday, Friday, Saturday',
    notes: 'Explicit early_offseason week 1 scenario.',
  },
  {
    id: 'S7',
    humanName: 'Off-season six days with three team trainings',
    phase: 'Off-season',
    scenarioIntent: 'Guards off-season load distribution around Monday/Wednesday/Friday team training.',
    gameDay: 'none',
    teamTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    availabilitySummary: '6 available days: Monday-Saturday',
  },
  {
    id: 'S8',
    humanName: 'In-season, Saturday game, team Monday/Wednesday',
    phase: 'In-season',
    scenarioIntent: 'Guards non-standard team-training days around a Saturday game.',
    gameDay: 'Saturday',
    teamTrainingDays: ['Monday', 'Wednesday'],
    availabilitySummary: '5 available days: Monday-Friday',
  },
  {
    id: 'S9',
    humanName: 'In-season, Saturday game, one team training',
    phase: 'In-season',
    scenarioIntent: 'Guards structure when only one club training day anchors the week.',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday'],
    availabilitySummary: '5 available days: Monday-Friday',
  },
  {
    id: 'S10',
    humanName: 'In-season, Saturday game, three consecutive team trainings',
    phase: 'In-season',
    scenarioIntent: 'Guards consecutive team-training stress management before a Saturday game.',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Wednesday', 'Thursday'],
    availabilitySummary: '5 available days: Monday-Friday',
  },
  {
    id: 'S11',
    humanName: 'Pre-season with Saturday practice match',
    phase: 'Pre-season',
    scenarioIntent: 'Guards pre-season practice-match/game stress while preserving safe training.',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '5 available days: Monday-Friday',
  },
  {
    id: 'S12',
    humanName: 'Pre-season, no practice match',
    phase: 'Pre-season',
    scenarioIntent: 'Guards pre-season structure without a game or practice-match anchor.',
    gameDay: 'none',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '5 available days: Monday-Friday',
  },
  {
    id: 'E1',
    humanName: 'Edit flow, remove Saturday game',
    phase: 'In-season',
    scenarioIntent: 'Guards the visible week after a Saturday game is removed.',
    gameDay: 'none',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '6 available days: Monday-Saturday',
    notes: 'Derived from S1.',
  },
  {
    id: 'E2',
    humanName: 'Edit flow, move Saturday game to Sunday',
    phase: 'In-season',
    scenarioIntent: 'Guards the visible week after a game moves from Saturday to Sunday.',
    gameDay: 'Sunday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '6 available days: Monday-Saturday',
    notes: 'Derived from S1.',
  },
  {
    id: 'E3',
    humanName: 'Edit flow, add Saturday game back',
    phase: 'In-season',
    scenarioIntent: 'Guards the visible week after the Saturday game is restored.',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '5 available days: Monday-Friday',
    notes: 'Derived from E1.',
  },
  {
    id: 'S13',
    humanName: 'In-season low availability with Saturday game',
    phase: 'In-season',
    scenarioIntent: 'Guards minimum viable structure when the athlete has only Monday/Wednesday/Friday available.',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '3 available days: Monday, Wednesday, Friday',
  },
  {
    id: 'S14',
    humanName: 'In-season low readiness with injuries',
    phase: 'In-season',
    scenarioIntent: 'Guards conservative structure for poor conditioning, low recent load, and active knee/shoulder history.',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    availabilitySummary: '4 available days: Monday, Tuesday, Thursday, Friday',
    notes: 'Includes knee and shoulder injury history.',
  },
];

const METADATA_BY_ID = new Map(WEEK_PLAN_QA_SCENARIO_METADATA.map((entry) => [entry.id, entry]));

export interface ScenarioMetadataInput {
  id?: string;
  name?: string;
  onboarding?: Partial<OnboardingData>;
}

export function parseScenarioId(name: string | undefined): string {
  const match = String(name ?? '').match(/^\s*([A-Z]\d+)\b/);
  return match?.[1] ?? 'UNKNOWN';
}

export function humanNameFromLegacyName(name: string | undefined): string {
  const raw = String(name ?? '').trim();
  const withoutId = raw.replace(/^\s*[A-Z]\d+\s*:\s*/, '').trim();
  return withoutId || 'Unnamed QA scenario';
}

function fallbackPhase(onboarding?: Partial<OnboardingData>): SeasonPhase {
  return onboarding?.seasonPhase ?? 'Pre-season';
}

function fallbackGameDay(onboarding?: Partial<OnboardingData>): string {
  return onboarding?.gameDay ?? 'none';
}

function fallbackTeamTrainingDays(onboarding?: Partial<OnboardingData>): DayOfWeek[] {
  return onboarding?.teamTrainingDays ?? [];
}

function fallbackAvailability(onboarding?: Partial<OnboardingData>): string {
  const days = onboarding?.preferredTrainingDays ?? [];
  if (days.length === 0) return 'Availability not specified';
  return `${days.length} available day${days.length === 1 ? '' : 's'}: ${days.join(', ')}`;
}

export function metadataForScenario(input: ScenarioMetadataInput): WeekPlanQAScenarioMetadata {
  const id = input.id ?? parseScenarioId(input.name);
  const known = METADATA_BY_ID.get(id);
  if (known) return known;
  return {
    id,
    humanName: humanNameFromLegacyName(input.name),
    phase: fallbackPhase(input.onboarding),
    scenarioIntent: 'Intent not specified; inspect the scenario configuration.',
    gameDay: fallbackGameDay(input.onboarding),
    teamTrainingDays: fallbackTeamTrainingDays(input.onboarding),
    availabilitySummary: fallbackAvailability(input.onboarding),
    notes: 'Metadata fallback generated at runtime.',
  };
}

export function scenarioDisplayLabel(input: ScenarioMetadataInput): string {
  const metadata = metadataForScenario(input);
  return `${metadata.id} — ${metadata.humanName}`;
}

export function scenarioContextLine(input: ScenarioMetadataInput): string {
  const metadata = metadataForScenario(input);
  const team = metadata.teamTrainingDays.length > 0 ? metadata.teamTrainingDays.join(', ') : 'none';
  return `Phase: ${metadata.phase}  |  Game: ${metadata.gameDay}  |  Team: ${team}  |  Availability: ${metadata.availabilitySummary}`;
}

export function scenarioTocLine(input: ScenarioMetadataInput): string {
  const metadata = metadataForScenario(input);
  return `${metadata.id.padEnd(4)} ${metadata.humanName.padEnd(54)} ${metadata.scenarioIntent}`;
}
