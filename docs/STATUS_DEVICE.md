# STATUS — seat `device`

**One name, one file, one writer.** Started 2026-08-13. `ls docs/STATUS_*.md`
returned ARMS / AUDIT / COMPOSER / DESKTOP / GUNSHOW / PACE / PATTERNS /
PROGRESSION / READINESS / TERMINAL — `DEVICE` was free. Item 62 claimed by
stamping this name on its head line, as the item instructs.

---

## 2026-08-13 — THE APP DID NOT START, AND IT WAS NOT A PRODUCT BUG

### WHAT WAS BROKEN

`npm run lfa:dev` ran cleanly and launched the app — **and the app opened on a
refusal screen, not on Sam's program:**

> **The app did not start**
> A development check refused before the app could load. This is the test
> harness, not your training data — nothing of yours has been lost.
> `DevE2EClock reload mismatch: clock receipt has no active checkpoint.`

**So the startup command was already "working" by its own report while being
useless to him.** That gap is the whole of item 62.

### THE DIAGNOSIS, MEASURED FROM THE SIMULATOR'S OWN STORAGE

`restoreDevE2EClockBeforeHydration` (`devE2EClockPersistence.ts:108`) throws on
exactly one condition: **`receipt && !checkpoint && !scenarioSession`.** I read
the simulator's AsyncStorage manifest directly rather than inferring:

| key | present |
| --- | --- |
| `dev-e2e-clock-receipt-v1` | **YES** |
| `dev-e2e-checkpoint-v2` | **NO** |

**That is the throwing condition character for character.** A Maestro run writes
a durable clock receipt; its checkpoint is cleared when the run ends; the next
PLAIN launch — *the way Sam opens the app* — finds a receipt with nothing to
match it against.

**This is already recorded as law**, in `lawRegistry.ts:645`, as the white screen
Sam hit at 19:22 after a rebuild. The refusal surface built then made the reason
SPEAK; nothing made it stop happening. **`test:qa`, `test:bible` and every source
cell were green throughout — there is nothing wrong with code that did not run.**

### THE LOOP I HIT BEFORE FIXING IT, RECORDED BECAUSE IT LOOKS LIKE PROGRESS

**refusal → tap "Clear test-harness state and start" → WHITE SCREEN → reseed
through `run-maestro-ios.sh` → refusal again.** Three of the four steps look like
they are working. The on-screen clear does not survive the next launch, and the
seed run re-strands the receipt on its way out.

### THE FIX — IN THE ONE SCRIPT, NOT A SECOND ONE

`scripts/qa-start.sh` gains a step before launch: **if the clock receipt is
present and the checkpoint is absent, delete the `dev-e2e-*` keys and say so.**

- **It removes ONLY `dev-e2e-*` keys, and ONLY when stranded.** `program-store`,
  `profile-store`, `calendar-storage` and the other 11 athlete keys are never
  touched. **Wiping a week to fix a harness is how a "reset" becomes the thing
  nobody dares run.**
- **A coherent harness state is left ALONE** — a real seeded session has both
  halves, and this must not eat it.
- **No second script**, per the standing rule the skill states and
  `test:repo-law-guards` enforces: if startup needs to behave differently, the
  flag goes in that file.

**PROVEN BY RECREATING THE FAILURE, not by asserting the fix.** I wrote a
stranded receipt back into the simulator's manifest, confirmed the broken state
(`receipt present = true, checkpoint present = false`), ran the one command, and
it printed:

```
[lfa:dev] Cleared a STRANDED dev-harness receipt (a Maestro run left it behind):
[lfa:dev]   dev-e2e-clock-receipt-v1
[lfa:dev] Your training data was not touched.
```

…and the app came up on the Program screen. **Screenshot-verified both times.**

### WHAT I COULD NOT REACH, PLAINLY

**A SIMULATOR IS NOT HIS PHONE, AND I ONLY REACHED A SIMULATOR.** Installing on
his device needs Xcode signing and the phone plugged in, and neither is mine to
do. **Everything above is proven on `LFA Explorer 4c8535f` (iOS 26.3) and
nowhere else.**

**⚠ AND ONE OBSERVATION I DID NOT ACT ON:** the Metro serving `:8081` was started
as `expo run:ios --device --configuration Release`. It serves this checkout and
the dev build attached to it fine, but **the skill says Debug, never Release**,
and a Release-built app would not carry the dev harness at all. Named, not
touched — it is working, and changing another seat's running Metro mid-session is
not worth the risk.

### NOT MINE, FOUND ON THE WAY

`test:repo-law-guards` gained a third red: *"no source-reading cell gains an
unproven anchor"*, naming **`vocabularyCrosswalkCensusTests.ts`** — the census
suite I wrote as `arms`. **The anchor is NOT in the committed version** (HEAD has
zero `indexOf`; the working tree has one, and the file has grown 291 → 460 lines).
**Another seat is extending that suite right now, uncommitted, and the new cell
carries the unproven anchor.** Left alone; named here so its author sees it.
`existingWeekProofTests.ts` carries the other one and is not mine either.
