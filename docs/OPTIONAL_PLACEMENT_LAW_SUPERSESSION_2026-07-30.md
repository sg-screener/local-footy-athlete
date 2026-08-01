# SUPERSESSION — the optional placement law

**Sam, 2026-07-30. Recorded, not retro-fitted.** Prior documents are left exactly
as written: `SESSION_TYPE_CHARTER_2026-07-30.md`,
`BIBLE_AMENDMENTS_SESSION_TYPE_CHARTER_2026-07-30.md` and the commit messages of
`a4be9b9`..`4ad3916` all state the withdrawn law, and they should. This file is
what supersedes them.

---

## 1. WITHDRAWN

> ~~"The generator never places optional work uninvited."~~

**An overreach.** It was my formulation, not Sam's, derived from a survey finding
about Recovery and then generalised to every optional type. Generalising a
finding is not the same as being given a law.

## 2. THE LAW, AS RULED

> **The generator MAY place optional work** — gunshow, accessories, mobility,
> optional conditioning, optional strength — **ONLY under:**
>
> 1. a **Sam-authored placement rule**
> 2. **Sam-authored composition**
> 3. rendered **visibly optional**
> 4. **binnable in one tap**
> 5. and **never counted** toward compliance, load, or rest.
>
> **Standing precedent:** early off-season's authored all-optional contracts.

## 3. WHAT KILLED RECOVERY — and stays dead

Three things together, none of them "the generator placed something":

- **authorless placement** — nine sites, no source cited at any
- **invented composition** — four hand-typed rows in no authored sheet
- **rest interference** — a day the athlete rolled on stopped counting as rest

The deletion stands. What changes is the REASON, and therefore the guard: it was
never "optional work is forbidden", it was "this optional work had no author, no
composition and no business touching the rest quota".

## 4. Consequences, applied

| Thing | Before this supersession | Now |
|---|---|---|
| `g_minus_1_optional_only` | queued for deletion in stage 4b | **STAYS.** The Bible's three weekly structures stand. |
| G-1 Gunshow auto-placement | queued for deletion | **STAYS**, rendered visibly optional. |
| G-1 ask flow `take_the_gunshow` | losing its subject | **keeps its subject.** |
| Stage 4b ("generator stops placing accessories") | pending Sam | **RESOLVED — not done, and correctly not done.** |
| 8a/8b/P5 + the neutrality guard | protecting a blanket ban | **re-formed** to protect the five conditions. |
| Mobility door | nine pre-built flow bundles | **composed from the pool.** |

**Nothing was reverted.** Everything shipped in `a4be9b9`..`4ad3916` remains
correct under the refined law — the deletion, the Rest law, the read-ingress
lift, the seven strength variants, the gunshow's 2+2+2, the typed accessory
rows. Only the guard's WORDING was wrong, and the mobility door's source.

---

## 5. PROVENANCE TRACE — the mobility flow bundles

**Sam's instruction: "provenance-trace their authorship (exercises are his; the
GROUPINGS are suspect)." He is right, and the trace is short.**

`src/data/mobilityFlowTemplates.ts` has four commits in its whole history:

| Commit | Date | What it did |
|---|---|---|
| **`c01a80a`** | 2026-07-09 | **"Add mobility flow templates"** — created all ten bundles, 355 lines, plus their test |
| `b44960f` | 2026-07-24 | applied Sam's authored cue + video pass (renames only) |
| `73b0871` | 2026-07-27 | "trunk/core" → "midline" in athlete copy |
| `2c67d76` | 2026-07-27 | run-7 polish — retired inline note strings |

**The originating commit's entire message is its subject line.** No ruling cited.
No changeset document. No divergence report. Compare it with `b44960f` directly
beneath — which cites `docs/CUE_CHANGESET_2026-07-23.md`, names three divergences
found *before any code changed*, and records what Sam ruled on each. That is what
an authored change looks like in this repo. `c01a80a` does not look like one.

**The split, precisely:**

- **The exercise NAMES are Sam's.** Every movement in every bundle is curated
  pool vocabulary, and `exerciseNameCanonicalisationTests` §11 has been sweeping
  them against his locked list since the vocabulary switch.
- **Everything else came from `c01a80a`:** which movements are grouped together,
  how many per bundle, the order, the `focusTags`, the `phaseSuitability`, the
  `roundsMin`/`roundsMax`, and the `injuryCautions` prose.

**Verdict: his suspicion is confirmed.** The groupings are an agent's.

### What changed, and what has NOT

**Changed:** the Mobility door no longer reads the bundles at all. It composes
5-8 movements from `MOBILITY_POOL` — twenty exercises Sam authored, each with the
dose he authored on it — spread across lower / hips / midline / upper.

**NOT changed, and this needs saying:** `recoveryAddonBuilder` still runs on
those bundles, and so does `mobilityPrehabFlow`. Retiring them there is a
separate unit with its own replacement mechanism, and doing it silently inside
this one would be worse than leaving it visible. **The recovery add-on is
therefore still attaching groupings Sam does not recognise**, and it is already
on the open list as a third placer of recovery content. It is now the top item.

### The one invention in the replacement, marked as such

Composing "across four regions" needs to know which region each of the twenty
exercises belongs to, and **the pool does not carry that**. The table in
`rules/mobilitySessionComposition.ts` is **PROPOSED, not signed**, enumerated in
`OPTIONAL_PLACEMENT_SHEET_2026-07-30.md` §3, and gated both directions so it
cannot drift from the pool. It is exactly the kind of thing that produced the
flow bundles, so it is being handled the opposite way: written down, sent, and
not trusted until signed.

**The 4-movement floor question is dissolved**, as Sam said — there are no
bundles left to be too short.

---

## 6. Still open

1. **The placement rules themselves** — drafted in
   `OPTIONAL_PLACEMENT_SHEET_2026-07-30.md`, awaiting signature. Nothing places
   without a signed rule, and until they are signed the existing placements run
   on Bible anchors that the sheet cites rather than on rules Sam has read.
2. **The recovery add-on builder** — still on the unrecognised bundles. Top of
   the list.
3. **Prehab and Gunshow share one door.** Unresolved.
4. **The visible classifier** still reads accessory sessions as upper/lower
   strength. The LEDGER no longer does, which is what the hard-day budget reads,
   but the two disagree and that is the remaining charter debt for both types.
