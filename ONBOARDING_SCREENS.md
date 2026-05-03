# Local Footy Athlete - Onboarding Screens

## Overview
Complete onboarding flow with 8 screens that collect user data to generate personalized S&C programs.

## Screens Created

### 1. WelcomeScreen.tsx
- Entry point for the onboarding journey
- Displays app branding with emoji logo (⚽)
- Shows tagline: "AI-Powered S&C for You"
- Lists 4 key features with icons and descriptions
- Motivational message encouraging user to continue
- "Let's Get Started" button navigates to Position screen

**Features:**
- Hero section with branded title and tagline
- Feature cards highlighting app benefits
- Clean, inspiring design suitable for first impression

### 2. PositionScreen.tsx
- Asks: "What's your playing position?"
- 4 selectable position cards: Defender, Midfielder, Forward, Ruck
- Each position includes:
  - Position name
  - Icon (🛡️, ⚡, 🎯, 💪)
  - Description of S&C focus for that position
- Single select with green accent border on selection
- Back button to previous screen
- Progress indicator (Step 1 of 8)

**State Management:**
- Uses `useProfileStore` to save selected position
- Updates `profileStore.onboardingData.position`

### 3. ExperienceScreen.tsx
- Two-part screen: Age and Experience Level
- Age: Numeric input field (accepts 16-40 range)
- Experience Level: 3 selectable cards
  - Beginner (< 1 year)
  - Intermediate (1-3 years)
  - Advanced (3+ years)
- Each level includes description of fitness background
- Progress indicator (Step 2 of 8)
- Continue button disabled until both fields completed

**State Management:**
- Saves `age` and `experienceLevel` to profile store
- Validates age is minimum 16

### 4. EquipmentScreen.tsx
- Two-part screen: Location and Equipment
- Location: 3 single-select options
  - Full Gym (🏋️)
  - Home Gym (🏠)
  - Club Facilities (⚽)
- Equipment: 7 multi-select checkboxes
  - Barbell, Dumbbells, Kettlebells, Pull-up Bar
  - Resistance Bands, Cable Machine, Bench
- Equipment items shown as grid with checkmark indicators
- Progress indicator (Step 3 of 8)

**State Management:**
- Saves training location and equipment availability
- Updates `hasBarbell`, `hasDumbbells`, `hasFullGym` flags

### 5. TrainingDaysScreen.tsx
- Asks: "How many days per week can you train S&C?"
- 4 selectable options with details:
  - 2 days: "Upper / Lower"
  - 3 days: "Lower / Upper / Power"
  - 4 days: "Upper / Lower x2"
  - 5 days: "Upper / Lower / Power / Back / Legs"
- Each card shows:
  - Number of days (large, prominent)
  - Recommended split
  - Description of benefits
- Info box note: "Consistency matters more than frequency"
- Progress indicator (Step 4 of 8)

**State Management:**
- Saves `daysPerWeek` to profile store

### 6. InjuryHistoryScreen.tsx
- Asks: "Any current or past injuries we should know about?"
- Multi-select injury chips: 9 injury types
  - Knee, Ankle, Shoulder, Back/Spine
  - Hamstring, Groin/Hip, Wrist/Hand, Calf, Neck
- Optional notes section (TextInput for detailed info)
- Reassurance message: "We'll modify your program to work around these"
- Progress indicator (Step 5 of 8)
- Continue button always enabled (injuries optional)

**State Management:**
- Saves `injuryHistory` array to profile store

### 7. GoalsScreen.tsx
- Asks: "What are your main S&C goals?"
- Multi-select cards (max 3 selections)
- 6 goal options with icons and descriptions:
  - Increase Strength (💪)
  - Build Power/Speed (⚡)
  - Build Muscle (🏋️)
  - Improve Endurance (🏃)
  - Reduce Injury Risk (🛡️)
  - Game Day Performance (⚽)
- Selection counter showing "X of 3 goals selected"
- Selected cards show green checkmark
- Unselectable once max reached
- Progress indicator (Step 6 of 8)

**State Management:**
- Saves `primaryGoals` array (max 3) to profile store
- Enforces max selection limit

### 8. SeasonPhaseScreen.tsx
- Asks: "What phase of the season are you in?"
- 4 selectable phase cards with details:
  - **Off-Season** (🌱): "Build your foundation"
    - Heavy strength focus, build base
  - **Pre-Season** (⚙️): "Get game-ready"
    - Power and conditioning, get ready
  - **In-Season** (⚽): "Maintain and recover"
    - Maintenance focus, stay strong
  - **Finals** (🏆): "Peak performance"
    - Minimal volume, maximum intensity
- Each card includes:
  - Icon and title
  - Tagline
  - Full description
  - 3 focus areas (e.g., "Max strength work", "Hypertrophy training")
- Green checkmark on selection
- Progress indicator (Step 7 of 8)

**State Management:**
- Saves season phase to profile store (extended data)

### 9. ReviewScreen.tsx
- Final review before program generation (Step 8 of 8)
- Displays summary of all 8 selections in cards
- Each review card shows:
  - Icon, field name, selected value
  - "Edit" button to navigate back to that screen
- Edit buttons allow user to go back and modify any selection
- "Generate My Program" button at bottom
- Loading state with animated spinner
- Rotating motivational messages during generation (4 second delay)
- Reassurance message about program customization

**Features:**
- Full progress bar (100%) at top
- Review cards with left-aligned icons
- Edit functionality for each section
- Smooth transition to completion screen

### 10. CompleteScreen.tsx
- Success screen shown after program generation
- Displays success animation:
  - Large green checkmark circle (✓)
  - "You're All Set!" headline in accent green
  - "Your personalized S&C program is ready" subtitle
- Personalization message showing user's profile:
  - Position, experience level, training days
- 4 feature highlights:
  - "Your Program is Ready" (📱)
  - "AI Coach at Your Side" (🤖)
  - "Smart Logging" (📔)
  - "Adaptive Training" (📈)
- Motivational quote in highlighted box
- "Start Training" button to enter main app
- Pro tip: "Check the Coach tab for AI guidance"

**Design Features:**
- Large green accent color for success state
- Inspiring messaging
- Clear call-to-action
- Sets positive tone for entering app

## Design System

### Colors Used
- **Background**: `colors.surface.primary` (#1A1A2E)
- **Cards**: `colors.surface.secondary` (#252542)
- **Accent**: `colors.accent.electric` (#00E676) - for highlights, checkmarks
- **Text Primary**: `colors.text.primary` (#E8E8E8)
- **Text Secondary**: `colors.text.secondary` (#B0B0C3)
- **Text Tertiary**: `colors.text.tertiary` (#808090)

### Typography
- **H1**: 32px, bold
- **H2**: 28px, bold
- **H3**: 24px, semibold
- **H4**: 20px, semibold
- **Body**: 16px, regular
- **Body Small**: 14px, regular
- **Captions**: 12px, regular

### Spacing
- Base: 16px (lg)
- Sections: 32px (xxl) between major sections
- Cards: 16px padding
- Elements: 8px (sm) to 24px (lg) between items

### Rounded Corners
- Cards and buttons: 12px (lg)
- Checkmarks/badges: 16px (xl) or full circle

## Navigation Flow

```
Welcome (No back)
    ↓
Position
    ↓
Experience
    ↓
Equipment
    ↓
TrainingDays
    ↓
InjuryHistory
    ↓
Goals
    ↓
SeasonPhase
    ↓
Review (with edit buttons back to any screen)
    ↓
Complete (navigates to main app)
```

## State Management

All screens use Zustand `useProfileStore`:

```typescript
// Store updates
updateOnboardingData({
  position: 'Midfielder',
  age: 24,
  experienceLevel: 'Intermediate',
  trainingLocation: 'Gym',
  daysPerWeek: 3,
  injuryHistory: ['Knee', 'Ankle'],
  primaryGoals: ['strength', 'power', 'injury'],
  seasonPhase: 'Off-Season',
})

// Mark complete
completeOnboarding()
```

## Data Collection Summary

After completing onboarding, collected data includes:
- Position (Defender/Midfielder/Forward/Ruck)
- Age (16-40)
- Experience Level (Beginner/Intermediate/Advanced)
- Training Location (Home/Gym/Club)
- Equipment Available (barbell, dumbbells, kettlebells, etc.)
- Days Per Week (2/3/4/5)
- Injury History (multi-select)
- Primary Goals (up to 3)
- Season Phase (Off-Season/Pre-Season/In-Season/Finals)

## Production Quality Features

- Full TypeScript typing
- Proper error handling
- Responsive design (works on various screen sizes)
- Smooth animations and transitions
- Loading states with messaging
- Disabled button states (prevents invalid submissions)
- Progress indicators on every screen
- Back navigation on all screens except Welcome
- Accessibility-friendly component structure
- Clean, consistent design throughout
- Motivational messaging to encourage completion

## Files Created

All files located in `/src/screens/onboarding/`:
1. WelcomeScreen.tsx (6.1 KB)
2. PositionScreen.tsx (6.7 KB)
3. ExperienceScreen.tsx (8.0 KB)
4. EquipmentScreen.tsx (8.6 KB)
5. TrainingDaysScreen.tsx (8.0 KB)
6. InjuryHistoryScreen.tsx (7.6 KB)
7. GoalsScreen.tsx (8.7 KB)
8. SeasonPhaseScreen.tsx (8.8 KB)
9. ReviewScreen.tsx (11 KB)
10. CompleteScreen.tsx (7.0 KB)
11. index.ts (598 B) - Exports all screens

Updated Files:
- `src/navigation/OnboardingNavigator.tsx` - Now imports and uses real screens
- `src/store/profileStore.ts` - Extended to support seasonPhase field

Total: ~100 KB of production-quality TypeScript React Native code
