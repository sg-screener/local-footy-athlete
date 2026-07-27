# L2 Report — D13 Session Template (2026-07-27)

Unit: build the D13 session template per `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md`
(final; all ten rulings resolved in §6). Merged to `main` `--no-ff` as `43ce820`.

**Status: gates green, awaiting Sam device acceptance.** This is a heavily
visual unit — §7 lists everything that needs Sam's eyes on a real phone, because
no gate in this repo can see layout.

**Update 2026-07-27 — Sam ruled two of the visual calls before his device pass;
both are applied (`a20f7bb`) and folded into this report. See §8.** The device
pass now covers only the remaining calls: the collapsed flow's read, and
whitespace-vs-headers on long days.

---

## 1. What shipped

Four staged commits on `feat/d13-session-template`, merged `--no-ff`:

| Commit | Stage |
|---|---|
| `3f33fd0` | 1 — the one-list render, six role badges, D2 ordering, the found bug |
| `d7c6215` | 2 — the collapsed Mobility & Prehab flow |
| `73b0871` | 3 — trunk/core → Midline across athlete-facing copy |
| `7b71519` | 4 — recovery days keep their simple template |
| `67dcd1a` | chore — orphaned style removed |

### Stage 1 — the session is ONE list

Seven render boxes collapse into a single ordered list of typed rows, ordered by
one of exactly six internal roles: **power / main_lift / accessory / midline /
prehab / conditioning**. (These shipped as visible badge text and were ruled back
to internal-only on 2026-07-27 — see §8.)

The important part is not the badges, it is the **owner**. The screen used to
mount one of three mutually-exclusive branches (`isConditioning` / `isRecovery` /
default-strength) with boxes nested inside whichever won.
`buildSessionTemplate(workout)` now reads the whole workout once and emits every
applicable row unconditionally; the screen renders what it returned and decides
nothing.

New owners, all pure and React-free so the rules are testable without a renderer:

- `src/utils/sessionTemplate.ts` — composition and D2 ordering
- `src/utils/sessionRoles.ts` — exercise name → role

**The spec's found bug is fixed by construction.** `TeamTrainingBlock` only
existed inside the strength branch, so a conditioning day that also carried a
club session rendered none of it. There is no longer a branch that could swallow
it. The fix is the absence of the structure, not a fourth mount site.

Rulings applied: six roles only, "secondary" is a list position (§6.1); team
training is an inline banner (§6.2); the combined-day picker is one
Conditioning row that expands in place (§6.4); midline and prehab sit after
accessory (§6.5); conditioning-only days follow phase order, not D2 (§6.4).

### Stage 2 — the collapsed Mobility & Prehab flow

`MOBILITY_FLOW_TEMPLATES` has been a 10-template catalog with nowhere to render;
the old code comment called flow rendering "a POSSIBLE FUTURE BUILD, not now"
because "a suggestion naming a MOBILITY_FLOW_TEMPLATES entry has nowhere to
land". It lands here: one collapsed line above the list, tap to expand.

`selectMobilityPrehabFlow` reads the session's dominant movement pattern off the
rows the athlete will actually do, filters by `phaseSuitability`, and lets game
week override — with the phase filter still vetoing, so an off-season game week
falls back to the pattern-matched template rather than being handed one the
catalog calls unsuitable. No flow on conditioning-only (§6.8), recovery (§6.3),
or team-only days.

Game week comes from `useResolvedWeekForDate` — a signal the schedule already
owns, so the override is reachable in product rather than dormant behind a flag
nothing sets.

**Never load-bearing (§6.6) is enforced, not merely intended.**
`mobilityPrehabFlowTests` §5 fails if flow content becomes a session component,
leaks into the counted rows, appears as a badged list row, reaches the feedback
panel, or if `sessionComponents.ts` so much as imports the module. The tick is
plain component state (§6.9); the test fails if the component ever touches a
store, and the label reads "Done — nothing is logged" rather than letting the
athlete assume it counted.

### Stage 3 — Midline

Applied across §5.1's confirmed inventory plus the §5.2 items the spec itself
puts in scope: the component label and both feedback sentences, the Add-exercise
sheet option, 8 exercise cues, the Dead Bug pool note, the Band Pallof
rescheduler note, the session "why" explainer, 8 coach-chat substitute labels, 8
injury keep-lines, 2 home-screen coach-note lines, the coach "add core work"
reply label, the small-muscle-armour description, the mobility template name and
its caution, the generation-prompt pool group label, and the recovery add-on
focus-area label with its 7 rule strings.

The main assertion is an **invariant, not 25 one-offs**: no string literal in the
athlete-copy files may contain the body-region word, with a named allowlist for
the internal ids that legitimately do. That catches copy a future change adds.

Two exclusions, both pinned by tests rather than trusted:

- `SessionTier 'core'` — a homonym meaning "required session". Drives the
  rendered "CORE" chip and the day-row accent key. §6.10 excludes it;
  `midlineTerminologyTests` §3 fails if a future sweep pulls it in.
- Internal ids (`trunk_anti_rotation`, `movement: 'core'`, `trunk_core`,
  `lower_back_trunk`, the `low-back-friendly-trunk-reset` template id) keep their
  names. Churning them would touch persisted data and silently unlink
  `templateIds`.

Cue renames went through the authoring docs first (§5.4), so the changeset gates
stay the source of truth.

### Stage 4 — recovery days, and the bug it found

Stage 1 already routed recovery days to `mode: 'recovery'`. Stage 4 tested what
that actually conserved and **found one thing it did not**.

`PowerPrimerSection` used to render *above* the branch split, so it reached
recovery days too. Stage 1 gave the recovery branch `RecoveryBlock` +
`RecoveryAddonSection` only, silently dropping a power block on a recovery day.
I restored it on conservation grounds.

**Sam then ruled that restoration wrong (§8.2):** power work does not belong on
a recovery day at all, so the primer only ever reached one by accident of layout
and stage 4 was preserving a bug rather than conserving content. It is now
removed entirely and the test pins its absence. The conservation *method* still
earned its keep — it is what surfaced the behaviour for a ruling instead of
leaving it to be discovered on device.

---

## 2. Decisions I made that the spec did not

Each is pinned by a test, so overturning one is a visible change, not a silent
drift. All four want Sam's ruling.

1. **A superset spanning two tiers is not torn apart by the D2 sort.** A pairing
   can join a main lift to a midline hold. The group sorts at its
   highest-ranked member and each member keeps its own badge. Splitting the pair
   to satisfy the tier order would destroy the prescription.
2. **Recovery add-on rows become ordinary badged rows carrying an "Optional"
   marker.** The spec says the box "splits", but §4.1's v1 flow content is
   template-driven, not add-on-driven — so a literal reading would have deleted
   prescribed content. §6.6 says important prehab must live in the session as a
   badged row, never only in the flow, which points the same way.
3. **`Band Pull-Apart` resolves to Prehab, not Accessory.** It sits in *both*
   `upper_back_pump` and `shoulder_health`. Determinism was the requirement;
   joint-health membership is the more specific claim, so Prehab wins.
4. ~~**The numeric index ("1", "2", "1a") is gone from exercise rows**, replaced
   by the badge in that slot.~~ **OVERTURNED by Sam, 2026-07-27 (§8.1).** The
   index is back and the badge text is gone. The pinned test was inverted rather
   than deleted, so a future revert stays visible.

---

## 3. Design decisions

The screen already has a documented visual language (flat `#0C0C0C` page, no
card surfaces, whitespace as separation, one lime accent, micro-caps eyebrows).
I extended it rather than re-branding.

- ~~**All six badges share one muted grey**, as a micro-caps eyebrow above the
  exercise name.~~ **Superseded (§8.1):** there are no badges. The row leads with
  its index again, in the tone it always had.
- **The superset rail is unchanged** — a pairing is a real prescription fact, so
  it stays the only grouping device left.
- **The flow gets one hairline-ruled line and no fill** — it must read as
  available, not as a first task blocking the session.
- **The flow's tick deliberately avoids the lime CTA treatment.** An action with
  no consequence must not borrow the visual weight of one that does.

---

## 4. Gates

| Gate | Result |
|---|---|
| `npm run test:bible` (full, post-merge on `main`) | **EXIT=0** |
| `npm run test:compile` (3-scope ratchet) | **PASSED** — no file regressed |
| `npm run test:keyboard-convention` | EXIT=0 |
| `npm run test:content-reconciliation` | EXIT=0 |
| `npm run test:accessibility-contracts` | EXIT=0 |
| `npm run test:authored-cues` / `test:cue-join` / `test:locked-list` | pass |

A clean baseline `test:bible` was captured **before** any edit (EXIT=0), so
nothing here is misattributed to a pre-existing failure.

Four new suites, 134 assertions, all wired into `test:bible`:

| Suite | Assertions |
|---|---|
| `sessionTemplateOneListTests` | 61 |
| `mobilityPrehabFlowTests` | 36 |
| `midlineTerminologyTests` | 23 |
| `recoverySimpleTemplateTests` | 14 |

---

## 5. What is still open

- **Spec item 11 (deliberately not done).** `trainAroundEngine.ts`'s ~21 dormant
  `'Trunk'` literals. The spec lists this as the one unruled question and the
  file is imported nowhere outside its own tests. Needs Sam's call.
- **The real flow menus.** §4.1's mapping is an explicit v1 placeholder shipped
  so the mechanism has something to render. Sam's own example (upper-push = dead
  hangs, pec stretch, external rotations, scap pull-ups) is richer than what
  ships. This is the future curation session, unchanged by this unit.
- **The Accessory / Prehab / Mobility-flow category boundary** (§6.6) — deferred
  to the same curation session.

---

## 6. NOT COVERED

- **`DayWorkoutScreenClassic` was not migrated.** It still renders the seven old
  boxes. It is unreachable at runtime (`DESIGN_VERSION` hardcoded `'v2'`) but
  still compiles, so `PowerPrimerSection` and `TrunkSupportSection` were kept
  rather than deleted. Retiring Classic is a separate decision.
- **`speedBlock` still has no render site.** The spec explicitly declines to
  invent a Speed badge; speed/sprint content continues to render under
  Conditioning. Unchanged by this unit.
- **The D11 muscle-block "works: X" card text** — its own Phase 4.3 unit.
- **The D12 conditioning grid's internal curation** — specced separately.
- **No device or simulator run.** Everything below is unverified on hardware.
- **No animation** was added to the expand/collapse. The spec left the
  interaction pattern to the implementer; I used the existing `+` / `−`
  disclosure convention with no transition.
- **Bible cross-check for the conditioning-day mobility primer** — still not
  done; §6.8 resolved the question by removing the primer instead.

---

## 7. What needs Sam's eyes on device

No gate in this repo can see layout — the source contracts read source text.
This unit changes the primary screen's whole composition, so the device pass is
the real acceptance. In rough priority:

Items 1-3 (the badge decision) and item 18's power-primer question were **settled
by Sam's 2026-07-27 rulings** and are no longer device questions — see §8.

**High — the flow**

4. **The collapsed flow line at the top.** Does it read as optional, or as a
   first task to clear? It is the first thing on the screen now.
5. **Expanded flow length.** A 12-minute template plus primers can be 6-7
   movements — check the expanded state does not bury the actual session.
6. **The cosmetic tick.** It says "Done — nothing is logged". Is that reassuring
   or confusing? Also confirm it survives nothing — leave the screen and return,
   it should be unticked.
7. **Flow content quality.** The v1 mapping is a placeholder; seeing it on device
   is the natural trigger for the curation session.

**High — the one-list layout**

8. **Vertical rhythm with no section headers.** Whitespace is now the only
   separator between six different kinds of row. Does a long full-body day still
   parse at a glance?
9. **The superset rail beside the badges.** Both are micro-caps lime/grey — check
   they do not visually collide.
10. **The combined-day conditioning row.** Tap "Choose one of 2" and confirm it
    expands in place and reads as a choice, not as two prescribed sessions.
11. **Power as the first row.** It lost its "POWER / EXPLOSIVE PRIMER" header and
    its "Before strength" tag, and now carries no label at all. Is placement
    alone enough to say what it is and when to do it? This is the row most
    exposed by the badge-text removal.
12. **The team-training banner.** It keeps its accent tint and sits last.
    Confirm it reads as a commitment, not as an exercise.
13. **Add-on rows.** "OPTIONAL" is now the row's only eyebrow, replacing a box
    with "Skip with no penalty if it adds fatigue." Is the no-penalty meaning
    still clear enough?

**Medium — the rename and the day types**

14. **"Midline" in the wild.** Especially the feedback question "Did you complete
    the midline work?" and the coach-chat keep-lines.
15. **Cue rewording.** Eight cues changed. "Long stride, tall through the
    midline." and "Tall through the midline, no arching." are the two where I
    had to restructure the sentence rather than swap a word.
16. **The "CORE" chip on the Program tab must be unchanged.** It is a homonym,
    pinned by a test, but worth one look.
17. **A conditioning-only day WITH team training** — the found bug. This
    previously rendered nothing for team training; confirm the banner is there.
18. **A recovery day** — should look exactly as it did before this unit, minus
    any power primer (§8.2).
19. **The weight editor keyboard** on an exercise row, since the header row
    markup changed around it.
20. **Superset numbering** — confirm a pair reads "2a / 2b" and the next row
    picks up at "3".

---

## 8. Sam's rulings, 2026-07-27 (applied — `a20f7bb`)

### 8.1 The numeric index returns; role text goes

Rows read "1 / 1a / 2" exactly as before. Sam's reasoning: the D2 ordering
already tells the athlete what matters, so a big "MAIN LIFT" label earns nothing.

The role is **not** removed — it stays internal data driving list ordering,
mobility-flow selection, and the muscle-block logic still to come. What went is
the athlete-facing vocabulary: `SESSION_ROLE_BADGES` and `SessionRoleBadge.tsx`
are deleted, so no dangling athlete-facing string can drift. `SessionRole` and
`SESSION_ROLE_ORDER` are untouched.

**On the discreet icon Sam left open:** I took nothing. Six roles need six glyphs
the athlete would have to learn — the same "earns nothing" problem in a different
medium — and this screen has no icon vocabulary to draw on, only two inline SVGs
that are both controls rather than labels. "When in doubt, nothing" applied.

Numbering went into the owner as `sessionListLabels(items)` rather than back into
the screen. With one list a number is a property of the *list* — a superset takes
one slot however its members are ordered — so it is derived and unit-tested
rather than eyeballed. Rows that were never numbered (power, add-ons,
conditioning phases, the team banner) stay unnumbered: numbering an optional
add-on beside prescribed work would quietly promote it.

### 8.2 No power primer on recovery days

Removed entirely. The conservation test is **inverted, not deleted** — it now
pins the primer's absence *and* pins that the composition owner emits no power
item for a recovery day, so no path remains by which one could return silently.

`PowerPrimerSection.tsx` stays on disk because `DayWorkoutScreenClassic` still
imports it and still compiles.
