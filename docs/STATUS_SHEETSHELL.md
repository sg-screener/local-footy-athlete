# STATUS — seat `sheetshell`

**Started 2026-08-20.** Seat name checked against `ls docs/STATUS_*.md` before the
first commit: `SHEETSHELL` was free. Branch `feat/session-action-shell`, from
`main` at `f2b76282`, in its own worktree.

## The task

Sam: *"Put all five Active Session actions into one shared bottom-sheet shell —
Equipment, Injury, Add, Remove, Swap. The shell must be the single owner of
opening and closing animation, safe-area spacing, title and step header,
scrolling, Back behaviour, Cancel behaviour, resetting state when closed, and
consistent height and layout. Each action must keep ownership of its own
questions and behaviour."*

Non-goals, stated: no Club/Team Training completion, no programming work, no
broad QA, no demolition. **No merge without his explicit approval.**

## THE COMPARISON HE ASKED FOR, MEASURED BEFORE ANY CODE

Five actions, **three** `Sheet` call sites, and Injury crossing two of them
mid-flow (the guided questions are `GuidedInjuryFlowSheet`; the review of what
will change is a step of `ExerciseEditSheet`, a different modal).

| concern | Equipment | Injury flow | Injury review / Add / Remove / Swap |
| --- | --- | --- | --- |
| height | `flexibleBody` — a fixed 92% | auto, uncapped | auto, uncapped |
| scrolling | one `ScrollView` over the lot | **NONE** — 13 trigger chips | a `maxHeight: 360` list on three add levels **only**; `pick_exercise`, `choose_swap` and `injury_review` had none |
| title | `styles.title` 22/700 | `styles.title` 22/800 | `exerciseEditTitle` 21/800 |
| Back | none | its own `BackButton`, **plus** a secondary `Button` labelled "Back" on `stop_training` | its own `Pressable` + `goBack` |
| Cancel | none | none | **NINE identical inline `label="Cancel"` buttons** |
| close animation | fades | fades | **SNAPS** — the component returned `null` |
| reset on close | own `useEffect(visible)` | own `useEffect(visible)` | the screen re-seeds the step |
| safe area | `Sheet`'s hard-coded 40pt | same | overridden to 36 |

**THE INCREMENTAL ALTERNATIVE WAS PRICED AND REJECTED.** Adding what was missing
where it was missing — a scroll view to the injury flow, a Back to Equipment, a
Cancel to each — leaves eight owners of eight decisions and guarantees the next
action drifts again, which is exactly how the table above came to have three
answers in every row. The shared thing already existed (`ui/Sheet`) and was not
enough, because every caller then decided height, scrolling, title, Back and
Cancel **on top of it**.

## WHAT LANDED

**`src/components/SessionActionSheet.tsx` — new, the only thing that renders a
`Sheet` for a session action.** Bodies publish their current step UP to it
(`useSessionActionStep`) rather than the shell taking a header down as a prop,
because the header has to come from wherever the step state lives and the step
state has to live INSIDE the shell for the shell to be able to reset it.

It owns, once: the modal and its animation · the safe-area bottom inset ·
eyebrow + title + subtitle · Back · Cancel · one `ScrollView` keyed by the step
· the height cap · the reset.

**`onBack` UNDEFINED DRAWS NO BACK.** Six steps used to show a Back that closed
the sheet (`pick_exercise`, `add_family`, `choose_swap`, `confirm_remove`,
`coach_fallback`, `future_scope`). An exit wearing a Back label is not *"up
exactly one step"*, and this app already refuses to draw a door that cannot act
(`SessionChangeHub`'s no-dead-buttons rule).

**TWO STEPS GAINED THE BACK THEY SHOULD HAVE HAD.** `choose_swap` and
`confirm_remove` are each reached from `pick_exercise` and nowhere else
(`prepareSwap` has one caller, `confirm_remove` has one setter, both inside the
picker), so the step above them is that picker. They now climb to it.

**`ui/Sheet` GAINED A SECOND NAMED MODE, `cappedBody`.** `flexibleBody` is a
DEFINITE 92% height, which is what a `flex: 1` child needs — and which would
open "Remove this exercise?" as a 92%-tall sheet with two lines in it. That is
why three callers had each invented their own inner `maxHeight` instead.
`cappedBody` is the hug-but-stop shape, once. Its scrolling child must use
`flexShrink: 1`, never `flex: 1`: flex-basis-0 measures ZERO inside a parent
still deriving its height, which is the sliver defect from Sam's device on
2026-07-29.

**Deleted, not merely bypassed:** nine inline Cancel buttons, three per-step
`ScrollView`s, `BackButton`, the `stop_training` Back button, five injury
`<Text style={styles.title}>` literals, and eight now-unowned style rules across
two files.

## WHAT THIS DID *NOT* CHANGE

Every action's questions, order, legality and durable writes are untouched: the
five hub labels/icons/tints, Add's variable-depth hierarchy and its
`fromFamily`/`fromGroup`/`fromList` provenance, Injury's region → area →
severity → triggers flow and the `stop_training` safety ladder, Remove's scopes,
Swap's ranked groups and own-load behaviour, Equipment's dated temporary fact,
and every success / refusal / Undo / Restore path. `UndoToast` was not touched.

## MEASUREMENT — BOTH ENDS, SAME TREE

**53 suites** — every suite whose source reads `DayWorkoutScreenV2.tsx`,
`GuidedInjuryFlowSheet.tsx`, `SessionEquipmentSheet.tsx`, `ui/Sheet.tsx` or
`SessionChangeHub.tsx` — run at `f2b76282` in a detached control worktree and at
the candidate, comparing **failure NAMES**, not totals.

| | result |
| --- | --- |
| candidate vs control | **identical failure sets**, with one exception, below |
| `test:signed-copy-extraction` | **7/1 → 8/0.** Not the target: deleting the nine duplicate Cancels and the duplicate titles took athlete-visible unauthored strings 585 → 579, back under the 580 ceiling this ratchet reds above. `main` itself is red on it. |
| `test:session-action-shell` | **NEW — 55 cells, 55 pass** |
| `test:compile` | no new error in any changed file (project `tsc`, filtered) |

## PROVEN ON GLASS — iPhone 17 Pro (its own simulator), `standard-in-season-week`

Three new Maestro flows, all green, plus the existing Remove walk re-run:

| flow | what it proves |
| --- | --- |
| `.maestro/visible/session-action-shell.yaml` | all five actions open the same shell; Back is ABSENT on every first step and present one level in; Back climbs exactly one; Cancel exits from every step; Injury REOPENS at its first question after being left two steps deep; the five hub words are re-read after every one of the seven exits; the session's rows are untouched at the end |
| `.maestro/visible/session-action-shell-scroll.yaml` | the deep Add branch (family -> group -> leaf -> exercises) climbs back one level at a time; the injury 13-trigger step, which had NO scroll view at all before, now fits and scrolls |
| `.maestro/visible/session-action-shell-injury-review.yaml` | Injury's questions and its review — two components — are one sheet with no second modal in between; Cancel there applies nothing and the six strength rows are exactly as seeded |
| `.maestro/visible/remove-hub-labelled.yaml` (existing, unchanged) | Remove still removes: picker -> confirm -> all three scopes -> receipt -> Undo raised inside the session -> the row gone and its neighbours not |

⚠ **"OPENS AT THE TOP" IS PROVEN BY PHOTOGRAPH, NOT BY `assertNotVisible`.**
Maestro's hierarchy carries a `ScrollView`'s off-screen children with their real
bounds, so a scrolled-away last row reports as VISIBLE — measured here, and a
flow written that way would be asserting a scroll position it cannot see. The
same list is shot on arrival and again after Back and the files compared:

- Add groups, arrival vs after Back: **byte-identical**.
- Injury areas, arrival vs after Back: differ in **exactly one band, rows
  1869-1982 plus the divider at 2031-2033** — the `Knee` row's selected
  highlight, which is the answer being preserved. Every other pixel, including
  the whole list offset, is identical.

## NOT COVERED — NAMED, NOT SWEPT IN

- **`injury_review` still has no Back.** The step above it is the guided flow's
  LAST question, in another component that always restarts at `region`; a Back
  landing on `region` would not be "up one step". Cancel exits, applying
  nothing, exactly as today. **This is a ruling nobody has given.**
- **The guided injury flow is also the Day screen's "Injured" door, the
  quick-action sheet's and the Coach tab's.** There is one injury flow, so all
  four entry points get the shell. A session-only copy would be the duplication
  the task exists to remove.
- **The keyboard.** The only step in the five with a text input is Injury's
  "Other" → type-an-area. `KeyboardSafeArea` — the app's one avoidance owner —
  has a `flex: 1` root and so needs a DEFINITE height, which is the one thing
  `cappedBody` deliberately does not give. Measured on glass rather than
  guessed; see the device pass below.
