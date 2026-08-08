# NOW — overwrite at every checkpoint (pointer, not history)

- **BRANCH:** `main` · **HEAD:** `c140a2d0` (day-first slice 2 + the bucket
  vocabulary; docs follow it).
- **UNIT: DAY-FIRST UI, SLICE 2 — BUILT AND LANDED, both of Sam's 2026-08-08
  orders.** `e8d227ac` (layout + chip row + spacing) and `c140a2d0` (bucket
  vocabulary). docs/DAY_FIRST_SLICE2_BOUNDARY_2026-08-08.md
- **WHAT IS ON HIS PHONE, in the order he wrote out:** the Today/Week control,
  **the seven-day strip directly under it**, today's card with its component
  timeline, **the life-fact chip row**, then Coach Notes. The missed-session
  prompt and the phase-skew disclosure moved below the card with the notes; the
  picker banners stayed above the days they instruct about.
- **FIVE STACKED BARS ARE ONE ROW OF ICON CHIPS, AND NOT ONE DOOR MOVED.** Same
  handler, same testID, same accessibility label on all five — including the two
  whose testID changes when their fact is active. Each bar's sentence is now the
  chip's SPOKEN name. **Labels PROPOSED, unsigned:** Time / Away / Sick / Injured
  / Equipment (copy batch 12, with slice 1's "Today"/"Week").
- **THE DAY SAYS ITS NAME ONCE.** The week row and the day title are the day's
  **BUCKET** (Strength, Conditioning, Rest, Mobility, Accessories, Gunshow,
  Speed); the **timeline is the one enumeration** and carries the variant name.
  **"Power" is gone from the week view** — the exhibit day reads "Strength" — and
  is NOT retired: it still names that component on the timeline.
- **THE PROJECTION OWNS THE WORD.** `VisiblePart` carries `bucket` beside
  `headline`; `PART_BUCKET_KIND` is a table the type system forces to be
  complete. It sits on the WORDS half of the projection, so a missing copy entry
  still cannot disarm the structural laws. **Nothing on the Program screen
  composes a name out of other names any more.**
- **MEASURED IN BOTH WORLDS BEFORE A WORD CHANGED** — a tape over three real
  generated weeks, diffed: every training day's row and title → its bucket;
  Power → Strength; Rest / Practice Match / Game / Team Training unchanged; **the
  TIMELINE BYTE-IDENTICAL**; and **Gunshow kept "Gunshow" on its own**, through
  the typed charter-door branch rather than a special case.
- **THE GATE, both commits:** full `test:bible` **UNPIPED `TRUE_EXIT=1` at
  `test:program-control-durable`, 1 FAIL line** — main's declared red, same
  assertion text. **Sweep 2 of 157 = the declared set EXACTLY.** `test:compile`
  EXIT 0, no file regressed. Copy extraction ceiling **DROPPED 141 → 130 in the
  commit that earned it**, honestly labelled: five sentences left the
  EXTRACTOR'S view, not the app.
- **EIGHT NEW CELLS, TWELVE MUTATIONS, TWELVE REDS — and one mutation SURVIVED
  first.** Deleting the charter-optional branch from `partBucket` left every cell
  green, because a Gunshow day quietly reading "Strength" is a *legal bucket
  word*. A cell of its own now holds it. **That is the finding to carry: a
  vocabulary gate is blind to a wrong word from its own vocabulary.**
- **THREE PINS MOVED, ALL OUT LOUD**, all the legitimate case (the ruling moved,
  on a date, from the owner): A4 rider (a) "notes above the week" → below the
  card, still asserting a POSITION; `coachNoteDisplayTests`' helper pin → the
  structural form; and the readiness entry's button ROLE → asserted at its new
  owner, identity still asserted at the call site.
- **LOOP CHECK, SIGHTING 5:** `a count taken for a record` fired again, inside a
  gate I had just written, on its first run — it counted a door FILE-wide and
  called a legitimate second owner a leftover. **The number named the FILE while
  the claim was about the SCREEN.** Secondary: **a green gate watching nothing** —
  the copy-binding gate reads quoted strings in TABLE ROWS, and my table quoted
  the OLD sentences, so it bound five strings nobody needed watching and none of
  the new labels while printing PASS. 29 → 41 bound, mutation-proven.
- **SEVEN QUESTIONS PARKED**
  (docs/PARKED_QUESTIONS/DAY_FIRST_SLICE2_2026-08-08.md): whether an active fact
  should light its chip (**not built on purpose** — only 2 of 5 chips know);
  **a zoomed-out week row now shows ONE word**, a real loss at that size; power
  still gets its own timeline row for one exercise; **the day SCREEN has the same
  double-labelling one screen over**, outside the order; the five labels for
  signing; the Gunshow-without-a-typed-door gap; where the readiness owner's
  title went.
- **NOT COVERED, first line of it: NO DEVICE EVIDENCE.** Chip sizing, label
  lengths, every tightened gap and how a one-word row scans are unverified by
  eye; this repo has no render-level test, so the gates read source SHAPE and
  projection OUTPUT. The row icon still comes from a title-STRING table
  ("Strength" resolves, "Power" did not, so nothing regressed) — argued from the
  table, not rendered. `coachNoteDisplayTests` does not run at all (crashes at
  HEAD on a missing `TodayWorkoutCard.tsx`, pre-existing, not in the chain); its
  pin was updated anyway rather than left as a trap. Rulings 1–12 of the
  home-screen redesign remain owed.
- **SLICE 1 STILL STANDS BEHIND IT** (`2796f6d1`, fork A — completion SHOWN, not
  written; two shapes of one screen, one row call site).
  docs/DAY_FIRST_SLICE1_BOUNDARY_2026-08-08.md
- **NEXT:** Sam's eye on slice 2 — he holds a veto on all of it, and the parked
  seven are his. Then either the device pass or the next slice. The **LR-29
  replay unit** still builds after day-first UI and remains the measured payer of
  main's `fixture-identity` red.

- **STILL TRUE FROM THE MERGE (2026-08-07, `89b540f9`):** main carries Stage B
  stages 1 + 2; **a green main went to a 2-red main knowingly** —
  `test:program-control-durable` + `test:fixture-identity`, the declared set
  exactly. `fixture-identity` 3/5/6 are plain laws whose payer is the LR-29
  replay unit, measured (under `LFA_FLIP_DOOR=1` that suite goes GREEN).
  Sam-accepted as known-imperfect.
- **The LR-29 dependency list is DELIVERED** —
  docs/REPLAY_UNIT_DEPENDENCY_LIST_2026-08-07.md. 3 of 10 readers read ZERO
  fields; the `current_microcycle` rung answered ZERO times in 156 suites; **the
  ledger has no vocabulary for illness/injury/readiness/phase**, so the unit's
  input set is ledger + fact stores and that fork is its largest open decision;
  **the boot already replays**, so its real first question is whether that replay
  already reconstructs `authorisedReductions`.

- **Branches (the ledger — ask git, never recall):**
  - `main` — **the tip**. `feat/stage-b-stage2` is fully merged, 0 ahead;
    `feat/r53-v3-switchover` is an ancestor. Both historical.
  - **TWELVE `scratch/*` branches** — inert instruments, unlanded, kept for the
    replay unit. **FOUR stashes**; only `stash@{0}` ("flip-move-i-wip") is the
    one the kickoff doc names. Stash is unsafe in this shared worktree.
- **WATCH-FORS still open on Sam's device:** completed-day display at the next
  completed session; the three fallback sheets; stale-banner Review; the
  team-training affordance.
- **DEFERRED, NOT FORGOTTEN:** coaching QUALITY — *"labels are okay but the
  programming is pretty shit"*. Exhibits at
  docs/COACHING_QUALITY_EXHIBITS_2026-08-07.md. Not current work.
- **Small maintenance, filed not now:** `runSlice1` runs 21.2s against its own
  18s warning and 30s hard ceiling.
- **INBOX CONVENTION:** an empty queue is written `(none)`, **unnumbered** — the
  stop hook read a numbered empty marker as an order twice
  (`scripts/__tests__/seatInboxHookTests.sh`, 6/6).
- **Standing:** `test:bible` is the ONLY official gate, unpiped, per commit.
  `npm run test:bible:parallel` is a NON-OFFICIAL fast pre-check — no official
  verdict ever cites it. Verify `git branch --show-current` before every commit
  (shared worktree).
