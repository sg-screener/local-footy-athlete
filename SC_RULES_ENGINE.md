# S&C Rules Engine & Supabase Edge Functions

Complete implementation of the core business logic for the Local Footy Athlete React Native app. This document describes the strength and conditioning (S&C) rules engine that generates personalized training programs for AFL athletes.

## Overview

The S&C Rules Engine is the heart of the app. It:

1. **Generates training programs** based on user profile and season phase
2. **Creates personalized workout splits** for 2-5 training days per week
3. **Selects appropriate exercises** based on position, equipment, and injury history
4. **Applies progressive overload** strategies week to week
5. **Manages training periodization** with strategic deload weeks
6. **Provides AI coaching** with position and context-specific guidance

## Architecture

### Server-Side (Supabase Edge Functions)

Running on Deno runtime in Supabase, these functions handle sensitive operations:

#### 1. `generate-program` (Endpoint: `/generate-program`)

**Purpose:** Creates a complete training program from scratch

**Request:**
```json
{
  "user_id": "uuid",
  "program_phase": "Pre-Season" // optional, defaults to determined phase
}
```

**Response:**
```json
{
  "success": true,
  "programId": "uuid",
  "message": "Successfully generated Pre-Season program with 18 workouts"
}
```

**What it does:**
1. Fetches user profile from database
2. Loads the AFL Rules Configuration
3. Creates a training_programs record
4. Generates microcycles (4-12 week blocks) based on phase
5. Creates workouts for each day in each microcycle
6. Assigns exercises to each workout based on:
   - Workout focus area
   - User's position
   - Available equipment
   - Injury restrictions
   - Experience level
7. Sets progressive overload parameters for each exercise
8. Returns program ID and summary

**Program Structure:**
```
Training Program (12-52 weeks)
├── Microcycle 1 (Week 1) - Deload: No
│   ├── Workout 1 (Lower Strength)
│   │   ├── Back Squat (4-6 sets × 3-6 reps)
│   │   ├── Romanian Deadlift (4 × 5-8 reps)
│   │   └── ...
│   ├── Workout 2 (Upper Power)
│   │   └── ...
│   └── ...
├── Microcycle 2 (Week 2) - Deload: No
│   └── ...
├── Microcycle 3 (Week 3) - Deload: No
│   └── ...
└── Microcycle 4 (Week 4) - Deload: Yes (60% intensity)
```

#### 2. `coach-send-message` (Endpoint: `/coach-send-message`)

**Purpose:** AI-powered coaching assistant with safety guardrails

**Request:**
```json
{
  "user_id": "uuid",
  "conversation_id": "uuid",
  "message": "How should I warm up before heavy squats?"
}
```

**Response:**
```json
{
  "success": true,
  "conversationId": "uuid",
  "messageId": "uuid",
  "response": "Great question! For heavy squats, a proper warm-up is crucial..."
}
```

**What it does:**
1. Validates user and conversation exist
2. Fetches user profile for context (position, injuries, equipment)
3. Fetches recent 5 workouts for performance context
4. Fetches conversation history (last 10 messages)
5. Builds contextual system prompt with:
   - Coach personality and expertise
   - User-specific constraints and goals
   - Recent workout data
   - Active program phase
6. Calls Claude API (claude-sonnet-4-5-20250929)
7. Saves both user message and assistant response
8. Returns response text

**Safety Guardrails:**
- For pain/injury: "Consult your physio, avoid aggravating movements"
- For nutrition: General guidance only, refer to club dietitian
- For medical: Never diagnose, defer to qualified professionals
- For mental health: Recognize limits, recommend professionals

**System Prompt:** See `coach-send-message/index.ts` for full prompt

#### 3. `sync-exercises` (Endpoint: `/sync-exercises`)

**Purpose:** Sync exercise database with ExerciseDB API

**Request:**
```json
{
  "limit": 100,    // optional, max 500
  "offset": 0      // optional
}
```

**Response:**
```json
{
  "success": true,
  "syncedCount": 87,
  "message": "Successfully synced 87 exercises"
}
```

**What it does:**
1. Fetches exercises from ExerciseDB API (or uses sample if API unavailable)
2. Transforms exercises to app schema:
   - Determines exercise type (Compound/Isolation/Plyometric)
   - Determines difficulty level (Beginner/Intermediate/Advanced)
   - Maps equipment types
   - Maps muscle groups
   - Generates form notes
3. Upserts into exercises table in batches of 50
4. Returns sync count and status

**Can be called:**
- Periodically via cron job (e.g., weekly)
- Manually from admin UI
- During app initialization if exercise library is empty

### Client-Side (React Native)

#### 1. `rulesEngine.ts`

**Purpose:** Client-side implementation of rules logic for previewing programs

**Key Exports:**

```typescript
// Get training split for a given days per week
getTrainingSplit(daysPerWeek: 2|3|4|5): TrainingSplit

// Select exercises for a workout
selectExercisesForWorkout(
  focus: string,
  userProfile: UserProfile,
  availableExercises: Exercise[],
  count?: number
): Exercise[]

// Calculate progressive overload
calculateProgressiveOverload(
  weekNumber: number,
  currentWeight: number,
  exerciseType: 'Compound' | 'Isolation',
  phaseConfig: PhaseConfig
): number

// Filter exercises by constraints
filterExercises(
  exercises: Exercise[],
  filter: ExerciseFilter,
  rulesConfig: RulesConfig
): Exercise[]

// Get available equipment
getAvailableEquipment(userProfile: UserProfile): string[]

// Get phase configuration
getPhaseConfig(phase: ProgramPhase): PhaseConfig
```

**AFL_RULES_CONFIG:** Complete default rules configuration including:
- Phase definitions (Off-Season, Pre-Season, In-Season, Finals)
- Training splits (2-5 days per week)
- Position-specific exercise priorities
- Injury restriction mappings
- Equipment substitution rules
- RPE targets by phase

#### 2. `calculations.ts`

**Purpose:** Training calculations and metrics

**Key Functions:**

```typescript
// Estimate one rep max (Epley formula)
estimateOneRepMax(weight: number, reps: number): number

// Brzycki formula (alternative, more conservative)
estimateOneRepMaxBrzycki(weight: number, reps: number): number

// Calculate working weight from RPE
calculateWorkingWeight(
  oneRepMax: number,
  targetRPE: number,
  targetReps: number
): number

// Calculate volume and load
calculateVolume(sets: number, reps: number, weight: number): number
calculateTrainingLoad(sets: number, reps: number, weight: number, rpe: number): number

// Get weekly statistics
getWeeklyVolume(loggedWorkouts: LoggedWorkout[]): number
getAverageRPE(loggedWorkouts: LoggedWorkout[]): number
getCompletionRate(loggedWorkouts: LoggedWorkout[]): number

// Training streak and trends
calculateStreak(loggedWorkouts: LoggedWorkout[]): number
getVolumeTrend(loggedWorkouts: LoggedWorkout[], windowSize?: number): number
getTrainingStatus(loggedWorkouts: LoggedWorkout[]): 'improving'|'stable'|'declining'

// Personal records and projections
getPersonalRecord(loggedWorkouts: LoggedWorkout[], exerciseName: string): PR | null
estimateCurrentMax(loggedWorkouts: LoggedWorkout[], exerciseName: string): number
projectMax(loggedWorkouts: LoggedWorkout[], weeksAhead?: number): number

// Utility formatters
formatWeight(kg: number, decimals?: number): string
formatDuration(minutes: number): string
formatPrescription(sets: number, repsMin: number, repsMax: number, weight?: number): string
```

## AFL Rules Configuration

### Phase Definitions

**Off-Season** (12 weeks)
- Focus: Strength Development
- Rep Range: 3-6 (heavy)
- Sets: 4-6
- Intensity Multiplier: 1.2x
- Deload: Every 4th week
- RPE Target: 8
- Goal: Build maximum strength foundation

**Pre-Season** (6 weeks)
- Focus: Power & Explosiveness
- Rep Range: 1-5 (explosive)
- Sets: 3-5
- Intensity Multiplier: 1.15x
- Deload: Every 3rd week
- RPE Target: 8.5
- Goal: Convert strength to power, improve conditioning

**In-Season** (52 weeks)
- Focus: Maintenance & Injury Prevention
- Rep Range: 6-10 (moderate)
- Sets: 2-4
- Intensity Multiplier: 0.9x
- Deload: Every 5th week
- RPE Target: 6.5
- Goal: Maintain fitness while managing fatigue

**Finals** (4 weeks)
- Focus: Peak Performance
- Rep Range: 1-3 (maximal)
- Sets: 2-3
- Intensity Multiplier: 1.3x
- Deload: Every 2nd week
- RPE Target: 9
- Goal: Peak for maximum performance

### Training Splits

**2 Days/Week:**
- Full Body A (Upper Focus)
- Full Body B (Lower Focus)

**3 Days/Week:**
- Lower Strength (Legs & Posterior Chain)
- Upper Power (Chest, Back, Arms)
- Conditioning (Energy System Development)

**4 Days/Week:**
- Lower Strength (Quad & Hip Strength)
- Upper Strength (Pressing & Pulling Strength)
- Lower Hypertrophy (Glute & Posterior Chain)
- Upper Power (Explosive & Dynamic)

**5 Days/Week:**
- Legs (Complete Lower Body)
- Push (Pressing Movements)
- Pull (Pulling Movements)
- Power (Explosive & Plyometric)
- Conditioning (Conditioning & Recovery)

### Position-Specific Exercise Priorities

**Ruck:** Upper body strength priority
- Overhead Press, Bench Press, Pull-ups
- Deadlift, Back Squat (lower foundation)
- Shoulder Press, Box Jumps (explosive)

**Forward:** Lower body power priority
- Back Squat, Deadlift, Bench Press
- Lateral Bounds, Explosive Push-ups
- Box Jumps, Medicine Ball work

**Midfielder:** Balanced, multi-directional
- Back Squat, Deadlift, Pull-ups
- Lateral Bounds, Single Leg Work
- Core Work, Conditioning circuits

**Defender:** Lateral movement and rotational focus
- Back Squat, Deadlift, Pull-ups
- Anti-Rotation work, Lateral movements
- Single Leg Work, Agility drills

### Injury Restrictions

Specific exercises are blacklisted for each injury type:

**ACL Injury:** Avoid deep knee flexion under load
- Full Back Squat, Deep Lunges, Plyometric Drills
- Side-to-Side Movements, Jump Squats, Lateral Bounds

**Lower Back Pain:** Avoid spinal loading and extension
- Heavy Deadlifts, Hyperextensions, Weighted Sit-ups
- Power Clean, Heavy Back Squats, Overhead Carries

**Shoulder Impingement:** Avoid overhead and horizontal adduction
- Overhead Press, Pull-ups, Bench Press
- Dumbbell Flyes, Lateral Raises, Upright Rows

**Hamstring Strain:** Avoid eccentric loading
- Nordic Hamstring Curls, Heavy Deadlifts
- Explosive Movements, Heavy Sprints, Plyometrics

## How Program Generation Works

### Step-by-Step Process

1. **User Profile Loaded**
   - Position, experience level, equipment available
   - Injury history, days per week available

2. **Program Phase Determined**
   - From request parameter or inferred from current date
   - Fetches phase configuration (reps, sets, intensity)

3. **Training Split Selected**
   - Based on days per week (2-5)
   - Provides names and focuses for each workout day

4. **Duration Calculated**
   - Based on phase (4-52 weeks)
   - Each week is a "microcycle"

5. **Microcycles Generated**
   - One per week of program
   - Deload weeks every N weeks (varies by phase)
   - Intensity multiplier: 1.0 for normal, 0.6 for deload

6. **Workouts Created**
   - One workout per day in split
   - Names and focuses from split definition
   - Intensity and type assigned based on phase and day

7. **Exercises Assigned**
   - 4-6 exercises per workout
   - Filtered by:
     - Equipment availability
     - Injury restrictions
     - Experience level
   - Prioritized by position (when available)

8. **Prescriptions Set**
   - Sets and reps from phase configuration
   - RPE target from phase
   - Rest time calculated based on rep range
   - Progressive overload rules applied

### Progressive Overload Strategies

**Compound Lifts (Squat, Deadlift, Bench, etc.):**
- Increase weight by 2.5kg per week
- Deload week: reduce to 60% of current

**Isolation Exercises:**
- Increase weight by 1kg per week
- Increase reps by 1 per week alternative
- Deload week: reduce to 60% of current

**Rest Periods:**
- Heavy (1-5 reps): 3 minutes
- Hypertrophy (6-12 reps): 90 seconds
- Endurance (13+ reps): 45 seconds

## Usage Examples

### Example 1: Generate a Pre-Season Program

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-program \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "program_phase": "Pre-Season"
  }'
```

This creates a 6-week program focused on power and explosiveness.

### Example 2: Client-Side Program Preview

```typescript
import { getTrainingSplit, selectExercisesForWorkout } from './utils/rulesEngine';
import { estimateOneRepMax, calculateWorkingWeight } from './utils/calculations';

// Get the split for user's preferred training days
const split = getTrainingSplit(userProfile.daysPerWeek);

// For the first workout (Lower Strength)
const exercises = selectExercisesForWorkout(
  'Quad & Hip Strength',
  userProfile,
  availableExercises,
  5
);

// Calculate what weight to use for first session
const userBackSquatMax = estimateOneRepMax(120, 5); // User lifted 120kg × 5
const workingWeight = calculateWorkingWeight(userBackSquatMax, 8, 5); // RPE 8, 5 reps

console.log(`Recommended opening weight: ${workingWeight}kg`);
```

### Example 3: AI Coach Integration

```typescript
const response = await supabase.functions.invoke('coach-send-message', {
  body: {
    user_id: 'user123',
    conversation_id: 'conv456',
    message: 'I\'m feeling sore in my shoulder, can I still do bench press?'
  }
});

console.log(response.data.response);
// "I understand your concern. Shoulder soreness needs proper assessment.
//  I'd recommend consulting your physio before heavy pressing movements..."
```

### Example 4: Calculate Training Stats

```typescript
import {
  getWeeklyVolume,
  getTrainingStatus,
  calculateStreak
} from './utils/calculations';

const weeklyVolume = getWeeklyVolume(recentWorkouts);
const status = getTrainingStatus(recentWorkouts);
const streak = calculateStreak(recentWorkouts);

console.log(`Weekly volume: ${weeklyVolume} kg`);
console.log(`Training status: ${status}`);
console.log(`Current streak: ${streak} days`);
```

## Environment Variables Required

### Supabase Edge Functions

```bash
# In supabase/functions/.env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=sk-ant-xxx
EXERCISEDB_API_KEY=xxx (optional, uses sample data if missing)
```

## Testing

### Test generate-program locally:

```bash
supabase functions serve
# In another terminal:
curl -X POST http://localhost:54321/functions/v1/generate-program \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{"user_id": "test-user-123"}'
```

### Test coach-send-message:

```bash
curl -X POST http://localhost:54321/functions/v1/coach-send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{
    "user_id": "test-user-123",
    "conversation_id": "conv-123",
    "message": "How do I warm up properly?"
  }'
```

## Database Schema Integration

The edge functions expect these tables:

```sql
-- Users and profiles
user_profiles (id, position, experience_level, has_barbell, etc.)

-- Programs and structure
training_programs (id, user_id, program_phase, start_date, end_date)
microcycles (id, program_id, week_number, deload_week, intensity_multiplier)
workouts (id, microcycle_id, name, intensity, workout_type)
workout_exercises (id, workout_id, exercise_id, prescribed_sets, prescribed_reps_min)

-- Exercises
exercises (id, name, exercise_type, equipment_required, difficulty_level)

-- Logging
logged_workouts (id, user_id, workout_id, logged_date, completed)
logged_sets (id, logged_workout_id, actual_weight_kg, actual_reps, actual_rpe)

-- Coaching
coach_conversations (id, user_id, title, created_at)
coach_messages (id, conversation_id, role, content, tokens_used)
```

## Performance Considerations

1. **Exercise Filtering:** Efficiently filters large exercise libraries
2. **Batch Operations:** Upserts exercises in batches of 50
3. **Caching:** Rules config is hardcoded, no DB queries needed
4. **Retry Logic:** Handles transient API failures
5. **Transaction Safety:** Uses Supabase client transactions

## Future Enhancements

1. **Dynamic Rules Loading:** Load rules config from database
2. **Team/Club Rules:** Allow clubs to customize rules
3. **Machine Learning:** Predict phase based on game schedule
4. **Performance Tracking:** Auto-adjust intensity based on logged results
5. **Advanced Coach:** Integration with more sophisticated AI
6. **Exercise Variations:** Suggest alternatives based on feedback

## File Structure

```
local-footy-athlete/
├── supabase/functions/
│   ├── generate-program/
│   │   └── index.ts (850 lines)
│   ├── coach-send-message/
│   │   └── index.ts (550 lines)
│   ├── sync-exercises/
│   │   └── index.ts (400 lines)
│   └── shared/
│       ├── types.ts (150 lines)
│       └── utils.ts (300 lines)
└── src/utils/
    ├── rulesEngine.ts (600 lines - FULL config)
    └── calculations.ts (650 lines - 30+ functions)
```

## Total Lines of Code

- **Edge Functions:** ~2,100 lines
- **Shared Utilities:** ~450 lines
- **Client-Side:** ~1,250 lines
- **Total:** ~3,800 lines of production TypeScript

## References

- Epley Formula: Epley, B. J. (1985). "Estimating maximal strength."
- Brzycki Formula: Brzycki, M. (1993). "Strength testing."
- RPE Scale: Borg, G. A. (1982). "Psychophysical bases."
- AFL Training: AFL Coach Education, AFLPA Performance Standards
