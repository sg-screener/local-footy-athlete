# S&C Rules Engine Implementation Guide

## Quick Start

### Files Created

```
✓ supabase/functions/generate-program/index.ts        (572 lines)
✓ supabase/functions/coach-send-message/index.ts      (377 lines)
✓ supabase/functions/sync-exercises/index.ts          (464 lines)
✓ supabase/functions/shared/types.ts                  (153 lines)
✓ supabase/functions/shared/utils.ts                  (206 lines)
✓ src/utils/rulesEngine.ts                            (609 lines)
✓ src/utils/calculations.ts                           (484 lines)
───────────────────────────────────────────────────
  Total: 2,865 lines of production TypeScript
```

### What Was Built

**1. Complete Rules Engine Configuration**
- 4 training phases (Off-Season, Pre-Season, In-Season, Finals)
- 5 training split types (2-5 days per week)
- 4 position-specific exercise libraries
- 5 injury restriction categories
- Progressive overload strategies
- RPE and intensity mappings

**2. Server-Side Edge Functions**
- **generate-program:** Creates personalized training programs (572 lines)
- **coach-send-message:** AI-powered coaching with guardrails (377 lines)
- **sync-exercises:** Exercise database synchronization (464 lines)

**3. Client-Side Utilities**
- **rulesEngine.ts:** Complete rule implementation for client preview
- **calculations.ts:** 25+ training math functions

**4. Shared Infrastructure**
- **types.ts:** TypeScript definitions for all edge functions
- **utils.ts:** Database, error handling, and helper utilities

## Implementation Steps

### Step 1: Deploy Edge Functions to Supabase

```bash
# Authenticate with Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy generate-program
supabase functions deploy coach-send-message
supabase functions functions deploy sync-exercises
```

### Step 2: Set Environment Variables

Create `.env.local` in `supabase/functions/`:

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx

# Optional
EXERCISEDB_API_KEY=xxx
```

### Step 3: Set Up Database Tables

Ensure these tables exist (via migrations):

```sql
-- user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  position TEXT NOT NULL,
  experience_level TEXT NOT NULL,
  has_barbell BOOLEAN DEFAULT false,
  has_dumbbells BOOLEAN DEFAULT false,
  has_full_gym BOOLEAN DEFAULT false,
  days_per_week INT DEFAULT 3,
  injury_history TEXT[] DEFAULT '{}',
  -- ... other fields
);

-- exercises table
CREATE TABLE exercises (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  exercise_type TEXT NOT NULL,
  equipment_required TEXT[] DEFAULT '{}',
  difficulty_level TEXT NOT NULL,
  -- ... other fields
);

-- training_programs table
CREATE TABLE training_programs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  program_phase TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  -- ... other fields
);

-- And so on for microcycles, workouts, etc.
```

### Step 4: Sync Exercises

Call sync-exercises to populate your exercise database:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-exercises \
  -H "Authorization: Bearer your-api-key" \
  -d '{"limit": 100}'
```

Or from React Native:

```typescript
import { supabase } from './lib/supabase';

const { data, error } = await supabase.functions.invoke('sync-exercises', {
  body: { limit: 100 }
});
```

### Step 5: Import Client-Side Utilities

In your React Native components:

```typescript
import { getTrainingSplit, selectExercisesForWorkout } from '@/utils/rulesEngine';
import { estimateOneRepMax, calculateWorkingWeight } from '@/utils/calculations';

// Use for program previews, calculations, etc.
```

## API Endpoints

### POST /generate-program

**Purpose:** Generate a complete training program

**Authentication:** Supabase JWT or API Key

**Request:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "program_phase": "Pre-Season"
}
```

**Response (Success):**
```json
{
  "success": true,
  "programId": "550e8400-e29b-41d4-a716-446655440001",
  "message": "Successfully generated Pre-Season program with 18 workouts"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "User not found: 550e8400-e29b-41d4-a716-446655440000"
}
```

**Typical Execution Time:** 2-5 seconds

**Program Sizes:**
- Off-Season: 12 weeks × 3-5 days = 36-60 workouts
- Pre-Season: 6 weeks × 3-5 days = 18-30 workouts
- In-Season: 52 weeks × 2-5 days = 104-260 workouts
- Finals: 4 weeks × 3-5 days = 12-20 workouts

### POST /coach-send-message

**Purpose:** Send a message to the AI coach

**Authentication:** Supabase JWT

**Request:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440002",
  "message": "How should I approach my first week of pre-season training?"
}
```

**Response (Success):**
```json
{
  "success": true,
  "conversationId": "550e8400-e29b-41d4-a716-446655440002",
  "messageId": "550e8400-e29b-41d4-a716-446655440003",
  "response": "Great question! The first week of pre-season is crucial... [response text]"
}
```

**Typical Execution Time:** 5-10 seconds

**Features:**
- Contextual responses based on user's position
- Considers recent workout history
- Provides form cues and technique tips
- Respects injury restrictions
- Safety guardrails for medical/nutrition topics

### POST /sync-exercises

**Purpose:** Sync exercise database

**Request (Optional):**
```json
{
  "limit": 100,
  "offset": 0
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

**Typical Execution Time:** 1-3 seconds

## Client-Side Usage

### Generate Program Preview

```typescript
import { getTrainingSplit, selectExercisesForWorkout, getPhaseConfig } from '@/utils/rulesEngine';

function ProgramPreview({ userProfile, availableExercises }) {
  const split = getTrainingSplit(userProfile.daysPerWeek);
  const phaseConfig = getPhaseConfig('Pre-Season');

  return (
    <View>
      <Text>Program Split: {split.description}</Text>
      <Text>Duration: {phaseConfig.durationWeeks} weeks</Text>
      <Text>Rep Range: {phaseConfig.repRange[0]}-{phaseConfig.repRange[1]}</Text>

      {split.days.map((day, idx) => (
        <View key={idx}>
          <Text>{day.name}</Text>
          {selectExercisesForWorkout(
            day.focus,
            userProfile,
            availableExercises,
            5
          ).map(ex => (
            <Text key={ex.id}>{ex.name}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}
```

### Calculate Training Stats

```typescript
import {
  getWeeklyVolume,
  getTrainingStatus,
  calculateStreak,
  getPersonalRecord,
  estimateCurrentMax
} from '@/utils/calculations';

function TrainingStats({ loggedWorkouts }) {
  const weeklyVolume = getWeeklyVolume(loggedWorkouts);
  const status = getTrainingStatus(loggedWorkouts);
  const streak = calculateStreak(loggedWorkouts);
  const squat1RM = estimateCurrentMax(loggedWorkouts, 'Back Squat');

  return (
    <View>
      <Text>Weekly Volume: {weeklyVolume}kg</Text>
      <Text>Status: {status}</Text>
      <Text>Training Streak: {streak} days</Text>
      <Text>Est. Squat Max: {squat1RM}kg</Text>
    </View>
  );
}
```

### Calculate Working Weight

```typescript
import { estimateOneRepMax, calculateWorkingWeight } from '@/utils/calculations';

function CalculateWeight({ currentMaxKg, currentReps }) {
  const max = estimateOneRepMax(currentMaxKg, currentReps);
  const target = calculateWorkingWeight(max, 8, 5); // RPE 8, 5 reps

  return (
    <Text>
      Based on {currentMaxKg}kg × {currentReps} reps,
      try {target}kg for 5 reps at RPE 8
    </Text>
  );
}
```

## Customization

### Modify Rules Config

Edit `src/utils/rulesEngine.ts` to customize:

```typescript
export const AFL_RULES_CONFIG = {
  phases: {
    'Off-Season': {
      repRange: [3, 6],          // Change rep ranges
      setRange: [4, 6],          // Change set ranges
      intensityMultiplier: 1.2,  // Adjust intensity
      deloadFrequency: 4,        // Deload every N weeks
      durationWeeks: 12,         // Program length
      focus: 'Strength Development',
      rpeTarget: 8,
    },
    // ... other phases
  },
  splits: {
    3: {
      days: [
        // Customize split structure
      ],
    },
    // ... other splits
  },
  positionPriorities: {
    Ruck: ['Overhead Press', ...], // Customize by position
    // ... other positions
  },
  injuryRestrictions: {
    ACL_Injury: [...],  // Add/remove restrictions
    // ... other injuries
  },
};
```

### Add New Position

1. Add position to enum in `src/types/domain.ts`
2. Add position to `AFL_RULES_CONFIG.positionPriorities`
3. Add position-specific logic in filtering

### Add New Injury Type

1. Add injury type to database
2. Add entry to `injuryRestrictions` in both server and client
3. Test filtering works correctly

## Testing

### Test generate-program Locally

```bash
# Start Supabase locally
supabase start

# In another terminal, start functions
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/generate-program \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "user_id": "test-user-id",
    "program_phase": "Pre-Season"
  }'
```

### Test coach-send-message Locally

```bash
curl -X POST http://localhost:54321/functions/v1/coach-send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "user_id": "test-user-id",
    "conversation_id": "test-conv-id",
    "message": "How do I warm up before squats?"
  }'
```

### Test Client-Side Functions

```typescript
import { getTrainingSplit, selectExercisesForWorkout } from '@/utils/rulesEngine';
import { estimateOneRepMax, calculateWorkingWeight } from '@/utils/calculations';

// Test 1RM estimation
const max = estimateOneRepMax(100, 5);
console.assert(max > 100, 'Max should be greater than working weight');

// Test working weight calculation
const weight = calculateWorkingWeight(max, 8, 5);
console.assert(weight > 0, 'Weight should be positive');

// Test split selection
const split = getTrainingSplit(3);
console.assert(split.days.length === 3, 'Should have 3 workout days');
```

## Performance Optimization

### Edge Functions
- **Caching:** Rules config is hardcoded (no DB queries)
- **Batching:** Exercises inserted in batches of 50
- **Indexes:** Add indexes on frequently filtered columns
- **Concurrent:** Multiple workouts generated in parallel

### Client-Side
- **Memoization:** Use React.memo for expensive calculations
- **Lazy Loading:** Load exercises library on demand
- **Local Storage:** Cache phase configs locally

## Troubleshooting

### Issue: "User not found" error

**Solution:**
1. Verify user_id is correct
2. Check user_profiles table has the user
3. Ensure user is not deleted

### Issue: "No exercises available" error

**Solution:**
1. Run sync-exercises endpoint
2. Verify exercises table is populated
3. Check exercise active status

### Issue: Claude API errors

**Solution:**
1. Verify ANTHROPIC_API_KEY is set
2. Check API key has correct permissions
3. Verify rate limits not exceeded

### Issue: Program generation is slow (>10 seconds)

**Solution:**
1. Check database indexes on user_profiles, exercises
2. Reduce batch size for exercise assignment
3. Consider pre-generating common programs

## Monitoring

### Logs to Check

```bash
# View function logs
supabase functions logs generate-program
supabase functions logs coach-send-message
supabase functions logs sync-exercises
```

### Metrics to Track

- Program generation time
- Coach response time
- Exercise assignment distribution
- Error rates by function

## Next Steps

1. **Deploy to Production**
   - `supabase functions deploy --prod`

2. **Integrate into App**
   - Add UI for generating programs
   - Add coaching interface
   - Add workout logging

3. **Monitor & Optimize**
   - Track function performance
   - Adjust rules based on feedback
   - Add analytics

4. **Enhance Rules**
   - Add team/club customizations
   - Implement ML-based phase prediction
   - Add game schedule integration

## Key Concepts

### RPE (Rate of Perceived Exertion)
- 10: Maximum effort, 1 rep left in tank
- 9: 1-2 reps left
- 8: 2-3 reps left
- 7: 3-4 reps left
- 6: 4-5 reps left

### Intensity Multiplier
- 1.3: Peak/maximal (Finals)
- 1.2: Heavy (Off-Season)
- 1.15: Moderate heavy (Pre-Season)
- 0.9: Maintenance (In-Season)
- 0.6: Recovery/deload

### Progressive Overload
- **Weekly:** Add weight (2.5kg compounds, 1kg isolation)
- **Monthly:** Increase volume (more sets/reps)
- **Deload:** Reduce to 60% to recover
- **Cycling:** Change rep ranges each phase

## Resources

- AFL Coach Education: https://coaches.aflpa.com.au/
- Strength & Conditioning Standards: ASCA (Australian Strength & Conditioning Association)
- Scientific Papers: See SC_RULES_ENGINE.md references
- ExerciseDB API: https://rapidapi.com/justin-WFnsXH_haHLw/api/exercisedb

## Support

For issues or questions about the rules engine:
1. Check SC_RULES_ENGINE.md documentation
2. Review function logs for errors
3. Test edge cases manually
4. Consult team S&C coach for rules questions
