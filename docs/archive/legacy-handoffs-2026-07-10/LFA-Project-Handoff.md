# LOCAL FOOTY ATHLETE — Complete Project Handoff

**Date:** March 2026
**Owner:** Sam
**Status:** MVP in development — Layer 1 coaching knowledge complete, React Native codebase scaffolded, browser prototype v2 built

---

## 1. THE APP IDEA

Local Footy Athlete (LFA) is an AI-powered Strength & Conditioning programming app for local Australian Rules Football athletes. It provides personalised training programs, an AI coach, a training journal, and adapts to schedule changes.

**Business model:** $10/week subscription with 1-week free trial.
**Target market:** Males 16–30 who play local/amateur Aussie Rules footy.
**Target users:** 250–1,000 paying subscribers.
**Sam's edge:** 200+ game local footballer, sports science degree, S&C coach at a local footy club, AI/business knowledge. The app packages Sam's real-world coaching philosophy and delivers it through AI at scale.

---

## 2. KEY DESIGN & UX DECISIONS

### Visual Design
- **Dark & industrial** aesthetic — NOT a clean/minimal fitness app
- Background: black #0C0C0C
- Primary accent: lime green #C8FF00
- Headings: Bebas Neue font (bold, gritty, industrial)
- Body text: clean sans-serif
- Feel: Bold, strong, confident — like a footy club gym, not a yoga studio

### Home Screen
- Grid layout that does NOT require scrolling
- Shows today's session and a "Make a Change to Plan" button
- Quick access to all key features

### Workout Logger (Simplified)
- ONE working weight per exercise — no per-set weight tracking
- No RPE tracking
- No training timer
- No total load/volume calculations
- Tappable set circles to mark sets as done
- Weight input with +/- buttons
- At session end: "How'd you feel?" selector (Cooked / Strong / Good / Average / Sore) + optional notes → saved to journal

### "Make a Change" Feature
Options: Injury, Game day changed, Change training days, Bye week, Season over, Something else.
AI coach adapts the program based on the change.

### Exercise Videos
- ExerciseDB GIF demos for now (API: https://v2.exercisedb.io)
- Ability to replace with custom videos later

### Onboarding
6-step flow: Position → Experience → Equipment → Training Days → Injury History → Goals → then program generates with a loading animation.

---

## 3. TECH STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Mobile framework | React Native + Expo (TypeScript) | Cross-platform iOS/Android |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Realtime) | Database, auth, serverless |
| AI Coach | Claude API via Supabase Edge Functions | Server-side AI for security/cost |
| Payments | RevenueCat SDK | Apple/Google in-app purchases |
| Exercise demos | ExerciseDB API | GIF exercise demonstrations |
| State management | Zustand | Client-side global state |
| Server state | TanStack React Query | Data fetching/caching |
| Offline storage | expo-sqlite (SQLite) | Offline-first workout logging |

### Key Config
- Bundle ID: `com.localfootyathlete.app`
- Expo SDK: ~52.0.0
- React Native: 0.76.0

---

## 4. AI COACHING ARCHITECTURE

Three-layer system:

### Layer 1: Knowledge Document (COMPLETE)
A comprehensive document containing Sam's complete coaching philosophy — voice/tone rules, training principles, exercise selection, programming structure, season periodisation, conditioning session library, injury management, nutrition guidelines, recovery advice, and a ready-to-use system prompt. This is the file `LFA-Coaching-Knowledge-Base.docx` included alongside this handoff.

### Layer 2: System Prompt
The system prompt (included in Section 10 of the knowledge doc) is sent to Claude API with every message. It defines:
- Coach voice (Aussie footy mate, not a robot)
- Core philosophy (simplicity, intensity > volume, big rocks to 90%)
- Programming rules (3–5 reps, 5→8 progression, mini-cycles)
- Conditioning approach (sprint intervals, flush-outs, session library)
- Guardrails (never diagnose injuries, never prescribe diets, never recommend supplement dosages)

### Layer 3: User Context Injection
Injected dynamically with every API call:
- User profile (position, experience, equipment, injuries)
- Current program phase
- Recent workout logs and performance data
- Any schedule changes or notes

---

## 5. SAM'S TRAINING PHILOSOPHY (SUMMARY)

**Core belief:** Keep it simple. Repeat foundational patterns. Intensity > volume. Consistency beats complexity.

**Hybrid athlete model:** Get strong, get big, get fit, get fast. Not specialise in one thing. Sam's own benchmarks (achieved simultaneously): sub-3s 20m sprint, close to 6min 2km TT, bench BW for 15, deadlift 2.5x BW, 20 strict pull-ups, 14km per game.

**Movement patterns:** Squat (box squat, Bulgarians), Hinge (RDLs are the go-to), Push horizontal (bench variations, dips), Push vertical (overhead press, landmine press), Pull horizontal (rows), Pull vertical (pull-ups, chin-ups), Carry (farmer's carries, suitcase carries).

**Rep ranges:** Most work 3–5 reps. In-season: sets of 3. Pre/off-season: up to 10. 5 reps is the sweet spot.

**Progressive overload:** Start at 5 reps → work to 8 reps → increase weight → back to 5 reps. Repeat.

**Mini-cycles:** 3–4 week blocks. Same program each week, just add weight. After 3–4 weeks, small variation (e.g., DB bench to barbell bench) to keep athletes engaged. Movement patterns stay the same.

**Conditioning toolkit:** Sprint intervals on assault bike (6x10s or 3x20s maximal), flush-outs (30on/30off rotating bike/ski/rower), Nordic 4x4, long slow runs (Oct–Feb, 35–50min), MetCons, Flog Friday (gut-wrencher for grit), 6x1km efforts (start every 7min), hill sprints, MAS training (15:15 x8, rest 2min, 4–5 rounds, distance benchmarks 60m–100m), tempo runs, quality sprint sessions (10–15x100m at 80%, every 2min).

**Things Sam DOESN'T do:** Olympic lifting, speed ladders, complex agility drills, structured deload weeks, RPE tracking, per-set weight logging, total volume calculations. No trying to turn local footballers into professionals.

**Nutrition approach:** Calories are king. Protein + carbs. Honey and rice. Magnesium glycinate + salt. Don't preach about alcohol — these are local footy players.

**Injury philosophy:** Focus on what they CAN do. 3/10 pain rule. Always refer to physio for anything serious.

**Arms matter:** "Gun show" Friday — a light pump session before Saturday's game. Looking good = confidence = performance.

---

## 6. SEASON PERIODISATION

| Phase | Timing | Focus |
|-------|--------|-------|
| Post-season | End of season, 2 weeks | Complete rest |
| Early off-season | Weeks 3–6 | Pure hypertrophy (8–10 reps), light cardio |
| Base building | Weeks 7–12 (pre-November) | Hypertrophy → strength blend, aerobic base |
| Pre-season skills | November – mid-December | 3–5 gym days, 2 conditioning sessions, 3x5 or 4x4 schemes |
| Christmas block | Mid-Dec – late Jan (4–6 weeks) | THE most important block. 4+ conditioning, 3–5 strength sessions |
| Return to skills | Late Jan / early Feb | Volume drops, fitness ~90% done, quality work |
| In-season | March – September | Maintenance. 3 gym sessions min. Flush-outs + bike sprints. Gun show Friday. |

---

## 7. DATABASE SCHEMA

13 tables in Supabase PostgreSQL:

1. **profiles** — User accounts extending Supabase auth (position, experience, equipment, injuries, goals, subscription)
2. **training_programs** — Complete training plans (phase, dates, focus, active status)
3. **microcycles** — Weekly blocks within programs (week number, deload status, intensity multiplier)
4. **workouts** — Individual sessions within microcycles (name, type, intensity, duration)
5. **exercises** — Master exercise library (name, muscle groups, equipment, video URL, difficulty)
6. **workout_exercises** — Exercise prescriptions per workout (sets, reps, weight, rest, order)
7. **logged_workouts** — Completed workout records (date, duration, perceived difficulty, notes)
8. **logged_sets** — Individual set records (reps, weight, RPE — note: RPE should be removed per Sam's philosophy)
9. **ai_coach_conversations** — Chat threads with AI coach
10. **ai_coach_messages** — Individual messages in conversations
11. **schedule_events** — Games, bye weeks, injuries affecting schedule
12. **program_modifications** — Changes made to programs (injury, schedule change, etc.)
13. **user_preferences** — App settings (reminders, weight unit, theme)

Full SQL migrations are in `supabase/migrations/`.

---

## 8. PROJECT FILE STRUCTURE

```
local-footy-athlete/
├── App.tsx                          # Root component with providers
├── app.json                         # Expo config
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── babel.config.js                  # Babel + Reanimated plugin
├── .env.example                     # Environment variables template
│
├── src/
│   ├── types/
│   │   ├── domain.ts                # Core business types (UserProfile, Program, Workout, etc.)
│   │   ├── navigation.ts            # Navigation param types
│   │   ├── api.ts                   # API request/response types
│   │   └── index.ts                 # Re-exports
│   │
│   ├── theme/
│   │   ├── colors.ts                # Color palette (NEEDS UPDATE: currently navy, should be #0C0C0C/#C8FF00)
│   │   ├── typography.ts            # Font sizes, weights
│   │   ├── spacing.ts               # Spacing scale, borders, shadows
│   │   └── styles.ts                # Common style patterns
│   │
│   ├── store/                       # Zustand stores
│   │   ├── authStore.ts
│   │   ├── profileStore.ts
│   │   ├── programStore.ts
│   │   ├── workoutLogStore.ts
│   │   ├── coachStore.ts
│   │   ├── uiStore.ts
│   │   └── index.ts
│   │
│   ├── services/
│   │   ├── api/
│   │   │   ├── supabaseClient.ts    # Supabase client with SecureStore auth
│   │   │   ├── programService.ts    # Program CRUD
│   │   │   ├── workoutService.ts    # Workout logging, history, PRs
│   │   │   ├── coachService.ts      # AI chat with streaming
│   │   │   ├── exerciseService.ts   # Exercise library with filters
│   │   │   └── scheduleService.ts   # Schedule events CRUD
│   │   └── auth/
│   │       ├── authService.ts       # Sign up/in/out, password reset
│   │       ├── authContext.tsx       # React Context provider
│   │       └── useAuthHook.ts       # Custom auth hook
│   │
│   ├── hooks/
│   │   ├── useProgram.ts
│   │   ├── useWorkoutLog.ts
│   │   └── useCoach.ts
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx        # Auth state → Auth/Onboarding/App
│   │   ├── AuthNavigator.tsx        # SignIn, SignUp, ForgotPassword
│   │   ├── OnboardingNavigator.tsx  # 10-screen slide flow
│   │   └── AppNavigator.tsx         # Bottom tabs (Home, Program, Journal, Coach, Profile)
│   │
│   ├── screens/
│   │   ├── auth/                    # SignIn, SignUp, ForgotPassword
│   │   ├── onboarding/              # Welcome, Position, Experience, Equipment, TrainingDays, Injury, Goals, SeasonPhase, Review, Complete
│   │   ├── home/                    # HomeScreen, TodayWorkoutCard, WeekViewCard, StatsCard
│   │   ├── workout/                 # WorkoutLogger, SetLoggerRow, RestTimer, ExerciseVideoPlayer, CompletionSummary
│   │   └── coach/                   # CoachScreen, ChatScreen
│   │
│   ├── components/
│   │   ├── common/                  # Button, Card, Text, Input, Select, Modal, Loading, Header, Badge, ProgressBar, Divider, Avatar
│   │   └── coach/                   # MessageBubble, QuickPromptsBar, TypingIndicator, ConversationListItem
│   │
│   └── utils/
│       ├── rulesEngine.ts           # S&C rules config (NEEDS UPDATE to match Sam's philosophy)
│       └── calculations.ts          # oneRepMax, workingWeight, volume, streak calcs
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # 13 tables with enums, FKs, triggers
│   │   ├── 002_indexes.sql          # Performance indexes
│   │   ├── 003_policies.sql         # Row Level Security policies
│   │   └── 004_seed.sql             # 80+ AFL-specific exercises
│   └── functions/
│       ├── generate-program/        # Rules engine program generator
│       ├── coach-send-message/      # Claude API wrapper with context
│       ├── sync-exercises/          # ExerciseDB API sync
│       └── shared/                  # Shared types and utilities
```

---

## 9. KNOWN ISSUES & WHAT NEEDS UPDATING

### Code doesn't match current design/philosophy:
1. **Theme colours** — `src/theme/colors.ts` still has the old navy (#1A1A2E) palette. Needs updating to black #0C0C0C + lime #C8FF00
2. **RPE tracking** — Still present in types (`prescribedRpe`, `actualRpe` in domain.ts) and workout logger. Should be removed per Sam's philosophy.
3. **Per-set weight logging** — `LoggedSet` type tracks individual set weights. Should be simplified to one weight per exercise.
4. **Deload weeks** — Rules engine has structured deload logic. Sam doesn't believe in scheduled deloads — listen to the body instead.
5. **Rules engine phase configs** — `rulesEngine.ts` rep ranges don't match Sam's philosophy (e.g., In-Season shows 6–10 reps but Sam says sets of 3 in-season).
6. **Position priorities** — Include exercises Sam doesn't use (speed ladders, power cleans, agility ladder drills). Need to match his exercise selection.
7. **Coach system prompt** — `coach-send-message/index.ts` has a generic placeholder prompt. Needs replacing with the Layer 1 knowledge doc system prompt.
8. **Mini-cycle programming** — Not yet implemented in the rules engine. Programs should generate in 3–4 week blocks with same exercises, then rotate with small variations.
9. **Conditioning sessions** — Not modeled in the database or rules engine yet. Need workout types for flush-outs, sprint intervals, MAS training, etc.
10. **"Make a Change" feature** — Not yet wired into the backend. Needs a flow that updates the active program based on the change type.
11. **app.json splash background** — Still #1A1A2E, should be #0C0C0C.

### npm packages NOT installed:
The codebase was created in a sandbox where npm registry was blocked. Running `npm install` in the project root on a local machine will install all dependencies.

---

## 10. BROWSER PROTOTYPE (v2)

A fully interactive HTML prototype exists at `local-footy-athlete-preview/index.html`. This is the current reference design and represents Sam's approved UX. It includes:
- Dark industrial design with correct colours and typography
- All screens: Sign In, Sign Up, Welcome, Onboarding (6 steps), Generating animation, Home (grid), Make a Change, Workout Logger, Completion, Program, Journal, Coach hub, Chat, Profile
- Working exercise navigation, chat with sample responses, set toggling, weight +/- adjustment
- ExerciseDB GIF URLs for exercise demos
- AI coach responses in casual Aussie voice

Use this as the visual reference when building out the React Native app.

---

## 11. COACHING KNOWLEDGE BASE

The complete Layer 1 AI Coaching Knowledge Base is in the file `LFA-Coaching-Knowledge-Base.docx`. It contains 10 sections:

1. **Coach Identity & Voice** — Who the coach is, tone/language rules, things the coach never does
2. **Core Training Philosophy** — Simplicity, hybrid athlete model, big rocks, intensity > volume, looking good matters
3. **Exercise Selection & Movement Patterns** — Specific exercises for squat/hinge/push/pull/carry/accessories/power
4. **Programming Structure** — Rep ranges (3–5 sweet spot), progressive overload (5→8→increase), training frequency, simple logging, no deloads, mini-cycle 3–4 week blocks
5. **Season Periodisation** — Detailed breakdown of every phase from post-season through in-season
6. **Conditioning Philosophy** — In-season (flush-outs + bike sprints) and full session library (Nordic 4x4, long runs, MetCons, Flog Friday, 6x1km, hill sprints, MAS training, tempo runs, quality sprints) + programming principles
7. **Injury Management** — Focus on what they CAN do, 3/10 pain rule, always refer to physio
8. **Nutrition Guidelines** — Calories king, protein + carbs, honey + rice, magnesium + salt, don't preach about alcohol
9. **Recovery & Lifestyle** — Sleep is #1, pre-bed routine, sauna/ice baths are extras
10. **AI System Prompt** — Complete ready-to-paste prompt for the Supabase Edge Function

---

## 12. NEXT STEPS (PRIORITY ORDER)

1. **Update the rules engine** to match Sam's actual philosophy (rep ranges, exercises, no RPE, no deloads, mini-cycles)
2. **Replace the coach system prompt** in `coach-send-message/index.ts` with the one from the knowledge base
3. **Update the theme** to black/lime (#0C0C0C / #C8FF00) with Bebas Neue headings
4. **Simplify the workout logger** — one weight per exercise, remove RPE, remove timer, remove volume tracking
5. **Build the "Make a Change" backend flow** — connect change types to program modifications
6. **Implement mini-cycle programming** in the program generator — 3–4 week blocks with small exercise rotations
7. **Add conditioning session types** to the database and program generator
8. **Wire ExerciseDB API** properly into the React Native app for GIF demos
9. **Set up Supabase project** — create the database, deploy edge functions, configure auth
10. **Set up RevenueCat** — $10/week subscription, 1-week free trial
11. **Test on device** — run `npm install`, then `expo start` on local machine
12. **Replace ExerciseDB GIFs** with custom exercise videos when ready

---

## 13. FILES INCLUDED IN THIS HANDOFF

| File | Description |
|------|-------------|
| `LFA-Project-Handoff.md` | This document — complete project overview |
| `LFA-Coaching-Knowledge-Base.docx` | Layer 1 AI coaching philosophy & system prompt |
| `local-footy-athlete/` | Complete React Native Expo project (~87 source files) |
| `local-footy-athlete-preview/index.html` | Interactive browser prototype (v2 — current reference design) |
