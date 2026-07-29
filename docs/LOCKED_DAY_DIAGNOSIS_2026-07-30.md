# The locked G-1 day — read from Sam's device, not reconstructed

**Status: DIAGNOSED FROM BYTES, NOT FIXED.** Two defects, both from one
sequence on Sam's phone (2026-07-29/30). The fix waits for the action log to
ship and for Sam to re-run the sequence, so the *order* of what happened is
read rather than inferred. Reconstruction has been wrong four times on this
exact flow.

The export these numbers came from (`device-export-3.json`) was read and
deleted in the same commit that recorded this file. Nothing personal was in it;
the numbers below are the whole of what it said.

---

## 1. What Sam did, in his words

On a G-1 day holding the canonical **rest stub**:

1. The ask appeared. (Correct — this is the funnel working.)
2. He picked **Accessories only**, and the day was given **Full Body Strength**
   — the landing session at full size, not its accessories version.
3. He deleted that session.
4. From then on the day is **dead**: every add and every swap refuses with
   *"I couldn't safely make that change, so the plan is untouched."*

## 2. What the device says

```
markedDays                       { "2026-08-01": "game", "2026-07-31": "rest" }
userRemovalConstraintCount       1
dateOverrideDates                []
weekScopedOverlayWeeks           ["2026-07-27"]
acceptedRevision                 14        lastTransaction  temporary_source_fact:hydrate
onboardingAnswerCount            23        snapshotAnswerCount 23    mirrorRefusals 0
```

`2026-08-01` is the Saturday fixture. **`2026-07-31` is the G-1 Friday, and it
now carries an explicit `rest` CALENDAR MARK** — the same class of mark as a
game. Nothing the athlete did was a calendar edit.

(The profile numbers are incidental but worth noting: 23 answers, 23 in the
snapshot, zero mirror refusals. The mirror-narrowing law is holding on the real
device.)

## 3. Defect A — a deletion door writes a schedule fact

`stageAthleteSessionDeletionTransaction` (`store/acceptedStateTransaction.ts`,
the `wholeDayRest` branch):

```ts
const markedDays = { ...prior.markedDays };
if (wholeDayRest) markedDays[date] = 'rest';
```

Deleting the only session on a day writes `markedDays[date] = 'rest'`, and that
mark is read by the resolver at the TOP of `_resolveDateRaw` — before templates,
before proximity, before anything the athlete could add later. Hence "dead
day": the mark outranks every door, and no door the athlete can reach removes
it.

**Sam's framing, and the law to fix against: a deletion door has no business
deciding a schedule fact.** "There is no session here today" and "this day is a
rest day" are different claims. The first is what the athlete said; the second
is a standing instruction to the planner that survives them changing their mind.
One is the absence of content, the other is content of its own.

Open questions for the fix (do NOT answer them by reading the code alone —
Sam's re-run answers them):

- Was the mark written by the delete, or by the reversible-adjustment ledger
  reacting to it? `reversibleAdjustmentTransaction.ts:468` and
  `acceptedStateTransaction.ts:2944` both DELETE a rest mark; something writes
  one and nothing on the athlete's path removes it.
- Which day did Sam actually delete — the G-1 Friday itself, or the source day?
- Does the surviving removal constraint (count 1) also gate the day, or is the
  mark doing all of the work? Two candidate locks, and the log will say which
  fires first.

## 4. Defect B — route (b) placed the landing session at full size

Sam picked **Accessories only** and got **Full Body Strength**. That is the
untransformed landing template, so on his build the route's transformation did
not reach what was published.

This is the class the landing unit added a single owner for
(`utils/g1RouteMaterialisation`, one wrapper for every materialise call), and
three separate paths that dropped the route were fixed in `d0437ce`. **Sam's
build predates that commit**, so the first thing his re-run establishes is
whether B still reproduces at all. If it does, the log names the door and the
boundary, and the fix has one place to look rather than three.

Note the interaction that made this worse than a wrong session: an empty G-1
holding a rest stub is exactly the case where route (a) reads *"Leave Friday
free"*, and where — under Sam's ruling below — the Gunshow should have been on
the menu in the first place.

## 5. Sam's rulings for the fix that follows (2026-07-30)

Recorded now, built after the log lands and the sequence is read.

**(1) The warning must read as a warning.** The current sheet renders the ask
as a neutral picker — the same option rows as "which conditioning session?".
The athlete is being told they are about to cost themselves a game, and it
looks like a preference. It needs the caution register. Athlete-facing design:
the treatment is proposed for Sam's sign-off, not chosen unilaterally.

**(2) On an empty or rest-stub G-1, the Gunshow joins the option list.** An
athlete adding work the day before a game should be offered the session that day
was built for — today the menu offers three ways to place *their* choice and
never offers the day's own. And the back affordance is labelled for what it
does: **"Go back — leave Friday free."**

The route copy pattern extends accordingly (a fourth option on empty days, plus
the labelled back row), and **Sam signs the new strings** before they ship —
the copy-equality gate in `g1LandingAskFlowTests` 18 fails until the design
document carries them, which is the mechanism that enforces it.

---

# Addendum — the re-test (export 6), and a corrected root cause

Six steps, taps on the tape. Four findings, and **one of them corrects this
document's own diagnosis.**

## The tape could not answer, and that is finding zero

200 entries, of which **182 were a single move's §18 repair search**
(`accepted_week_gateway_result` 76, `repair_candidate_selected` 65,
`repair_candidates_generated` 28, `repair_candidate_rejected` 13). One
transaction's internals evicted the first five steps of the session, including
both findings Sam most wanted read. The log spanned 38 seconds of a several-
minute script.

Fixed: the ring now evicts ENGINE entries before athlete decisions, and only
drops a decision when the ring is all decisions. The chatter is still recorded;
it just loses its place in the queue to the athlete's own actions.

## Finding 4 — the locked day: THIS DOCUMENT HAD THE WRONG CAUSE

Reproduced on the current branch, and the surprise is in the first two lines:

```
bin on G-1        → ok,  markedDays { "2026-07-24": "rest" }
add on that day   → ok,  session lands
add + a G-1 route → REFUSED: unknown_section_id
```

**The rest mark is not what locked the day.** An add over the mark succeeds. What
refused was `unknown_section_id`, and that is a hole in this unit's own fix:
added content is authorised by byte-exact signature match, and `d0437ce` taught
the policy to authorise ROUTED templates — inside a loop over days that begins
`if (!day.workout) continue;`. An empty day authorised the plain template and
nothing else. So Sam answered the ask and the app refused its own offer.

A day with nothing on it is exactly the day an add is for. Fixed; pinned by
`g1LandingAskFlowTests` 28, which reproduces his sequence exactly.

## The mark itself — ruling stands, unit is bigger than it looked

Sam's law is unchanged and correct: a deletion door does not write calendar
marks. It was attempted in this session and **reverted**, because removing it
alone is not a contained change:

- The mark is the planner's rest input. `buildWeekLog` reads `markedDays`, so
  removing it changes conditioning placement on OTHER days.
- Owning the emptiness with a stamped rest stub (the placement-law shape, which
  does work — the resolver keeps the day empty) still moved a neighbouring day,
  and `athleteSessionDeletionTests` regression 9 went red: the TAP door applied
  and the COACH door refused, because the coach verifier treats any other-day
  change as a verification failure while the same deletion authorises
  equivalent-exposure relocation.
- Three further assertions in that suite pin the mark as the ownership
  mechanism and need re-pointing at the new owner, not deleting.

That is a unit with a ruling of its own to ask for: **when a deletion authorises
relocation, may the coach door report success while another day rebalances?**
Until that is answered, half-removing the mark would trade a locked day for a
divergence between the two doors — and the locked day is already fixed above.

## Findings still open, with what they need

- **(2) Route (b) is a no-op on the registry strength templates.** Reproduced:
  `accessories_only` over `strength_full` lands all five rows unchanged, because
  every row classifies as an accessory — `isMainStrengthRow` asks
  `classifyPoolSlot(...)?.role === 'anchor'` and template rows are not pool
  anchors. Same classifier as **5D.4**, same shape: a lookup standing in for
  authored truth. The athlete asks for accessories-only and gets the whole
  session. Belongs to 5D.4; not patched here.
- **(2) No Gunshow in the option list on an empty G-1** — ruled in, needs Sam's
  signature on two new strings before it can ship.
- **(6) The move refusal.** The destination picker offers a day the commit door
  then refuses (`protected_anchor_day` — a team-training day), and the athlete
  is told "nothing on your plan changed. Try again", which is advice that cannot
  work. Needs one signed string naming the real reason, plus the picker
  excluding anchor destinations.


---

# Closed — Sam's five rulings, 2026-07-30

**(1) Relocation is disclosed, not refused.** The coach door required that no
other day move and rolled the whole removal back when one did — while the tap
door applied the same transaction. A removal that authorises equivalent-exposure
relocation is SUPPOSED to move other days; the bin door has disclosed that in
words since the repair-disclosure law. Refusing over disclosed rebalancing was
the defect. The verification that remains is the one that matters — the TARGET
changed — and every other day that moved is named in the reply, in the bin
door's own sentence. Disclosed set equals moved set.

**The mark removal then shipped.** It had been reverted for exactly the
divergence ruling (1) closes. A deletion door now writes no calendar mark, and
the emptiness is owned the way placed content is: a canonical rest stub carrying
the placement stamp, which every deriver already asks about. Three assertions in
`athleteSessionDeletionTests` pinned the MARK as the ownership mechanism and were
re-pointed at the new owner rather than deleted.

**(2) The fourth route, signed.** On an empty G-1 the menu now offers the day's
own session — *"Keep Friday's Gunshow — light upper-body pump, what the day
before a game is built for."* — and the back row says what it does: *"Go back —
leave Friday free."* Both filed in the design document and pinned both
directions by the copy gate. Offered ONLY on an empty day: where the day holds
something, route (a) already keeps it, and two names for one outcome is worse
than one.

**(3) The doubling law — the move refusal REVERSED, not reworded.** Moving a
session onto a team-training day is legal and lands as a COMBINED day, the exact
shape generation produces. The commit door refusing it was the defect, and the
picker was right to offer those days. Game day stays locked. Three things had to
change together: the destination check now blocks only game anchors, the picker
offers team nights, and the move ABSORBS — the anchor stays put, the arriving
session stacks beside it, and nothing travels back to the source day. The
conservation post-condition follows the combined identity, the mirror image of
how a scoped move conserves its two halves.

I had proposed a string for the old refusal. It is not shipped: the refusal it
would have explained should never happen.

**(4) Route (b) refuses rather than no-ops.** Over a registry strength template
it stripped nothing — every row classifies as an accessory because
`isMainStrengthRow` asks the pool registry for an anchor role and template rows
are not pool slots. The athlete asked for the light version and got the whole
session. Same classifier as **5D.4**, same root. Until it lands the route
refuses honestly; `g1LandingAskFlowTests` 23 asserts the template still has no
main lift, so it goes red when 5D.4 fixes the classifier — the signal to delete
the containment. 23b proves the route still works on a real session, which has
pool anchors.

**(5) The ring-buffer priority fix** shipped as approved.
