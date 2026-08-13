# PROGRESSION — your own status file. ONE WRITER: you.

**NAMED 2026-08-13.** The seats are named for WHERE they live (`terminal` — the
rules engine; `desktop` — screens and flows) or WHAT they do (`audit` — it does
not believe a claim until it has measured it). This one is named for its LANE:
**strength progression — `progressionRules.ts`,
`strengthProgressionIntegration.ts`, and the authored dose they spend.**

**WHY NOT `audit`.** This session began holding the `audit` memory. While it
worked, **another live session committed as `Agent: audit`** — `15d32ef2`,
`63fe3fba`, `d7953e9d` — so stamping `audit` here would have put two concurrent
seats behind one name, which is the exact ambiguity the stamping rule exists to
end. Renamed rather than collided. **`docs/STATUS_AUDIT.md` is NOT mine to
write** and was left alone.

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: progression`.**

---

## STATUS

### THE UNIT: the authored dose is spent by a layer that had floors and no ceiling

**THE ORDER.** The authored dose is enforced at generation, then
`applyStrengthProgression` re-writes it with floors only and no ceilings — a
beginner is moved to 4 sets after three clean sessions, and reps can drop to 3,
below Sam's minimum of 4.

**BOTH HALVES REPRODUCE. Measured before anything was changed**, by authoring a
lower main lift exactly as generation would for each phase band and running the
real `applyStrengthProgression` over it:

| case | authored band | generation | progression | breach |
| --- | --- | --- | --- | --- |
| early off-season, 3 clean sessions | 2-3 x 8-12 | 3 x 8-12 | **4** x 8-12 | **sets over max** |
| the same, plus the adaptation volume nudge | 2-3 x 8-12 | 3 x 8-12 | **5** x 8-12 | **sets over max** |
| pre-season, deload | 2-4 x **4**-6 | 3 x 4-6 | 1 x **3**-4 | **reps under min** |
| off-season, deload | 2-4 x **6**-8 | 3 x 6-8 | 1 x **4**-6 | **reps under min** |

**AND THE SETS HALF IS NARROWER THAN THE ORDER STATES, WHICH MATTERS.** Three
clean sessions add a set in EVERY phase — but pre-season and off-season author a
maximum of 4, so landing on 4 is legal progression inside Sam's own 2-4. **The
only band with a maximum of 3 is `early_offseason`**, so that is the only place
the fourth set is a breach. It is not an exotic case: `resolveOffseasonSubphase`
**returns `early_offseason` whenever phase-clock context is missing**, by design
("missing phase-clock context must choose the least aggressive policy").

### ⚠ THE REASON IT SURVIVED: THE SUITE NAMED FOR THIS MODULE HAS BEEN DEAD SINCE 2026-07-28

`test:strength-progression-integration` **crashed at import** —
`TypeError: classifyExerciseRole is not a function`. `77ccb6dc` (2026-07-28)
renamed that export to `classifyProgressionEligibility` and did not update the
suite, which calls it 14 times. **693 lines of cells, ZERO assertions executed,
for sixteen days.** Revived by the rename; it then reported **93 passed, 0
failed** — so nothing had rotted behind the crash, and the whole cost of the
outage was that this defect had no guard.

**THE SHAPE TO CARRY FORWARD:** a suite that dies at IMPORT reports no failures,
and a chain that reads exit codes cannot tell it from a suite that has no cells.
`scripts/sweep.sh` counted it among its passes.

### WHAT LANDED

**THE RULE, one sentence:** **the authored band is the boundary — progression
moves within it, and where a row already sits outside it progression may not
push it further out.**

- **`phaseRepSchemes.ts` gains `mainLiftSchemeForSlot`**, moved verbatim out of
  `defaultProgram.ts`. **ONE OWNER, TWO READERS** — generation reads it to WRITE
  the prescription, progression reads it to know the boundary. A copy beside the
  second reader is how two answers to "what is the authored dose" start drifting.
- **`applyDelta` takes the band** and clamps. **The two rules are deliberately
  NOT symmetric:**
  - **sets: a CEILING and no band floor.** Nothing authorises more sets than the
    phase allows. Going BELOW the minimum IS authored — **R-034 halves the
    sets** — so clamping up to `setsMin` would put this function in the deload
    law's way. The 1-set floor is untouched.
  - **reps: held inside the band both ways.** The invented `Math.max(3, …)` is
    gone.
  - **the bound WIDENS to admit a row already outside the band**, so
    `quality_low_volume`'s 2x3 (exempt from the phase scheme by ruling) is not
    "corrected" by a second owner.
- **`band` is null for any row generation did not dose from this table** — the
  condition MIRRORS generation's (`anchor` in a main-lift slot) line for line, so
  a lunge is never bounded by the squat's numbers. Accessories keep the old
  floors, which is the honest answer rather than a borrowed band.
- **The subphase reaches progression with NOTHING NEW STORED OR DERIVED.**
  `ProgramBlockState` already carries `phaseResolution`, and
  `buildProgressionContext` already receives the block state — so it reads the
  CLOCK's answer (the ruled owner of season phase) rather than deriving a second
  one. `sessionResolver.ts` needed no change at all.

**`progressionRules.ts` NEEDED NO CHANGE, and that is a finding, not an
omission.** It is dimensionless — it emits `add_one` / `big_down`, never a
number. The dose is spent in the integration module, so a ceiling written into
the rules file would have been in the wrong layer.

### WORKING — the cells that fail if this breaks

`test:strength-progression-integration`, section 21, **104 passed / 0 failed**
(93 revived + 11 new). Non-vacuity first throughout.

| cell | holds |
| --- | --- |
| `[21a]` | three clean sessions really do ask for a set (else every ceiling cell is vacuous) |
| `[21b]` | sets stay within the authored maximum |
| `[21c]` | **and the ceiling is not a freeze** — a band with room still earns the 4th set |
| `[21d]` | the adaptation volume override cannot cross the ceiling either |
| `[21e]` | reps hold Sam's authored minimum, on a row proven to be on a deload |
| `[21f]` | a row below the band keeps its own reps — the band bounds, never overwrites |
| `[21g]` | **a deload still cuts sets below the authored minimum** — R-034 not broken |
| `[21h]` | the band reaches the LIVE path — real block-state producer, real context assembler |

**MUTATION-PROVEN, five mutants, each killed by the intended cells:**

| mutant | killed by |
| --- | --- |
| sets ceiling removed | `[21b]` `[21d]` `[21h]` |
| reps floor back to the invented 3 | `[21e]` + the overturned deload cell |
| band ignores the off-season subphase | `[21b]` `[21d]` `[21h]` |
| band DRAGS an out-of-band row in | `[21f]` |
| sets clamped UP to `setsMin` | `[21g]` |

**The third mutant is the one worth keeping:** it proves the subphase plumbing is
load-bearing rather than decoration.

### THE WIDER RUN — AND WHY IT IS A TARGETED ARM, NOT `sweep.sh`

**`scripts/sweep.sh` IS NOT A USABLE INSTRUMENT IN THIS CHECKOUT TODAY, AND
THAT IS A MEASUREMENT, NOT AN EXCUSE.** My arm ran at `8205ae36` (51 of 209
red); the control ran after **eight further commits from other seats landed**
and another agent's uncommitted edits appeared in the tree
(`resolverDisplacementSweepTests.ts`, `exercisePoolsStrength.ts`, an untracked
`codProbe.probe.ts`). **The two arms did not see the same world**, so their
totals cannot be differenced — the instrument-fault-in-both-arms shape.
**Twenty-four commits from other seats landed during this unit.**

**REPLACED BY A TARGETED ARM RUN BACK TO BACK WITH NO COMMITS IN BETWEEN**, over
every suite that imports the three modules I changed, plus the deload and dose
suites the rule touches. **The two arms differ in my four files and nothing
else. ONE LINE OF DIFFERENCE:**

    < FAIL test:strength-progression-integration     (control: crashes at import)
    > PASS test:strength-progression-integration     (mine: 104/0)

`test:strength-progression-inputs` · `test:variation` · `test:block-rollover` ·
`test:row-counting` · `test:bible-anchors` · **`test:deload-law`** ·
`test:deload-week` · `test:game-feedback` · `test:recovery-template` ·
`test:rules-kernel` · `test:session-template` — **all green in BOTH arms.**

**TWO SUITES ARE RED IN BOTH ARMS AND ARE NOT MINE** — they red identically with
my four files at `HEAD`: `test:block-state` (*"legacy feedback survives
hydration unchanged"*) and `test:session-outcome-parity` (100/1). **Named, not
absorbed, and not claimed as fixed.**

**`npm run test:compile` PASSES** — no file regressed; the tests scope came back
**one better** than baseline (373 against 374).

### ⚠ ONE EXISTING CELL WAS OVERTURNED — NOT RELAXED, AND NOT EDITED TO MATCH MY CHANGE

Section 7 asserted `prescribedRepsMin === 3`: **a deload cuts main-lift reps by
two.** It reds under the fix. It was replaced by the OPPOSITE claim with its
authority attached, rather than loosened:

**`DELOAD_LAW` (`rules/deloadWeekRules.ts:35`, R-034, held by `test:deload-law`)
is the signed transformation and it HAS NO REP TERM.** It halves sets
(`mainLiftSetMultiplier: 0.5`), drops RPE to 5-6, and **HOLDS load** unless the
athlete is beat up. A rep cut is a reduction no door authored — the exact class
that law exists to end — and `deloadPowerDose` says so in as many words: *"it is
the volume that drops"*. **The cell had not executed since 2026-07-28, so it was
never a guard holding that behaviour in place.**

### ⚠ WHAT IS NOT FIXED — NAMED SO IT IS NOT MISTAKEN FOR CLOSED

**`applyStrengthProgression` IS A SECOND OWNER OF DELOAD DOSING, AND IT
DISAGREES WITH THE LAW IT IS SHADOWING.** Bounding the band does not settle
this, and it is bigger than this unit:

| | `DELOAD_LAW` (R-034) | `applyStrengthProgression` |
| --- | --- | --- |
| sets | HALF (`0.5`), floor 1 | `drop_two` — **a 3-set day goes to 1, the law says 2** |
| load | **HOLDS**; 0.9 only if beat up | flat `0.7`, unconditional |
| reps | **no term at all** | `-2` on `big_down` |

The law's own comment on `beatUpLoadMultiplier` says the drop *"is not an
unconditional multiplier — which is what the code did before this law"*. **That
sentence describes this module today.**

**A visible consequence that remains:** a deload still pulls `repsMax` down to
the band floor, so a 4-6 pre-season lift deloads to 4-4 and is shown as "4"
rather than "5" (R-016 shows one middle number). Inside the band, so not a
breach — but it is the rep term that R-034 does not have.

**NOT SENT TO SAM. Nothing here needs a ruling** — R-034 already decided it; the
question is which module obeys it.

### FOR WHOEVER TAKES THE NEXT ONE

1. **The deload second-owner unit above.** One module should dose a deload.
2. **`test:qa` and `test:scenarios` CANNOT SEE THIS CODE.** A probe at the top of
   `applyStrengthProgression` fired **ZERO** times under both, while the same
   probe fired 9 times under `test:strength-progression-inputs`. **The corpus
   suites do not reach the live progression path at all**, so "scenarios green"
   is not evidence about anything in this lane. Same shape the terminal recorded
   for item 34's drift branch.
3. **`sed -i` SILENTLY NO-OPS IN THIS CHECKOUT.** It exits 0 and changes nothing
   (the `.fuse_hidden*` files are the tell — it is a FUSE mount). Use an editor
   that reads the file back. This cost one wrong "the suite is still broken".
4. **`git status` lied again**, exactly as recorded: it showed
   `sessionResolver.ts` as `MM` while the file was **byte-identical to HEAD**.
   `cmp` against `git show HEAD:<path>` before believing you are blocked.
