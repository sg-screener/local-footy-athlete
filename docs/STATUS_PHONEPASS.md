# STATUS — seat `phonepass`

Physical-iPhone acceptance pass for the three merges on `main`. **Verification
only.** No product file was edited; no branch was merged; no suite was re-run.

## 1. WHAT IS ON `main` — CONFIRMED BEFORE BUILDING

`main` @ `01306539`. Product tree (`src/`, `ios/`, `package.json`, `app.json`)
is **exactly** `main` — the only dirty files are `docs/printed-weeks/*.md` and
two `.fuse_hidden*`, all left untouched.

| ordered | present | evidence |
| --- | --- | --- |
| shared panel for all five actions | YES | `2798d6e7` R-123, `src/components/SessionActionSheet.tsx`; the only three call sites are `DayWorkoutScreenV2`, `GuidedInjuryFlowSheet`, `SessionEquipmentSheet` |
| session-level Injury fallback | YES | `68918d47` R-124, `src/utils/injurySessionAdjustment.ts` (746 new lines) |
| the two signed headings | YES | `01306539`, `src/rules/projectionCopy.ts:726` `PAUSED — YOUR` + `:732` `ADDED INSTEAD`, both `source: 'sam_ruling'` |

## 2. THE BUILD

Clean Release build, fresh derived-data path in scratchpad, `BUILD SUCCEEDED`,
0 errors.

- `main.jsbundle` **9.1 MB embedded** — standalone, does NOT need Metro. This
  was checked on purpose: a Release build that still reaches for Metro is
  useless on a phone off the dev network.
- Signed `Apple Development: Samuel Geurts`, team `66M7FZ6G37`, id
  `com.localfootyathlete.app` — matches the one provisioning profile
  (`iOS Team Provisioning Profile`, expires 2027-08-08).

## 3. THE DEVICE — AND THE TWO THINGS THAT NEEDED SAM

**⚠ TWO PHYSICAL IPHONES ARE PAIRED WITH THIS MAC AND BOTH ARE IN THE
PROVISIONING PROFILE.** `Renee's iPhone` (iPhone 17 Pro,
`00008150-000C159E3C38C01C`) and an unnamed `iPhone` (iPhone 16 Pro Max,
`00008140-000975CC022A801C`). **A seat that installs without asking has a 50%
chance of pushing a build to someone else's phone.** Sam confirmed the
iPhone 16 Pro Max, 2026-08-21.

**⚠ `devicectl` REPORTS A LOCKED PHONE AS A DEVELOPER-DISK-IMAGE FAILURE.** The
first probe returned `CoreDeviceError 12040 — the developer disk image could
not be mounted`, which reads as a broken Xcode/DDI setup. The real reason was
four levels down the error: `kAMDMobileImageMounterDeviceLocked: The device is
locked.` **Read the innermost line of a devicectl error before diagnosing the
toolchain.** It cleared the moment the phone was unlocked, with no change to
anything on this Mac.

Install: **in-place upgrade, data preserved.** `1.0.0` build `1` was already
installed; `devicectl device install app` returned a new bundle container and
exit 0 with no delete required. Launched, and still in the process list 8s
later — it does not crash on boot.

## 4. WHAT THIS PASS DOES *NOT* PROVE

**The ten contracts are athlete-facing and are Sam's to confirm on glass.**
Per R-033 the phone is the LAST instrument, so nothing here substitutes for it.
Two contracts were additionally read at the code level while the build ran, and
that reading is a structural claim only, not a device result:

- **[5] no fake one-to-one arrows** — `DayWorkoutScreenV2.tsx:4028`: the `→` is
  drawn ONLY in `review.changes.map`. The paused section renders
  `change.from` alone, so it **structurally cannot** draw a partner.
- **[7] SKIP instead of a checkbox** — `DayWorkoutScreenV2.tsx:2640` renders the
  `SKIP` text under the ruling at `:2621`.

The simulator walks for the shell (3 Maestro flows) and the injury fallback
(knee review + two-injury flow) were already green at merge and were **NOT**
re-run, per the order.

Agent: phonepass
