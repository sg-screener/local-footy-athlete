# Store-armour fleet, wave 2b (the tail) — 2026-08-03

Branch `feat/store-armour-tail`. Recipe: `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`
(all twelve lessons read and applied). Scope: `profileStore` quarantine-only
completion, `authStore`, `uiStore` — the last three entries this group owns on
`UNPROTECTED_STORES_DEBT`.

## North star statement

TOWARD. No new stored state anywhere in the unit; three stores' writes became
owned, named, refusable-where-material decisions. The unit also surfaced the
opposite finding honestly: ui/auth persist state nothing writes or reads —
stored non-decisions — parked as question 6 rather than extended.

## Per-store decisions

### profileStore — quarantine only (door/tape/sweep pre-existed)

- Boundary registered under `profile-store`; `carriesMaterial` reuses the
  store's own answered-count semantics (≥1 answered field, blank strings and
  empty arrays count for nothing, unreadable bytes answer no).
- `profileGuardedStorage` over `asyncStorageCompat`; both door refusal paths
  now capture the DISK copy best-effort (`quarantineRefusedPayload`).
- New small suite `profileStoreQuarantineTests` (5 cells) rather than
  extending `profileMirrorNarrowingTests`: the boundary cells are async and
  the narrowing suite's runner is synchronous; nothing the narrowing suite
  owns was touched. KNOWN, NOT REPAIRED (recipe lesson 12's note): the
  profile door still emits `resetActionId`, which the diagnostics filter
  strips — repairing it is outside "touch only what the quarantine needs".
- No census counter change: profile's registry entry was already
  owner+taped; `unownedPersistedStores` never counted it (verified by reading
  the detector before assuming).

### authStore — full recipe

- Material slice: SESSION IDENTITY (`user`, `session`, `isAuthenticated`).
  Session tokens count as material — losing a login strands the athlete.
- Door `applyAuthSessionWrite`; refusals `default_over_answered_session` +
  `reset_action_not_in_flight`. `signOut` is the athlete's own erasure under
  a named reset act (lesson 11); `clear` likewise (`auth_store_clear`).
- Tape `auth_write`: FLAGS ONLY (`hadUser`/`hadSession`/`authenticated`
  before+after) — never a token, email or id; the suite hunts the real
  values it acts in. Reset act travels as `erasureActId` (lesson 12).
- Quarantine boundary + guarded storage; raw `AsyncStorage` import replaced
  by `asyncStorageCompat` (lesson 7).
- Honesty note (in store, census caveat, and parked question 6): NO product
  sign-in flow exists; `setUser`/`setSession`/`setAuthenticated` had zero
  callers. Armour precedes the flow; retire-or-wire is Sam's call.

### uiStore — the honest minimum, each absence a pinned decision

- Presentation only; NO athlete-answer slice (census said "negligible";
  reading confirmed: zero product writers of any field).
- Door `applyUiSettingsWrite` owns the durable chosen settings
  (`theme`, `designVersion`) and tapes `ui_store_write` (flags only).
- NO wipe refusal — the defaults are a legitimate chosen state; refusing
  them would refuse the athlete's own resets. Pinned as a decision in
  `uiStoreOwnershipTests` cell 3.
- Quarantine boundary registered + guarded storage wired; with no refusal
  path nothing can arm it today — declared in the store comment and census
  caveat, and the machinery is proven with a hand-armed hold (cell 5).
- `activeTab`/`isOnline` stay outside the door and OFF the tape: a tab
  switch per navigation would flood the 200-entry ring with non-decisions.
- Deviation from the fleet instruction, recorded: the instruction offered
  "ui_store_write unnecessary if nothing material". The census's own
  contract says a non-null owner means door+refusals+tape, so the door IS
  taped (writes are rare athlete taps; no flood risk) and the two genuine
  absences (refusal, quarantine armability) carry the caveat instead.

## Walker declaration (day-log entry the fleet asked for)

- **auth: refusal-replay cell ADDED** (`athleteActionWalkerTests`) — world
  reached through `host.perform` (onboard, generate, +3 days), session acted
  in through the store's own actions (declared gap: the walker vocabulary has
  no sign-in action because no product sign-in flow exists). SHALLOW tier
  stated per L13: 3 walked actions, 3 days crossed.
- **ui: NO cell, by decision** — the recipe's §6 replays a refusal and this
  door has none to replay; the absence is declared in the auth cell's comment
  and pinned in the ui suite.

## Debt list and census

- `UNPROTECTED_STORES_DEBT`: 5 → 2. profile-store, auth-store, ui-store
  deleted (each in the same commit as its boundary). **NOT ZERO from this
  branch**: `coach-store` and `coach-memory-store` remain — they are wave
  2a's, unmerged in this branch's base. No audit cell asserts non-emptiness,
  so no expectation edit was needed; if wave 2a merges first the orchestrator
  resolves the list to empty and the L12 celebration belongs to that merge.
- Census LR-2: `declared` 5 → 3 (auth −1, ui −1; relative decrements as
  instructed). `LEGACY_DEBT_BASELINE` 108 → 106; narration comment corrected
  to the true sum (27 + 3 + 4 + 72 — the old first line said "27 + 7 + 4 +
  72", stale since wave 1). `foundingCount` untouched.

## The mutation pass (L-E4; committed first, scratchpad backups)

| # | Mutation | Caught by |
|---|---|---|
| 1 | profile `registerQuarantineBoundary` disabled | 4 quarantine cells + audit "protected or declared" |
| 2 | profile guarded storage stops asking `decideQuarantinedWrite` | boundary cell (bare-over-held) |
| 3 | auth refusal check deleted | 3 auth cells (refusal, stale-id, tape) + walker replay |
| 4 | auth refusals silenced on the tape | auth taped-either-way cell + walker witness count |
| 5 | rogue `useAuthStore.setState` in `resetCoach.ts` | auth repo-wide sweep |
| 6 | ui `setTheme` bypasses the door via `set({ theme })` | tape cell — and the SWEEP WAS BLIND: shorthand `{ theme }` carries no colon and the `field:` regex missed it. Both new suites' sweeps strengthened to word-match; the sweep now also reds. |
| 7 | census un-paid (declared 3 → 5) | 4 census cells (directions 1/2/3 + detector completeness) |

Mutation 6 is this unit's L12 contribution: **a sweep that matches `field:`
is blind to ES6 shorthand assignment.** The two prior fleet sweeps
(calendar/coach-prefs style, `match.includes('field')`) happen to be immune
because a bare substring check catches shorthand too; the colon-regex variant
this unit first wrote does not. The next armour application should use word
match from the start.

## Verification

Full `npm run test:bible` from THIS worktree, cwd recorded as the log's first
line (the wave-1 shared-checkout mistake not repeated):

```
/Users/samgeurts/Documents/local-footy-athlete/.claude/worktrees/agent-aa8cbabdcb81a3ed9
BIBLE EXIT=0
```

Zero `FAIL` lines in the whole log (107 suite totals, all "0 failed").
`test:action-walker:deep` additionally run standalone: 15/15. Because every
suite this unit runs is green, there are NO pre-existing reds to attribute —
the detached-main comparison (recipe lesson 8) was not needed this time.

## L12 — what catches the next defect of this class

Three answers, one per layer: (1) a NEW persisted store cannot join quietly —
the audit enumerates the boot registry and fails on an undeclared store, and
the census counts any store its registry has not heard of; (2) the next
BLIND SWEEP of this family is named above (shorthand-vs-colon) with the word-
match form the next application must start from; (3) the next store whose
armour is judged "not worth it" now has a precedent for the honest minimum —
decided absences pinned in cells, never silent omissions.
