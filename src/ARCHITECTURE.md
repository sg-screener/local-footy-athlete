# Architecture Guide: Zustand Stores & Supabase Services

This document describes the state management and API service layer for the Local Footy Athlete React Native app.

## Overview

The application uses a layered architecture with:
- **Zustand** for client-side state management
- **Supabase** for backend services and database
- **Custom hooks** for business logic and API integration
- **React Context** for auth initialization and user state

## Directory Structure

```
src/
├── store/                    # Zustand state stores
│   ├── authStore.ts         # Authentication state
│   ├── profileStore.ts      # User profile & onboarding
│   ├── programStore.ts      # Training program state
│   ├── workoutLogStore.ts   # Workout logging session
│   ├── coachStore.ts        # AI coach conversations
│   ├── uiStore.ts           # General UI state
│   └── index.ts             # Central exports
├── services/                # API and business logic
│   ├── api/
│   │   ├── supabaseClient.ts      # Supabase client config
│   │   ├── programService.ts      # Program CRUD
│   │   ├── workoutService.ts      # Workout logging
│   │   ├── coachService.ts        # AI coach API
│   │   ├── scheduleService.ts     # Schedule events
│   │   └── index.ts              # API exports
│   ├── auth/
│   │   ├── authService.ts         # Authentication logic
│   │   ├── authContext.tsx        # Auth context provider
│   │   ├── useAuthHook.ts         # Auth operations hook
│   │   └── index.ts              # Auth exports
│   └── index.ts                  # All service exports
└── hooks/                   # Custom React hooks
    ├── useProgram.ts       # Program management
    ├── useWorkoutLog.ts    # Workout logging
    ├── useCoach.ts         # Coach conversation
    └── index.ts            # Hook exports
```

## Zustand Stores

### 1. Auth Store (`authStore.ts`)

Manages user authentication state.

```typescript
import { useAuthStore } from '@/store';

const { user, isAuthenticated, isLoading, setUser, signOut } = useAuthStore();
```

**State:**
- `user`: Current authenticated user
- `session`: Active session with tokens
- `isAuthenticated`: Whether user is logged in
- `isLoading`: Loading state for async operations
- `error`: Last error message

**Methods:**
- `setUser(user)`: Set authenticated user
- `setSession(session)`: Store session tokens
- `setAuthenticated(boolean)`: Update auth state
- `setLoading(boolean)`: Update loading state
- `setError(error)`: Set error message
- `signOut()`: Clear auth state
- `clear()`: Reset all auth state

### 2. Profile Store (`profileStore.ts`)

Manages user profile data and onboarding progress.

```typescript
import { useProfileStore } from '@/store';

const { profile, onboardingData, updateOnboardingData, completeOnboarding } = useProfileStore();
```

**State:**
- `profile`: Complete user profile from Supabase
- `onboardingData`: Partial profile during onboarding
- `isOnboardingComplete`: Onboarding status flag
- `isLoading`: Loading state
- `error`: Error messages

**Methods:**
- `setProfile(profile)`: Set complete profile
- `updateOnboardingData(data)`: Accumulate onboarding answers
- `completeOnboarding()`: Mark onboarding as done
- `resetOnboarding()`: Start onboarding over

### 3. Program Store (`programStore.ts`)

Manages the current training program and workouts.

```typescript
import { useProgramStore } from '@/store';

const { currentProgram, todayWorkout, setCurrentProgram } = useProgramStore();
```

**State:**
- `currentProgram`: Active TrainingProgram with microcycles
- `currentMicrocycle`: Current week being followed
- `todayWorkout`: Today's scheduled workout
- `isGenerating`: Whether AI is generating program
- `isLoading`: Data loading state
- `error`: Error messages

**Methods:**
- `setCurrentProgram(program)`: Set active program
- `setCurrentMicrocycle(microcycle)`: Set current week
- `setTodayWorkout(workout)`: Set today's workout
- `setGenerating(boolean)`: Update generation state

### 4. Workout Log Store (`workoutLogStore.ts`)

Manages the active workout logging session (in-memory state).

```typescript
import { useWorkoutLogStore } from '@/store';

const {
  activeWorkout,
  currentExerciseIndex,
  startWorkout,
  logSet,
  nextExercise,
  completeWorkout,
} = useWorkoutLogStore();
```

**State:**
- `activeWorkout`: Current LoggedWorkout being logged
- `loggedSets`: Map of exercise ID -> LoggedSet[]
- `currentExerciseIndex`: Which exercise user is on
- `isLogging`: Whether actively logging
- `isLoading`: Data loading state
- `error`: Error messages

**Methods:**
- `startWorkout(workout)`: Begin logging session
- `logSet(exerciseId, set)`: Add a logged set
- `updateSet(exerciseId, index, updates)`: Modify a logged set
- `getExerciseSets(exerciseId)`: Get sets for exercise
- `nextExercise()`: Move to next exercise
- `prevExercise()`: Move to previous exercise
- `completeWorkout()`: Finish logging session

### 5. Coach Store (`coachStore.ts`)

Manages AI coach conversations and messages.

```typescript
import { useCoachStore } from '@/store';

const { conversations, activeConversation, messages, addMessage } = useCoachStore();
```

**State:**
- `conversations`: All CoachConversation threads
- `activeConversation`: Current conversation
- `messages`: Messages in active conversation
- `isStreaming`: Whether streaming AI response
- `isLoading`: Data loading state
- `error`: Error messages

**Methods:**
- `setConversations(conversations)`: Set all conversations
- `setActiveConversation(conversation)`: Select conversation
- `setMessages(messages)`: Set message list
- `addMessage(message)`: Add single message

### 6. UI Store (`uiStore.ts`)

Manages general UI state and preferences.

```typescript
import { useUIStore } from '@/store';

const { isOnline, activeTab, theme, setTheme } = useUIStore();
```

**State:**
- `isOnline`: Network connectivity status
- `activeTab`: Currently active navigation tab
- `theme`: 'dark' or 'light' theme

**Methods:**
- `setOnline(boolean)`: Update network status
- `setActiveTab(tab)`: Change active tab
- `setTheme(theme)`: Change theme

## Supabase Services

All services follow the pattern:

```typescript
async function operation(...): Promise<ApiResponse<T>> {
  try {
    // Supabase operations
    return { data: result, error: null, success: true };
  } catch (error) {
    return { data: null, error: { code, message }, success: false };
  }
}
```

### Supabase Client (`supabaseClient.ts`)

Initializes Supabase client with secure token storage using `expo-secure-store`.

```typescript
import { supabase, getCurrentUser, getCurrentSession } from '@/services';

const user = await getCurrentUser();
const session = await getCurrentSession();
```

**Key Features:**
- Automatic token refresh
- Session persistence
- Secure storage adapter for React Native
- Error handling utilities

### Auth Service (`authService.ts`)

Handles user authentication operations.

```typescript
import { signUp, signIn, signOut, resetPassword } from '@/services';

// Sign up
const response = await signUp({
  email: 'user@example.com',
  password: 'password123',
  displayName: 'John Doe',
});

// Sign in
const response = await signIn({
  email: 'user@example.com',
  password: 'password123',
});

// Sign out
await signOut();

// Reset password
await resetPassword('user@example.com');
```

**Functions:**
- `signUp(request)`: Create new user account
- `signIn(request)`: Authenticate user
- `signOut()`: Log out current user
- `resetPassword(email)`: Send reset email
- `updatePassword(newPassword)`: Change password
- `getAuthUser()`: Get current auth user
- `onAuthStateChange(callback)`: Listen for auth changes

### Program Service (`programService.ts`)

Manages training programs and microcycles.

```typescript
import {
  getCurrentProgram,
  getProgramById,
  createProgram,
  getTodayWorkout,
  getWeekWorkouts,
  updateProgram,
  deactivateProgram,
} from '@/services';

// Get active program
const response = await getCurrentProgram(userId);
const program = response.data;

// Get today's workout
const workout = await getTodayWorkout(programId);

// Get week's workouts
const workouts = await getWeekWorkouts(microcycleId);
```

**Functions:**
- `getCurrentProgram(userId)`: Get active TrainingProgram
- `getProgramById(programId)`: Get specific program
- `createProgram(data)`: Create new program
- `getTodayWorkout(programId)`: Get today's scheduled workout
- `getWeekWorkouts(microcycleId)`: Get all week's workouts
- `updateProgram(id, updates)`: Modify program
- `deactivateProgram(id)`: Deactivate program

### Workout Service (`workoutService.ts`)

Manages workout logging and set tracking.

```typescript
import {
  logWorkout,
  logSet,
  getWorkoutHistory,
  getExerciseHistory,
  getPersonalRecords,
  completeWorkout,
  updateSet,
  bulkUpdateSets,
} from '@/services';

// Start logging a workout
const workout = await logWorkout({
  userId,
  workoutId,
  loggedDate: '2024-01-15',
});

// Log a set
const set = await logSet({
  loggedWorkoutId: workout.id,
  workoutExerciseId: 'ex123',
  setNumber: 1,
  actualReps: 10,
  actualWeightKg: 80,
  actualRpe: 7,
});

// Complete workout
await completeWorkout(loggedWorkoutId, {
  completedAt: new Date().toISOString(),
  durationMinutes: 45,
  perceivedDifficulty: 7,
});

// Get PRs
const prs = await getPersonalRecords(userId);
```

**Functions:**
- `logWorkout(data)`: Create logged workout
- `logSet(data)`: Add set to workout
- `getWorkoutHistory(userId, limit)`: Get past workouts
- `getExerciseHistory(userId, exerciseId)`: Get exercise history
- `getPersonalRecords(userId)`: Get PRs by exercise
- `completeWorkout(id, data)`: Mark workout complete
- `updateSet(id, updates)`: Modify logged set
- `bulkUpdateSets(updates)`: Update multiple sets

### Coach Service (`coachService.ts`)

Manages AI coach conversations and streaming.

```typescript
import {
  sendMessage,
  getConversations,
  createConversation,
  getMessages,
  streamMessage,
  deleteConversation,
} from '@/services';

// Create conversation
const conversation = await createConversation({
  userId,
  topic: 'training-plan',
  title: 'Program Discussion',
  initialMessage: 'Help me plan my training',
});

// Send message
const response = await sendMessage(conversationId, 'How should I warm up?');

// Stream message (real-time)
await streamMessage(
  conversationId,
  'Tell me about periodization',
  (chunk) => console.log(chunk.fullMessage),
  () => console.log('Done'),
  (error) => console.error(error),
);

// Get all conversations
const conversations = await getConversations(userId);
```

**Functions:**
- `sendMessage(conversationId, message)`: Send message and get response
- `getConversations(userId)`: List user's conversations
- `createConversation(request)`: Start new conversation
- `getMessages(conversationId)`: Get message history
- `streamMessage(...)`: Stream AI response
- `deleteConversation(id)`: Delete conversation

### Schedule Service (`scheduleService.ts`)

Manages schedule events (games, bye weeks, injuries).

```typescript
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getUpcomingEvents,
  getEventsByType,
} from '@/services';

// Create event
const event = await createEvent({
  userId,
  eventType: 'Game',
  eventName: 'Home Game vs Team A',
  startDate: '2024-02-15',
  endDate: '2024-02-15',
  modifiesProgram: true,
  notes: 'Important fixture',
});

// Get upcoming events
const upcoming = await getUpcomingEvents(userId);

// Get events by type
const games = await getEventsByType(userId, 'Game');
```

**Functions:**
- `getEvents(userId, dateRange)`: Get events in date range
- `createEvent(data)`: Create schedule event
- `updateEvent(id, updates)`: Modify event
- `deleteEvent(id)`: Delete event
- `getUpcomingEvents(userId)`: Get next 7 days
- `getEventsByType(userId, type)`: Filter by event type

## Custom Hooks

Custom hooks provide convenient abstractions for common patterns.

### useProgram Hook

```typescript
import { useProgram } from '@/hooks';

const {
  currentProgram,
  loadCurrentProgram,
  updateProgram,
  getTodayWorkout,
  getWeekWorkouts,
  setGenerating,
} = useProgram();

// Load user's program
await loadCurrentProgram();

// Update program
await updateProgram({ name: 'New Program' });

// Get today's workout
const workout = await getTodayWorkout();
```

### useWorkoutLog Hook

```typescript
import { useWorkoutLog } from '@/hooks';

const {
  activeWorkout,
  currentExerciseIndex,
  startNewWorkout,
  addSet,
  updateLoggedSet,
  finishWorkout,
  getCurrentExercise,
  moveToNextExercise,
  hasNextExercise,
} = useWorkoutLog();

// Start logging
await startNewWorkout(workoutId, userId, '2024-01-15');

// Log set
await addSet(exerciseId, {
  setNumber: 1,
  actualReps: 10,
  actualWeightKg: 80,
});

// Navigate exercises
if (hasNextExercise()) {
  moveToNextExercise();
}

// Finish workout
await finishWorkout(45, 8);
```

### useCoach Hook

```typescript
import { useCoach } from '@/hooks';

const {
  conversations,
  activeConversation,
  messages,
  createNewConversation,
  sendMessage,
  streamMessage,
  selectConversation,
} = useCoach();

// Create conversation
await createNewConversation(userId, 'training', 'Periodization', 'Tell me about periodization');

// Send message
await sendMessage('How should I structure my training week?');

// Stream response
await streamMessage('Explain linear periodization');
```

## Auth Context & Hooks

### AuthProvider

Wraps your app to initialize and manage auth state:

```typescript
import { AuthProvider } from '@/services';

export default function App() {
  return (
    <AuthProvider>
      {/* Your app */}
    </AuthProvider>
  );
}
```

### useAuth Hook

Check auth status in any component:

```typescript
import { useAuth } from '@/services';

function MyComponent() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen />;

  return <MainApp />;
}
```

### useAuthHook

Perform auth operations:

```typescript
import { useAuthHook } from '@/services';

function LoginScreen() {
  const { signIn, signUp, resetPassword, isLoading } = useAuthHook();

  const handleLogin = async () => {
    const result = await signIn({
      email: 'user@example.com',
      password: 'password123',
    });

    if (result.success) {
      // Navigate to home
    } else {
      // Show error
    }
  };

  return <></>;
}
```

## Data Flow Examples

### User Onboarding Flow

```
AuthProvider → User logs in
    ↓
useAuthStore updated with user
    ↓
useProfileStore.setProfile() called
    ↓
Onboarding screen shown
    ↓
User fills form → updateOnboardingData()
    ↓
Submit → Save to Supabase
    ↓
completeOnboarding() → Navigate to home
```

### Workout Logging Flow

```
Home screen → "Start Workout" clicked
    ↓
getTodayWorkout() → Load from programService
    ↓
startWorkout() → Initialize in workoutLogStore
    ↓
Exercise screen → User logs set
    ↓
logSet() → Save to Supabase & workoutLogStore
    ↓
Next exercise → nextExercise() updates index
    ↓
Finish → completeWorkout() → Save completion
    ↓
Analytics updated with new PR data
```

### Coach Conversation Flow

```
Coach tab → List conversations
    ↓
createNewConversation() → New thread
    ↓
User types message → sendMessage()
    ↓
Edge function processes → saves to Supabase
    ↓
Response added to coachStore
    ↓
Message displayed with streaming (optional)
```

## Error Handling

All services return standardized `ApiResponse<T>`:

```typescript
interface ApiResponse<T> {
  data: T;
  error: ApiError | null;
  success: boolean;
}

// Usage
const response = await getCurrentProgram(userId);
if (response.success) {
  const program = response.data;
} else {
  console.error(response.error?.message);
}
```

## Persistence & Hydration

Zustand stores with `persist` middleware automatically:
- Save state to AsyncStorage
- Hydrate on app startup
- Keep data in sync across sessions

Stores that persist:
- `authStore` (user/session)
- `profileStore` (user profile)
- `programStore` (current program)
- `coachStore` (conversations)
- `uiStore` (theme/preferences)

The `workoutLogStore` does NOT persist (clears on app restart) since it's for active sessions only.

## Performance Considerations

1. **Selective Subscriptions**: Only subscribe to needed state
   ```typescript
   const user = useAuthStore((state) => state.user);
   ```

2. **Debounce API Calls**: Prevent rapid duplicate requests
   ```typescript
   const debouncedUpdate = useCallback(
     debounce((data) => updateProgram(data), 500),
     [],
   );
   ```

3. **Lazy Load Data**: Load only when needed
   ```typescript
   const loadProgram = useCallback(async () => {
     if (currentProgram) return; // Already loaded
     await loadCurrentProgram();
   }, [currentProgram]);
   ```

4. **Batch Updates**: Use bulk operations for sets
   ```typescript
   await bulkUpdateSets(setUpdates);
   ```

## Testing

Test stores in isolation:

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useAuthStore } from '@/store';

test('auth store', () => {
  const { result } = renderHook(() => useAuthStore());

  act(() => {
    result.current.setUser({ id: '1', email: 'test@example.com' });
  });

  expect(result.current.user?.email).toBe('test@example.com');
});
```

Test services with mocked Supabase:

```typescript
jest.mock('@/services/api/supabaseClient');

test('getProgram', async () => {
  supabase.from.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: mockProgram }),
    }),
  });

  const response = await getCurrentProgram('userId');
  expect(response.success).toBe(true);
});
```

## Best Practices

1. Always check `response.success` before using `response.data`
2. Handle loading and error states in UI
3. Use custom hooks for business logic, not raw store/service calls
4. Clear stores on logout with `clearAllStores()`
5. Memoize callbacks with `useCallback`
6. Avoid nested component subscriptions to same store
7. Use proper TypeScript types from `@/types`
8. Keep Supabase queries simple - use views/functions for complex logic
9. Implement optimistic updates for better UX
10. Sync online/offline status with `useUIStore`
