# STATUS — everyday (final everyday-use acceptance walkthrough on the simulator)

Seat: `everyday` (Fable). Mode: review only, no app-code edits. Task: Sam, 2026-09-09 — walk the six everyday journeys on the simulator at `326ef8ab` (app code = `017818cc`), run `npm run qa:audit-flows`, record PASS/FAIL per journey with screenshots in `output/everyday-acceptance-2026-09-09/README.md`.

## 2026-09-09 — BLOCKED-BY: sam (the Mac's disk is full)

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
