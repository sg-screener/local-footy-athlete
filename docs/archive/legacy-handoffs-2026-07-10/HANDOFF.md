# Local Footy Athlete (LFA) — Full Project Handoff

## Overview
React Native mobile app for Australian Rules Football players. AI-powered S&C coaching, periodized training programs, dark industrial aesthetic with lime green (#C8FF00) accent.

## Tech Stack
- **Frontend**: React Native 0.81.5, Expo SDK 54, React 19.1, TypeScript 5.9
- **Navigation**: React Navigation 7 (bottom tabs + native stack)
- **State**: Zustand 4.5 with AsyncStorage persistence
- **AI Coach**: Supabase Edge Function → Claude Sonnet 4
- **Keyboard**: react-native-keyboard-controller 1.18.5 (dev build required, not Expo Go)
- **Animations**: react-native-reanimated 4.1
- **Icons**: react-native-svg (SVG line icons in tab bar)

## How to Run
```bash
# iOS (requires Xcode with iOS simulator runtime installed)
npm install
npx expo prebuild --clean && npx expo run:ios

# After first build, just use:
npx expo start --dev-client

# Deploy coach edge function
supabase functions deploy coach-chat --no-verify-jwt
```

## File Structure
```
src/
  navigation/
    RootNavigator.tsx        — Auth gate + dark theme setup
    AppNavigator.tsx         — Bottom tabs (Program, Coach, Profile) with SVG icons
  screens/
    home/
      HomeScreen.tsx         — Week view, day selector, quick action chips
      DayWorkoutScreen.tsx   — Single workout detail + start button
      WorkoutLoggerScreen.tsx — Live workout logging (WIP)
    coach/
      CoachScreen.tsx        — AI chat (KeyboardStickyView, FlatList messages)
    profile/
      ProfileScreen.tsx      — Athlete info, goals, equipment tags
      FAQScreen.tsx          — FAQ accordion
  components/
    common/                  — Text, Button, Card, Input, Modal, Badge, etc.
    ExerciseVideoModal.tsx   — YouTube demo video modal (direct URLs only)
    ConversationListItem.tsx
    MessageBubble.tsx
    QuickPromptsBar.tsx
    TypingIndicator.tsx
  store/
    programStore.ts          — Current program, microcycle, today's workout
    authStore.ts             — User auth (currently seeded defaults)
    profileStore.ts          — User profile + onboarding state
    coachMemoryStore.ts      — Persistent notes from coach conversations
    coachStore.ts            — Chat conversations + streaming state
    uiStore.ts               — UI modals etc.
    workoutLogStore.ts       — Logged workouts and sets
  theme/
    colors.ts                — Dark palette + lime accent + intensity colors
    spacing.ts               — Spacing scale, border radius, shadows, component dims
    typography.ts            — Bebas Neue headings, system body font
    styles.ts                — Common style helpers
  types/
    domain.ts                — All domain types (UserProfile, Workout, Exercise, etc.)
    api.ts                   — API request/response types
  services/
    api/supabaseClient.ts    — Supabase init with expo-secure-store
    auth/                    — Auth context (not heavily used in MVP)
    exerciseVideoService.ts  — Exercise name → pinned YouTube video URL (or null)
    coachService.ts, programService.ts, etc.
  hooks/
    useInitializeApp.ts      — Seeds default data on first launch
    useCoach.ts, useProgram.ts, useWorkoutLog.ts
  data/
    defaultProgram.ts        — 40+ exercises, default 6-day microcycle, buildWorkoutsFromCoach()
  utils/
    helpers.ts

supabase/functions/coach-chat/index.ts — AI coach edge function

App.tsx — Root: GestureHandler → KeyboardProvider → SafeAreaProvider → QueryClient → RootNavigator
```

## Key Architecture Decisions

### Coach-Driven Program Modification
Users don't manually edit programs. They chat with the AI coach, which uses Claude's tool_use to call `update_program` and modify the training week. The coach also calls `save_note` to persist observations (injuries, preferences, schedule) which get sent as context in every future message.

### State Management
All state in Zustand stores with AsyncStorage persistence. No Redux. Simple direct mutation pattern.

### Keyboard Handling (CoachScreen)
Uses `react-native-keyboard-controller` with `KeyboardStickyView` for frame-perfect keyboard tracking. This requires a **development build** (not Expo Go) because it includes native code. App.tsx wraps everything in `KeyboardProvider`. Current offset: `{ closed: 0, opened: tabBarHeight }`.

### Tab Bar
Custom SVG line icons (clipboard, chat bubble, person). Background #0C0C0C, no border, active tint #C8FF00, inactive #555555. Height 84px, paddingBottom 28px. `lazy: false` to pre-render all screens.

## AI Coach Edge Function Details

**Endpoint**: `https://ryzoxwcijoqbguduonov.supabase.co/functions/v1/coach-chat`
**Auth**: `Bearer sb_publishable_zDWj7A6Z2DRjJY6Smv6lqA_dxu7coLd`

### System Prompt Covers:
- Programming philosophy (3-4 week blocks, periodization, progressive overload)
- Full exercise repertoire organized by category:
  - LOWER BODY COMPOUND: Back squat, box squat, high box squat, trap bar deadlift, front squat, Bulgarian split squat, RDL, hip thrust, leg press, lunges, step ups
  - LOWER BODY POWER: Squat jump, box jump, vertical jump, broad jump
  - LOWER BODY ACCESSORY: Nordic lowers, hamstring curls, Copenhagen plank, hip flex lifts, groin squeeze, crab walks, back extension/reverse hyper, Bosch hold
  - UPPER BODY POWER: Speed bench, explosive landmine press, explosive push ups/clap push ups
  - UPPER PUSH: Bench press, incline bench, flat/incline DB press, overhead press, Z press, landmine press, dips, push ups
  - UPPER PULL: Pull ups, weighted pull ups, chin ups, bent over barbell row, incline DB row, single arm DB row, face pulls
  - ARMS / ACCESSORIES: Skull crushers, tricep pushdowns, Dirty 30, bicep curls, lateral raises, DB shrugs, single arm DB shrugs, Cuban press
  - CORE / CARRIES: Ab wheel, hanging leg raise, side plank, weighted side plank, dragon flag, GHD sit ups, farmers carry, suitcase carry
- Session programming rules (no Olympic lifts, contrast pairs, injury prevention)
- Conditioning methodology (aerobic base, MAS, speed work, repeat sprints)
- In-season vs off-season templates
- Injury management, nutrition guidance, bye week strategies
- Australian tone ("G'day mate")

### Tool Definitions:
1. `update_program` — Takes workouts array with dayOfWeek, name, workoutType, exercises (name, sets, repsMin, repsMax, weight, notes)
2. `save_note` — Takes a string note to remember about the user

### Request Format:
```json
POST { "messages": [...], "coachNotes": ["note1", "note2"] }
```

### Response Flow:
1. Coach responds with text
2. If tool_use for update_program → `buildWorkoutsFromCoach()` converts to app format → programStore updated
3. If tool_use for save_note → coachMemoryStore updated
4. System message shown: "Program updated — check your Program tab."

## Theme Constants

### Colors
- Background: #0C0C0C (primary), #111111 (surface), #161616 (elevated), #1E1E1E (border)
- Accent: #C8FF00 (lime green)
- Text: #FFFFFF (primary), #AAAAAA (secondary), #666666 (disabled)

### Spacing
- xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48

### Typography
- Headings: Bebas Neue (uppercase, bold)
- Body: System default

## Domain Types (key ones)
- **UserProfile**: name, email, position, experienceLevel, trainingDaysPerWeek, goals[], equipment[], subscriptionStatus
- **Microcycle**: weekNumber, workouts[], intensityMultiplier
- **Workout**: dayOfWeek (0-6), name, workoutType, estimatedDuration, exercises[]
- **WorkoutExercise**: exercise, prescribedSets, prescribedRepsMin/Max, prescribedWeight, restSeconds, notes, order
- **ProgramPhase**: Post-Season | Early-Off-Season | Base-Building | Pre-Season-Skills | Christmas-Block | Return-to-Skills | In-Season
- **SessionFeeling**: Cooked | Strong | Good | Average | Sore

## Current State (MVP 0.1)
### Working:
- AI coach chat with program generation
- View weekly program with day selector
- Quick action prompts from home screen
- Coach notes persistence (context memory)
- Dark theme UI
- Exercise demo links (YouTube)
- Dev build with native keyboard handling

### Not Yet Built:
- Real auth (currently seeded fake user)
- Database persistence (all AsyncStorage currently)
- Workout logging completion
- Onboarding flow
- Advanced analytics/charts
- Push notifications
- Subscription/payments (RevenueCat skeleton exists)
- Video playback in-app

## Supabase Config
- Project ID: `ryzoxwcijoqbguduonov`
- Env vars needed: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY
- .env file in project root

## Important Notes
1. **Dev build required** — `react-native-keyboard-controller` needs native code. Use `npx expo start --dev-client` not `npx expo start`
2. **Xcode 26.3** — User has latest Xcode, iOS 26.3 simulator. Packages were aligned with `npx expo install --fix`
3. **Cross-platform** — `react-native-keyboard-controller` works on both iOS and Android
4. **Coach function deployment** — `supabase functions deploy coach-chat --no-verify-jwt`
5. **No git repo** — Project doesn't have git initialized yet
