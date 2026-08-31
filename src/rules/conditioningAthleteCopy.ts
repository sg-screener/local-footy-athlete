/**
 * Sam-approved athlete copy for the 55 conditioning templates (2026-08-31).
 *
 * The signed workbook continues to own physiology, selection and permitted
 * dose bands. This projection owns the one concrete instruction the athlete
 * reads. It may choose an authored rung or express recovery as a departure;
 * it never changes a template's quality, placement or eligibility.
 */
export interface ConditioningAthleteCopy {
  readonly title: string;
  readonly work: string;
  readonly recovery: string;
  readonly setsRounds: string;
  readonly intensity: string;
  readonly cue: string;
  readonly totalSessionTime?: string;
}

export const CONDITIONING_ATHLETE_COPY: Readonly<Record<string, ConditioningAthleteCopy>> = {
  '10 m Acceleration Reps': { title: '10 m Acceleration Reps', work: '10 m', recovery: 'Start every 60 s', setsRounds: '8 reps', intensity: '95–100%', cue: 'Fast first steps. Stop if your technique drops.' },
  '20 m Acceleration Reps': { title: '20 m Acceleration Reps', work: '20 m', recovery: 'Start every 90 s', setsRounds: '8 reps', intensity: '95–100%', cue: 'Drive hard and accelerate through the full 20 m.' },
  '30 m Acceleration Reps': { title: '30 m Acceleration Reps', work: '30 m', recovery: 'Start every 2 min', setsRounds: '5 reps', intensity: '95–100%', cue: 'Accelerate through the rep without reaching or straining.' },
  'Hill Acceleration': { title: 'Hill Accelerations', work: '5 s uphill', recovery: 'Start every 90 s', setsRounds: '8 reps', intensity: '95–100%', cue: 'Lean into the hill and drive forward.' },
  'Air Bike Accelerations': { title: 'Air Bike Accelerations', work: '5 s maximal', recovery: '55 s easy', setsRounds: '8 reps', intensity: 'Maximal', cue: 'Stop when your power begins to drop.' },
  'Team-Training Warm-Up Dose': { title: 'Team-Training Acceleration Dose', work: '10–20 m', recovery: 'Start every 60 s', setsRounds: '4 reps during your club warm-up', intensity: '95–100%', cue: 'Complete these during the warm-up, not as another session.' },
  'Return-to-Speed Ladder': { title: 'Return-to-Speed Ladder', work: '10 m, 10 m, 15 m, 15 m, 20 m', recovery: 'Start every 2 min', setsRounds: '5 reps', intensity: '90–95%', cue: 'Stay relaxed and prioritise clean movement.' },

  'Fly 20 (20+20)': { title: 'Fly 20', work: '20 m build + 20 m fly', recovery: 'Start every 3 min', setsRounds: '5 reps', intensity: '95–100% max velocity', cue: 'Build smoothly and stay relaxed through the fly zone.' },
  'Fly 30 (30+30)': { title: 'Fly 30', work: '30 m build + 30 m fly', recovery: 'Start every 3 min', setsRounds: '5 reps', intensity: '95–100% max velocity', cue: 'Run tall and stop if your speed drops.' },
  'Progressive Sprint Exposure': { title: 'Progressive Sprint Exposure', work: '40–60 m', recovery: 'Start every 3 min', setsRounds: '5 reps', intensity: '90–100%', cue: 'Build your speed gradually through every rep.' },
  'Off-Season Speed Reintroduction': { title: 'Off-Season Speed Reintroduction', work: '20 m build + 20 m fly', recovery: 'Start every 4 min', setsRounds: '3 reps', intensity: '90–95%', cue: 'Keep it smooth. Do not force top speed.' },

  '20 m Shuttle Repeats': { title: '20 m Shuttle Repeats', work: '2 × 10 m shuttle', recovery: 'Start every 30 s', setsRounds: '2 sets × 8 reps, 4 min between sets', intensity: 'Maximal repeat effort', cue: 'Stay sharp through the turn and keep every rep consistent.' },
  '30 m Repeats': { title: '30 m Repeats', work: '30 m', recovery: 'Start every 30 s', setsRounds: '2 sets × 6 reps, 4 min between sets', intensity: 'Maximal repeat effort', cue: 'Run every rep at the same standard.' },
  'Sprint Sets (3×5×6 s)': { title: 'Sprint Sets', work: '6 s sprint', recovery: 'Start every 30 s', setsRounds: '3 sets × 5 reps, 3 min between sets', intensity: 'Maximal', cue: 'Stop if your speed or technique drops.' },
  '10 s Max Sprint Repeats': { title: '10 s Max Sprint Repeats', work: '10 s maximal', recovery: '50 s recovery', setsRounds: '6 reps', intensity: 'Maximal', cue: 'Reset before each effort and attack every rep.' },
  '10 s Repeat Efforts': { title: '10 s Repeat Efforts', work: '10 s hard', recovery: '30 s easy', setsRounds: '8 reps', intensity: 'Very hard', cue: 'Keep the same output from the first rep to the last.' },

  'Up-Back Shuttle': { title: 'Up-Back Shuttle', work: '30 m out + 30 m back', recovery: 'Start every 60 s', setsRounds: '15 reps', intensity: 'Hard but controlled', cue: 'Plant cleanly and accelerate out of the turn.' },
  'Low-Intensity Deceleration Drills': { title: 'Low-Intensity Deceleration Drills', work: '15–20 m approach + controlled stop', recovery: 'Start every 45 s', setsRounds: '3 reps', intensity: 'Easy', cue: 'Lower your body and stop under control.' },
  'Deceleration and Landing Work': { title: 'Deceleration and Landing Work', work: 'One jump-and-stick or run-and-stick', recovery: 'Start every 60 s', setsRounds: '4 reps', intensity: 'Controlled', cue: 'Land quietly and hold your position.' },
  '45-Degree Cut Reps': { title: '45-Degree Cut Reps', work: '10 m approach + cut + 10 m exit', recovery: 'Start every 90 s', setsRounds: '5 reps', intensity: 'Maximal intent', cue: 'Keep your plant foot underneath you.' },

  '20 s Max Sprint — Small Dose': { title: '20 s Max Sprint — Small Dose', work: '20 s flat out', recovery: 'Start every 2 min', setsRounds: '3 rounds', intensity: 'Maximal', cue: 'Commit fully to every effort.' },
  'Erg Short-Burst Repeats (15–20 s)': { title: 'Erg Short-Burst Repeats', work: '15 s hard', recovery: '45 s easy', setsRounds: '9 rounds', intensity: 'Very hard', cue: 'Keep every effort sharp rather than grinding.' },
  'Tabata Finisher': { title: 'Tabata Finisher', work: '20 s hard', recovery: '10 s easy', setsRounds: '8 rounds', intensity: 'Maximal', cue: 'Stay controlled enough to complete all eight rounds.' },
  '30 s Very Hard Repeats': { title: '30 s Very Hard Repeats', work: '30 s hard', recovery: '90 s easy', setsRounds: '6 rounds', intensity: 'Very hard, not maximal', cue: 'Choose an output you can repeat six times.' },
  '45 s Hard Repeats': { title: '45 s Hard Repeats', work: '45 s hard', recovery: 'Start every 3 min', setsRounds: '5 rounds', intensity: 'Hard', cue: 'Hold the same effort throughout every round.' },
  '60 s Max Sustained Effort': { title: '60 s Max Sustained Efforts', work: '60 s hard', recovery: 'Start every 3 min', setsRounds: '5 rounds', intensity: 'All-out sustained', cue: 'Start under control and finish strongly.' },
  '150–200 m Hard Repeats': { title: '150–200 m Hard Repeats', work: '150–200 m', recovery: 'Start every 2 min', setsRounds: '6 reps', intensity: 'Hard', cue: 'Match your pace across all six reps.' },
  'Hill Repeats — hard sustained': { title: 'Hard Hill Repeats', work: '45 s uphill', recovery: 'Start every 3 min', setsRounds: '5 rounds', intensity: 'Hard, not maximal', cue: 'Keep the same effort from the bottom to the top.' },
  'Bodyweight Circuit (no-equipment fallback)': { title: 'Bodyweight Conditioning Circuit', work: '4 movements · 40 s work', recovery: '20 s to change; 90 s between rounds', setsRounds: '5 rounds', intensity: 'Hard but sustainable', cue: 'Move consistently without rushing your technique.' },

  'Classic 4×4': { title: '4 × 4 VO₂ Max', work: '4 min hard', recovery: '3 min complete recovery', setsRounds: '4 rounds', intensity: '90–100% MAS', cue: 'Choose a pace you can repeat for all four rounds.' },
  'Three-Minute Intervals': { title: '3-Minute Intervals', work: '3 min hard', recovery: '2 min easy', setsRounds: '6 rounds', intensity: '90–100% MAS', cue: 'Keep your output consistent across every round.' },
  'Two-Minute Repeats': { title: '2-Minute Repeats', work: '2 min hard', recovery: '2 min easy', setsRounds: '7 rounds', intensity: 'Approximately 100% MAS', cue: 'Settle into your target pace immediately.' },
  'MAS 15:15 Blocks': { title: '15-Second MAS Blocks', work: '15 s hard', recovery: '15 s easy; 2 min between blocks', setsRounds: '8 rounds × 3 blocks', intensity: '110% MAS', cue: 'Stay quick and controlled through every block.' },
  '30:30 Hard Intermittent': { title: '30-Second Hard Intervals', work: '30 s hard', recovery: '30 s easy; 3 min between blocks', setsRounds: '2 blocks × 5 rounds', intensity: '100–110% MAS', cue: 'Repeat the same effort throughout. Do not sprint.' },
  'Footy Shuttles': { title: 'Footy Shuttles', work: '60 s hard', recovery: '60 s easy; 3 min between sets', setsRounds: '3 sets × 5 reps', intensity: 'Hard but controlled', cue: 'Keep the final set as consistent as the first.' },
  '1 km Repeats': { title: '1 km Repeats', work: '1 km hard', recovery: 'Up to 3 min easy', setsRounds: '5 reps', intensity: '90–100% MAS', cue: 'Run even splits rather than chasing the first rep.' },
  '400 m Repeats': { title: '400 m Repeats', work: '400 m', recovery: 'Start every 3 min', setsRounds: '5 reps', intensity: 'Hard but controlled', cue: 'Keep the same pace as fatigue builds.' },
  'Erg EMOM': { title: 'Erg EMOM', work: '40 s hard', recovery: '20 s easy; 3 min between blocks', setsRounds: '3 blocks × 5 rounds', intensity: 'Hard', cue: 'Begin each effort as soon as the next minute starts.' },

  'Continuous Aerobic Run': { title: 'Continuous Aerobic Run', work: '40 min continuous', recovery: 'No recovery', setsRounds: '1 block', intensity: '65–80% MAS', cue: 'Hold a conversational pace from start to finish.' },
  'Long Aerobic Intervals': { title: 'Long Aerobic Intervals', work: '10 min steady', recovery: '2 min easy', setsRounds: '3 rounds', intensity: '70–80% MAS', cue: 'Keep all three rounds nearly identical.' },
  'Steady Blocks (3×8 min or 4×6 min)': { title: 'Steady Aerobic Blocks', work: '6 min steady', recovery: '2 min easy', setsRounds: '4 rounds', intensity: '65–75% MAS', cue: 'Stay relaxed and avoid unnecessary surges.' },
  'Controlled 10–20 min Blocks': { title: 'Controlled Tempo Blocks', work: '15 min controlled', recovery: '3 min easy', setsRounds: '2 rounds', intensity: '70–80% MAS', cue: 'Maintain the same effort through the end of each block.' },
  'Steady 5 min Blocks': { title: '5-Minute Aerobic Blocks', work: '5 min steady', recovery: '1 min easy', setsRounds: '5 rounds', intensity: '65–80% MAS', cue: 'Keep this below hard-interval intensity.' },
  'Aerobic Shuttles': { title: 'Aerobic Shuttles', work: '6 min controlled', recovery: '90 s easy', setsRounds: '4 rounds', intensity: '65–75% MAS', cue: 'Turn smoothly rather than cutting at maximal speed.' },
  'Extensive Tempo (100 m repeats)': { title: 'Extensive Tempo — 100 m Repeats', work: '100 m', recovery: '30 s walk; 3 min between sets', setsRounds: '2 sets × 8 reps', intensity: '65–75%', cue: 'Find a relaxed rhythm and repeat it.' },
  '2 min On / 1 min Easy': { title: '2 min On / 1 min Easy', work: '2 min steady', recovery: '1 min easy', setsRounds: '7 rounds', intensity: '70–80% MAS', cue: 'Let the effort build without turning it into a race.' },
  '30:30 Controlled Tempo Blocks': { title: '30-Second Tempo Blocks', work: '30 s steady', recovery: '30 s easy', setsRounds: '13 rounds', intensity: '65–80% MAS', cue: 'Stay relaxed and in control.' },
  '1 min On / 1 min Easy Tempo': { title: '1 min On / 1 min Easy', work: '1 min steady', recovery: '1 min easy', setsRounds: '10 rounds', intensity: '65–80% MAS', cue: 'Settle into a rhythm you can maintain throughout.' },

  'Short Flush': { title: 'Short Flush', work: '1 min easy', recovery: '1 min rest', setsRounds: '4 × 2-minute blocks', intensity: 'Very easy, 2–3/10', cue: 'Keep it easy enough to speak in full sentences.', totalSessionTime: '8 min total' },
  'Easy Aerobic Flush': { title: 'Easy Aerobic Flush', work: '1 min easy', recovery: '1 min rest', setsRounds: '5 × 2-minute blocks', intensity: 'Very easy, 2–3/10', cue: 'Finish feeling better than when you started.', totalSessionTime: '10 min total' },
  'Nasal-Paced Easy': { title: 'Nasal-Paced Easy', work: '1 min easy', recovery: '1 min rest', setsRounds: '5 × 2-minute blocks', intensity: 'Very easy, 2–3/10', cue: 'Slow down if you cannot maintain comfortable nasal breathing.', totalSessionTime: '10 min total' },
  'Erg Flush Blocks': { title: 'Erg Flush Blocks', work: '2 min easy', recovery: '1 min rest', setsRounds: '4 × 3-minute blocks', intensity: 'Very easy, 2–3/10', cue: 'Use a smooth, relaxed rhythm.', totalSessionTime: '12 min total' },
  'Flush Intervals 30:30': { title: '30-Second Flush Intervals', work: '30 s easy', recovery: '30 s rest', setsRounds: '10 × 1-minute blocks', intensity: 'Very easy, 2–3/10', cue: 'Keep every effort deliberately easy.', totalSessionTime: '10 min total' },
  'Flush Intervals 1:1 (1 min / 1 min)': { title: '1-Minute Flush Intervals', work: '1 min easy', recovery: '1 min rest', setsRounds: '6 × 2-minute blocks', intensity: 'Very easy, 2–3/10', cue: 'Stay relaxed and breathe comfortably.', totalSessionTime: '12 min total' },
  'Flush Intervals 2:1 (2 min / 1 min)': { title: '2-Minute Flush Intervals', work: '2 min easy', recovery: '1 min rest', setsRounds: '4 × 3-minute blocks', intensity: 'Very easy, 2–3/10', cue: 'Keep moving without accumulating fatigue.', totalSessionTime: '12 min total' },
};
