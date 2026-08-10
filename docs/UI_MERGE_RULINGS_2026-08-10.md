# UI MERGE RULINGS — Sam, 2026-08-10, signed in chat

**Status: SIGNED. These are Sam's own words, given after tapping through
both prototypes. They are the merge sheet — the clash list did not need
writing because he ruled it first.**

Source of the "hers" column: `docs/design/LFA_UI_PROTOTYPE_2026-08-10.html`
(his partner's interactive prototype, 12 screens). Source of the "mine"
column: the app as it stands at this commit.

---

## THE GOVERNING RULE, VERBATIM AND BINDING

> *"please make those changes in any way that has the most chance of
> success, I do like my colours, fonts, and stuff though over hers so
> keep her structure with my style - keep all of my icons for now too
> and my colours please"*

**HER STRUCTURE. HIS STYLE.** Take the layout, the flow, the
information hierarchy, the simplification. **Keep his colours, his
fonts, his icons — all of them, for now.** The prototype's own palette
and type scale are NOT adopted; they are reference for structure only.

And from earlier the same evening, still binding:

> *"the idea is to merge them together - in the best way possible
> without destroying what i have now"*

**Nothing that works is removed to match a picture.** Where a ruling
below would remove a working behaviour, the behaviour is re-homed, not
deleted — and where it cannot be, that is a question for Sam.

---

## THE NINE RULINGS, VERBATIM

**1. THE STATUS-THEN-BUTTONS FRAME.**
> *"Need to make a change - update your status to modify your program -
> then the buttons - thats better than just having the buttons - her
> buttons obviously don't connect to anything but mine do so keep those
> links but make it more like hers now"*

Take her framing: a heading that tells the athlete WHY the buttons are
there, then the buttons. **Keep every existing wiring — his buttons
reach real doors and hers reach nothing.** This is a presentation
change over live controls, not a rebuild of the controls.

**2. THE DAY CARD.**
> *"I like her day card better, simple and it shows the drop down over
> view of the session if you want it but then hitting start session is
> where you go in side and are taken to the session screen i already
> have. tehres less highlight here as well whihc is good."*

Her day card: simple, with an optional drop-down overview of the
session. **"Start session" is the way in, and it goes to HIS EXISTING
SESSION SCREEN — that screen is not being replaced.** Less visual
highlight than his current card; that reduction is deliberate and
wanted.

**3. NO DAY STRIP AT THE TOP.**
> *"No days at the top of the page - people only care about the day
> they are on and if they need to view the other days they go to weekly
> view."*

Remove the days row from the top of the day screen. Weekly view is the
way to see other days. **Check what else reaches days through that
strip before removing it** — re-home, do not orphan.

**4. ACTIVE MODIFIERS REPLACE COACH NOTES, AND THE COACH PAGE OWNS
THEM.**
> *"2 active modifiers at the top replaces coaches notes, you tap on
> that to be taken to the coach page which is where simplified coaches
> notes will now live. The coach page shows active modifiers and then
> you can tap my status at the top to change season phase or change the
> modifiers (or what we have previously called coaches notes)"*

- Day screen: **two active modifiers at the top**, replacing the coach
  notes block.
- Tapping them goes to the **coach page**.
- The coach page shows active modifiers, and **"my status" at the top
  is where season phase and the modifiers (formerly coach notes) are
  changed.**
- **This lands on the freshly rebuilt coach tab. Check it against the
  coach architecture ruling and L-C1/L-C2/L-C4 before building** — the
  coach tab is a conversation surface and this adds a status surface
  above it.

**5. NO "TODAY" BADGE; THE HEADING CARRIES THE DATE.**
> *"I like how there is no 'today badge' anymore - just 'todays
> session' which should also have the date 'today's session - Mon
> 10/8'"*

Heading reads **"Today's session - Mon 10/8"**. Badge removed.
**This is new athlete-facing copy — it goes through the copy register
and Sam's signing, like every other string.**

**6. SEASON PHASE LEAVES THE DAY AND WEEK SCREENS.**
> *"No more shift season phase at the bottom of the page on day scren
> or week screen"*

Removed from both. **It is not lost — ruling 4 re-homes it under "my
status" on the coach page.**

**7. WEEKLY VIEW GETS MUCH SIMPLER, AND HIS REASONING IS THE SPEC.**
> *"here weekly view is much much better - way simpler and clean and no
> need for buttons below or teh shift season phase here i.e. someone
> will make a change for that day if they need it and if it's chronic
> they're not going to have to go to each day to make the change =
> also, people don't plan on being sick or injured in the future so
> those buttons don't need to be on weekly view"*

Weekly view: her structure, no buttons underneath, no season phase.
**His reason is the rule to apply to anything else that turns up
there: a change for one day is made on that day; a chronic change is
made once, not per day; and nobody schedules being sick or injured in
advance.**

**8. KEEP HIS COMPOSER.**
> *"I do like the text input and send button already in my app so let's
> leave that"*

His existing text input and send button stay exactly as they are.
**Note: this is the surface the keyboard matrix already guards — do
not disturb it.**

**9. "MY STATUS" IN THE COACH SECTION IS THE OLD COACH NOTES, HER
DESIGN.**
> *"My status in the coaching section is now the old coaches notes
> where you can see whats impacting your program in more detail, i like
> her design there"*

"My status" on the coach page = the old coach notes, in more detail —
what is impacting the program. **Her design for that screen is
adopted** (structure; his style per the governing rule).

---

## SCOPE AND SEQUENCING

- **Scope: DAY, WEEK, PROFILE**, plus the coach page surfaces rulings 4
  and 9 create. Session screen is EXPLICITLY out — ruling 2 keeps his.
- **DO NOT START CHANGING SCREENS until a flow walks day -> week ->
  profile end to end.** The older flows still point at buttons the
  redesign moved. That guard is the whole reason the rig work came
  first, and a UI change under a half-blind net is how those flows
  broke unnoticed the first time.
- **New strings go through the copy register and one signing sitting**,
  batched, not dripped.
- **Every ruling above that removes something must say where the
  behaviour went.** Rulings 3, 6 and 7 all remove; 4 and 9 are where
  most of it lands. Anything with nowhere to land is a question for
  Sam, asked once, on one sheet.
