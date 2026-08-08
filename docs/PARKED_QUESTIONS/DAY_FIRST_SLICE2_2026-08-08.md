# PARKED QUESTIONS — day-first slice 2 + the bucket vocabulary (2026-08-08)

Seven questions. Every one is Sam's; none was answered by guessing. The build
continued past all of them, which is the overnight law — these are the places it
continued under a stated assumption rather than a ruling.

---

## 1. Should an active life-fact LIGHT its chip?

**Not built, deliberately.** The chip row is always visible and every chip looks
the same whether or not that fact is currently shaping the week.

**Why it was not just done:** only TWO of the five chips know. The readiness chip
and the equipment chip already hold their active fact (it is why their testID
changes), so lighting those two is free. Short-on-time, away and injured do not
hold one at that call site, and deriving it there would make the row a second
place that decides what is active. **Lighting two of five is worse than lighting
none** — the athlete would read three unlit chips as "not active" and be wrong.

**What the athlete has instead:** Coach Notes, which now sits directly under the
chip row and names every active fact in full.

**If you want it:** it is a small unit, and its honest shape is the projection
answering "is this door's fact active" for all five, not the row guessing.

---

## 2. A zoomed-out week row now says ONE word

Your ruling is "bucket words only on the week view rows", and that is what
shipped. The consequence, stated plainly: in the Week shape a training row now
reads **"Strength"** and nothing else, where it used to read "Upper Push" with
"+ Conditioning" under it. **That is a real loss of information at the size where
the athlete is scanning seven days at once**, and the day-first shape does not
have it because the timeline is right there.

Options if it reads too thin on the phone: (a) leave it — the bucket is the
point; (b) the week row keeps a compact parts count; (c) the week rows keep the
variant name and only the DAY TITLE goes to buckets.

---

## 3. Power still gets its own timeline ROW, for one exercise

You ruled Power out of the week row, the day title and the bucket list, and that
is exactly what was built. The timeline was left as it is — your words were "the
current daily layout is right" — so a day with a power component now reads:

```
Strength                     ← the title (was "Power")
  ● Power                    ← the timeline
  ● Lower Squat
```

**The same complaint may apply one level down**: one exercise wearing its own
labelled row. It was not folded in, because folding it is not a naming change —
`power` is a real component with its own §18 load, and merging it into the
strength part is engine surgery, not vocabulary.

---

## 4. The day SCREEN has the same double-labelling, one screen over

Your (a) was about the day card, and the card is fixed. The day screen behind it
now reads:

```
Strength                          ← title (bucket, from the same rule)
Tue 4/8 · 6 exercises · Team Training   ← subtitle, still lists attached parts
  … sections: Upper Push, Team Training  ← and lists them again below
```

**"Team Training" appears twice on that screen.** Same shape as the defect you
ruled on, on a surface your order did not name. Not touched: it was outside the
order, and that screen has no timeline, so the fix there is a different one.

---

## 5. Five chip labels, PROPOSED and unsigned

**"Time", "Away", "Sick", "Injured", "Equipment"** — one Title Case word each,
under the icon. Recorded as batch 12 in the copy sheet with the sentence each one
replaced. They join "Today"/"Week" from slice 1.

Two notes for the signing:
- **"Equipment"** was chosen over "Kit" or "Gear" — both fit better under an icon
  — because this app says *equipment* everywhere and a shortened label should not
  also be a new noun. It is the longest of the five.
- **"Sick"** drops the "flat" from "I'm sick/flat today". The full sentence is
  still what the chip announces and still what Coach Notes says when the fact is
  active.

---

## 6. A Gunshow day keeps "Gunshow" — but only because of HOW it arrives

Measured, not assumed: the generated Gunshow day carries a charter
`composedOptionalKind`, so it takes the Add-menu door's word and reads "Gunshow"
exactly as your bucket list says.

**The gap:** if a strength day ever resolves to the *variant* named "Gunshow"
WITHOUT that typed door — the strength-variant path — it will read "Strength".
No such day exists in three generated weeks. Flagged rather than pre-solved,
because the fix would be a name-matching special case and those are what this
codebase keeps deleting.

---

## 7. The readiness chip no longer shows the owner's TITLE

The old bar showed the fact's own title when one was active ("Under the weather
this week") — your A4 ruling, that the label is the owner's and not the card's.
A chip cannot carry a sentence.

**Where it went:** the chip now SAYS that title (accessibility) and the title
renders in full in Coach Notes, directly below the row. Nothing composes a
generic replacement — the thing A4 was actually about.
