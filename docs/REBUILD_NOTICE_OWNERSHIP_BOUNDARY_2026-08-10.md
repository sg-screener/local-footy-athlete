# `useRebuildNotice()` IS BUILT — ONE OWNER, EVERYONE READS

**LOOP CHECK: `LAW-one-name-two-meanings` — sighting 7, and the FIRST one
applied BEFORE the code moved rather than found after.** Disposition: **iterate** — the row
is updated and the ratchet raised from 5 to 7 in the same pass, so the sighting
cannot be absorbed silently. The measurement paid: the two paths driving the
notice drive **the same four pieces of state**, which is why one move closed
two rulings.

**NORTH STAR: TOWARD.** No new stored state — nothing new reaches disk, and the
persisted-inputs gate proves it by reading storage rather than source. What
moved was in-memory render state, from four `useState`s on one screen to one
module-scoped owner. `test:persisted-inputs-schema` is unchanged and green.

---

## THE ORDER'S OWN FIRST QUESTION, ANSWERED FIRST

The seat's order and `docs/REBUILD_NOTICE_OWNERSHIP_2026-08-10.md` both said the
same thing: **check whether `runRebuild` closes over day-screen state before
scoping, because if it does the price changes.**

**IT DOES NOT.** `runRebuild` (`useHomeScreen.ts`) closes over exactly one
hook-derived value — `onboardingData`, a `useProfileStore` selection any screen
can make. Everything else it touches is a module import
(`generateProgramFromProfile`, `getCurrentBlockNumberForGeneration`,
`decideSweepForCurrentStores`, `commitRebuiltProgram`) or a local helper that
only raises an `Alert`. **The design's assumption held and route (a) is priced
as written.**

## WHAT WAS BUILT

| file | what it owns |
|---|---|
| `src/store/rebuildNoticeStore.ts` | `isRebuilding`, `msgIdx`, `error`, `errorCanRetry` — and the acts that write them |
| `src/hooks/useRebuildNotice.ts` | the reader every screen calls; the module-scoped fade and the one ticker |
| `src/__tests__/rebuildNoticeOwnershipTests.ts` | the gate, in `test:bible` as `test:rebuild-notice-ownership` |

**THE STORE IS PURE, AND THAT WAS A CORRECTION, NOT A PLAN.** The first cut put
the `Animated.Value` and the interval in the store. **No other store in this
repo imports `react-native`, and the probe showed why** — the node harness
cannot even parse `react-native`'s entry file, so a store holding an
`Animated.Value` would have been the only store its own suite could not call,
and every assertion about it would have had to be a regex over source. The fade
and the ticker moved one layer up to the hooks module; the store stayed
node-callable; assertions [1]–[3] of the gate are **real calls**, not text
matching.

**THE TICKER IS A MODULE SUBSCRIPTION, NOT AN EFFECT.** It was a `useEffect` on
the day screen. Left that way, the second screen to mount a reader would run a
second interval and rotate the messages at double speed — the exact bug shape
(b) was rejected for. It now subscribes to the store once, at import.

## WHAT WAS REMOVED FROM THE DAY SCREEN, AND WHAT WAS NOT

Removed: four `useState`s, one `useRef(new Animated.Value)`, the rotation
`useEffect`, and the three copies of the same four-line preamble
(`setRebuildMsgIdx(0)`, `rebuildMsgOpacity.setValue(1)`, `setIsRebuilding(true)`,
`clearRebuildError()`) that `handleConfirmRebuild`, `executePhaseShift` and
`handleProgramControlResult` each carried. They are one call: `beginRebuildNotice()`.

**NOT removed: the rendering.** The hook returns the same five field names to
the same components, and `<RebuildSheet>` is untouched. The gate asserts this
as its own section — **without it, deleting the notice outright would pass every
other assertion.**

## THE GATE, AND THE MUTATION THAT CAUGHT ITS OWN VACUOUS CELL

`test:rebuild-notice-ownership` — 37 cells, all green. **Nine mutations run; the
first pass caught eight.**

| mutation | verdict |
|---|---|
| clearing an error no longer restores `canRetry` | RED |
| begin no longer clears the previous attempt's error | RED |
| `msgIdx` stops wrapping | RED |
| the day screen regrows a local `setIsRebuilding` | RED |
| the ticker goes back into an effect | RED |
| a `begin` ships with no `end` | RED |
| the return drops `rebuildMsgOpacity` | **GREEN — SURVIVED** |
| the return drops `rebuildMsgIdx` | RED (after the fix) |
| the return drops `rebuildErrorCanRetry` | RED (after the fix) |

**THE SURVIVOR IS THE FINDING.** The "rendering did not change" cell searched
the WHOLE FILE for `\n    <field>,` — which the hook's own
`const { … } = useRebuildNotice()` destructure matches at the same indent.
Every one of those five cells was green and empty: they were reading the
destructure, never the return. **A bind can be green and empty.** The cell is
now scoped to the return block, and the mutation reds.

Two of the nine mutations were themselves wrong before they were right — a
non-anchored `perl` substitution hit the destructure instead of the return and
read as "the gate survived". **Reported because a mutation that mutates the
wrong line is a claim too**, and taking its green at face value would have left
the vacuous cell in place.

## WHAT IS GREEN, AND WHAT IS RED FOR REASONS THAT ARE NOT MINE

- `test:rebuild-notice-ownership` — 37/37.
- `test:repo-law-guards` — 34/34, including the raised sightings ratchet.
- `test:compile` — no file regressed against baseline; **0 typecheck errors** in
  the three touched files.
- Full chain, parallel pre-check: **188 suites, 12 failures.** All 12 were
  measured on a stashed clean tree and **all 12 fail identically there** — the
  failure TEXT was diffed, not the totals. The only difference in any of the
  twelve logs is one line: `chain suites discovered: 182` → `183`, which is this
  unit's own suite joining, armed.

## NOT COVERED — NAMED, NOT IMPLIED

- **THE COACH STATUS SCREEN DOES NOT MOUNT THE NOTICE YET.** That is step 4 of
  the design and it has not started. The gate says so in its own header rather
  than asserting a surface that does not read it — a negative behavioural claim
  with no cell is prose.
- **THE TAPE THAT MATTERS HAS NOT BEEN RUN.** "A rebuild started from the coach
  page shows on BOTH surfaces and lands on the SAME decision the day screen
  writes" cannot exist until step 4 does. What exists today is the ownership
  boundary that makes it possible: two readers, one truth, asserted by real
  calls.
- **NOTHING HERE HAS BEEN SEEN ON A DEVICE.** The fade and the ticker are the
  parts a screenshot would judge, and they are the parts no node cell can see.
- **THE REMOVALS HAVE NOT SHIPPED.** Ruling 4's section and ruling 6's card are
  still on the day screen, correctly — `LAW-removal-ships-with-its-replacement`
  says they leave in the same commit as their destination, and the destination
  is step 4.
