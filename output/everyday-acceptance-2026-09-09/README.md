# Everyday-use acceptance walkthrough — 2026-09-09 — NOT STARTED (disk full)

Commit under test: `326ef8ab` (app code identical to `017818cc`). Seat: `everyday`. Mode: review only.

## Status: BLOCKED — the Mac's disk is 100 % full

| item | result |
| --- | --- |
| `npm run qa:audit-flows` | NOT RUN — the shell could not even open its output file (`ENOSPC`) |
| Journey 1 fresh install → first week | NOT REACHED |
| Journey 2 view the plan vs PDF/engine | NOT REACHED |
| Journey 3 log training | NOT REACHED |
| Journey 4 make changes | NOT REACHED |
| Journey 5 coach | NOT REACHED |
| Journey 6 reopen after 3 and 4 | NOT REACHED |

**Verified facts.** `/System/Volumes/Data`: 460 GiB, 425 GiB used, 110 MiB free at the moment of failure; 1.3 GiB free after I removed my own simulator, Metro and scratch app copy. A fresh simulator carrying the app measured 1.0 GiB before any screenshot. Consumers measured (none mine): the 46 GB candidate worktree `/private/tmp/lfa-ui-programming-integration-20260909`, 81 GB of simulators (21 shut down), 22 GB of Xcode DerivedData, five 3 GB `lfa-*-phone-*` build dirs.

**Inference.** Running the walkthrough on 1.3 GiB would fill the disk again mid-run and break the other three sessions' Metro servers.

**Untested claims.** None about the app. No screen was read; no verdict on the app is given here.

Details and the exact undo steps: `docs/STATUS_EVERYDAY.md`. This file will be rewritten with the six journeys once space is freed.
