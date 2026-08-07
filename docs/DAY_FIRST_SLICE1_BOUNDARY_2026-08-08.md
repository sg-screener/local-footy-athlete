# DAY-FIRST UI — SLICE 1 BOUNDARY REPORT (2026-08-08)

**LOOP CHECK: `a count taken for a record` — SIGHTING 4 — COMPRESS, and it fired
inside a gate I wrote, on that gate's first mutation test.** The state-leaf cell
counted `<DayStateLeaves` occurrences and passed against a mutation that emptied
the loop feeding them: the count was right and the days were gone. The
compression is written into AGENTS.md beside the law it belongs to (a source scan
counts CALL SITES; the domain noun is what those call sites do — word-boundary
the count, then read the region that runs them, then prove the region was found),
not left as a note in this report. *Secondary firing:
`a-ruling-premise-is-a-claim-too` — the unit plan's own §2f hazard is refuted
below.*

World: `main`. Order: SEAT_INBOX, fork A — *"completion shown, not written.
Commit as authored, then CONTINUE the overnight slice-1 build."*

---

## 1. WHAT IS ON SCREEN

The Program tab now **leads with today**, and the week is the zoom-out.

- **A week strip across the top.** Seven chips: weekday, date, and a mark
  coloured by the day's kind — **the game day carries the ball icon**, which is
  Sam's anchor. The kind comes from `VisibleDay.kind`, so the strip cannot
  disagree with the row below it about which day is the game.
- **The selected day, full size**, exactly the row that exists today: its
  badges, its Done marker, its stale banner, its Start Session / View summary /
  Log Game CTA and its "Want to change something?" door. Unchanged, because it is
  literally the same component.
- **The day's session as a tappable component timeline**, between the day's name
  and its CTA. One row per component, in the projection's order, each with an
  icon, the part's signed headline, and a completion node. Tapping any row opens
  the same day-detail door the CTA opens.
- **A Today / Week control** under the week nav. `Week` is the seven-row list
  exactly as it is today.
- **No clock times.** Not suppressed — the projection carries none.

**WHERE THE TIMELINE DOES NOT APPEAR, deliberately:** a **fixture** day (its one
part is the fixture itself, which the day's own name already says, and the game
block's Log Game / move-or-remove doors are what that day is for) and a **rest**
day (no parts — and the timeline renders nothing on an empty list rather than an
empty frame). Both keep the exact expanded blocks they have today.

**Completion is SHOWN, NOT WRITTEN** (fork A). A filled green node means the
athlete's SAVED outcome recorded that component as done; amber means partial;
grey means they said they skipped it; a hollow ring means they have not answered
yet. Nothing on this screen writes.

## 2. THE ARCHITECTURE, IN ONE PARAGRAPH

**Two shapes of one screen, not two screens.** Both render the same
`visibleWeek`, through the same `DayRow`, from **one row call site**
(`renderDayRow`). A rival day-first screen behind a third `DESIGN_VERSION` — the
switch the unit plan named — would have been two live truths about one week,
which is the disease the L14–L16 note already refused once. Nothing is lost and
nothing is duplicated: the week list is one tap away, and it is the **forced**
shape in the two cases where a day-first view has no day to be about — another
week (there is no today, and the selection owner deliberately selects nothing
there) and a game picker (choosing among seven days is a week-level act, and its
target rows and testIDs are untouched).

**The timeline is the projection's parts.** `rules/dayTimeline.ts` is built on
`projectDayDetail` — already the day-detail screen's reading of `VisibleDay` — so
the two surfaces are one list asked twice and the walker's existing L-P3 cell
covers both. What the module adds is the one thing the projection must not carry:
the **result**. `visibleWeek = derive(…, results, …)` names results as an input;
the saved outcome arrives BESIDE `VisibleDay`, never inside it.

## 3. THE GATE

Measured on the FINAL tree, `2796f6d1`, both instruments.

- **Full `test:bible` UNPIPED: `TRUE_EXIT=1` at `test:program-control-durable`,
  1 FAIL cell line in the whole run** — *"a move committed durably reaches the
  visible week"*, 18 passed / 1 failed. **Byte-for-byte the declared red main has
  carried since `89b540f9`.**
- **Sweep, every suite: `2 of 157` = `test:program-control-durable` +
  `test:fixture-identity` — the declared set EXACTLY. No difference, no STOP.**
  157 is 156 plus this unit's own suite. World identity printed:
  `head=2796f6d1`.
- `test:compile` **EXIT 0 — no file regressed** against the baseline.
- `test:day-first-timeline` **10/10**, and **seven mutations, seven reds** (§5).
- Copy extraction: **130 both before and after**, measured by running the
  extractor in a git worktree at the pre-unit commit rather than assumed.

**STATED PLAINLY: the chain was run on the FINAL TREE, not once per commit.**
The standing law is per commit; what happened is `test:compile` plus targeted
suites during the build, then the full chain and the full sweep twice — once at
`8bf096d4` and again at `2796f6d1` after the tap-outside fix. The first of those
full runs is what caught the profile-census red in §6(b). Four commits, two full
gate runs, and the last one covers the tree that ships.

## 4. NORTH STAR — WHICH WAY DID THIS MOVE?

**TOWARD.** Zero new stored state; the unit's whole ruling is that it stores
nothing. The completion the timeline shows is a RESULT the app already records
through its one existing door, read at render and never copied. Four identities
that were about to be re-derived by a new surface got single owners instead
(§5). The one thing worth flagging honestly: the day-first view is a new WINDOW,
so it converges nothing that was divergent — it is north-star-neutral-to-positive
rather than a convergence step, and the report should not dress it up as one.

## 5. ONE OWNER PER IDENTITY — L12's ANSWER FOR THIS UNIT

The defect class the plan named is *a surface that re-derives an identity the
projection already carries*. Four identities were candidates, and each got a
single owner in this commit rather than a second reader:

| identity | owner |
|---|---|
| the part id, **both directions** | `partIdFor` / `componentIdFromPartId`, in `projectVisibleWeek` beside where the ids are minted |
| what a saved outcome says about a component | `completionByComponentId` in `sessionFeedbackForm` — the feedback panel and the timeline read one rule, legacy lift included |
| what state a day is in, for the explorer | `dayStateToken` + `DayStateLeaves`, extracted from `DayRow` so the six strip days still report themselves |
| the calendar date's display | `dayOfMonthLabel`, beside the existing d/m owner in `appDate` |

**Mutation-proven, seven for seven** — each red against the cell that claims the
property: id recovery broken (2 cells), the legacy lift deleted, the timeline
keyed by kind, the state-leaf loop emptied, the skip guard dropped, a writer
imported into the timeline module, and the timeline mutating the outcome it was
handed.

## 6. TWO CORRECTIONS, BOTH MINE, BOTH BEFORE THE WORK WAS TRUSTED

**(a) THE UNIT PLAN'S NAMED HAZARD IS REFUTED, AND THE RULING IT SUPPORTS
SURVIVES.** The plan (§2f) said the live `kind` collision was *a day carrying
both a conditioning component and a finisher*. **Measured at the emitter, that
day cannot exist**: `getSessionComponents` pushes ONE of them from a single `if`,
choosing on `attachedConditioningKind`. `session`/`strength` are mutually
exclusive the same way. **The reachable pair is `recovery` + `recovery_addon`** —
`recovery` is emitted only when nothing else was, and `recovery_addon` is
appended after that check. The suite now builds that day. "Key on `id`, never on
`kind`" was right for a reason that was wrong and is now right for a measured
one. The plan is corrected in place, in the section that was wrong.

**A CONSEQUENCE NAMED, NOT PATCHED:** those two `recovery` parts render with the
same headline and the same rows, because `partHeadline` and `rowsForKind` both
key on kind. Keying on id means no work vanishes — but the athlete would see two
identical-looking lines. The projection carries nothing that tells them apart, so
a surface that invented a distinguishing word would be composing. **Sam's call.**

**(b) THE SUITE REACHED THE PROFILE AROUND ITS OWNER, AND THE FULL GATE CAUGHT
IT.** `world()` copied `useProfileStore.setState` from `projectionOwnershipTests`
— which is one of ~50 DECLARED entries in the one-door census, and those are debt
rather than permission. Joining that list would have pushed a ratchet that has
only moved down this era, to buy nothing. Routed through
`applyProfileOnboardingWrite`. **This is the value of running the whole chain
rather than the suites I thought were related** — nothing in my mental model of
"what a UI slice touches" contained the profile census.

## 7. PARKED FOR SAM (one line each — the overnight law)

1. **Mid-session ticks do not survive an app kill.** The known edge of fork A,
   recorded and accepted: ticks reflect a SAVED outcome, so nothing is lost —
   there is simply nothing to show until the athlete saves. If he wants live
   per-component ticks that survive a kill, that is fork B/C as its own unit.
2. **Copy, PROPOSED and unsigned: `Today` and `Week`** — the slice's only new
   chrome words, both already this screen's vocabulary. They join the next
   signing batch.
3. **Icons are terminal-proposed from existing assets** (rulings 6/10): power and
   speed both take the bolt, support takes the core mark, conditioning takes the
   flame. Nonsense pairings are his call at the device pass.
4. **Should `Today` or `Week` be the remembered default?** Today leads on every
   open right now; the choice is not persisted (persisting it would be new stored
   state, and this unit stores nothing).
5. **Two identical `recovery` rows** on a recovery day with an add-on — §6(a).

## 8. NOT COVERED — honestly

- **NO DEVICE EVIDENCE.** Nothing here has been on a phone. Everything below the
  glass is measured; the glass itself is measured only as source and types. **The
  layout, spacing and colour of the strip and the timeline are unverified by
  eye** — this is exactly the class Sam's device pass exists for.
- **NO RENDER-LEVEL TEST EXISTS IN THIS REPO**, so no cell asserts that the
  day-first branch actually mounts. The three source-scan assertions in cell 9
  read the block's shape, and their limit is stated here rather than in the
  report's headline: a source scan cannot see a render.
- **THE `recovery` + `recovery_addon` DAY IS BUILT AS A PURE-FUNCTION PROBE**
  (`getSessionComponents` + `projectParts` on a hand-written workout), not
  reached by acting. It proves the SHAPE is emittable; it does not prove an
  athlete's real week reaches it. A walker route that produces one would be
  stronger, and does not exist.
- **THE WEEK STRIP HAS NO WALKER ACTION.** Selecting a day from the strip is a
  new tap the action vocabulary does not contain, so no cell walks it. By the
  walker's own header, that is a defect in the harness rather than a gap in the
  app — filed, not fixed here.
- **The five week modes stage 1's proof loop never reached** (bye, bye_recovery,
  deload, optional, illness_recovery) are not reached by this suite either. A
  day-first view landing in one of them is crossing the same unwalked ground.
- **Rulings 1–12 of the home-screen redesign remain owed** — this slice is the
  today-first view only, and the icon shortcut row, the four-action menu, inline
  exercise editing and the repeat-week deletion are all later slices.
- **The `Today`/`Week` choice is not persisted**, deliberately (§7.4).
- **L12 — what catches the NEXT defect of this class:** the class is *a surface
  that re-derives an identity the projection already carries*. The gate is the
  four single owners in §5, each held by a mutation-proven cell, plus the new
  AGENTS.md rule that a source-scan count is never the whole assertion. What
  would still slip through: an identity re-derived **inside a component in
  `HomeScreenV2` itself**, since nothing enumerates those. Naming that as the
  residual rather than claiming the class is closed.
