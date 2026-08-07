# D-2 — the worn-world probe: receipts for Sam, before any ruling

Sam's D-2 ruling (2026-08-05): *"measure first, LR-27 method. No
implementation, no redirect, no reorder until a probe on a WORN acted world
(long life, overrides authored, hydrate + accepted-commit cycles) brings back
receipts on what the hydration-repair in-place branch actually does and stamps.
The probe report comes back to Sam via the review seat BEFORE any D-2 ruling."*

**Nothing was implemented, redirected or reordered.** Two instruments were
added, both env-gated and inert by default, in the `WALKER_LOG_LP3` /
`LR27_PROBE` shape:

- `D2_PROBE=1` at the branch itself (`programStore.ts`) — prints one line each
  time the in-place repair fires, with what it found stored and what it wrote.
- `D2_PROBE=1 npm run test:action-walker` — runs `probeTheWornWorld` instead of
  the suite: onboard → generate → three `plan_change` doors → mark a game →
  advance time → **five** relaunch + accepted-commit cycles, printing the
  `dateOverrides` key set, byte size and per-date content fingerprint at each.

---

## Receipt 1 — the branch fires, and here is exactly what it does

One hit, from the walker's own bounded walks (10 walks × 14 actions):

```
[D2_PROBE] in_place_repair {
  "date": "2026-07-20", "action": "overwrite",
  "storedName": "Upper Pull", "storedRows": 5, "storedBytes": 8979,
  "replacementName": "Upper Pull", "replacementRows": 5, "replacementBytes": 9095,
  "sameId": true
}
```

**It is not a no-op.** It overwrote a stored athlete-surface entry.

**And it is not a substitution either.** Same session id, same name, same row
count — the gateway's re-derived version of *the very session that was already
there*, 116 bytes larger. On this evidence the branch rewrites the athlete's
override with a recognisably identical session, not a different one. That is
the mildest of the shapes the survey said it could have, and it is one
observation, not a distribution.

## Receipt 2 — the worn world never reached the branch at all

The purpose-built worn world authored **zero** `dateOverrides`, and stayed at
zero across every relaunch:

```
after wearing in: 0 override(s), 2 bytes        ("{}")
relaunch 1: 0 override(s), 2 bytes (+0)
relaunch 2: 0 override(s), 2 bytes (+0)
relaunch 3: 0 override(s), 2 bytes (+0)
relaunch 4: 0 override(s), 2 bytes (+0)
relaunch 5: 0 override(s), 2 bytes (+0)
```

**No churn. No growth. Not the LR-27 shape** — but not because the branch is
harmless: because **the athlete doors the walker can drive no longer write
that surface at all.** That is the same measurement LR-1 recorded ("no athlete
tap door writes `dateOverrides` any more") and exactly what the lighter-day
unit sheet predicted once the trim moved to the week overlay: *"the population
it repairs shrinks to coach writes and restores."*

So the honest answer to "what does this branch do on a worn phone" is: **on an
athlete-only phone, it almost never runs**, and the surface it guards is
effectively empty.

## Receipt 3 — the probe could not reach the branch by ACTING

The one hit came from the bounded walks, not from the worn world, and the worn
world could not produce the precondition (`dateOverrides` owning the date) no
matter how long it was driven. **The probe cannot build the coordinate its
subject lives at** — which is the mirror image of the class Sam named on
2026-08-04, and the same limitation that keeps LR-28 parked.

The reason is structural, not a harness gap: the walker has no coach
vocabulary, and after Stage B stage 1 the remaining writers of `dateOverrides`
are coach-pipeline ones, frozen under LR-6.

---

## What this does and does not settle

**Settled:**
- The branch overwrites stored athlete-surface content — confirmed, measured.
- What it writes is the same session re-derived, +116 bytes — not a swap.
- It does not churn or grow across relaunches on an athlete-only world,
  because that world holds no overrides for it to repair.

**NOT settled, and no ruling should assume either way:**
- Its behaviour on a phone whose overrides came from the COACH path. That is
  where the surviving population is, and LR-6 holds it.
- Whether the +116 bytes is stable or accumulates over many cycles — one
  observation cannot say.
- Whether an authored override's *content* is ever replaced by a materially
  different session. Not observed; not excluded.

**The survey's structural findings stand unchanged** and are not re-argued
here: the write bypasses the override door's tape, is later stamped
`authorship: 'athlete'`, and redirecting it to the overlay is inert under
`dayPrecedence` without a second, decision-1-class change.

## The question this puts back to Sam

The evidence has shifted the shape of the question. It is no longer "is this
branch corrupting athlete work on worn phones" — on the athlete path there is
nothing there to corrupt. It is:

> **A repair branch guards a surface the athlete no longer writes. Its whole
> remaining population is coach writes and restores, which are frozen under
> LR-6. Does it stay as-is until the coach rebuild reaches it (and get an
> honest cell saying so), or does the coach rebuild inherit it as scope?**

Option 2 from the survey (narrow to non-athlete-authored entries) now looks
different too: if the athlete path writes nothing, "narrow to non-athlete"
approaches "leave it alone", and the prerequisite authorship field may never
need building.

**Nothing further will be built here until Sam rules.**
