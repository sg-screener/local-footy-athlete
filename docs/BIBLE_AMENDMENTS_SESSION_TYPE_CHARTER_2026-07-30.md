# Bible amendments — the session type charter

**DRAFTED FOR SAM'S SIGNATURE. Nothing here is applied to
`LFA_PROGRAMMING_BIBLE`.** These are the places the charter unit changed what the
app does, where the Bible either says something else or says nothing. Each one is
quoted with the line it amends, the proposed replacement, and — because this is
the part that matters — **what the app does today if you do not sign it**.

The code already behaves as proposed. That is not an argument for signing: it is
why each item states plainly what would have to be reverted.

---

## 1. "Rest or recovery" — the disjunction the app was resolving for the athlete

**Bible today** (`:79`, `:81`, `:122`, `:134`): the day after a game is "rest
**or** recovery"; "the user can always add … as optional"; "you can always add a
recovery or mobility flow to any day as optional".

**The finding.** The Bible offers a choice and never says who makes it. The app
made it — nine placement sites in `coachingEngine.ts`, plus a resolver derivation
that put a recovery session on an empty G+1 — and none of them cited a source.

**Proposed amendment:**

> Where the Bible offers "rest or recovery", the ATHLETE chooses. The app plans
> REST and offers the recovery door; it never places recovery uninvited.

**If you don't sign it:** revert the nine deletions and the G+1 change. Note that
the empty-G+1 derivation also made the deletion door lie — an athlete tapping
Remove on that session got "the change did not reach the visible week", because
there was nothing stored to remove.

---

## 2. The rest quota — what a rest day IS

**Bible today:** rest frequency is expressed as a count of full rest days, with
no definition of what disqualifies a day.

**The finding.** The app read it as "nothing was placed here", so an athlete who
added a foam-rolling session to their Sunday lost their rest day and the week
raised a **blocking** finding against them for accepting an offer the Bible makes
outright at `:122`.

**Proposed amendment:**

> **THE REST LAW.** The rest quota counts days on which nothing was REQUIRED of
> the athlete. Athlete-added optional work — recovery, mobility, prehab,
> gunshow — never breaks a rest day. A day may be both rested and active, and
> the week reports both.

**If you don't sign it:** the app goes back to charging athletes a rest day for
their own recovery, and `section18ContractV2Tests` 8a/8b/P5 revert with it.

**Note the older defect this replaces rather than reopens:** 8a/8b/P5 were
closed because a week could LOOK compliant on rest when recovery inflated the
count. That recovery was the app's own. With the generator placing none, the old
defect is unrepresentable rather than detected — which is why the deletion and
the law had to land in one commit.

---

## 3. Gunshow — a structure, and a rule about scarcity

**Bible today** (`:81` and the other two ideal weekly structures): names Gunshow
by name. Says nothing about what is in one.

**Proposed amendment:**

> **GUNSHOW.** 2 biceps + 2 triceps + 2 shoulder, 2-3 sets each. "Shoulder" means
> the pump delts pool, not shoulder health — shoulder health stays with
> Accessories.
>
> Under restricted equipment a Gunshow gets **smaller, never padded**. No
> cross-family top-ups. The app never invents to fill a quota.

**Signed as delivered on 2026-07-30**; recorded here because it is a programming
rule and belongs in the Bible, not only in a chat.

**What it caught:** the sixth slot drew from `UPPER_BACK_PUMP_POOL`, so the app
was prescribing "Face Pull" in a session whose signed shoulder family holds
"Cable Face Pull". Authored — and not authored for that session, a distinction
every existing gate was blind to.

---

## 4. Mobility — the door the Bible granted and the app never built

**Bible today** (`:122`): "You can always add a recovery or mobility flow to any
day as optional."

**The finding.** Ten authored flows existed, reachable only as an add-on inside
Recovery. The Bible granted it and the app did not offer it.

**Proposed amendment:**

> **MOBILITY.** Athlete-add only, on any day. A flow is 5-8 movements at warm-up
> doses, drawn whole from the authored flows. Counts toward nothing: never a hard
> day, no exposure credit, never breaks rest.

**One thing needs you before this is complete:** `hips-adductors-groin-reset`
carries **four** movements. It is not offered, because topping it up from another
flow is the padding rule 3 forbids. Amend the flow to five, or lower the floor to
four — your call, and the app does nothing either way until you make it.

*(Also: the step-1 survey said eleven flows. There are ten. The handover repeated
the eleven. Corrected before anything was built on it.)*

---

## 5. Strength — seven sessions, three doors

**Bible today:** names strength sessions by pattern in the weekly structures
without enumerating the set.

**Proposed amendment:**

> **THE SEVEN STRENGTH SESSIONS.** Lower Squat, Lower Hinge, Lower Body Strength,
> Upper Push, Upper Pull, Upper Body Strength, Full Body Strength. The athlete
> picks Upper, Lower or Full Body; the app resolves the variant.

**Not a change in behaviour** — the app has built all seven and named all seven
for months. The change is that the picker could only reach four, so Lower Squat
and Lower Hinge were unreachable through any door.

---

## 6. The four questions

**Proposed addition** — the rule the whole unit is built on:

> **NO SESSION TYPE EXISTS UNTIL FOUR QUESTIONS ARE ANSWERED:** who may place it,
> who chooses it, what it counts as, and who authored its contents. A type
> missing any of the four is not programmable.

Held in code at `src/rules/sessionTypeCharter.ts`, where the four are required
fields, and bound to behaviour by `npm run test:session-type-charter`.

---

## Still open, and NOT drafted as amendments

Three things the unit surfaced that no ruling covers. They are listed rather than
proposed, because writing a Bible line for something you have not decided would
be the app inventing again.

1. **Do Prehab and Gunshow deserve separate doors?** They share "Accessories".
   Your vocabulary has seven words; the athlete's has six.
2. **Does the recovery ADD-ON builder count as placing recovery uninvited?** It
   attaches authored mobility work to sessions across the week. It is a third
   placer, and the charter has not ruled on it.
3. **Stage 4b — "the generator stops placing accessories entirely."** Your
   ruling, and it collides with three shipped things: the Bible names Gunshow in
   all three ideal weekly structures; `g_minus_1_optional_only` is what puts
   optional arms/pump on G-1; and the shipped G-1 ask flow offers
   "take the session the day was BUILT for", whose subject is the derived G-1
   Gunshow. Deleting the placement removes that route's subject. Raised, not
   actioned.
