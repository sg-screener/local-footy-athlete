# Local Footy Athlete - Navigation & Auth Setup

Complete navigation structure and authentication screens for the Local Footy Athlete React Native app.

## Project Structure

```
src/
├── navigation/
│   ├── RootNavigator.tsx           # Root navigation stack with auth state
│   ├── AuthNavigator.tsx           # Auth stack (SignIn, SignUp, ForgotPassword)
│   ├── OnboardingNavigator.tsx     # Onboarding flow with 10 screens
│   ├── AppNavigator.tsx            # Main app bottom tab navigator (5 tabs)
│   ├── types.ts                    # Re-exports navigation types
│   └── index.ts                    # Navigation exports
├── screens/
│   └── auth/
│       ├── SignInScreen.tsx        # Professional sign-in screen
│       ├── SignUpScreen.tsx        # Sign-up with validation
│       ├── ForgotPasswordScreen.tsx # Password reset flow
│       └── index.ts                # Screen exports
├── store/
│   ├── authStore.ts                # Auth state (existing)
│   └── profileStore.ts             # Profile/onboarding state (existing)
├── services/
│   └── auth/
│       └── authService.ts          # Auth API calls (existing)
└── types/
    └── navigation.ts               # Navigation param types (existing)
```

## Navigation Flow

### Root Navigator (`RootNavigator.tsx`)
- Entry point for the entire app
- Manages authentication state with Zustand stores
- Routing logic:
  - Not authenticated → `AuthNavigator`
  - Authenticated + not onboarded → `OnboardingNavigator`
  - Authenticated + onboarded → `AppNavigator`
- Uses dark theme with electric green accent color

### Auth Navigator (`AuthNavigator.tsx`)
Stack-based navigation with three screens:

1. **SignInScreen** - Entry point for returning users
2. **SignUpScreen** - New user registration
3. **ForgotPasswordScreen** - Password recovery

### Onboarding Navigator (`OnboardingNavigator.tsx`)
10-step onboarding flow with slide animation:
1. Welcome
2. Position
3. Experience
4. Equipment
5. TrainingDays
6. InjuryHistory
7. Goals
8. SeasonPhase
9. Review
10. Complete

*Note: Placeholder screens provided - replace with full implementations*

### App Navigator (`AppNavigator.tsx`)
Bottom tab navigator with 5 main sections:

1. **Home** (HomeStack)
   - HomeScreen
   - TrainingOverview
   - CurrentWeek
   - DayWorkout
   - QuickStart
   - Stats

2. **Program** (ProgramStack)
   - ProgramList
   - ProgramDetail
   - ProgramCreate
   - ProgramEdit
   - MicrocycleDetail
   - WorkoutDetail
   - ExerciseDetail
   - ExerciseLibrary
   - CustomizeWorkout

3. **Journal** (JournalStack)
   - JournalHome
   - LogWorkout
   - WorkoutHistory
   - WorkoutHistoryDetail
   - PersonalRecords
   - ProgressCharts
   - ExerciseHistory
   - WeeklyReview

4. **Coach** (CoachStack)
   - CoachHome
   - CoachChat
   - CoachConversations
   - CoachConversationDetail
   - CoachTopics
   - CoachTopic

5. **Profile** (ProfileStack)
   - ProfileHome
   - EditProfile
   - Preferences
   - TrainingPreferences
   - EquipmentSettings
   - GoalSettings
   - HealthSettings
   - InjuryManagement
   - NotificationSettings
   - Privacy
   - Terms
   - About
   - Help
   - Support
   - Feedback
   - Account
   - Subscription
   - DeleteAccount

## Auth Screens

### SignInScreen (`SignInScreen.tsx`)

Professional sign-in screen with:
- App title "Local Footy Athlete" with tagline
- Email input with validation
- Password input (secure)
- "Forgot Password?" link
- Full-width sign-in button
- Error messaging
- Link to sign-up screen
- Loading states
- Form validation (email format, required fields)

**Features:**
- Real-time error feedback
- Keyboard handling with KeyboardAvoidingView
- Loading state feedback
- Smooth navigation transitions

### SignUpScreen (`SignUpScreen.tsx`)

Registration screen with:
- Header "Join Local Footy Athlete"
- Subheader "Start your free 1-week trial"
- Email input with validation
- Password input with requirements display
  - At least 8 characters
  - Uppercase and lowercase letters
  - Numbers
- Confirm password input
- Full-width create account button
- Error messaging
- Link to sign-in screen
- Loading states
- Password validation:
  - Minimum 8 characters
  - Must contain uppercase letters
  - Must contain lowercase letters
  - Must contain numbers
  - Passwords must match

**Features:**
- Visual password requirements guide
- Real-time validation feedback
- Comprehensive error handling
- Auto-generated display name from email

### ForgotPasswordScreen (`ForgotPasswordScreen.tsx`)

Password reset screen with two states:

**Reset Request State:**
- Back button to return to sign-in
- Email input with validation
- Full-width send reset link button
- Error messaging
- Additional help text with support link

**Success State:**
- Success icon (✓)
- Success message
- Instructions to check email
- Auto-redirect to sign-in after 3 seconds
- Button to manually return to sign-in

**Features:**
- Two-state UX (request → success)
- Auto-navigation to sign-in
- Spam folder reminder
- Support contact option

## Theme Implementation

All screens use the dark theme colors:

- **Background**: #1A1A2E (primary dark)
- **Surface**: #252542 (secondary, cards)
- **Accent**: #00E676 (electric green)
- **Secondary**: #FF6D00 (burnt orange)
- **Text Primary**: #FFFFFF
- **Text Secondary**: #B0B0C3
- **Text Tertiary**: #808090
- **Borders**: #3F3F5A
- **Error**: #F44336
- **Success**: #4CAF50

## Component Dependencies

All screens use existing components:

- `Text` - Custom typography component
- `Input` - Form input with validation
- `Button` - Primary/secondary buttons with variants
- `colors` - Theme color palette
- `spacing`, `borderRadius` - Spacing system
- `typography` - Font sizes and weights

## State Management

**Auth Store (Zustand):**
```typescript
- user: { id: string; email: string } | null
- session: { accessToken: string; refreshToken: string } | null
- isAuthenticated: boolean
- isLoading: boolean
- error: string | null
- setUser() / setSession() / setAuthenticated() / setLoading() / setError()
- signOut() / clear()
```

**Profile Store (Zustand):**
```typescript
- profile: UserProfile | null
- onboardingData: Partial<UserProfile>
- isOnboardingComplete: boolean
- setProfile() / updateOnboardingData() / completeOnboarding()
- resetOnboarding() / clear()
```

## API Integration

Auth screens use `authService.ts` functions:

- `signUp(request)` - Register new user
- `signIn(request)` - Authenticate user
- `resetPassword(email)` - Request password reset
- `updatePassword(newPassword)` - Update password with token
- `getAuthUser()` - Get current user
- `onAuthStateChange(callback)` - Listen to auth changes

## Usage

### Using in App.tsx or Root Component

```typescript
import { RootNavigator } from './src/navigation';

export default function App() {
  return <RootNavigator />;
}
```

### Navigating Between Screens

```typescript
// From any auth screen
navigation.navigate('SignIn');
navigation.navigate('SignUp');
navigation.navigate('ForgotPassword');

// From app screens
navigation.navigate('HomeStack');
navigation.navigate('ProgramStack');
navigation.navigate('JournalStack');
navigation.navigate('CoachStack');
navigation.navigate('ProfileStack');
```

## Validation Rules

### Email
- Required
- Valid email format (contains @ and .)

### Password (Sign In)
- Required
- Minimum 6 characters

### Password (Sign Up)
- Required
- Minimum 8 characters
- Must contain uppercase letter
- Must contain lowercase letter
- Must contain number
- Must match confirm password

## File Locations

All files use relative imports (not path aliases):

```typescript
// Correct ✓
import { colors } from '../../theme/colors';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';

// Not used ✗
import { colors } from '@/theme/colors';
```

## Next Steps

1. Implement remaining onboarding screens in `OnboardingNavigator`
2. Implement placeholder screens in each tab navigator
3. Add deep linking configuration
4. Add splash/loading screen
5. Add error boundary and offline handling
6. Add analytics tracking
7. Implement proper keyboard handling for Android
8. Add animation transitions between screens

## Error Handling

All screens include comprehensive error handling:
- Form validation with clear error messages
- API error response handling
- Network error management
- Loading states during async operations
- User-friendly error messages

## Accessibility

- Proper text colors for readability
- Clear visual hierarchy
- Input labels for form fields
- Error messages with context
- Keyboard support throughout
- Proper button hit targets

## Performance

- Lazy loading of navigators
- Efficient state updates with Zustand
- Minimal re-renders using proper hooks
- Optimized ScrollView usage
- Proper cleanup of async operations

---

Created: March 1, 2026
Version: 1.0.0
