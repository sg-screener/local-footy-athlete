import { projectAndLog } from './src/utils/visibleProgramProjection';

const wk = {
  id: 'lbs', microcycleId: 'mc', dayOfWeek: 1, name: 'Lower Body Strength',
  description: '', durationMinutes: 60, intensity: 'Moderate', workoutType: 'Strength',
  sessionTier: 'core', exercises: [
    { id:'1', workoutId:'w', exerciseId:'1', exerciseOrder:0, prescribedSets:3, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0,
      exercise:{ id:'1', name:'Back Squat', description:'', exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' }, createdAt:'', updatedAt:'' },
    { id:'2', workoutId:'w', exerciseId:'2', exerciseOrder:1, prescribedSets:3, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0,
      exercise:{ id:'2', name:'Box Jump', description:'', exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' }, createdAt:'', updatedAt:'' },
    { id:'3', workoutId:'w', exerciseId:'3', exerciseOrder:2, prescribedSets:3, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0,
      exercise:{ id:'3', name:'Deadlift', description:'', exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' }, createdAt:'', updatedAt:'' },
    { id:'4', workoutId:'w', exerciseId:'4', exerciseOrder:3, prescribedSets:3, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0,
      exercise:{ id:'4', name:'Nordic Lower', description:'', exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' }, createdAt:'', updatedAt:'' },
  ], createdAt:'', updatedAt:'',
} as any;

const day = { date: '2026-05-04', dayOfWeek: 1, short: 'MON', isToday: false, workout: wk, source: 'template', indicator: null } as any;

projectAndLog({
  day,
  activeInjury: { bodyPart:'hammy', bucket:'hamstring', severity:6, status:'active', rules:['No sprinting','No heavy hinge'] },
  todayISO: '2026-04-29',
  surface: 'home',
});
