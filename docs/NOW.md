# NOW — overwrite at every checkpoint (pointer, not history)

**THIS FILE IS A POINTER AND IT IS NOW BUDGETED.** It was 53KB on 2026-08-10 and
had become history — re-read at every stop, and Sam paid for it in dollars
(`/usage`: 126M tokens in, $68.95 for 1h43m, almost all of it reading this file
and `SEAT_INBOX.md`). Everything it held is verbatim in
`docs/NOW_HISTORY_TO_2026-08-10.md`; **nothing was deleted, only moved off the
hot path.** `test:repo-law-guards` now fails when either file exceeds its budget.
**If you are about to append a paragraph here, it belongs in the boundary report
and this file gets one line pointing at it.**

---

## FOR SAM — the short list

- **⚠ SAM: ONE REBUILD IS STILL OWED AND IT NOW CARRIES TWO THINGS.** Run
  `npx expo run:ios --configuration Debug` — roughly 40 minutes, machine busy the
  whole time, so pick when. Until it runs, the test rig's practice-week door and
  **the ten crash-points that are now refusals instead** are both built and
  **have never executed**. **Not seen on your phone.**

- **⚠ SAM: THE DAY SCREEN'S ADDITIONS ARE BUILT AND PHOTOGRAPHED.** `25565430`.
  Eyebrow, drop-downs with exercises and prescriptions, the change card, the
  calmer card. Both drop-down states shot at
  `artifacts/ui-walk/dropdown-{1-collapsed,2-expanded}.png`, and
  `.maestro/golden/day-card-dropdowns.yaml` holds them. **Simulator only — not
  seen on your phone.**

- **⚠ SAM: THE TEST RIG WORKS AND IT FOUND THE ROT YOU WARNED ABOUT.** One flow
  runs end to end in 18 seconds (`96dd6f01`), and on its first working run it
  caught that **every practice week here was built from a profile the app would
  refuse from a real person** — no 2km time. **21 of 332 suites consumed that
  impossible athlete** and whether they still pass on a legal profile is
  **still open**. **Not something you have seen on your phone.**

- **⚠ SAM: THE UI MERGE IS OPEN AND SLICE 1 LANDED — THE ADDITIONS HAVE NOT.**
  Slice 1 removed what your rulings took (`97066aa0`). Your eye pass named what is
  missing: the drop-downs, the eyebrow, the calmer card, the words above the five
  circles. **Nothing from that list has been on your phone.**
  `docs/UI_MERGE_PLAN_2026-08-10.md`

- **⚠ SAM: TWO DECISIONS ONLY YOU CAN MAKE, AND NEITHER IS URGENT TODAY.**
  Local-only vs sign-in (**there is no auth code in the repo at all** — measured,
  not assumed), and whether v1 is iPhone-only (**Android has never been run**).
  Plus one line for `eas.json` — `submit.production.ios` is `{}`. **Waiting on
  your word.**

## STATE

- **BRANCH:** `main` · **HEAD:** `1165f183`
- **`test:bible` IS DELIBERATELY RED and stays red until every law has a guard.**
  `test:law-registry` is the chain's last link and fails while any registry row
  reads `UNENFORCED`. The red does not mean the app broke — it means the app has
  never been checked against those rules, and from now that counts as failing.
  **Only guards, guard-caught fixes and measurement land while it is red.** The
  count is measured by running `test:law-registry`, never recalled. **Sam's rule:
  it may only fall.**
- **`test:bible` stops at the first failing suite** — anything past position 92
  needs `scripts/sweep.sh <label>`. `npm run test:bible:parallel` is a
  NON-OFFICIAL pre-check. **Verify `git branch --show-current` before every
  commit** (shared worktree).

## OPEN, ON US

- **A REFUSAL HAS NEVER FIRED.** `DevE2ELaunchDiagnostic.swift` went from TEN
  hard `fatalError`s on the launch path to ZERO, and each one is now a typed code
  surfacing as `e2e-explorer-launch-error-<code>`. **Native — inert until the
  rebuild.** No flow launches with a bad input to prove the marker appears; that
  flow is the next cheap act and is deliberately not written blind.
  `docs/LAUNCH_DIAGNOSTIC_REFUSAL_BOUNDARY_2026-08-10.md`.
- **THE UI MERGE — SLICES 3, 4 AND 5 ARE NEXT.** Slice 2 landed at `25565430`.
  Slice 4's modifiers strip is HELD by Sam's own excusal until the coach page has
  a home for it. Plan:
  `docs/UI_MERGE_PLAN_2026-08-10.md` · rulings:
  `docs/UI_MERGE_RULINGS_2026-08-10.md` · her signed prototype:
  `docs/design/LFA_UI_PROTOTYPE_2026-08-10.html`.
- **THE SEEDED WORLD IS NOT DURABLE** — 4 game days in memory, 1 on disk — and
  six flows stay red behind it.
- **THE DAY NAME IS READ BY DOORS, NOT JUST SHOWN** — the move gate and the
  repair both read it, so a combined day's conditioning has no name to carry.
  Read, never run: `docs/DOES_THE_DOOR_READ_THE_NAME_2026-08-10.md`.
- **THE OLD EXPOSURE RULES ARE CUT FROM GENERATION BUT STILL RUN IN THREE OTHER
  PLACES** with no guard — measured open, not claimed fixed. `2ec4d49b` ·
  `docs/V1_EXPOSURE_CONTRACT_CUT_2026-08-10.md`.
- **COACH REBUILD:** slices 1+2+3 landed; **S4 (*it knows how you're tracking*)
  is NOT started.** The journal's behind-the-scenes record — load, regions, feel,
  niggles — is an INPUT to it; that is why the journal data layer stayed live and
  every journal suite is pinned in the chain.
- **STILL OPEN, NOT ANY UNIT:** ~150 `label:` strings across 20+ `utils`/`rules`
  modules invisible to both copy gates; legacy `JournalStack`/`JournalHome`/
  `RouteEnum.JOURNAL` type-only debt; **no instrument distinguishes "shipped"
  from "shipped and reachable"**.
- **DEFERRED, NOT FORGOTTEN:** coaching QUALITY — *"labels are okay but the
  programming is pretty shit"*, `docs/COACHING_QUALITY_EXHIBITS_2026-08-07.md`.

## CONVENTIONS

- **Inbox:** an empty queue is written `(none)`. Numbering does not matter in
  either direction (`f168b48b`) — the stop hook reads content. Seat orders are
  1, 2, 3, newest first; urgency belongs in the words.
- **A seat order is as short as it can be and still be unambiguous.** Receipts
  belong in the boundary report, not in the order.
- **Reports to Sam:** `CLAUDE.md` governs — what happened, what's next, what to
  send. **The ceremony moves to the docs; it does not shrink.**

## WHERE THE HISTORY WENT

- `docs/NOW_HISTORY_TO_2026-08-10.md` — this file's entire prior contents.
- `docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md` — every processed seat order.
- `docs/STOP_INBOX_QUEUE_2026-08-10.md` — the live law-guard queue.
