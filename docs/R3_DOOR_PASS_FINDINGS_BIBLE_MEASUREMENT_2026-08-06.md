# R3 door pass — findings 1 and 3 measured against the Bible

**No code rides with this document.** Sam's instruction: report what the Bible
requires versus what `derive()` produced, before fixing. Every claim below is a
measurement on a world reached by acting (onboard Sam's pass profile → generate
→ act), and every requirement is a Bible line citation
(`docs/LFA_PROGRAMMING_BIBLE.md`).

The measured week is `2026-08-10` (a full future week, so nothing is pinned
history). Sam's profile: team training **Monday and Wednesday**, 2×/week.

---

## FINDING 1a — off-season kept the team-training anchors

### What the Bible requires

> **`:107` — Off-season → "How hard can the app push"**
> "very. **no team training or games** means conditioning is controlled = no
> outside forces actign on the athlete. No risk of overdoing the gym work but
> then having to front up to team training the next night…"

That is the Bible defining off-season by the *absence* of team training. Three
more lines say the same thing from different directions:

> **`:108` — Off-season → "Ideal weekly structure"**
> "…lower body + conditoning, upper body + conditoning, rest wednesday, ower
> body + conditoning, upper body + conditoning, saturday long slow run, sunday
> rest…"
> — **no team training appears anywhere in it.**

> **`:1289`** "AVAILABILITY GATE, **no-team-training weeks only** … Prescribe it
> only in weeks with NO team training (**late off-season**, the Christmas
> break)."
> — the Bible's own name for a no-team-training week *is* off-season.

> **`:129`** "the year-round required minimum is 1 genuine sprint/high-speed
> exposure per week **except early off-season**. **Team training**, games and
> practice matches **receive anchor credit**…"
> — so a retained team night in off-season does not merely sit there; it feeds
> anchor credit into a phase whose sprint floor the Bible has just removed.

**Team training days are a club-season fact.** The profile answer is true of
the athlete *while their club is training*; the Bible's off-season is the part
of the year when it is not.

### What derive() produced

```
BEFORE (Pre-season)                 AFTER shift to OFF-SEASON
  Mon  Team Training + Upper Push     Mon  Team Training + Full Body Strength
  Tue  Lower Hinge                    Tue  Aerobic Flush
  Wed  Team Training                  Wed  Team Training + Upper Push
  Thu  Prehab & Accessories           Thu  Lower Squat
  Fri  Upper Pull                     Fri  Prehab & Accessories
  Sat  Lower Squat                    Sat  Aerobic Flush
  Sun  —                              Sun  —

profile after the shift: teamTrainingDays = ["Monday","Wednesday"], perWeek = 2
```

**Both team nights survived the phase change, and the profile answer that
produces them was never touched.** Confirmed against the Bible, not against
taste.

### What is NOT a defect here, stated so it is not "fixed" by mistake

**Every session came back `optional`, and that is correct.** `:110` — "Weeks 1-2
(early off-season) are the **OPTIONAL block** — everything optional, zero
completed sessions is a valid honest week". The shift had just happened, so the
clock is in weeks 1-2. Anyone fixing 1a must leave this alone.

One genuine secondary gap, same measurement: `:108` asks for "3-4 strengths,
**3-5 conditionioning** and 1-2 mobility". Derived: 3 strengths ✓, 1 mobility ✓,
**2 conditioning ✗** (below the floor of 3) — and two of the three "strength"
slots are stacked onto the team nights that should not be there at all, so this
number will move once 1a is paid. **Do not tune it before 1a.**

---

## FINDING 1b — the in-season week the shift derived

### What the Bible requires

> **`:81` — In-season → "Ideal weekly structure: 3 options."**
> "Assuming saturday game and 2 team trainings on tuesday and thursday.
> **Option 1** = monday lower body strength and *optional flushout/ aerobic
> conditioning off-leg*, tuesday upper body pull plus team training, wednesday
> rest or *optional flushout/ aerobic conditioning off-leg*, thursday upper body
> push and team training, friday gunshow or recovery, saturday game, sunday rest
> or recovery. **2nd option**, lower body squat + *optional flushout…*, tuesday
> upper body pull + team training, wednesday lower body hinge + *optional
> flushout…*, thursday upper body push + team training, friday gunshow or
> recovery, saturday game, sunday rest or recovery. **3rd option.** monday Full
> body strength + *optional flushout…*, tuesday team training, wednesday Full
> body strength + *optional flushout…*, thursday team training, friday gunshow
> or recovery, saturday game, sunday rest or recovery."

The templates assume Tue/Thu team training; Sam's profile is Mon/Wed, so they
are compared **structurally**, not day-for-day.

### What derive() produced

```
AFTER shift to IN-SEASON
  Mon  Team Training + Upper Pull   (core)
  Tue  Lower Body Strength          (core)
  Wed  Team Training + Upper Push   (core)
  Thu  Prehab & Accessories         (optional)
  Fri  Gunshow                      (optional)
  Sat  Game Day                     (core)
  Sun  —
```

**What already conforms** (worth saying, so the fix does not break it): upper
sessions doubled onto both team nights, one lower strength day, **gunshow on the
day before the game** (`:81` "friday gunshow or recovery"), game Saturday. That
is recognisably Option 1's shape.

**Where it departs from the Bible:**

1. **No conditioning at all.** All three options carry "optional flushout/
   aerobic conditioning off-leg" on the strength days. The derived week has
   **zero** conditioning components. `:1242` — "In-season conditioning should
   support performance and freshness."
2. **Sunday is empty, not "rest or recovery".** All three options end "sunday
   rest or recovery"; `:79` — "What should happen the day after a game: rest or
   recovery day". An empty day and an offered recovery day are not the same
   thing on the athlete's screen.
3. **Lower body sits between the two team nights (Tue, between Mon and Wed).**
   `:30` — "The app should avoid stacking too much hard lower-body or
   conditioning work on top of hard team training". Bible options place lower
   body on the day *furthest* from the team nights. This one is a judgement call
   and is flagged, not asserted.

**Sam's "poor" is substantiated on points 1 and 2 and arguable on point 3.**

---

## FINDING 3 — injury removes work but does not re-optimise

### What the Bible requires

The 6-7/10 band (a 6/10 hamstring was logged):

> **`:1913-1917` — "6-7 / 10 — Limiting issue."**
> "Tell the athlete to get physio/medical advice. **Moderately reduce** affected
> work. Avoid movements that directly trigger it. Reduce or remove high-speed,
> heavy, high-impact or high-volume work through that area. **Keep unaffected
> work in where possible. Use off-feet conditioning if lower limb is affected.**"

And the general rule, stated twice:

> **`:72`** "Work around the injury as much as possible. **Continue to do work on
> unaffected areas.** Then lighten loads and or volume for injured areas."
> **`:93`** "if you can work around it do so… **Get as much work as you can in
> around the injury.**"

And the repair order the Bible already spells out for a removed required
exposure:

> **`:4688`** "Repair order after deletion is: **relocate** the required exposure
> to the highest-scoring Bible-valid day; **substitute** a valid
> session/component where exact relocation is not possible; move or remove
> lower-priority optional work to recover space or stress; **then** record an
> `explicit_user_override` typed reduction for any unavoidable shortfall."

> **`:4755`** "**Substitute before reducing frequency.**"

> **`:4697`** provenance origins already include "**safety substitution**" — the
> machinery for this exists and is named.

### What derive() produced

```
BEFORE injury                       AFTER hamstring 6/10
  Mon  Team Training + Upper Push     Mon  Team Training
  Tue  Lower Hinge                    Tue  Upper Push
  Wed  Team Training                  Wed  Team Training
  Thu  Prehab & Accessories           Thu  Prehab & Accessories
  Fri  Upper Pull                     Fri  —
  Sat  Lower Squat                    Sat  Upper Pull
  Sun  —                              Sun  —
```

- **Correctly removed:** Lower Hinge and Lower Squat — hamstring, "No heavy
  hinge work". That part is right.
- **Correctly relocated:** Upper Push Mon→Tue, Upper Pull Fri→Sat. So the
  *relocate* step of `:4688` runs.
- **Never substituted:** the two removed lower slots came back as **nothing**.
  Friday is now empty. App-programmed work fell from 5 sessions to 4, and **no
  off-feet conditioning was added** although `:1917` names it explicitly for a
  lower-limb injury.

**The gap in one sentence: the derive path RELOCATES and then STOPS. `:4688`
and `:4755` both require SUBSTITUTE as the next step, and it does not run.**

### What R5 pays, and what does not — the separation Sam asked for

**R5 pays:** the *shape instability* already declared last session
(`factDoorInputOwnershipTests` cell 3) — the injured week derives differently
before and after a relaunch, because one path is an incremental REPLAN over the
published week and the other is a full RESOLVE from inputs. That is the
replan-vs-resolve class and it closes at the switchover.

**R5 does NOT pay the substitution gap.** Measured both ways: the
post-relaunch, pure-`derive()` injured week is *also* short of work and also
carries no off-feet conditioning. Filtering without substituting is a **rule
gap on the injury applier**, identical on both paths, so making the two paths
agree changes nothing about it.

**Therefore finding 3 needs its own unit** — "the injury path substitutes before
it reduces" — and only its relaunch-shape half rides on R5.

---

## Recommended order (for Sam's ruling)

1. **1a first, and alone.** Retiring team training in off-season moves the
   conditioning and strength counts, so any tuning done before it is wasted.
   The narrow question to rule: is `teamTrainingDays` **cleared** on the shift
   (an answer edit, like the In-season fixture-mark retirement
   `profileProgramTransaction` already performs when leaving In-season), or
   **phase-scoped at derivation** (the answer survives, and off-season simply
   does not read it)? The second is the north-star shape — no stored state is
   destroyed, and returning to Pre-season restores the club fact by itself —
   and it is the one this terminal recommends.
2. **Finding 3's own unit** — substitute-before-reduce on the injury path.
3. **1b** — the missing in-season conditioning and the Sunday recovery day;
   re-measure after 1a, because the same conditioning-placement owner is
   implicated in both.

Nothing in this document has been implemented.
