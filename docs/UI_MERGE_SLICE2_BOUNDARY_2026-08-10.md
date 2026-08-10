# UI MERGE SLICE 2 — BOUNDARY REPORT, 2026-08-10

**LOOP CHECK: a gate that names a landmark the surface no longer has — sighting 2
— ITERATE.** Slice 1 removed `<WeekStrip` from the day-first spine and the order
gate navigated by it, so the gate went red reporting *"this gate is reading a
screen that has been rebuilt around it"* rather than comparing -1 against -1.
That is the practice PAYING, not a wall: the gate refused to be vacuous and
stayed red until the surface settled, which is exactly what
`gate-must-watch-the-deleted-surface` asks for. The disposition is iterate —
re-aim the landmark in the slice that settles the spine, which is this one.

**The unit: Sam put his screen next to the signed prototype and listed what was
missing. Slice 1 did the removals; these are the additions.** His words, in
order: *"there's no text above the little buttons like rens said"*, *"there's no
drop downs for the session overview"*, *"hers has like mobility / warmup then
drop down of the exercise and the sets and reps"*, *"the today badge is still
there but the 'todays session' part has not been changed yet"*.

**STATUS: BUILT, GATED, AND PHOTOGRAPHED ON THE SIMULATOR IN BOTH STATES.**
`.maestro/golden/day-card-dropdowns.yaml` is green — collapsed, expanded,
collapsed again — and `.maestro/golden/day-week-profile.yaml` is still green.
`artifacts/ui-walk/dropdown-1-collapsed.png` and `dropdown-2-expanded.png`.
**Not on Sam's phone.**

---

## NORTH STAR

**Toward, and it is the whole shape of the slice.** Nothing here stores anything.
The drop-downs render `VisibleDayDetailSection.rows` — the projection's own list,
passed through `dayTimeline` untouched — so the card and the session screen are
one list asked twice rather than two readings that can drift. The one piece of
new state is which rows are open, and it is React state that dies with the
screen: **a drop-down being open is not a decision about training, it is where a
thumb is**, and writing it would be new stored state that is not an input.

---

## WHAT WAS BUILT, AGAINST HIS FOUR BULLETS

| His words | What landed | What holds it |
| --- | --- | --- |
| *"the today badge is still there but the 'todays session' part has not been changed yet"* | The eyebrow **`TODAY'S SESSION - MON 13/7`** replaces the `MON 13/7` cluster; the Today badge is gone from the day screen and kept in the week list | `test:day-first-timeline` "the day card leads with the eyebrow…"; `day-card-dropdowns.yaml` asserts `day-today-badge` NOT visible |
| *"there's no drop downs for the session overview"* + *"the exercise and the sets and reps"* | Each part is a collapsible row: icon, name in caps, `N exercises` under it, chevron; expanded shows name left / prescription right | `test:day-first-timeline` "the day card lists each part's exercises…"; the flow taps one open and shut |
| *"there's no text above the little buttons like rens said"* | The five circles now sit in a card headed **"Need to make a change?"** with **"Update your status to modify your program."** | `test:day-first-timeline` "the five circles sit in a card with words above them" |
| ruling 2, *"theres less highlight here as well whihc is good"* | The day card loses its lime border, its tinted fill and its glow. The accent strip and Start Session keep the lime | The screenshot; no cell — see NOT COVERED |

**START SESSION DID NOT MOVE AND DID NOT NEED TO.** It was already inside the
card below the timeline. A cell now pins that order, because "it was already
right" is the kind of claim that stops being true silently.

---

## THE COPY, AND THE ONE SIGNATURE SAM GAVE ON SIGHT

- **BATCH 32 — SIGNED.** `TODAY'S SESSION` and its ` - ` separator. He was shown
  the exact string and answered *"yes thats the better heading"*. The report had
  said the wording would come with a later batch; he ruled immediately, so it
  ships signed.
- **THE HYPHEN IS HIS.** The sheet's house style is an em dash. He read and signed
  `-`. Recorded rather than normalised — a signature is over the characters he saw.
- **THE DATE IS NOT A NEW STRING.** `MON` and `13/7` are `day.short` and
  `shortDayMonthLabel`, the two values this card already rendered side by side.
  The eyebrow moves them. Registering a date template would give the app a second
  way to say what day it is.
- **BATCH 33 — PROPOSED, three strings.** `{count} exercises`, `{count} exercise`,
  and the change card's two sentences. The last two are HER words, and the
  governing rule is her structure and HIS style — so they ship PROPOSED under the
  transitional rule rather than being adopted silently. **They are on the sheet
  for his next signing.**
- **"Time" STAYS "Time".** Hers says "Time away"; Sam ruled on sight to keep his.
  A cell asserts the label did not drift to hers.

---

## THREE GATES CAUGHT SOMETHING, WHICH IS THE POINT OF HAVING THEM

### 1. THE COPY BINDER AND A NEW CELL WERE IN DIRECT OPPOSITION
`test:copy-rulings-binding` demanded the signed literal appear in a surface file;
the new eyebrow cell forbids the literal in `HomeScreenV2` (the words are a sheet
entry). **A gate that can only be satisfied by breaking another gate gets
weakened by whoever next has to make it pass.**

**Fixed by making the binder ID-AWARE rather than by adding the sheet to
`AUTHORING_MODULES`.** Adding the sheet would have made every registered string
"in the app" by virtue of being registered — the *shipped vs shipped-and-
reachable* gap this repo already carries as open debt, turned into a tautology.
A sheet-backed string now counts as present only when a SURFACE reads its id,
which is **strictly stronger** than the literal scan was.

### 2. THE TIMELINE ENTRY SHAPE PIN CAUGHT `rows` ON ITS FIRST RUN
Admitted, not loosened, and with two assertions added beside it: the rows are
non-empty, and they are the projection's own rows for that part (same length,
same first id). **A shape pin alone cannot see an empty list**, and an empty list
renders a drop-down onto nothing.

### 3. A DEVICE ASSERTION THAT COULD NEVER HAVE PASSED
The flow's first version asserted `text: "Today"` is not visible, to prove ruling
5. **The Today/Week toggle says the word too**, so it failed on its first run —
and the tempting fix is to delete the line. The fix taken was an id
(`day-today-badge`, a new `testID` prop on `Badge`), which is a coordinate no
other control shares.

---

## THE CRASH REPORT SAM SENT AT 18:56 IS THIS SESSION'S OWN BAD COMMAND

**Attributed, with the receipt, because the inbox order says stop and read the
stack.** `LocalFootyAthlete-2026-08-10-185648.ips`, captured **18:56:45.1085**.
This session ran `maestro test` directly, without the runner, at **18:56:41**
(`~/.maestro/tests/2026-08-10_185641`). Without `scripts/dev-e2e/run-maestro-ios.sh`
the `-e E2E_METRO_URL=…` binding is never supplied, so the app was launched with
the **literal string `${E2E_METRO_URL}`** as its Metro URL, and
`validatedMetroURL(_:)` did what it is written to do.

**So it is not a second app defect and not a regression from the launch-purpose
fix — it is the harness being invoked wrong, by this terminal.** The three
subsequent runs through the runner produced no crash report at all.

**THE SYSTEMIC ORDER STILL STANDS AND IS NOT DONE. CENSUS, AS ASKED: there are
TEN hard `fatalError`s on the launch path** in
`ios/LocalFootyAthlete/DevE2ELaunchDiagnostic.swift` — lines 81, 95, 102, 120,
127, 164, 207, 234, 242, 257. **Three of them have now cost a debugging cycle
each.** Replacing the class with a refusal a flow can SEE is NOT built here and
is named as the next unit — it is a Swift change on the launch path and it is not
this slice.

---

## NOT COVERED

- **THE MODIFIERS STRIP (a) IS NOT BUILT.** Sam excused it — *"that's not built
  yet so fair enough"* — and the seat asked for it anyway with its destination
  stubbed. **Held, deliberately:** its two sentences are unsigned, its
  destination does not exist, and slice 4 owns it. **His excusal outranks the
  request to build it early**, and a stubbed strip is a dead surface carrying
  words he has not seen.
- **THE CALMER CARD HAS NO CELL.** Ruling 2's border/glow removal is asserted by
  the screenshot only. A style assertion would pin colours, and the merge's
  governing rule forbids this slice touching colour tokens — so pinning them here
  would be the gate contradicting the rule. **Sam's eye is the instrument.**
- **THE WEEK VIEW IS UNTOUCHED.** Slice 5 owns it. Her expand-in-place rows, the
  exercise counts, the TEAM TRAINING badge, the "Completed" state and the
  prev/next week sets are all listed and none are built.
- **NOTHING IS ON SAM'S PHONE.** Simulator only, Debug, over Metro.
- **THE PART NAME IS THE VARIANT, NOT THE BUCKET.** The inbox said part names must
  come from the app's own vocabulary; the timeline already uses `headline` (the
  variant — "Lower Body Strength"), which is the day-first ruling's own choice and
  is why "Power" left the day title on 2026-08-08. **Using `bucket` here would
  render "STRENGTH" twice on a day carrying strength and power.** Read as the
  inbox meaning "not her labels" rather than "the `bucket` field". **If Sam meant
  the bucket word, this is the line to correct.**
- **NO PART SHOWS A DESCRIPTOR META LINE.** Hers shows *"Aerobic flush"* on some
  rows; ours always shows the count. `VisiblePart.detail` exists and could carry
  it; not wired, not designed, not measured.
- **THE 21 SUITES BUILT ON THE IMPOSSIBLE ATHLETE** are still uncounted against a
  legal profile. Untouched by this slice.
- **`test:bible` WAS NOT RUN END TO END.** It is red on purpose and stops at the
  first failing suite. Seven suites were run by name plus the two flows.
- **`test:repo-law-guards` HAS ONE RED THIS SLICE DID NOT CAUSE** — a queue order
  using "supersedes" descriptively with no quote. Verified red at `HEAD` before
  this work started; named, not silently absorbed.
