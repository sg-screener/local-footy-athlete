export interface ApprovedConditioningAthleteCopy {
  readonly name: string;
  readonly title: string;
  readonly work: string;
  readonly recovery: string;
  readonly count: string;
  readonly intensity: string;
  readonly cue: string;
  readonly total?: string;
}

/** Sam-reviewed athlete-facing wording, approved in chat on 2026-09-01. */
export const APPROVED_CONDITIONING_ATHLETE_COPY: readonly ApprovedConditioningAthleteCopy[] = [
  { name: "10 m Acceleration Reps", title: "10 m Acceleration Reps", work: "10 m", recovery: "Start every 30 s", count: "10 reps", intensity: "10/10", cue: "Explode out of the gate. Stop if your technique drops." },
  { name: "20 m Acceleration Reps", title: "20 m Acceleration Reps", work: "20 m", recovery: "Start every 60 s", count: "8 reps", intensity: "10/10", cue: "Drive hard and accelerate through the full 20 m." },
  { name: "30 m Acceleration Reps", title: "30 m Acceleration Reps", work: "30 m", recovery: "Start every 90 s", count: "6 reps", intensity: "10/10", cue: "Drive hard and accelerate through the full 30 m." },
  { name: "Hill Acceleration", title: "Hill Accelerations", work: "5 s uphill", recovery: "Start every 60 s", count: "8 reps", intensity: "10/10", cue: "Lean into the hill and drive forward." },
  { name: "Air Bike Accelerations", title: "Air Bike Accelerations", work: "5 s maximal", recovery: "55 s easy", count: "8 reps", intensity: "10/10", cue: "Stop if power begins to drop." },
  { name: "Team-Training Warm-Up Dose", title: "Team-Training Acceleration Dose", work: "20 m", recovery: "Start every 60 s", count: "4 reps during your club warm-up", intensity: "10/10", cue: "Complete these during the warm-up, not as another session." },
  { name: "Return-to-Speed Ladder", title: "Return-to-Speed Ladder", work: "10 m, 20 m, 30 m, 40 m, 50 m", recovery: "Walk back as rest", count: "5 reps", intensity: "9/10", cue: "Stay relaxed and prioritise clean movement." },
  { name: "Fly 20 (20+20)", title: "Fly 20", work: "20 m build + 20 m fly · 40 m total", recovery: "Start every 2 min", count: "5 reps", intensity: "10/10", cue: "Build smoothly and stay relaxed through the fly zone." },
  { name: "Fly 30 (30+30)", title: "Fly 30", work: "30 m build + 30 m fly · 60 m total", recovery: "Start every 3 min", count: "5 reps", intensity: "10/10", cue: "Run tall and stop if your speed drops." },
  { name: "Progressive Sprint Exposure", title: "Progressive Sprint Exposure", work: "50 m", recovery: "Start every 3 min", count: "5 reps", intensity: "Build from 7/10 to 10/10", cue: "Build your speed gradually through every rep." },
  { name: "Off-Season Speed Reintroduction", title: "Off-Season Speed Reintroduction", work: "20 m build + 20 m fly · 40 m total", recovery: "Start every 2 min", count: "3 reps", intensity: "9/10", cue: "Keep it smooth. Do not force top speed." },
  { name: "20 m Shuttle Repeats", title: "20 m Shuttle Repeats", work: "10 m up + 10 m back · Start every 30 s", recovery: "4 min between sets", count: "2 sets × 8 reps", intensity: "10/10", cue: "Stay sharp through the turn and keep every rep consistent." },
  { name: "30 m Repeats", title: "30 m Repeats", work: "30 m · Start every 30 s", recovery: "4 min between sets", count: "2 sets × 6 reps", intensity: "10/10", cue: "Run every rep at the same standard. Stop if quality drops." },
  { name: "Sprint Sets (3×5×6 s)", title: "Sprint Sets", work: "6 s sprint · Start every 30 s", recovery: "3 min between sets", count: "3 sets × 5 reps", intensity: "9/10", cue: "Stop if your speed or technique drops." },
  { name: "10 s Max Sprint Repeats", title: "10 s Max Sprint Repeats", work: "10 s max sprint", recovery: "50 s rest", count: "6 reps", intensity: "10/10", cue: "Reset before each effort and attack every rep." },
  { name: "10 s Repeat Efforts", title: "10 s Repeat Efforts", work: "10 s hard", recovery: "30 s easy", count: "8 reps", intensity: "8/10", cue: "Keep the same output from the first rep to the last." },
  { name: "Change of Direction", title: "Change of Direction", work: "Three ordered running sections", recovery: "As shown in each section", count: "3 sections", intensity: "4–10/10", cue: "Control the stop first, then build into sharper cuts and turns." },
  { name: "20 s Max Sprint — Small Dose", title: "20 s Max Sprint — Small Dose", work: "20 s as hard as possible", recovery: "Start every 2 min", count: "3 reps", intensity: "10/10", cue: "Do this properly and you won't want to do a fourth rep." },
  { name: "Erg Short-Burst Repeats (15–20 s)", title: "Erg Short-Burst Repeats", work: "15 s hard", recovery: "45 s easy", count: "10 rounds", intensity: "8/10", cue: "Keep every effort sharp rather than grinding." },
  { name: "Tabata Finisher", title: "Tabata Finisher", work: "20 s hard", recovery: "10 s easy", count: "8 rounds", intensity: "8/10", cue: "Stay controlled enough to complete all eight rounds." },
  { name: "30 s Very Hard Repeats", title: "30 s Very Hard Repeats", work: "30 s hard", recovery: "90 s easy", count: "6 reps", intensity: "8/10", cue: "Choose an output you can repeat six times." },
  { name: "45 s Hard Repeats", title: "45 s Hard Repeats", work: "45 s hard", recovery: "Start every 3 min", count: "5 reps", intensity: "8/10", cue: "Hold the same effort throughout every rep." },
  { name: "60 s Max Sustained Effort", title: "60 s Max Sustained Efforts", work: "60 s hard", recovery: "Start every 3 min", count: "5 reps", intensity: "8/10", cue: "Go hard in the work period. Plenty of rest." },
  { name: "150–200 m Hard Repeats", title: "200 m Hard Repeats", work: "200 m", recovery: "Start every 2 min", count: "7 reps", intensity: "8/10", cue: "Match your pace across all seven reps." },
  { name: "Hill Repeats — hard sustained", title: "Hard Hill Repeats", work: "45 s uphill", recovery: "Start every 3 min", count: "5 reps", intensity: "8/10", cue: "Drive the legs and pump the arms." },
  { name: "Bodyweight Circuit (no-equipment fallback)", title: "Bodyweight Conditioning Circuit", work: "4 movements · 40 s work", recovery: "20 s to change; 30 s between rounds", count: "5 rounds", intensity: "Hard but sustainable", cue: "Move consistently without rushing your technique." },
  { name: "Classic 4×4", title: "4 × 4 VO₂ Max", work: "4 min hard", recovery: "3 min complete rest", count: "4 rounds", intensity: "90–100% MAS", cue: "Choose a pace you can repeat for all four rounds." },
  { name: "Three-Minute Intervals", title: "3-Minute Intervals", work: "3 min hard", recovery: "2 min rest", count: "6 rounds", intensity: "90–100% MAS", cue: "Keep your output consistent across every round." },
  { name: "Two-Minute Repeats", title: "2-Minute Repeats", work: "2 min hard", recovery: "2 min easy", count: "7 rounds", intensity: "100% MAS", cue: "Settle into your target pace immediately." },
  { name: "MAS 15:15 Blocks", title: "15-Second MAS Sets", work: "15 s hard / 15 s easy × 8", recovery: "2 min between sets", count: "2 sets", intensity: "110% MAS", cue: "Stay quick and controlled through every set." },
  { name: "30:30 Hard Intermittent", title: "30-Second Hard Intervals", work: "30 s hard / 30 s rest × 5", recovery: "2 min between sets", count: "2 sets", intensity: "100–110% MAS", cue: "Repeat the same effort throughout. Do not sprint." },
  { name: "Footy Shuttles", title: "Footy Shuttles", work: "60 s hard / 60 s easy × 5", recovery: "3 min between sets", count: "3 sets", intensity: "7/10", cue: "Keep the final set as consistent as the first." },
  { name: "1 km Repeats", title: "1 km Repeats", work: "1 km hard", recovery: "Start every 7 min", count: "5 reps", intensity: "90–100% MAS", cue: "Run even splits rather than chasing the first rep." },
  { name: "400 m Repeats", title: "400 m Repeats", work: "400 m", recovery: "Start every 3 min", count: "5 reps", intensity: "8/10", cue: "Keep the same pace as fatigue builds." },
  { name: "Erg EMOM", title: "Erg EMOM", work: "40 s hard / 20 s easy × 5", recovery: "3 min between sets", count: "3 sets", intensity: "Hard", cue: "Begin each effort as soon as the next minute starts." },
  { name: "Continuous Aerobic Run", title: "Continuous Aerobic Run", work: "30 min continuous", recovery: "No recovery", count: "1 set", intensity: "65–80% MAS", cue: "Hold a conversational pace from start to finish." },
  { name: "Long Aerobic Intervals", title: "Long Aerobic Intervals", work: "10 min steady", recovery: "2 min easy", count: "3 reps", intensity: "70–80% MAS", cue: "Keep all three reps nearly identical." },
  { name: "Steady Blocks (3×8 min or 4×6 min)", title: "Steady Aerobic Intervals", work: "6 min steady", recovery: "2 min easy", count: "4 reps", intensity: "65–75% MAS", cue: "Stay relaxed and consistent." },
  { name: "Controlled 10–20 min Blocks", title: "Controlled Tempo Sets", work: "10 min controlled", recovery: "3 min easy", count: "2 sets", intensity: "70–80% MAS", cue: "Maintain the same effort through the end of each set." },
  { name: "Steady 5 min Blocks", title: "5-Minute Aerobic Intervals", work: "5 min steady", recovery: "1 min easy", count: "5 reps", intensity: "65–80% MAS", cue: "Stay relaxed and consistent." },
  { name: "Aerobic Shuttles", title: "Aerobic Shuttles", work: "6 min up and back over 40 m", recovery: "2 min rest", count: "4 reps", intensity: "7/10", cue: "Turn smoothly rather than cutting at maximal speed." },
  { name: "Extensive Tempo (100 m repeats)", title: "Extensive Tempo — 100 m Repeats", work: "100 m / 30 s walk × 8", recovery: "3 min between sets", count: "2 sets", intensity: "65–75%", cue: "Find a relaxed rhythm and repeat it." },
  { name: "2 min On / 1 min Easy", title: "2 min On / 1 min Easy", work: "2 min steady", recovery: "1 min easy", count: "7 reps", intensity: "70–80% MAS", cue: "Let the effort build without turning it into a race." },
  { name: "30:30 Controlled Tempo Blocks", title: "30-Second Tempo Intervals", work: "30 s solid", recovery: "30 s easy", count: "15 reps", intensity: "65–80% MAS", cue: "Stay relaxed and in control." },
  { name: "1 min On / 1 min Easy Tempo", title: "1 min On / 1 min Easy", work: "1 min solid", recovery: "1 min easy", count: "10 reps", intensity: "65–80% MAS", cue: "Settle into a rhythm you can maintain throughout." },
  { name: "Short Flush", title: "Short Flush", work: "1 min easy", recovery: "1 min rest", count: "5 reps", intensity: "Very easy, 2–3/10", cue: "Keep it easy enough to speak in full sentences. Finish feeling better than when you started.", total: "10 min total" },
  { name: "Easy Aerobic Flush", title: "Easy Aerobic Flush", work: "1 min easy", recovery: "1 min rest", count: "5 reps", intensity: "Very easy, 2–3/10", cue: "Finish feeling better than when you started.", total: "10 min total" },
  { name: "Nasal-Paced Easy", title: "Nasal-Paced Easy", work: "1 min easy", recovery: "1 min rest", count: "5 reps", intensity: "Very easy, 2–3/10", cue: "Slow down if you cannot maintain comfortable nasal breathing.", total: "10 min total" },
  { name: "Erg Flush Blocks", title: "Erg Flush Intervals", work: "2 min easy", recovery: "1 min rest", count: "4 reps", intensity: "Very easy, 2–3/10", cue: "Use a smooth, relaxed rhythm.", total: "12 min total" },
  { name: "Flush Intervals 30:30", title: "30-Second Flush Intervals", work: "30 s easy", recovery: "30 s rest", count: "10 reps", intensity: "Very easy, 2–3/10", cue: "Keep every effort deliberately easy.", total: "10 min total" },
  { name: "Flush Intervals 1:1 (1 min / 1 min)", title: "1-Minute Flush Intervals", work: "1 min easy", recovery: "1 min rest", count: "6 reps", intensity: "Very easy, 2–3/10", cue: "Stay relaxed and breathe comfortably.", total: "12 min total" },
  { name: "Flush Intervals 2:1 (2 min / 1 min)", title: "2-Minute Flush Intervals", work: "2 min easy", recovery: "1 min rest", count: "4 reps", intensity: "Very easy, 2–3/10", cue: "Keep moving without accumulating fatigue.", total: "12 min total" },
];
