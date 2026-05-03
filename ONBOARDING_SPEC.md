# Onboarding Flow Specification

## Overview
28-screen onboarding flow (Welcome + 26 steps + Complete) that collects athlete context for AI-powered S&C programming.
Ordered for: low-friction personal info & identity → season context (gates downstream logic) → training logistics → physical capacity & load → goals/motivation/vision → review → generate.

The onboarding captures four layers:
1. **Data for programming** — age, measurements, equipment, experience, strength levels, conditioning, recent load
2. **Identity** — position, motivation for using the app
3. **Pain points** — frustrations, injuries, limitations
4. **Goal visualisation** — success vision, ranked goals

Layers 2–4 drive retention. The AI coach references them in session summaries, program updates, and motivational nudges.

## Screen Flow

### Screen 1 — Welcome
- Brand moment, value prop
- "Like having a really good S&C coach with boatloads of local footy experience in your pocket. For the cost of a schooner each week."
- Single CTA: "Let's go"

### Screen 2 — Age (Step 1 of 24)
- **Question**: "How old are you?"
- **Options**: Under 16 / 16–18 / 18–23 / 23–30 / 30+
- **Why**: Influences training volume, recovery, plyometric intensity, volume tolerance
- **Store field**: `ageRange`

### Screen 3 — Position (Step 2 of 24)
- **Question**: "What position do you play?"
- **Options**: Small back / Key back / Midfielder / Ruck / Small forward / Key forward
- **Why**: Personalisation — coach flavours programming by position
- **Store field**: `position`

### Screen 4 — Motivation (Step 3 of 24)
- **Question**: "Why are you using this app?"
- **Options**:
  - Make the senior team
  - Play at a higher level
  - Dominate my current competition
  - Prevent injuries
  - Improve athletic performance
  - Stay accountable to training
  - Other (free text input)
- **Why**: Anchors motivation. Coach references this throughout (e.g. "Session complete. One step closer to making the senior team."). Massively increases retention.
- **Store field**: `motivation`

### Screen 5 — Body Measurements (Step 4 of 24)
- **Question**: "What's your height and weight?"
- **Inputs**: Height (cm) numeric input, Weight (kg) numeric input
- **Why**: Relative strength targets, running load scaling, conditioning intensity, future body comp tracking
- **Store fields**: `heightCm`, `weightKg`

### Screen 6 — Season Phase (Step 5 of 24)
- **Question**: "What time of the season are you currently in?"
- **Options**:
  - Off-season (no team training) → skips Screen 7 AND Screen 8
  - Pre-season (team training) → skips Screen 7 only
  - In-season (team training and games) → shows all
- **Store field**: `seasonPhase`
- **GATING QUESTION** — controls conditional logic downstream

### Screen 7 — Game Day (Step 6 of 24) ⚡ CONDITIONAL
- **Show only if**: seasonPhase === 'In-season'
- **Question**: "What day do you usually play?"
- **Options**: Friday / Saturday / Sunday / Varies
- **Why**: Anchors weekly structure — recovery placement, lower body timing, speed sessions
- **Store field**: `gameDay`

### Screen 8 — Team Training Days (Step 7 of 24) ⚡ CONDITIONAL
- **Show only if**: seasonPhase === 'Pre-season' OR 'In-season'
- **Question**: "How many days per week are you training with the team?"
- **Options**: 0 / 1 / 2 / 3
- **If 1, 2, or 3**: Show day selector (Mon–Sun multi-select) — "Which days?"
- **If 0**: Move to next screen
- **Why**: Coach needs these locked in to build around them
- **Store fields**: `teamTrainingDaysPerWeek`, `teamTrainingDays` (day array)

### Screen 9 — Team Training Duration (Step 8 of 26) ⚡ CONDITIONAL
- **Show only if**: seasonPhase === 'Pre-season' OR 'In-season'
- **Question**: "How long does your team training usually last?"
- **Subtitle**: "This helps us calculate your total weekly training load"
- **Options**:
  - 60 minutes — "Shorter session — mostly skills and drills"
  - 90 minutes — "Standard session — skills, drills, and some match sim"
  - 2 hours — "Full session — conditioning, match simulation, sprinting"
- **Why**: A 2-hour session with match sim and sprints massively affects total training load vs a 60-minute skills session
- **Store field**: `teamTrainingDuration`

### Screen 10 — Team Training Intensity (Step 9 of 26) ⚡ CONDITIONAL
- **Show only if**: seasonPhase === 'Pre-season' OR 'In-season'
- **Question**: "How intense are your team training sessions?"
- **Subtitle**: "This lets us adjust your gym load around team sessions"
- **Options**:
  - Light — mostly skills / "Low physical demand, technical focus"
  - Moderate / "Some running, match practice"
  - Hard conditioning / "Significant running and physical work"
  - Very intense / "Full match sim, heavy conditioning, sprints"
- **Why**: Lets the AI adjust gym volume on team training days
- **Store field**: `teamTrainingIntensity`

### Screen 11 — Training Commitment (Step 10 of 26)
- **Question**: "How many days per week can you commit to training? (not including team training)"
- **Options**: 1 / 2 / 3 / 4 / 5 / 6
- **Always shown**
- **Store field**: `trainingDaysPerWeek`

### Screen 10 — Preferred Training Days (Step 9 of 24)
- **Question**: "Which days can you train?"
- **Input**: Mon–Sun multi-select (should match count from Screen 9)
- **Always shown**
- **Store field**: `preferredTrainingDays` (day array)

### Screen 11 — Session Duration (Step 10 of 24)
- **Question**: "How long can your training sessions usually be?"
- **Options**: 30 min / 45 min / 60 min / 75 min / 90+ min
- **Why**: Determines exercise count, conditioning blocks, accessory volume
- **Store field**: `sessionDurationMinutes`

### Screen 12 — Training Location (Step 11 of 24)
- **Question**: "Where do you usually train?"
- **Options**: Commercial gym / Home gym / Club gym / Outdoor / minimal equipment
- **Why**: Helps auto-select equipment defaults + coach assumptions
- **Store field**: `trainingLocation`

### Screen 13 — Equipment (Step 12 of 24)
- **Question**: "What equipment do you have access to?"
- **Input**: Multi-select chips
- **Full list**: Barbell & plates, Trap bar, Dumbbells, Kettlebells, Squat rack, Pull-up bar, Cable machine, Hamstring curl machine, Knee extension machine, Nordic curl machine, Resistance bands, Sled / prowler, Boxes (for jumps), Bike erg, Assault bike, Rower, Ski erg
- **Auto-select by location**:
  - Commercial gym → Barbell & plates, Dumbbells, Squat rack, Pull-up bar, Cable machine, Hamstring curl machine, Knee extension machine, Resistance bands
  - Home gym → (none — let user select)
  - Club gym → Barbell & plates, Dumbbells, Squat rack, Pull-up bar
  - Outdoor / minimal → Resistance bands, Boxes (for jumps)
- **Store field**: `equipment` (string array)

### Screen 14 — Gym Experience (Step 13 of 24)
- **Question**: "What is your experience level in the gym?"
- **Options**:
  - Complete beginner (0 experience) → skips Screens 15 & 16
  - 1–2 years — know my way around a gym
  - 2–5 years — experienced lifter
  - 5+ years — pro gym rat
- **Store field**: `experienceLevel`
- **GATING QUESTION** — controls strength level skip

### Screen 15 — Squat Strength (Step 14 of 24) ⚡ CONDITIONAL
- **Show only if**: experienceLevel !== 'Complete beginner'
- **Question**: "What is your current squat strength?"
- **Options**: I don't squat / Less than bodyweight / Around bodyweight / 1.5× bodyweight / 2× bodyweight+
- **Store field**: `squatStrength`

### Screen 16 — Bench Strength (Step 15 of 24) ⚡ CONDITIONAL
- **Show only if**: experienceLevel !== 'Complete beginner'
- **Question**: "What is your current bench press strength?"
- **Options**: I don't bench / 50–70kg / 70–90kg / 90–110kg / 110kg+
- **Store field**: `benchStrength`

### Screen 17 — Conditioning Level (Step 16 of 24)
- **Question**: "How would you rate your current fitness?"
- **Options**:
  - Poor — struggle with repeated running
  - Average — can get through training but gas out late
  - Good — rarely struggle
  - Elite — fitness is one of my strengths
- **Store field**: `conditioningLevel`

### Screen 18 — Sprint Exposure (Step 17 of 24)
- **Question**: "Do you currently do sprint training?"
- **Options**: No sprint training / Occasionally (once per week) / Yes (2+ times per week)
- **Why**: Sprint exposure must be managed carefully with team training — hamstring injury risk
- **Always shown** (even off-season — important baseline)
- **Store field**: `sprintExposure`

### Screen 19 — Recent Training Load (Step 18 of 24)
- **Question**: "Over the past 4 weeks, how consistently have you been training?"
- **Options**:
  - Hardly at all (0–1 sessions per week)
  - Somewhat consistent (2–3 sessions per week)
  - Very consistent (4–5 sessions per week)
  - Extremely consistent (6+ sessions per week)
- **Why**: Critical safety input. Determines starting training volume, running progression, and strength loading. If someone's been doing nothing and you give them 5 sessions + sprint work, that's when hamstrings and groins explode. The coach uses this to ramp load gradually.
- **Always shown**
- **Store field**: `recentTrainingLoad`

### Screen 20 — Injuries (Step 19 of 24)
- **Step 1**: "Do you currently have any injuries that make training difficult?" Yes / No
- **If No**: Skip to Screen 21
- **If Yes → Step 2**: Select body area(s): Groin / Hamstring / Knee / Ankle / Hip / Lower back / Shoulder / Other
- **Step 3**: For each selected area, text input: "Tell us about it"
- **Why**: Coach permanently remembers (e.g. "low back pain, can't deadlift" → deadlifts never programmed)
- **Store field**: `injuries` (array of { bodyArea, description })

### Screen 21 — Goals (Step 20 of 24)
- **Question**: "What are your main goals right now, in order of importance?"
- **Options** (rank/reorder): Peaking for game day / Getting stronger / Getting faster / Getting fitter / Adding muscle / Trimming down fat
- **Input**: Drag-to-reorder or numbered tap selection (1st, 2nd, 3rd...)
- **Why**: Directly shapes programming emphasis
- **Store field**: `goals` (ordered string array)

### Screen 22 — Biggest Limitation (Step 21 of 24)
- **Question**: "What is currently your biggest limitation as a footballer?"
- **Options**: Strength / Speed / Endurance / Size / Injury history / Mobility / Power & explosiveness
- **Why**: The killer question most apps miss — athletes know this better than any test
- **Store field**: `biggestLimitation`

### Screen 23 — Biggest Frustration (Step 22 of 24)
- **Question**: "What frustrates you most about your current training?"
- **Options**:
  - I don't know what program to follow
  - I'm sick of going into the gym clueless
  - I don't want to think about my program
  - I feel like I'm not getting stronger
  - I struggle to stay consistent
  - I'm always dealing with injuries
  - I don't feel explosive on the field
  - I get tired late in games
- **Why**: Makes the athlete feel understood. Coach references this later (e.g. "This program is designed to fix the late-game fatigue you mentioned."). Users feel the program is custom built for them.
- **Store field**: `biggestFrustration`

### Screen 24 — Success Vision (Step 23 of 24)
- **Question**: "If this season goes perfectly, what would happen?"
- **Options**:
  - Best season I've ever had
  - Make the senior side
  - Become one of the best players in my team
  - Get recruited to a higher level
  - Stay injury free all season
  - Other (free text input)
- **Why**: Goal visualisation massively increases adherence. This is the emotional high point of onboarding — the last thing they think about before seeing their profile summary.
- **Store field**: `successVision`

### Screen 25 — Review (Step 24 of 24)
- Summary of all collected data, grouped by section
- Each section has an Edit button → navigates back to that screen
- "Generate My Program" CTA at bottom

### Screen 26 — Complete / Program Generation
Two-phase screen that builds perceived value before generating the program.

**Phase 1 — Athlete Profile Card**
After Review, show a polished summary card titled "YOUR ATHLETE PROFILE" with the lime accent styling. This makes the athlete feel seen before the program even generates. Fields shown:

- **Position**: e.g. "Midfielder"
- **Level**: Derived from experience + age (e.g. "Senior club footballer", "Under 18s", "Masters")
- **Season phase**: e.g. "Pre-season"
- **Goal**: Top-ranked goal from Screen 21 (e.g. "Getting faster")
- **Biggest limitation**: e.g. "Endurance"
- **Success vision**: e.g. "Best season I've ever had"
- **Training days**: e.g. "4 days/week (+ 2 team sessions)"
- **Session length**: e.g. "60 minutes"
- **Gym experience**: e.g. "2–5 years"
- **Squat strength**: e.g. "1.5× bodyweight" (omit if beginner)
- **Bench strength**: e.g. "70–90kg" (omit if beginner)
- **Conditioning**: e.g. "Average"
- **Recent load**: e.g. "Somewhat consistent (2–3 sessions/week)"
- **Injuries**: e.g. "Lower back" or "None"

Below the card: a CTA button "Generate My Program"

**Phase 2 — Program Generation**
On tap, transitions to loading state:
- "Generating your personalised AFL performance program..."
- Animated loading indicator
- All onboarding data sent as `athleteProfile` context to the AI coach
- Coach generates first microcycle
- On success → "Start Training" → navigates to home screen

---

## Conditional Logic Summary

| Condition | Screens Skipped |
|---|---|
| Season = Off-season | Game Day (7), Team Training Days (8) |
| Season = Pre-season | Game Day (7) |
| Experience = Complete beginner | Squat Strength (15), Bench Strength (16) |
| No injuries | Injury detail sub-steps in Screen 20 |

## Step Counter Logic
The "Step X of Y" indicator dynamically adjusts based on skipped screens:
- All screens shown: 24 steps (excluding Welcome and Complete)
- Off-season + beginner: 20 steps
- Off-season + experienced: 22 steps
- In-season + beginner: 22 steps
- In-season + experienced: 24 steps (full flow)

## Equipment Auto-Select by Location

| Location | Auto-selected |
|---|---|
| Commercial gym | Barbell & plates, Dumbbells, Squat rack, Pull-up bar, Cable machine, Hamstring curl machine, Knee extension machine, Resistance bands |
| Home gym | (none — let user select) |
| Club gym | Barbell & plates, Dumbbells, Squat rack, Pull-up bar |
| Outdoor / minimal | Resistance bands, Boxes (for jumps) |

## Coach Integration
The AI coach edge function receives the full onboarding profile as `athleteProfile` in every request. The coach uses this to:
- **Program intelligently**: season phase, training days, equipment, experience, strength levels, conditioning level, session duration, recent training load
- **Ramp load safely**: recent training load determines starting volume and progression speed — never spike load on a deconditioned athlete
- **Reference motivation**: "Session complete. One step closer to making the senior team."
- **Address frustrations**: "This program is designed to fix the late-game fatigue you mentioned."
- **Reinforce vision**: "You wanted to have the best season of your life — this block is built for that."
- **Respect injuries**: never program movements that aggravate declared injuries
- **Position flavouring**: subtle programming adjustments by position

## Notes
- Position uses local footy specific options: Small back, Key back, Midfielder, Ruck, Small forward, Key forward
- Game Day includes Friday option
- Goal ranking replaces the old multi-select (max 3) approach — ordering matters for programming emphasis
- Motivation, Frustration, and Success Vision are the retention drivers — most training apps skip these entirely
- Recent Training Load is the key safety input — prevents load spikes on deconditioned athletes
