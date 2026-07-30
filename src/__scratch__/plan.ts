(global as any).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';
import { generateProgramLocally } from '../services/api/generateProgram';
const profile: any = {
  seasonPhase: 'In-season', position: 'inside_mid', motivation: 'Build strength and football fitness',
  trainingDaysPerWeek: 5, preferredTrainingDays: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
  teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday','Thursday'],
  teamTrainingDuration: '60-90 minutes', teamTrainingIntensity: 'Hard',
  trainingLocation: 'Commercial gym', equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete',
  experienceLevel: 'Advanced', squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Good', sprintExposure: '2+ times per week', recentTrainingLoad: 'Very consistent',
  injuries: [], usualGameDay: 'Saturday', gameDay: 'Saturday',
};
const p = generateProgramLocally(profile, { todayISO: '2026-07-13', previousProgram: null } as any);
const w: any = p.microcycles[0];
console.log('PLAN', (w.exposureContractV2 ? 'has contract' : 'no contract'));
for (const e of (p as any).microcycles[0].workouts) console.log('  W', e.dayOfWeek, e.workoutType, e.sessionTier, e.name);
