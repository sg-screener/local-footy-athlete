# Group D Execution Plan — 2026-07-23

**Lane:** 2 (docs only, this session — no code changes). **Branch/HEAD at time of
writing:** `diagnose/move-occupied-content-loss`. **Source:**
`docs/audits/GROUPCD_WORKLIST_2026-07-22.md` (Group D section) plus a fresh
re-read of every cited site this session, so line numbers below are current,
not the worklist's original citations (several have drifted — noted per site).

**Purpose:** a build-ready, site-by-site plan for the five Group D items
listed as v1 blocker #3 in `docs/V1_LAUNCH_DEFINITION.md`. This is a planning
document — no code in this doc, no code changes this session. Each item
states: the defect, the fix approach (with the incremental-vs-redesign
comparison where more than one shape is plausible, per CLAUDE.md's Elegant
Solution Requirement), exact files/lines touched, the invariant the fix must
satisfy, and the tests that prove it (existing tests to extend, new tests to
add — named, not written).

**Out of scope, explicitly:** the email-forward trigger for the feedback
table (Sam reads submissions directly via Supabase dashboard/service role
for v1); the Move-to-occupied-day content-conservation bug (tracked
separately per `MEMORY.md`'s "Move conservation + readiness unify" entry,
already shipped on this branch as WS1 — item D2 below touches an adjacent
cosmetic string in the same function and must not reopen that invariant);
Group C accessibility-label fixes (tracked in the same worklist doc, separate
item, separate PR); the §18 ownership / stack-primitive residuals (tracked in
`docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md`).

---

## Global constraints (apply to every item below)

- **No raw internal identifiers, error codes, or ISO date strings
  (`YYYY-MM-DD`) may reach an athlete-visible surface** — sheet copy, coach
  chat replies, alerts, banners. This is the standard the whole Group D sweep
  exists to enforce; every fix below is an instance of it.
- **v1 is single-user, no accounts, data on-device** (decided
  `docs/V1_LAUNCH_DEFINITION.md` line 35-37). Any new server-side surface
  (the feedback table) must not assume a Supabase Auth session exists —
  there is no `auth.uid()` to key RLS off, unlike every existing table in
  `supabase/migrations/`.
- **`test:bible` must stay green.** None of these are `test:bible` suites
  today, but D3/D4 touch `planChangeProducer.ts`, which several `test:bible`
  suites (`test:section18-planner`, `test:section18-v2`,
  `test:whole-week-repair`, `test:athlete-session-move`) exercise indirectly.
  Run the full `test:bible` composite after D3/D4, not just the targeted
  test file.
- **Existing regex/source-text tests are a floor, not a ceiling.** Several
  sites below (`profileResetUITests.ts`, `envConfigTests.ts`) are asserted
  today only by regexing the source file, not by rendering/executing it —
  each item notes where a real behavioral test needs to be added alongside
  the existing source-text check, not instead of it (don't delete the
  existing regex assertions; they still catch accidental copy reverts).

---

## D1 — In-app feedback form → Supabase `feedback` table

### Current state

Two separate things exist and neither is the fix:

1. **The reachable, broken path** — `src/screens/profile/ProfileScreen.tsx:713-723`.
   "Leave Feedback" and "Ask a Human" both call
   `Linking.openURL(buildMailto(...))` with no `.catch()` and no
   `Linking.canOpenURL` guard. On a simulator/device with no Mail account
   configured, this fails silently — zero visible change, confirmed live
   2026-07-22 (`docs/audits/GROUPCD_WORKLIST_2026-07-22.md` lines 144-157).
2. **The unreachable, half-built path** —
   `src/screens/profile/FeedbackScreen.tsx` exists in full (star rating 1-5 +
   free-text field), is exported from `src/screens/profile/index.ts:18`, and
   has a route declared at `src/types/navigation.ts:195`
   (`Feedback: undefined`) — but `src/navigation/AppNavigator.tsx` never
   registers it as a screen (only `Profile`, `FAQ`, `Privacy`, `Terms` are
   registered, lines 90-93). Its submit handler only `console.log`s
   (`{ email: user?.email, rating, feedback }`) and reads `user` from
   `useAuthStore` — a store that has nothing to read from, since v1 has no
   live auth flow. This screen cannot be wired up as-is; it was built against
   an auth assumption the product no longer has.

### Fix approach — reuse the existing screen, not a new one

**Option A (incremental):** patch `Linking.openURL` at the two ProfileScreen
call sites with a `.catch()` that shows a toast/alert on failure. This closes
the "silent failure" symptom but keeps the underlying mailto dependency
(still requires a configured Mail app, still can't collect structured
feedback, still leaves `FeedbackScreen.tsx` as dead code with copy debt).

**Option B (source-of-truth fix, recommended):** retire the mailto path
entirely for feedback, wire the existing `FeedbackScreen.tsx` into the
navigator, replace its stubbed submit with a real Supabase insert, and drop
its `useAuthStore` dependency in favor of a required plain-text email field
(matching what "Ask a Human" already promises the user: "we'll get back to
you"). This removes a whole class of failure (no dependency on the device's
Mail app being configured at all) rather than adding a guard around it, and
retires a dead-code screen instead of leaving it to rot next to its
now-superseded sibling.

**Recommendation: Option B.** It's not bigger scope than Option A once you
count that Option A still leaves `FeedbackScreen.tsx` as untouched dead code
that the next engineer will trip over. Both buttons ("Leave Feedback" and
"Ask a Human") route to the same form with a `topic` param
(`'feedback' | 'ask_a_human'`) that only changes the sheet's title/subtitle
copy and a `topic` column value — one mechanism closes both dead-button
findings from the worklist, not two.

### Sites touched

- **`src/screens/profile/FeedbackScreen.tsx`** — remove the star-rating UI
  (not requested by this task's scope; the form is "message + required
  email" per the task brief, not a rating widget — flag the rating removal
  as a scope decision for Sam to confirm before implementation, since the
  screen currently has one). Remove `useAuthStore` import/usage. Add a
  required, validated email `TextInput` (non-empty, contains `@`). Replace
  the `console.log` submit body with a Supabase insert into the new
  `feedback` table. Add a `topic` prop/param read from route params,
  defaulting to `'feedback'`.
- **`src/types/navigation.ts:195`** — change `Feedback: undefined` to
  `Feedback: { topic: 'feedback' | 'ask_a_human' }`.
- **`src/navigation/AppNavigator.tsx`** — register `FeedbackScreen` as a
  `<ProfileStackNav.Screen>` alongside `Profile`/`FAQ`/`Privacy`/`Terms`
  (same pattern as those four).
- **`src/screens/profile/ProfileScreen.tsx:713-723`** — replace both
  `onPress={() => Linking.openURL(buildMailto(...))}` handlers with
  `onPress={() => navigation.navigate('Feedback', { topic: 'feedback' | 'ask_a_human' })}`.
  Remove the now-unused `buildMailto`/`Linking` imports if nothing else in
  the file uses them (check — `Linking` may still be used elsewhere in this
  file for Privacy/Terms; `buildMailto` likely becomes unused entirely and
  should be deleted from `src/config/env.ts`, not kept as dead code).
- **New:** `src/services/api/feedbackService.ts` (or equivalent, matching
  the existing `src/services/api/` convention) — a single function,
  `submitFeedback({ email, message, topic })`, wrapping the Supabase insert.
- **New migration:** `supabase/migrations/007_feedback_table.sql` (next
  number after `006_exercise_gif_urls.sql`).

### Table + RLS design

v1's no-accounts decision means the existing `auth.uid() = user_id` RLS
pattern used by every current table (`003_policies.sql`) doesn't apply —
there's no session to key off. Design this as a public-contact-form table
instead: anonymous insert allowed, no read/update/delete allowed for the
anon role at all (deny by default), service-role (Sam, via dashboard/SQL)
reads it out of band.

```sql
create table feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  topic text not null default 'feedback' check (topic in ('feedback', 'ask_a_human')),
  email text not null check (char_length(email) > 0 and email like '%@%'),
  message text not null check (char_length(trim(message)) > 0),
  app_version text,
  platform text
);

alter table feedback enable row level security;

create policy "feedback_insert_anon" on feedback
  for insert
  with check (true);

-- Deliberately no select/update/delete policy for anon/authenticated —
-- RLS defaults to deny, so only the service-role key (server-side/dashboard)
-- can read submissions back. This is the whole point: athletes can write,
-- nobody but Sam can read.
```

`app_version`/`platform` are populated client-side from `expo-constants` /
`Platform.OS` at submit time — useful triage context, not required for the
form itself. If pulling these adds meaningful scope, cut them; they're not
load-bearing for the invariant below.

**Note for Sam, flagged not resolved here:** an anon-insert-only table with
no rate limiting is spammable (anyone with the anon key, which ships in the
client bundle, can insert unlimited rows). This is normal for a v1 contact
form and matches the "no accounts" product decision, but if it becomes a
problem post-launch, the fix is a Supabase Edge Function in front of the
insert (rate-limited by IP) rather than loosening/tightening RLS — out of
scope for this plan, noted so it doesn't get forgotten.

### Invariant

Submitting the feedback form with a non-empty message and a syntactically
plausible email always produces a persisted row in `feedback` with the
correct `topic`; the client can never read back its own or any other
submission (RLS proof, not just "we didn't build a read screen"). Tapping
"Leave Feedback" or "Ask a Human" always produces a visible UI change
(the sheet opens) — the silent-failure mode is structurally impossible
because there is no `Linking.openURL` call left in this path.

### Tests

- Extend `src/__tests__/profileResetUITests.ts` lines 457-460 (currently
  regexes for `Leave Feedback`/`Ask a Human`/the old mailto call) — replace
  the mailto-call regex assertion with one asserting
  `navigation.navigate('Feedback', ...)` is called from both buttons with
  the correct `topic`.
- New `src/__tests__/feedbackFormTests.ts` (naming matches the existing
  `*Tests.ts` convention): empty message blocks submit; empty/invalid email
  blocks submit; valid submit calls the Supabase client's `.insert()` with
  the expected row shape; submit failure (network/Supabase error) surfaces a
  plain-language error, not a raw Supabase error object (ties into D4's
  invariant — don't let this new surface reintroduce the class of bug D4
  fixes elsewhere).
- New RLS proof, run against a real (dev/staging) Supabase project, not
  mocked: insert as anon succeeds; select as anon on the same row returns
  zero rows. This can't be a unit test against a mock client — it has to hit
  actual Postgres RLS. Document it as a manual `psql`/Supabase-SQL-editor
  check in the PR description if a real integration-test harness for
  Supabase policies doesn't already exist in this repo (none was found
  during this session's research — confirm before assuming one needs to be
  built new).
- Add `EXPO_PUBLIC_SUPABASE_FEEDBACK_TABLE` — no, don't: table name doesn't
  need to be configurable, hardcode `'feedback'` in the service function.
  (Noted explicitly to head off over-engineering here.)

---

## D2 — `env.ts` `DEFAULT_SUPPORT_EMAIL` fallback

### Current state

`src/config/env.ts:43`:
```
const DEFAULT_SUPPORT_EMAIL = 'one22gym@gmail.com';
```
Consumed at lines 144-145:
```
const supportEmail = clean(env.EXPO_PUBLIC_SUPPORT_EMAIL) || DEFAULT_SUPPORT_EMAIL;
const feedbackEmail = clean(env.EXPO_PUBLIC_FEEDBACK_EMAIL) || supportEmail;
```
`.env.example:7-8` also hardcodes `one22gym@gmail.com` for both
`EXPO_PUBLIC_SUPPORT_EMAIL` and `EXPO_PUBLIC_FEEDBACK_EMAIL` — this is what a
new engineer copies when setting up their `.env`, so it's a second instance
of the same stale value, not just the code fallback.

This value is stale against current product docs: `docs/appstore/PRIVACY_POLICY_DRAFT.md`
(2026-07-22) and `docs/appstore/APP_STORE_LISTING_DRAFT.md` (2026-07-23) both
already commit to `hello@localfootyathlete.app` as the contact address.
`docs/TESTFLIGHT_CHECKLIST.md` (2026-05-03, not updated since) also still
shows the old `support@example.com` placeholder pattern in its EAS-env
examples — that file isn't code, but flag it in the FINAL_QA_CHECKLIST
release gate so nobody copies the stale example into a real EAS env var.

### Fix

Change `DEFAULT_SUPPORT_EMAIL` at `env.ts:43` to `'hello@localfootyathlete.app'`.
Change both values in `.env.example:7-8` to match. **Given D1 removes the
mailto path entirely, confirm with Sam before implementing whether
`supportEmail`/`feedbackEmail`/`buildMailto` are still consumed anywhere
else in the codebase after D1 lands** — if D1 is the only consumer, this
whole env surface (`DEFAULT_SUPPORT_EMAIL`, `supportEmail`, `feedbackEmail`,
`buildMailto`, the two `EXPO_PUBLIC_*_EMAIL` vars) becomes dead and should be
deleted rather than fixed-and-kept. Grep the two identifiers
(`clientEnv.supportEmail`, `clientEnv.feedbackEmail`) across the app before
starting D1 to settle this — it changes whether D2 is "change a string" or
"delete a subsystem."

### Invariant

No sourced or fallback support/feedback email value in the shipped app
resolves to `one22gym@gmail.com` (grep the built bundle or, simpler, grep
source + `.env.example` for the literal string in CI as a lint check).

### Tests

- Extend `src/__tests__/envConfigTests.ts` — the existing `[5] Support
  mailto helper is encoded` test (lines 123-130) only checks `buildMailto`'s
  URL-encoding, not the fallback value. Add an assertion that
  `getClientEnvConfig()` with `EXPO_PUBLIC_SUPPORT_EMAIL`/`EXPO_PUBLIC_FEEDBACK_EMAIL`
  unset resolves to `hello@localfootyathlete.app`, not the old address. If
  D1 deletes `buildMailto` entirely, delete this test file section instead
  of updating it — don't leave a passing test for a function that no longer
  exists reachable from the app.

---

## D3 — Raw ISO dates in athlete copy

### Current state

Two different code paths in `src/utils/planChangeProducer.ts` handle
"done" messages, and only one of them is correct:

- **Correct today:** `athleteSwapDoneMessage`/`athleteAdditionDoneMessage`
  (around lines 1900-1946) route every date through an `outcomeWeekday()`
  helper — e.g. line 1938: `` `Done. ${label} added on ${outcomeWeekday(date)}.` ``
  renders "Wednesday", not "2026-07-23".
- **Wrong today:** `planChangeDoneMessage`/`moveDoneMessage` (lines
  2022-2053, the legacy/registry path) render `change.date` /
  `change.toDate` / `change.fromDate` raw:
  - `planChangeProducer.ts:2040` — `` `Done. Session moved to ${change.toDate}.` ``
  - `planChangeProducer.ts:2052` — `` `Done. ${change.fromDate} and ${change.toDate} swapped sessions.` ``
  - `planChangeProducer.ts:2053` — `` `Done. Session moved to ${change.toDate}.` ``
  - Same pattern at lines 2027, 2029, 2032, 2034, 2036, 2038 (remove/swap/add
    variants) — all raw `change.date`.

Separately, **`src/utils/coachActions.ts`** embeds raw `${date}` in ~17
refusal/reason strings that feed the coach-chat reply pipeline (lines 417,
433, 451, 471, 482, 494, 518, 521, 538, 542, 558, 567, 622, 628, 642, 657,
671, 676, 690, 707, 768) — these are a second, independent instance of the
same defect class, on the coach-chat door rather than the tap door.

**Do not conflate this with the content-conservation bug.** The current
branch (`diagnose/move-occupied-content-loss`) already ships WS1 (move
content-conservation invariant) per `MEMORY.md`; the "swapped sessions"
string at `moveDoneMessage` line 2052 is the same success message that
`athleteMoveOccupiedContentLossTests.ts` uses as a symptom-anchor for that
*separate*, already-diagnosed bug (per
`docs/audits/MOVE_OCCUPIED_CONTENT_LOSS_2026-07-23.md`). This item (D3)
fixes only the date-format cosmetic — swap the raw dates for
`outcomeWeekday()` calls — and must not touch the conservation logic
upstream of the message. Re-run
`test:athlete-move-occupied-content-loss` after this change purely to
confirm it still passes unchanged, not to re-diagnose it.

### Fix

Route `planChangeDoneMessage`/`moveDoneMessage`'s date interpolations
through the same `outcomeWeekday()` helper the sibling functions already
use — this is a one-function-reuse fix, not a new helper. Do the same for
every raw `${date}` in `coachActions.ts` — either import `outcomeWeekday()`
from `planChangeProducer.ts` (check it's exported; if not, promote it to a
shared date-copy utility both files import, since it's now needed in two
files rather than one) or confirm an equivalent already exists in
`coachActions.ts`'s own imports before adding a second implementation of the
same weekday-formatting logic.

### Invariant

No athlete-visible string (tap-door "Done" messages, coach-chat replies)
ever contains a substring matching `\d{4}-\d{2}-\d{2}` (ISO date pattern).
This is exactly the kind of invariant worth asserting as a single shared
test helper (a regex scan over rendered message output) reused across both
files' test suites, rather than duplicating the assertion by hand in every
test case — the invariant is "no ISO date ever," so the test should be
structural, not enumerative.

### Tests

- New assertions in `src/__tests__/planChangeProducerTests.ts` (which
  already has extensive `protected_anchor_day` coverage at lines 284, 327,
  783, 1163, 1208, 1289-1320, 1631 to use as a pattern) — add cases for each
  of the 9 `planChangeDoneMessage`/`moveDoneMessage` branches asserting the
  output contains a weekday name, not a `YYYY-MM-DD` substring.
  `athleteMoveOccupiedContentLossTests.ts` already exists on this branch and
  quotes the "swapped sessions" string — re-run it unchanged after this fix
  as a regression check (see caution above), don't add new assertions to it
  for this item.
- New assertions in `src/__tests__/coachActionsTests.ts` (13 existing
  `replaceExerciseAtDate` call sites at lines 343, 363, 612, 681, 703, 724,
  753, 774, 829, 969, 991, 1015, 1035 to extend from) — for each refusal
  path listed above, assert the returned `reason`/message contains a
  weekday name, not the raw ISO string.

---

## D4 — Raw internal error codes on visible surfaces

### Current state

`blockedAssessmentForBuildError` (`planChangeProducer.ts:1227`) is an
**allowlist**: it only recognizes `protected_anchor_day`,
`protected_game_day`, and `move_destination_resolver_owned`, returning
`null` for every other error code. Four call sites render the raw code
whenever the gate returns `null`:

- `planChangeProducer.ts:1364` — `` `That change isn't possible here (${resolution.error}).` `` (preview path)
- `planChangeProducer.ts:1451` — `` `That change isn't possible here (${proposal.error}).` `` (preview path, second branch)
- `planChangeProducer.ts:1681` — `` `That change isn't possible here (${resolution.error}).` `` (commit path)
- `planChangeProducer.ts:1817-1828` — **no gate call at all on this path**
  (the legacy-proposal fallback inside `applyPlanChangeWithinTrace`,
  confirmed by direct read this session: the `if ('error' in proposal)`
  block at line 1821 goes straight to
  `` `That change isn't possible here (${proposal.error}).` `` at line 1824
  with zero `blockedAssessmentForBuildError` call anywhere in that branch).
  This is the widest-open instance — even `protected_game_day` renders raw
  here if a legacy-deferred change happens to hit an anchor.

Known raw codes that leak today include (not exhaustive — see "fix approach"
for why the exhaustive list doesn't matter): `nothing_to_swap`,
`no_template_for_category`, `athlete_move_identity_missing`,
`scope_not_on_day`, `day_already_has_strength`, `unknown_template`,
`nothing_to_move`.

Separately in `coachActions.ts`: line 1026
(`` `Unknown action kind: ${(action as any).kind}` ``) and line 1043
(`` `Exception applying ${action.kind}: ${e?.message || String(e)}` ``) leak
a raw action-kind enum value and a raw exception message respectively — same
defect class, coach-chat door.

### Fix approach — invert the gate, don't extend the allowlist

**Option A (incremental):** add every currently-leaking code
(`nothing_to_swap`, `no_template_for_category`, etc.) to
`blockedAssessmentForBuildError`'s allowlist with its own plain-language
string, and add the missing gate call at the legacy-proposal fallback site.
This closes today's known leaks but the defect class survives: the function
is still "raw-by-default, safe-by-exception," so the next new error code
added to `resolveAthleteMutation`/`buildPlanChangeProposal` leaks raw again
until someone remembers to add it to the allowlist. This is exactly the
shape CLAUDE.md's stop-patching list warns about ("one more resolver",
"compatibility path") — not because this is coach chat (it's the tap-door
producer), but because the underlying pattern — a growing allowlist that
must be remembered on every new error code — is the same shape of bug that
rule exists to catch.

**Option B (source-of-truth fix, recommended):** invert the default.
`blockedAssessmentForBuildError` (rename it — it's no longer "blocked
assessment for a specific set of codes," it's the single plain-language
mapping every error code goes through) becomes: known codes
(`protected_game_day`, `protected_anchor_day`, `move_destination_resolver_owned`,
and the newly-identified ones above) get their specific, tailored copy;
**every other code — known or not-yet-invented — falls through to one
generic plain-language string**, never the raw code. Call this function
from all four sites, including the currently-ungated legacy-proposal
fallback. A future engineer adding a new `resolveAthleteMutation` error code
gets safe-by-default copy automatically; they only need to touch this
function if they want *better* copy than the generic fallback, not to avoid
a raw-code leak.

**Recommendation: Option B.** It's the same number of call sites to touch as
Option A (all four still need visiting, since the legacy-proposal fallback
needs the call added either way) but removes the whole "did we remember to
add this code" failure mode instead of patching today's five known
instances.

Apply the same inversion to `coachActions.ts:1026,1043` — replace the raw
`action.kind`/exception-message interpolation with a fixed generic
plain-language string (e.g. "I couldn't make that change, so nothing was
applied.") and log the raw kind/exception server-side or to a debug channel
instead of the athlete-visible `reason` field, if a logging path exists;
otherwise just drop it from the user-visible string.

### Invariant

For every possible value `resolveAthleteMutation`/`buildPlanChangeProposal`
can return in its `error` field — enumerated today or added in the future —
the message rendered to the athlete never contains that raw string. Test
this as "for each of today's known codes, plus one made-up code the test
invents, the rendered message is never equal to a string containing the raw
code" — the made-up-code case is what proves the fallback is default-safe,
not allowlist-safe.

### Tests

- New assertions in `planChangeProducerTests.ts` covering all four call
  sites (1364, 1451, 1681, 1824) for: each of today's known-leaking codes
  now getting plain-language copy; and a synthetic/invented error code
  (something not in any allowlist, e.g. `'__test_unmapped_code__'`)
  confirming it still renders the generic fallback, never the raw string —
  this is the test that would have caught today's bug and prevents its
  recurrence under a new code name.
- New assertion in `coachActionsTests.ts` for the `Unknown action kind`
  and `Exception applying` branches (lines 1026, 1043) — same
  synthetic-unmapped-value approach.

---

## D5 — Missing swap-to-Rest control

### Current state

`PlanChangeCategoryId` (`src/utils/planChangeTypes.ts:1-8`) is a closed union
of 7 ids: `conditioning_light`, `conditioning_hard`, `recovery`,
`strength_upper`, `strength_lower`, `strength_full`, `accessories`. No `rest`
id exists anywhere in this type, in `CATEGORY_COPY`/`CATEGORY_TEMPLATE_MATCH`
(`planChangeProducer.ts:131-174`), or in `PlanChangeSheet.tsx`'s
`pick_category` step (lines 882-920, which renders Conditioning/Strength/
Recovery buckets filtered off `stepCategories`). The only path to a Rest
outcome today is "Bin this session" (`PlanChangeSheet.tsx:688-689`,
sub-copy "Remove it - the day becomes rest") — a destructive-confirm flow,
not the "confirm step, then rest" `docs/SUPPORTED_ATHLETE_ACTIONS.md` row
1.4 describes for Swap-to-Rest.

### Fix approach — alias to the existing remove path, don't invent new state

**Option A (incremental):** build a new `swap_category` variant that
transitions a session directly to a rest-day state, parallel to but separate
from the existing `remove_session` change kind. This means a second code
path that has to independently prove the same conservation/repair
invariants `remove_session` already proves (whole-week repair,
game-day-adjacency rules, undo) — doubling the surface area for exactly the
outcome the app already produces one way.

**Option B (source-of-truth fix, recommended):** add `'rest'` as a
`PlanChangeCategoryId` that, when chosen via `pick_category`'s Swap-To list,
internally resolves to the same `remove_session` change the Bin flow already
produces — same execution path, same conservation guarantees, same undo
behavior — but reached from a non-destructive-framed entry point ("Swap to:
Rest" sitting alongside Conditioning/Strength/Recovery) instead of a red
"Bin this session" confirm. The two entry points end at the same state by
construction, so there's no new invariant to prove — only the existing
`remove_session` invariants, which already have coverage.

**Recommendation: Option B.** This is the smaller change (one new category
id that maps to an existing change kind, one new filter branch in
`pick_category`'s render) and it removes a whole class of "does this new
path repair the week correctly" work by construction, per CLAUDE.md's
redesign-vs-incremental framing.

### Sites touched

- **`src/utils/planChangeTypes.ts:1-8`** — add `| 'rest'` to
  `PlanChangeCategoryId`.
- **`src/utils/planChangeProducer.ts:131-174`** (`CATEGORY_COPY`) — add a
  `rest` entry: label "Rest", sub copy along the lines of "Clear the session
  - the day becomes rest" (mirrors the Bin sub-copy's plain framing; see
  COPY_AUDIT for the exact recommended string).
  `CATEGORY_TEMPLATE_MATCH`/wherever `swap_category`/`add_category` change
  kinds are resolved into an actual mutation — route the `rest` id to the
  same `remove_session` change construction the Bin flow uses, rather than
  building a new template-matched session. This is the crux of the "alias,
  don't invent" approach — locate exactly where `chooseCategory` (called
  from `PlanChangeSheet.tsx:900`, `c.id === 'recovery'` branch's sibling)
  turns a category id into a `PlanChange`, and give `rest` a
  `remove_session`-shaped output there instead of a `swap_category`-shaped
  one.
- **`src/screens/home/PlanChangeSheet.tsx:882-920`** (`pick_category` step)
  — add a filter branch parallel to the existing
  `stepCategories.filter((c) => c.id === 'recovery')` one, for
  `c.id === 'rest'`, rendering it as its own `MenuOption` (not nested under
  the Conditioning/Strength buckets, matching how Recovery already stands
  alone in this list).
- **`PlanChangeSheet.tsx:670-671`** ("Swap this session" sub-copy — "Change
  to strength, conditioning or recovery") — update to include rest, e.g.
  "Change to strength, conditioning, recovery or rest" (exact string is a
  COPY_AUDIT call, not this plan's).

### Invariant

`options.categories` (as constructed for the `pick_category` swap-to list)
always includes a `rest` entry, and choosing it produces the identical
`PlanChange`/outcome shape (same `remove_session` semantics, same
conservation/repair/undo behavior) as choosing "Bin this session" on the
same day — provable by asserting both paths produce structurally identical
`PlanChange` objects for the same input day, not by re-testing conservation
twice.

### Tests

- Extend `src/__tests__/planChangeProducerTests.ts`'s existing
  `addOnTopCategories` coverage (lines 938-945, 982-985, 1035, 1649) with:
  `categories` includes `rest` for every day that currently has a session;
  choosing `rest` via `chooseCategory`/whatever the swap-to entry point is
  named produces a `PlanChange` matching (structurally) the one "Bin this
  session" produces for the same day.
- No new conservation/repair test needed — by construction (Option B),
  D5 reuses `remove_session`'s already-tested invariants rather than adding
  a new state transition to prove.

---

## Sequencing

D2 (env fallback) has no dependency on the others and can land first,
standalone, in minutes — except its "is this subsystem still used at all"
question depends on D1's decision, so confirm D1's shape before finalizing
D2 as "fix the string" vs. "delete the subsystem."

D1 (feedback form) is the largest single item (new table, new migration,
navigator wiring, screen rewrite) — do it as its own PR/commit sequence
before D3-D5, since D2 depends on knowing its outcome.

D3, D4, and D5 all touch `planChangeProducer.ts` but in non-overlapping
regions (date-formatting helper calls vs. the error-code gate vs. the
category type/copy) — they can be sequenced in any order or done in parallel
branches, but land them as separate commits so `test:bible` runs cleanly
attribute a regression to the right change if one appears.

Run the full `test:bible` composite once after all five items land, not
just after each individual item's targeted tests — several `test:bible`
suites exercise `planChangeProducer.ts` indirectly (whole-week-repair,
section18-planner/v2) and wouldn't be caught by D3/D4/D5's own targeted test
files alone.
