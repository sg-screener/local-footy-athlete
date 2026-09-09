# STATUS — everyday (final everyday-use acceptance walkthrough on the simulator)

Seat: `everyday` (Fable). Mode: review only, no app-code edits. Task: Sam, 2026-09-09 — walk the six everyday journeys on the simulator at `326ef8ab` (app code = `017818cc`), run `npm run qa:audit-flows`, record PASS/FAIL per journey with screenshots in `output/everyday-acceptance-2026-09-09/README.md`.

## 2026-09-09 (morning) — was BLOCKED-BY: sam (disk full) — CLEARED at 16:20, see the walkthrough section below

**What happened.** Read the four required docs. Copied the newest app bundle (built 2026-09-09 03:44 on `81D9747A`, native inputs unchanged since `77f5e415` 2026-08-09) into a NEW simulator `LFA Everyday 326ef8ab` (`3580E21D-…`), started my own Metro on `:8093`, launched the app. The next command failed with `ENOSPC: no space left on device`; every tool (Bash, Maestro MCP, simctl) then failed the same way. Measured with the one execution path that still worked (a background Monitor): `/System/Volumes/Data` 460 GiB, 425 GiB used, **110 MiB free**.

**What I undid (my own footprint only).** Killed my Metro on `:8093`, removed my scratch copy of the app bundle, deleted my simulator (`rm -rf` of its data dir, then `simctl delete` — `simctl delete` alone refused for lack of space). After: **1.3 GiB free**, still 100 %. The three Metro servers from this folder (`:8085`, `:8091`, `:8092`), the `:8081` server from `/private/tmp/lfa-hingecod-8d68`, the four booted simulators and the 11 h-old Maestro driver on `81D9747A` were not touched.

**Why I stopped.** A fresh simulator with the app measured 1.0 GiB before a single screenshot; Metro's first bundle, the simulator's own caches and ~80 screenshots would push the disk back to zero mid-run and starve the other three sessions. Everything left to free belongs to other seats or the system, so the choice is Sam's.

**Measured consumers (not mine, not deleted):**
- `/private/tmp/lfa-ui-programming-integration-20260909` — 46 GB (the combined-candidate worktree; its evidence is in the separate `/private/tmp/lfa-combined-verify-20260909`).
- `~/Library/Developer/CoreSimulator/Devices` — 81 GB across ~25 simulators; 21 are shut down (`LFA Explorer …`, `LFA Shell R123`, `LFA RIR Section QA`, `LFA PhonePass 74045cc1`, `iPhone 16e` 7 GB, `LFA Explorer 4c8535f` 9 GB …). Booted: `iPhone 17 Pro` 13 GB, `LFA Explorer 3589b53`, `LFA Audit b2f927ee`, `LFA Progress Preview`.
- `~/Library/Developer/Xcode/DerivedData` — 22 GB, seven `LocalFootyAthlete-*` build folders (7.2, 3.6, 2.1 ×4, 2.0 GB).
- `/private/tmp/lfa-*` — five `lfa-*-phone-*` build dirs at 2.8–3.3 GB each, a dozen `lfa-bisect-*` and other scratch worktrees, hundreds of logs (2026-09-02 → 09-09).

**Environment facts recorded.** `npm run qa:audit-flows` cannot pass its own preflight as written: `scripts/audit-flows.sh` calls the runner without `--device`, and `maestro-device-preflight.cjs` exits 65 without one; the preflight also refuses while ANY other simulator has a live Maestro driver (`81D9747A` has had one for 11 h). Plan when unblocked: run the pack as written (record its exit), then each flow through the Maestro MCP on my own simulator (one Maestro door per simulator).

**Journeys walked: 0 of 6. Regression flows run: 0 of 6.** Nothing is PASS, nothing is FAIL, everything is not reached — because of the disk, not the app.

**WHAT TO SEND (Sam):** which of the consumers above may be deleted (my recommendation: the 46 GB candidate worktree, whose code is now this folder's HEAD and whose evidence lives elsewhere, plus the shut-down `LFA Explorer …` simulators from July/August). I will not delete another seat's files without that word.

## 2026-09-09 — the walkthrough, done (report: `output/everyday-acceptance-2026-09-09/README.md`)

Sam freed the disk (46 GB candidate worktree removed by me on his word, 21 shut-down simulators and the pre-08 audit outputs removed by him; 128 GB free after). New simulator `LFA Everyday 326ef8ab` (`3680ABE7-…`), app bundle copied from `81D9747A`'s container, my Metro on `:8093`.

**Instruments.** The Maestro MCP was proven to read ANOTHER simulator (its screenshot = `81D9747A`'s home screen; that device has held a Maestro XCTest driver for 12 h) and the repo runner's preflight refuses while that driver lives, so every screen was driven with the Claude iOS Simulator tool (coordinate taps) and every reset/reload with the app's own launch switches (`-e2eSeedId`, `-e2eLaunchPurpose initial-cold-launch|action-reload`, the `localfootyathlete://e2e/checkpoint/<seed>` link). Storage read from the simulator's AsyncStorage manifest after each step. Engine oracle: seeds installed headlessly through `createDefaultDevE2ESeedCoordinator(true).reset()` and projected with `deriveVisibleWeekLive` + `buildSessionTemplate` (the PDF's row order and dose strings); onboarding replayed with `coldStartThroughOnboarding`; actions replayed with `executeProgramControlActionDurably` / `executeFixtureMutationTransaction` / `recordDay` (scripts in my scratchpad, outputs in the report folder).

**Result.** J1 PASS (engine reproduces the fresh week; F1 calendar header wraps on a 402 pt device). J2 PASS on content (every day's rows = engine template rows; F2: Day card prints raw names / no "/ side" / other timed-dose strings while the session screen and the PDF print the display names). J3: strength log PASS (110 kg, RIR, stored and survives reload), conditioning PASS, **"missed" FAIL (F3: a session logged with nothing done reads "Session complete"/DONE — `HomeScreenV2.tsx:2637` counts any feedback as completed)**. J4: **remove+undo FAIL (F5: no undo toast ever; F6: a whole-day removal rewrote today's logged session and detached the log — engine replay reproduces the rewrite)**, swap PASS with a one-step-late render (F7), move game PASS (F8: the removed Gunshow reappears on the new G−1 WITH ZERO EXERCISES — also visible in `spent-week-friday`'s Friday; F9 board overlap), injury report+clear PASS, tired PASS, away+return PASS. J5 coach PASS on behaviour, F14 grounding (invents a Sunday game and "readiness recorded as flat"). J6 reopen PASS after the logs and after the plan edits, **FAIL after injury→clear/tired/away→return (F13: harness refusal, persisted `coach-updates` ≠ memory)**. Flows: pack as written exit 1 0/6 at preflight (F4 tooling); by hand block-rollover PASS, removal-undo-home PASS, readiness-ack PASS on the card, bin-undo-toast FAIL, week-move-game PASS on the move, full-reset PASS.

**WORKING / BUILT / WRITTEN for the findings:** all fourteen are WRITTEN here with screenshots and storage dumps; none has a cell yet — the guards named in the report's table are the ones that should have caught F3/F5/F6/F13/F14 and did not, which is itself a finding for whoever owns them. No app code changed. No ruling re-asked (REGISTRY-GREP: R-271 for the missing "Game moved" card — honoured; R-291 family for F2; R-354 family for F6; R-236 for F8 — F8 needs Sam's word, everything else is a plain defect).

**Loop-audit:** three things happened three times — sheets ignoring the first tap, confirmations lagging 5–40 s behind the store, and a logged/removed day being rewritten by a later action. Each is written once in the report as a class, not per occurrence.

NOT COVERED: the Maestro YAML flows as YAML; "move it back"; the past-day missed prompt (structurally unreachable in seeds); the PDF's week 1 on the phone (different start date); a second reproduction of F13; Sam's real phone; mail; cloud sync.

My simulator and my Metro on `:8093` are left running for Sam to look at; both are mine to stop.
