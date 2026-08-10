# STOP — THE REBUILD NOTICE HAS ONE OWNER, AND A CELL WAS GREEN AND EMPTY

**LOOP CHECK: `LAW-one-name-two-meanings` — sighting 7.** Disposition: the
registry row enumerates it and `TWO_MEANING_SIGHTINGS` ratchets 5 → 7 in the
same commit, so the sighting cannot be absorbed silently. **This is the first
sighting of the class applied BEFORE the code moved rather than found after**,
and the measurement paid — the two paths driving the notice drive the same four
pieces of state, which is why one move closes two rulings.

**NORTH STAR: TOWARD.** No new stored state. Nothing new reaches disk;
`test:persisted-inputs-schema` proves it by reading storage, not source. What
moved was in-memory render state, from four `useState`s on one screen to one
module-scoped owner.

## WHAT LANDED

| commit | what |
|---|---|
| `3459aa4f` | `useRebuildNotice()` over a module-scoped store; the day screen's four `useState`s, its fade `useRef` and its rotation effect gone; gate in the chain; sightings ratchet raised |

## THE ORDER'S FIRST QUESTION WAS ANSWERED FIRST

The seat's order and the design both said: **check whether `runRebuild` closes
over day-screen state before scoping, because if it does the price changes.**

**IT DOES NOT.** It closes over `onboardingData` — a `useProfileStore`
selection any screen can make. Everything else is a module import or a local
`Alert` helper. Route (a) priced as written.

## THE CORRECTION MID-BUILD, REPORTED NOT SMOOTHED OVER

The first cut put the `Animated.Value` and the interval **in the store**. A
probe showed the node harness cannot parse `react-native`'s entry file at all,
and **no other store in this repo imports it** — so that store would have been
the only one its own suite could not call, and every assertion about it would
have degraded to regex-over-source. The fade and the ticker moved one layer up
to `hooks/useRebuildNotice.ts`; the store stayed pure. **Sections [1]–[3] of
the gate are real calls because of that correction, not text matching.**

The ticker is also a module-scope subscription rather than an effect: left as
an effect, the second screen to mount a reader would have run a second interval
and rotated the messages at double speed — the exact bug shape route (b) was
rejected for.

## THE MUTATION THAT CAUGHT ITS OWN VACUOUS CELL

Nine mutations; **eight red on the first pass**. The survivor was "the return
still carries `rebuildMsgOpacity`". The cell searched the WHOLE FILE for
`\n    <field>,` — which the hook's own `const { … } = useRebuildNotice()`
destructure matches at the same indent. **All five of those cells were reading
the destructure and none was reading the return: green and empty.** Scoped to
the return block; the mutation reds now.

Two mutations were themselves wrong before they were right — a non-anchored
`perl` substitution hit the destructure instead of the return and read as "the
gate survived". **Reported because a mutation that mutates the wrong line is a
claim too.**

## THE CHAIN

**188 suites, 12 failures.** All twelve measured on a stashed clean tree and
**all twelve fail identically there — failure TEXT diffed, not totals.** The
only difference across the twelve logs is one line:
`chain suites discovered: 182` → `183`, this unit's own suite joining, armed.
`test:law-registry` stays red for Sam's stop-the-line reason, not a new one:
**77 rows, 43 guarded, 34 UNENFORCED.**

## THE INBOX IS CLEAR — AND CLEARING IT WAS ITSELF A FINDING

The first attempt left a `**DONE — …**` line under `## Unprocessed`. **The stop
hook reads CONTENT, so a reply left in that section reads as work still owed**
— it blocked, correctly. The second attempt added explanatory prose at column 0
and blocked again for the same reason. The file's own rule is the answer and it
was already written there: *a terminal reply that is not an order does not
belong in `## Unprocessed` at all.* The pass is archived; the queue holds the
empty marker. `test:seat-inbox-hook` 21/21.

## WHAT IS BLOCKED ON SAM

**Nothing.**

## NOT COVERED, NAMED RATHER THAN IMPLIED

- **STEP 4 HAS NOT STARTED** — mount the modifier actions and the phase control
  on the coach status screen. Until it exists, the tape that matters (a rebuild
  started from the coach page showing on BOTH surfaces and landing on the SAME
  decision the day screen writes) **cannot be written**, and the gate says so in
  its own header rather than asserting a surface that does not read it.
- **THE REMOVALS CORRECTLY HAVE NOT SHIPPED.** Ruling 4's section and ruling 6's
  card stay on the day screen until step 4 gives them somewhere to land —
  `LAW-removal-ships-with-its-replacement`.
- **NOTHING HERE HAS BEEN SEEN ON A DEVICE.** The fade and the ticker are
  precisely the parts a screenshot would judge and no node cell can.
