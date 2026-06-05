# TestFlight Checklist

Last updated: 2026-05-03

This checklist is for the Local Footy Athlete MVP iOS/TestFlight build. It is configuration and release-process only; it does not change coach, program, resolver, constraint, exposure, or onboarding behavior.

## Current App Config Audit

| Item | Current value | Source |
| --- | --- | --- |
| App name | Local Footy Athlete | `app.json`, `ios/LocalFootyAthlete/Info.plist` |
| Slug | local-footy-athlete | `app.json` |
| iOS bundle identifier | `com.localfootyathlete.app` | `app.json`, Xcode project |
| App version | `1.0.0` in Expo config / Info.plist, `1.0` native marketing version | `app.json`, `Info.plist`, `project.pbxproj` |
| Build number | `1` | `Info.plist`, `project.pbxproj` |
| iOS deployment target | 15.1 | `ios/Podfile`, Xcode project |
| Orientation | Portrait | `app.json`, `Info.plist` |
| Tablet support | false | `app.json` |
| App icon | Present, 1024x1024 | `assets/icon.png`, `Images.xcassets/AppIcon.appiconset` |
| Splash | Present, 1284x2778, dark background | `assets/splash.png`, `SplashScreen.storyboard` |
| Privacy manifest | Present | `ios/LocalFootyAthlete/PrivacyInfo.xcprivacy` |
| Entitlements | Empty | `ios/LocalFootyAthlete/LocalFootyAthlete.entitlements` |
| Expo updates | Disabled | `ios/LocalFootyAthlete/Supporting/Expo.plist` |

## Permission Notes

`Info.plist` currently includes:

- `NSFaceIDUsageDescription`
- `NSMicrophoneUsageDescription`

No live MVP source path was found requesting Face ID, local authentication, audio recording, microphone permission, or Expo AV recording. These strings appear to come from installed native modules (`expo-secure-store`, `expo-av`) rather than a live product flow.

Do not add these permissions to App Store privacy copy as active product behavior unless a live flow starts requesting them. Before removing them, run a real device smoke test and confirm no native module/runtime prompt depends on the keys.

## EAS Profiles

`eas.json` now contains:

- `development`: internal development-client build for device QA.
- `preview`: internal ad hoc build for pre-TestFlight device QA.
- `production`: store-compatible iOS build with `autoIncrement: true`; use this for TestFlight/App Store.

All profiles set:

```bash
EXPO_PUBLIC_ENABLE_DEBUG_LOGS=false
```

The production profile should be the normal TestFlight build path.

## Required EAS Environment Variables

Set these in the EAS environment used for `production` builds:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
EXPO_PUBLIC_SUPPORT_EMAIL=support@example.com
EXPO_PUBLIC_FEEDBACK_EMAIL=support@example.com
EXPO_PUBLIC_ENABLE_DEBUG_LOGS=false
```

Optional:

```bash
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co/functions/v1
```

Use either `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Only set `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL` if the functions base is not the default `${EXPO_PUBLIC_SUPABASE_URL}/functions/v1`.

Never set private AI/backend secrets as Expo public variables. Do not set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or Supabase service-role keys in EAS client env.

## Supabase Checks

Confirm Supabase secrets are set server-side:

```bash
supabase secrets list
supabase secrets set OPENAI_API_KEY=...
supabase secrets set COACH_LLM_PROVIDER=openai
supabase secrets set COACH_LLM_MODEL=gpt-5.5
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

Deploy the live MVP functions:

```bash
supabase functions deploy coach-chat
supabase functions deploy coach-intent
```

Keep Supabase `ENABLE_DEBUG_LOGS` unset or false for release unless debugging a specific backend incident.

## Local Preflight

Run from repo root:

```bash
npm run typecheck
npm run test:env-config
npm run test:logger
npm run test:coach-live-path-v2
npm run test:coach-live-wiring
npm run test:weekly-coach-update
npm run test:coach-update-card-ui
npm run test:profile-reset-ui
npx expo config --type public
plutil -lint ios/LocalFootyAthlete/Info.plist
plutil -lint ios/LocalFootyAthlete/PrivacyInfo.xcprivacy
```

If available locally, also run:

```bash
npx expo-doctor
```

## First-Time EAS Setup

Install or use EAS CLI:

```bash
npm install --global eas-cli
eas login
eas init
```

If EAS asks to create/link a project, use the Local Footy Athlete Expo account/project. Do not invent a project id in config by hand.

Set EAS production env values:

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-public-anon-or-publishable-key
eas env:create --environment production --name EXPO_PUBLIC_SUPPORT_EMAIL --value support@example.com
eas env:create --environment production --name EXPO_PUBLIC_FEEDBACK_EMAIL --value support@example.com
eas env:create --environment production --name EXPO_PUBLIC_ENABLE_DEBUG_LOGS --value false
```

## Build Commands

Internal preview device build:

```bash
eas build --platform ios --profile preview
```

TestFlight/App Store build:

```bash
eas build --platform ios --profile production
```

Submit latest production build to App Store Connect/TestFlight:

```bash
eas submit --platform ios --profile production --latest
```

Alternatively, use `eas build --platform ios --profile production --auto-submit` after App Store Connect credentials are confirmed.

## TestFlight Upload Notes

- Confirm App Store Connect app record exists for bundle id `com.localfootyathlete.app`.
- Confirm Apple signing credentials are available to EAS.
- Confirm build number increments beyond the previous uploaded build. The `production` profile has `autoIncrement: true`.
- Confirm external Privacy Policy URL and Support URL are ready for App Store Connect.
- Confirm privacy nutrition labels match `docs/APP_STORE_PRIVACY_NOTES.md`.

## Fresh Install Smoke Test

On a clean TestFlight install:

1. App starts at onboarding.
2. Complete onboarding with a realistic local football profile.
3. Program generation completes without config errors.
4. App lands on Program tab.
5. Program tab shows the generated week with no tab bar overlap.
6. Open a day workout and verify it matches Program tab.
7. Calendar tab opens and shows game/team-training context.
8. Coach tab sends a normal message.
9. Coach injury/fatigue update visibly affects Program tab and Coach Update card.
10. Profile tab opens.
11. Privacy Policy and Terms open from Profile.
12. Leave Feedback and Ask a Human open mailto links.
13. Clear active changes clears Coach Update state without wiping base program.
14. Clear coach chat clears only conversation.
15. Full reset returns to onboarding after confirmation.

## Remaining Release Blockers / Checks

- External Privacy Policy URL is still needed for App Store Connect.
- External Support URL or stable support page is still needed for App Store Connect.
- Apple developer team/signing credentials are not represented in the repo; confirm in EAS/Apple account.
- `NSFaceIDUsageDescription` and `NSMicrophoneUsageDescription` appear unused by live MVP flows but remain in native config. Verify on device before removing.
- Local `.env` may contain server-only secrets for development. Do not mirror those into EAS client env.
