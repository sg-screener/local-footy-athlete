# Group C — Accessibility/testID Ownership Plan — 2026-07-23

**Status: DRAFT for review — design only, not approved.** No application code
has been changed to produce this document. This plan covers **Group C only**
(`docs/audits/GROUPCD_WORKLIST_2026-07-22.md`); Group D items are explicitly
out of scope (§5).

---

## 1. Root cause, restated precisely

Five shared option/row components accept a `testID` prop intended for
Maestro/E2E automation (`explorerTestId.*`, `src/utils/stableTestId.ts`) and
then also feed that same string into `accessibilityLabel` — the string a
screen reader actually speaks. There are two variants of the same mistake:

- **Direct assignment** — `accessibilityLabel={testID}`. No fallback exists;
  if `testID` is set, the internal id **is** the label, unconditionally.
  - `SheetOption` (`HomeScreenV2.tsx:1967-1974`)
  - `FlowOption` (`GuidedInjuryFlowSheet.tsx:311-344`)
  - `EquipmentOption` (`EquipmentLimitationSheet.tsx:64-80`)
  - Several inline (non-component) call sites in `HomeScreenV2.tsx` that skip
    a shared wrapper entirely and set `accessibilityLabel` straight to an
    `explorerTestId.*(...)` call or a template string.
- **`?? label` fallback that never gets a chance to fire** — the fallback
  only helps when `testID` is `undefined`. Every call site that *does* pass a
  `testID` (which is most of them, since these are exactly the rows Maestro
  needs to target) still gets the id as its label.
  - `MenuOption` (`PlanChangeSheet.tsx:1112-1124`)
  - `ExerciseSheetOption` (`DayWorkoutScreenV2.tsx:2600-2606`)

**Load-bearing discovery: the existing test suite pins the bug as a
contract.** `src/__tests__/accessibilityWrapperContractTests.ts` section
`[5]` ("Explorer semantic leaves and lifecycle controls are accessible")
currently asserts, as *passing* tests:

```
'SheetOption keeps semantic IDs as accessibility labels',
  /function SheetOption[\s\S]*?accessibilityLabel=\{testID\}/.test(home)
'injury options expose their stable identity to accessibility',
  /function FlowOption[\s\S]*?accessibilityLabel=\{testID\}/.test(injury)
'equipment options expose their stable identity to accessibility',
  /function EquipmentOption[\s\S]*?accessibilityLabel=\{testID\}/.test(equipment)
'fixture expanded action exposes the canonical fixture identity',
  /accessibilityRole="button"[\s\S]*?accessibilityLabel=\{explorerTestId\.fixtureIngress\('move', ...\)\}/.test(home)
```

This file is why the bug has survived: it is a green test actively asserting
the wrong behavior, under the banner of "accessibility contracts." Any fix
must **invert these four assertions**, not just change the components — the
existing file is part of the root cause, not a bystander.

**By contrast, `src/components/ui/Button.tsx` already does this correctly**
(and its own contract test at section `[2]` pins the correct behavior):
`accessibilityLabel={accessibilityLabel ?? label}`, `testID` kept as a fully
separate prop that never feeds the label. Button is the existing in-repo
precedent for the convention this plan generalizes — this is not a novel
pattern, it is bringing five components in line with one that already ships
correctly.

---

## 2. The single systemic fix

**Convention:** every option/row component in this family takes a required
`label: string`, uses it (or an explicit `accessibilityLabel` override, same
shape as `Button`) as `accessibilityLabel`, and `testID` is wired *only* to
the native `testID` prop. `accessibilityLabel={testID}` and
`accessibilityLabel={testID ?? label}` become structurally impossible.

Concretely, for each of the five components:

```ts
function XOption({ label, testID, accessibilityLabel, onPress, ... }: {
  label: string;
  testID?: string;
  accessibilityLabel?: string;   // rare override, matches Button's shape
  ...
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      ...
    >
```

This is **not a per-call-site patch** — every one of the ~20 call sites
across these five components gets the fix automatically once the shared
component signature changes, because (per §3 below) every call site already
passes a `label` prop with real, already-rendered copy. Zero call sites need
new authored copy; this is 100% "wire the label already on screen through,"
0% "invent new strings."

`testID` remains untouched in shape, value, and construction —
`explorerTestId.*` continues to produce exactly the same strings, Maestro
flows (`.maestro/common/*.yaml`, `.maestro/golden/*.yaml`) select elements by
`id:` (native `testID`) exclusively, e.g. `tapOn: { id: "day-row-mon" }`,
`tapOn: { id: "plan-change-edit-session" }` — never by accessibility text.
Automation is unaffected by this change; it is entirely additive to what a
screen-reader user hears.

### Direct-assignment (non-component) call sites in `HomeScreenV2.tsx`

These never had a wrapper to fix — they wire `accessibilityLabel` straight
to `explorerTestId...` on a bare `Pressable`. Same fix, applied inline: stop
setting `accessibilityLabel` to the testID expression; set it to the
existing rendered `Text` content for that row (already computed a few lines
above/below each site in every case — see §3).

---

## 3. Full site-by-site migration list

All sites need only **(a) wire the already-visible label through** — none
need newly authored copy, because every call site already renders real text
adjacent to (or as) the label the fix requires.

| # | Site | Kind | Visible text to reuse |
|---|------|------|------------------------|
| 1 | `PlanChangeSheet.tsx` `MenuOption` def (~1112-1124) | shared component | n/a — fix signature |
| 2 | `PlanChangeSheet.tsx:640-642` "Edit this session" | (a) | `label="Edit this session"` already passed |
| 3 | `PlanChangeSheet.tsx:682-684` "Move this session" | (a) | `label="Move this session"` already passed |
| 4 | `PlanChangeSheet.tsx:690-692` "Bin this session" | (a) | `label="Bin this session"` already passed |
| 5 | `HomeScreenV2.tsx:1967-1974` `SheetOption` def | shared component | n/a — fix signature |
| 6 | `HomeScreenV2.tsx` readiness sheet main options (~2154-2205: tired_today, poor_sleep_today, poor_sleep_week, cooked_week, sore_today, sick_week, short_time) + injury entry | (a) | Each already passes a real `label` ("Just a bit tired today", "Poor sleep last night", etc.) |
| 7 | `HomeScreenV2.tsx:1852-1876` follow-up options (still_not_right, still_sick, still_cooked, worse) | (a) | Each already passes a real `label` ("Still not right", "Still sick", "Still cooked", "Worse") |
| 8 | `HomeScreenV2.tsx` `GameDaySheet` options ("Move Game Day This Week", "Remove Game Day", ~1963-1971) | (a) | `label` already passed |
| 9 | `HomeScreenV2.tsx` `BusyAwaySheet`, lighter-day-offer, active-adjustment `SheetOption`s | (a) | `label` already passed on every instance found |
| 10 | `HomeScreenV2.tsx:695-697` weekly "I'm not 100%" entry card (direct assignment) | (a) | Row already renders dynamic `Text`: "Not 100% today" / "Recovery mode this week" / "Not 100% this week" / "I'm not 100%" — reuse the same computed string |
| 11 | `HomeScreenV2.tsx:728-730` "Missing equipment?" entry card (direct assignment) | (a) | Row renders `Text` "Missing equipment?" |
| 12 | `HomeScreenV2.tsx:650` add-fixture entry (direct assignment) | (a) | Row renders visible practice-match copy nearby |
| 13 | `HomeScreenV2.tsx:1614` "Move or remove game day" (direct assignment) | (a) | `Text` "Move or remove game day" renders in the same `Pressable` |
| 14 | `HomeScreenV2.tsx:1690-1702` coach-note action buttons (direct assignment, incl. `program-active-coach-note-action-...` inline fallback) | (a) | `action.label` is already rendered as the button's own `Text` two lines below |
| 15 | `GuidedInjuryFlowSheet.tsx:274-279` injury trigger chips | (a) | The chip's own visible `Text` is `{trigger}` (e.g. "Sprinting", "Change of direction") — use `trigger` itself, no wrapper needed, no lookup table |
| 16 | `GuidedInjuryFlowSheet.tsx:324-344` `FlowOption` def, and its call sites (severity picker etc.) | shared component + (a) | Each call site already passes `label={option.label}` |
| 17 | `EquipmentLimitationSheet.tsx:64-80` `EquipmentOption` def | shared component | n/a — fix signature |
| 18 | `EquipmentLimitationSheet.tsx` preset call sites (~40-52) | (a) | `label={preset.label}` already passed |
| 19 | `DayWorkoutScreenV2.tsx:2600-2606` `ExerciseSheetOption` def | shared component | n/a — fix signature |
| 20 | `DayWorkoutScreenV2.tsx:2393-2411` "Today only" / "Future weeks too" (remove scope) | (a) | `label="Today only"` / `label="Future weeks too"` already passed — this closes the exact `future_scope`/remove asymmetry the worklist called out (swap/add siblings were already correct only because they happen to leave `testID` unset, not because the component was fixed) |

No site in this worklist needs newly authored copy (no "(b)" cases).

---

## 4. Test invariant(s) to write first

Two mechanisms, both concrete; recommend doing **both**, in this order:

1. **Fix the false-positive first.** Invert the four assertions in
   `src/__tests__/accessibilityWrapperContractTests.ts` §[5] that currently
   pin `accessibilityLabel={testID}` for `SheetOption`, `FlowOption`,
   `EquipmentOption`, and the fixture-move inline site. Replace with
   assertions that `accessibilityLabel` resolves from `label` (e.g.
   `accessibilityLabel={accessibilityLabel ?? label}` in the component
   signature, and the concrete rendered string at the fixture-move call
   site). Written and red *before* the component changes land — this is the
   regression test for the bug itself.

2. **Add a repo-wide static-scan invariant** (new test, e.g.
   `src/__tests__/accessibilityLabelTestIdConflationTests.ts`, following the
   exact house style of `accessibilityWrapperContractTests.ts` — plain
   `fs.readFileSync` + regex over `src/`, run via
   `sucrase-node`/`npm run test:...`, no renderer needed): grep every
   `.tsx` file under `src/` for the literal patterns
   `accessibilityLabel={testID}`, `accessibilityLabel={testID ??`, and
   `accessibilityLabel={` immediately wrapping an `explorerTestId.` or
   `stableTestIdToken(` call, and fail with the offending file:line if any
   match. This is the "prevents reappearing" guard — it fires on any *future*
   call site, not just the six sites known today.

**Which is more robust, and why:** the static scan (mechanism 2) is more
robust than a typed prop shape alone. A typed signature
(`label: string; testID?: string`, no `accessibilityLabel` derived from
`testID`) prevents the mistake *inside* these five components, but it cannot
stop a sixth component from being written next month with the same bug from
scratch, nor catch the bare-`Pressable` direct-assignment variant (sites
10-14 above have no shared component at all — a prop-shape fix doesn't touch
them). The grep-based test is the only mechanism that covers both the
component-API class of bug and the ad-hoc inline class, and it is exactly
the mechanism this repo already trusts for accessibility contracts (see
`accessibilityWrapperContractTests.ts` itself). Recommend: typed prop shape
for the five known components (belt), static-scan test for the whole tree
(braces) — the scan is the one that must never be skipped.

---

## 5. Non-goals

This plan is **Group C only** — the `testID`↔`accessibilityLabel`
conflation across `MenuOption`, `SheetOption`, `FlowOption`,
`EquipmentOption`, `ExerciseSheetOption`, and the direct-assignment sites in
`HomeScreenV2.tsx`.

**Explicitly out of scope** (Group D, same worklist, tracked separately):

- Dead-feeling "Leave Feedback"/"Ask a Human" buttons — `Linking.openURL`
  with no `.catch()`/`canOpenURL` guard, silently no-ops with no mail app
  configured (`ProfileScreen.tsx:713-723`).
- Raw ISO dates in athlete-facing copy (`planChangeProducer.ts:2033`,
  `coachActions.ts:536-539`).
- Raw internal error codes surfacing on the visible surface
  (`planChangeProducer.ts:1345`, `:1432`, `:1662`, `:1802-1809` — the last of
  these has no plain-language gate at all).
- The missing swap-to-Rest control (`PlanChangeSheet.tsx:667-698`,
  `:882-920`).

These should be worked as their own plan(s); do not fold them into this
change.

---

## 6. Open questions for Sam

1. **Enforcement mechanism:** should the static-scan invariant (§4.2) run in
   CI as a blocking test (added to `test:bible` or a dedicated `npm run
   test:...` script per this repo's convention), or is a dev-mode runtime
   warning (`__DEV__` console warn when `accessibilityLabel === testID`)
   also wanted as a second, in-app tripwire? Recommend the static test as
   the blocking gate; a runtime warning is optional belt-and-suspenders.
2. **Lint vs. test-file convention:** `package.json` has an `eslint` script
   and dependency, but no `.eslintrc*`/`eslint.config.*` was found in the
   repo root — is ESLint actually wired into CI/pre-commit anywhere, or is
   the grep-based `sucrase-node` test file (this repo's evident house style
   for these invariants) the intended permanent home for this check rather
   than a custom lint rule?
3. **Design-system layer:** is there an intended future shared
   `OptionRow`/`SheetOption`-style primitive that all five of these should
   eventually collapse into (one component, five call sites' worth of
   styling variants), or should this fix keep the five components separate
   and only unify the `label`/`testID`/`accessibilityLabel` prop contract
   across them? This plan assumes the latter (narrower, lower-risk) unless
   told otherwise.
4. **`accessibilityLabel` override prop:** do any of these five components
   actually need the `accessibilityLabel?: string` escape hatch (matching
   `Button`'s shape), or is `label` always sufficient for every current call
   site? The migration list in §3 found no site that needs it — proposing
   it only for future-proofing/parity with `Button`. Fine to drop if
   unwanted.
