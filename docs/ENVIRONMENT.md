# Environment Configuration

Last updated: 2026-05-03

This document lists the environment variables required for the Local Footy Athlete MVP. Client variables use the `EXPO_PUBLIC_` prefix because they are embedded into the app bundle. Do not put private service keys in `EXPO_PUBLIC_*` variables.

## Client Variables

These are read by `src/config/env.ts`.

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Coach intent, coach chat, program generation, dormant Supabase client services | Example: `https://your-project.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase edge function authorization | Public anon/publishable key. Safe for client bundles, but should still be environment-managed. |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional alias | Same as anon key | Used only if `EXPO_PUBLIC_SUPABASE_ANON_KEY` is not set. |
| `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL` | Optional | Coach intent/chat endpoints | Defaults to `${EXPO_PUBLIC_SUPABASE_URL}/functions/v1`. Set only if using a proxy/custom functions base. |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | Optional | Profile support mailto | Defaults to `one22gym@gmail.com`. |
| `EXPO_PUBLIC_FEEDBACK_EMAIL` | Optional | Profile feedback mailto | Defaults to support email. |
| `EXPO_PUBLIC_ENABLE_DEBUG_LOGS` | Optional | Client logger | Set to `true` only when debugging a TestFlight build. Default production behavior emits only warn/error logs. |

Not currently live for MVP:

| Variable | Status |
| --- | --- |
| `EXPO_PUBLIC_EXERCISEDB_API_KEY` | Present in `.env.example`, but no live client use found in the current Program/DayWorkout path. |
| `REVENUECAT_IOS_KEY` / `REVENUECAT_ANDROID_KEY` | Present in `.env.example`, but no live RevenueCat import/use found. Do not configure App Store purchase privacy labels unless subscriptions are enabled. |

## Server / Supabase Secrets

These must be set as Supabase secrets, not Expo client variables.

| Secret | Required | Used by | Notes |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Yes for the preferred coach path | `supabase/functions/coach-chat`, `supabase/functions/coach-intent`, `supabase/functions/coach-send-message` | Private OpenAI key for GPT coach chat, intent classification, and program generation support. Never expose in app code or `EXPO_PUBLIC_*`. |
| `COACH_LLM_PROVIDER` | Optional | Coach edge functions | Set to `openai` to force GPT, or `anthropic` for Claude fallback/testing. If unset, functions use OpenAI when `OPENAI_API_KEY` exists, otherwise Anthropic. |
| `COACH_LLM_MODEL` | Optional | `coach-chat`, `coach-send-message` | Primary coach model. Defaults to `gpt-5.5`. |
| `COACH_LLM_FALLBACK_MODEL` | Optional | `coach-chat` | OpenAI fallback model after retryable failures. Defaults to `gpt-5.4`. |
| `COACH_LLM_FAST_MODEL` / `COACH_INTENT_LLM_MODEL` | Optional | `coach-intent`, injury classifier fallback | Compact classifier model. Defaults to `gpt-5.4-mini`. |
| `ANTHROPIC_API_KEY` | Optional fallback | Coach edge functions | Private Claude key for fallback/testing only. Never expose in app code or `EXPO_PUBLIC_*`. |
| `SUPABASE_URL` | Usually provided by Supabase | Shared function utility | Used by database-backed edge functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for database-backed functions | `supabase/functions/shared/utils.ts` | Private service role key. Never expose in app code. |
| `ENABLE_DEBUG_LOGS` | Optional | Supabase edge function debug logging | Set to `true` only for temporary backend debugging. Default production behavior keeps verbose coach-chat logs quiet. |

## Where Each Endpoint Is Used

- Coach intent: `${functionsBase}/coach-intent`
  - Live caller: `src/screens/coach/CoachScreen.tsx`
  - Client transport: `src/utils/llmCoachIntentClassifier.ts`
  - Server function calls the configured coach LLM provider.

- Coach chat: `${functionsBase}/coach-chat`
  - Live callers: `src/screens/coach/CoachScreen.tsx`, `src/services/api/generateProgram.ts`
  - Server function calls the configured coach LLM provider.

- Program generation:
  - Live caller: `src/services/api/generateProgram.ts`
  - Uses the `coach-chat` edge function with `mode: "generate"`.

- Support / feedback:
  - Live caller: `src/screens/profile/ProfileScreen.tsx`
  - Uses `mailto:` links; no backend support endpoint is configured.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Set:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
EXPO_PUBLIC_SUPPORT_EMAIL=support@example.com
EXPO_PUBLIC_FEEDBACK_EMAIL=support@example.com
```

3. Start the app:

```bash
npm run start
```

If required client env is missing:

- program generation returns a user-safe configuration error
- coach intent falls back to deterministic/general handling
- legacy coach chat shows a safe "could not reach coach" message
- development console logs name the missing variable

## Logging Policy

Client logging goes through `src/utils/logger.ts`.

- `__DEV__`: debug, info, warn and error logs are emitted.
- Production/TestFlight: only warn and error logs are emitted.
- Temporary TestFlight debugging: set `EXPO_PUBLIC_ENABLE_DEBUG_LOGS=true` and rebuild the app.

Supabase `coach-chat` uses `ENABLE_DEBUG_LOGS=true` for temporary verbose backend logs. Leave it unset or false for production.

Never log prompts, raw coach messages, raw model responses, full program JSON, private keys, key presence/length, authorization headers, or verbose tool payloads in production. Keep production failures to high-level status/error context and put sanitized previews behind debug-only logging.

## EAS / TestFlight Setup

Set public client values in the EAS environment used for the TestFlight build. Example:

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-public-anon-or-publishable-key
eas env:create --environment production --name EXPO_PUBLIC_SUPPORT_EMAIL --value support@example.com
eas env:create --environment production --name EXPO_PUBLIC_FEEDBACK_EMAIL --value support@example.com
eas env:create --environment production --name EXPO_PUBLIC_ENABLE_DEBUG_LOGS --value false
```

Do not set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or Supabase service-role secrets in EAS client env. Those remain Supabase secrets only. See `docs/TESTFLIGHT_CHECKLIST.md` for the release build command and smoke-test checklist.

## Supabase Function Secrets

Set private secrets in Supabase:

```bash
supabase secrets set OPENAI_API_KEY=your-private-openai-key
supabase secrets set COACH_LLM_PROVIDER=openai
supabase secrets set COACH_LLM_MODEL=gpt-5.5
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-private-service-role-key
```

Do not add these to `.env.example` as usable client variables. Do not prefix them with `EXPO_PUBLIC_`.

## Supabase Function Deployment

Deploy the live MVP functions after confirming the project ref:

```bash
supabase functions deploy coach-chat
supabase functions deploy coach-intent
```

Other functions in the repo may be dormant or legacy. Deploy only the functions required by the release path unless the backend owner confirms otherwise.

## Validation

Run before TestFlight:

```bash
npm run typecheck
npm run test:env-config
npm run test:coach-live-path-v2
npm run test:weekly-coach-update
npm run test:profile-reset-ui
```

## Release Notes

- The Supabase anon/publishable key is public by design for client-side edge function calls.
- AI provider keys are private and must remain server-side only.
- Changing `EXPO_PUBLIC_*` values requires rebuilding the app; they are embedded at build time.
- Leave `EXPO_PUBLIC_ENABLE_DEBUG_LOGS` and Supabase `ENABLE_DEBUG_LOGS` off for release builds unless investigating a specific incident.
