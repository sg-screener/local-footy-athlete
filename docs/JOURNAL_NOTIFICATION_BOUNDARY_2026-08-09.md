# BOUNDARY — THE MONDAY NOTIFICATION (2026-08-09)

**Commit:** `8b12fcdd`. **Order:** Sam's decision C6, SEAT_INBOX item 1 (vi), its
own slice after the flip landed, as ordered.

**GATE:** full `test:bible` **UNPIPED `GATE_EXIT=1` at
`test:program-control-durable`, 1 FAIL line** — main's declared red.
`test:compile` PASSED. The declared red sits at chain position **92** and the new
suite at **129**, so the official chain stops before it: **sweep 2 of 170 = the
declared set exactly**, with `test:journal-reminder` **55 passed, 0 failed**
inside it. **11 mutations, 11 red** (one genuine survivor, re-aimed — §5).

---

## 1. SAM — THIS NEEDS A REBUILD, NOT A RELOAD

**Plain words, as the order asked for.**

`expo-notifications` ships **native code**. It is now a dependency and its config
plugin is registered in `app.json`. **Shaking the app or reloading JS will not
pick it up.** The app has to be rebuilt with pods:

```
npx expo prebuild        # regenerates ios/ with the plugin
cd ios && pod install
# or, in one step:
npx expo run:ios
```

**Until that rebuild, every notification call is inert on the binary you are
running.** The service reports that as `unavailable` and the screen renders
nothing — no error, no broken tab. You will simply not see the reminder row.

**AND NOTHING WILL FIRE EVEN AFTER THE REBUILD**, because the sentence is
PROPOSED. That is C6 working, not a bug — see §3.

---

## 2. WHAT IS BUILT

| Piece | Where | What it is |
| --- | --- | --- |
| The decision | `rules/journalReminder.ts` | **PURE.** Which state we are in, and when the next Monday 08:00 is. No React, no native module — L14, and it is why the schedule is testable at all. |
| The words + the gate | `rules/journalReminderCopy.ts` | The two sentences and the provenance door. |
| The hands | `services/journalReminderService.ts` | **The only module in the app that imports `expo-notifications`.** |
| The tap | `navigation/AppNavigator.tsx` | Opens the Journal tab — reading the route from the payload, not hardcoded. |
| The offer | `JournalScreen.tsx` `MondayReminderRow` | Last on the screen, below even the note. |

**FIVE STATES, AND THREE OF THEM RENDER NOTHING:**

- `scheduled` — one quiet confirmation line. No toggle: turning it off belongs in
  the OS Settings app, and a second switch here would be a second owner of "is
  this on".
- `may_ask` — the offer row.
- `refused` · `unsigned_copy` · `unavailable` — **nothing at all.**

---

## 3. THE SENTENCE GATE — THE HEART OF THE SLICE

C6: *"Notification sentence comes to Sam PROPOSED before it ever fires."*

**A NOTIFICATION IS THE ONE ATHLETE-VISIBLE SURFACE SAM CANNOT REVIEW BY USING
THE APP.** Every other PROPOSED string is on a screen: if it ships early he sees
it on his own phone, in context, and says so. This one appears on a lock screen
at 8am on a Monday and nowhere else. **"Remember to get it signed first" is not a
mechanism for a sentence nobody will notice shipping.**

So it is structural, the same move the load model made for its constants:
`decideJournalReminder` returns `unsigned_copy` while batch 28 reads PROPOSED,
and in that state **nothing is scheduled AND no permission is requested.**

**THE ORDERING IS THE LOAD-BEARING PART.** iOS grants an app **one** permission
prompt and does not hand it back. Asking for it and then declining to use it
would burn the prompt on a feature that cannot fire, leaving the athlete having
refused something they never got. **A cell asserts the gate refuses even when
permission is ALREADY GRANTED** — the only state that proves the check sits
upstream of the permission branch rather than beside it.

**Sam signing one field turns the whole feature on with no code change**, exactly
as this morning's eight constants did.

---

## 4. ZERO NEW STORED STATE — THE OS IS THE STORE

The obvious build stores `journalReminderEnabled` and `permissionAsked`. **Both
are second copies of facts `getPermissionsAsync()` already returns:**

```
granted                    -> schedule it
!granted && canAskAgain    -> we may ask; they have not said no
!granted && !canAskAgain   -> THE ATHLETE REFUSED. That is the fact.
```

A stored mirror goes stale the moment the athlete changes their mind in the
Settings app — **and it goes stale silently, which is how an app ends up certain
of a permission it does not have.** A cell sweeps both modules for every store
idiom in the repo and requires none, and asserts no cached permission variable
exists.

**ONE NOTIFICATION, ONE PERMISSION, and that is what keeps the above true.** The
moment a second kind exists, "are notifications on" stops answering "does this
athlete want the Monday nudge" and a real preference has to be recorded. It would
be an INPUT and the north star would allow it — **it does not exist yet, so it is
not minted yet.** North star: **TOWARD.**

### "A refusal is a fact, not an error" — as control flow

`refused` is a returned state sitting beside `scheduled`, not a catch block.
Nothing retries it, nothing logs it as a failure, and the surface says nothing.
**A cell asserts `refused` and `may_ask` are DIFFERENT states**, because
collapsing them into one falsy value is the easy build and it produces an app
that asks an athlete who already said no, every week, forever.

**A FAILURE AND A REFUSAL ARE ALSO KEPT APART.** `unavailable` is the service
admitting it could not reach the OS — the normal state until Sam rebuilds.
Folding it into `refused` would report the athlete as having declined something
they were never asked.

---

## 5. THE FINDING — A CELL THAT SURVIVED ITS OWN MUTATION

**N7: deleting the cancel from `scheduleJournalReminder` left the suite GREEN.**

Without that cancel, every visit to the Journal tab stacks another weekly
trigger, and by the third week an active athlete has a dozen identical Monday
alerts. The cell asserting it read:

```
strip(service).includes('cancelScheduledNotificationAsync(JOURNAL_REMINDER_IDENTIFIER)')
```

**The occurrence was in the FILE. The claim was about one FUNCTION.**
`disableJournalReminder` calls the same thing two screens down and satisfied it.

That is `a count taken for a record` in its **source-scan** form — AGENTS.md
states the remedy almost word for word: *"A count is never the whole assertion.
Locate the REGION the occurrence lives in and assert what makes it run."*
Re-aimed: the scheduler is located, proven non-trivial, and the **ORDER** is
asserted inside it — a cancel that ran *after* the schedule would be worse than
none, and the old cell could not have told the difference either.

**It is the eighth sighting of that shape and the second time this week it has
fired inside a brand-new gate on its first mutation run.**

### And a smaller one: the UI gate caught my naming

`journalUiLawsTests` sweeps the Journal screen for writer idioms, one of which is
`setState(`. My local `useState` setter was named `setState` and tripped it. The
collision is accidental; the sweep is not. **The name yielded, not the gate** — a
forbidden-idiom list that gets an exception the first time it is inconvenient
stops being a list.

---

## 6. THE COPY GATES — THE FOURTH OPENING OF THE SAME HATCH

`rules/journalReminderCopy.ts` joined the binder's `AUTHORING_MODULES`. That
hatch has now been opened four times (plan-change producer, feedback form, deload
sentences, this), and the pattern is worth stating: **words are authored where
the feature's decision lives, and the feature's decision is almost never in
`screens/`.**

**IT MATTERS MORE HERE THAN AT THE OTHER THREE ADDRESSES.** The two notification
sentences are invisible to the extraction gate as well, so **the one string in
this app that nobody will ever review by using the app** ends up with three
readers instead of one: the binder, the provenance gate in its own module, and
Sam's signature.

Ceiling **573 → 576**, attributed to the three reminder-row lines the extractor
*can* see. Batch 28 PROPOSED.

---

## 7. NOT COVERED

**FIRST LINE: NO NOTIFICATION HAS EVER BEEN SCHEDULED OR DELIVERED. DEPTH (L13):
0.** The native module is absent from the running binary until Sam rebuilds, and
**no cell in this slice calls the notification centre at all.** Everything above
proves the DECISION; nothing proves the DELIVERY.

Specifically unverified, all of it requiring a device:

- **THE WEEKDAY CONVERSION IS THE SINGLE MOST LIKELY THING TO BE WRONG.** The
  rule uses `Date.getDay()` numbering (Monday = 1); expo's `WEEKLY` trigger
  counts Sunday as 1, so the service passes `weekday + 1`. **That `+ 1` is read
  off documentation and has never been observed.** If it is wrong the athlete
  gets a Tuesday notification, and no test in this repo can tell.
- That the permission prompt appears at all, and what it says.
- That iOS accepts a `WEEKLY` trigger with this shape.
- That the payload survives a cold start, and that tapping the notification lands
  on the Journal tab rather than the Program tab.
- **That the reminder row looks like anything.** It is the last block on a screen
  that just gained four more.
- Behaviour when the athlete revokes permission in Settings while a trigger is
  already scheduled. The state reads correctly on the next mount; whether the OS
  drops the pending trigger is its business and is not asserted.

---

## 8. PARKED FOR SAM — three

1. **BATCH 28'S SENTENCE, AND IT IS BLOCKING THIS FEATURE ON PURPOSE.** "Last
   week" / "Your week is in the Journal." Nothing fires until it is signed.
2. **08:00 MONDAY IS MINE.** C6 says "Monday-morning local schedule" and does not
   say which hour. 8am is a guess about when a footballer looks at their phone.
3. **ONE NOTIFICATION A WEEK, WITH NO WAY TO TURN IT OFF INSIDE THE APP** — off
   lives in OS Settings, deliberately, so there is only one owner of "is this
   on". If he wants an in-app switch that becomes a real stored preference and
   the §4 argument above changes.
