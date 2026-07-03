# Local Footy Athlete — Dev Diary

A plain-English log of what got built, why it matters for the app, and what's
next. Written so anyone can read it — no jargon, no code. Newest entries at
the top.

---

## Friday 3 July 2026 — The coach learns Sam's conditioning philosophy

**What happened.**
Yesterday the coach learned to be honest. Today it learned to coach like
Sam. We sat down and wrote out how conditioning should actually work across
a footy season — and then built it into the app.

The rules, in plain English: during a normal game week the body needs to
recover, so the coach will only add easy "flush out" sessions — gentle
bike, row or ski work that helps you bounce back. But on a bye week, with
no game to save your legs for, the gloves come off: the coach unlocks two
proper hard sessions — an every-minute-on-the-minute erg grinder and a
"MetCon" of hard machines, carries and burpees — to simulate that game-day
hit the body would otherwise miss. The app works out for itself which
weeks are bye weeks. The AI doesn't get a say in breaking the rule — the
app enforces it, so a hard session physically cannot land on a game week.

Watching it work live was genuinely cool: asked for hard conditioning on
Saturday (a bye), it offered the menu; picked the MetCon; it asked "want
me to swap in MetCon — Off-Legs on Saturday? (yes/no)"; said yes; it was
on the board two seconds later. Then asked for the same thing NEXT
Saturday — a game week — and it politely refused, explained why, and
offered the easy options instead. That's exactly what a good human coach
would do.

**A bug caught before Sam ever hit it.** In testing, picking an option
from the coach's menu ("MetCon please") hit a dead end — the app dropped
the choice instead of asking for the yes/no. Turned out two code paths
were doing the same job slightly differently. Fixed by making them share
one path, with a test so it can never quietly come back. This is the
whole philosophy of the rebuild: don't patch the symptom, remove the
duplicate.

**Also fixed the invisible-updates trap.** Twice now, the app was
secretly running yesterday's code while we tested today's — which makes
test results meaningless. The app now stamps every coach reply in the
logs with a fingerprint of what's actually running, so a stale build
exposes itself immediately instead of wasting a morning.

**What's next.**
Sam feeds in more work-capacity sessions over time and the menu grows.
Bigger picture: teach the program generator itself the running rules
(max 4 runs a week, in-season running only around training and game
days) — that one needs a proper plan first, it touches the engine that
builds the whole week.

---

## Thursday 2 July 2026 — The day the AI coach got a brain transplant

**What happened.**
Huge one. Started before sunrise, wrapped mid-afternoon. Claude Fable 5 came
out, and after weeks of hitting the same wall with the old setup, I grabbed
the subscription and pointed it at the problem.

The old system had the AI coach's changes passing through about fifteen
different layers of checks and translations before anything touched the
program. Each layer could have its own bugs, and worse — they could disagree
with each other. The AI would understand me perfectly ("drop the lower work
Monday but keep the flush") and then some layer downstream would mangle it
into the wrong change, or block it, or claim it was done when nothing
happened. Whack-a-mole for weeks.

Today we replaced all of that with one source of truth: the AI looks at the
exact program the athlete sees, proposes the new version of it, and the app
checks that proposal against hard rules before anything is saved. One
representation of the change, checked once, applied once, verified on screen.

**What the coach can do now (all tested live, on the actual app, today):**
- Remove a session or part of a session ("bin tomorrow's session")
- Make a day lighter without deleting anything
- Move a session to another day ("move Friday's session to Wednesday")
- Swap a session for an approved easy-conditioning option — and it asks
  "want me to?" before doing it
- Route big schedule changes ("I can only train Mon/Wed/Fri now") into a
  full program rebuild
- Answer normal questions like a coach instead of treating everything as an
  edit request
- Understand slang, typos, and vague wording ("bin", "gunshow", "the 6th") —
  and when it genuinely isn't sure, it asks a short question and REMEMBERS
  your answer instead of starting over

**The big one: it doesn't lie anymore.** All day, across every test we threw
at it — including deliberate traps — it never once said "Done" without the
change actually being on screen, exactly as described. If it can't do
something safely, it says so plainly. Trust is the product; today we built
it.

**Bonus:** Claude can now drive the app itself — it taps through the
simulator, sends coach messages, reads the logs, finds a bug, fixes it, and
re-tests, while I do other things. It caught and fixed several bugs today
completely on its own. That's hours a week back for content, business, and
actually training.

**Numbers for the nerds (skippable):** ~30 code changes shipped, 300+
automated tests guarding everything, and the whole project is now backed up
on GitHub so nothing can be lost.

**What's next.**
Edits currently take about 5–15 seconds depending on size — accurate every
time, just not instant. We measured exactly where the seconds go (the AI is
genuinely "thinking", which is why it's so accurate), and there's a designed
plan to roughly halve that without making it any dumber, if real-world use
says it's worth it. Otherwise: use the coach for a few days like a real
athlete would, and let it prove itself.

---

## Friday 3 July 2026 — evening session

**The plan got a facelift, and the change menu grew up.**

This afternoon we decided the plan itself should be the way athletes talk
to the coach — tap a day, pick from a menu, done. Tonight that idea got
polished in five visible ways:

1. **One clean week list.** The big "today" card at the top is gone.
   You now see Monday to Sunday as one list, with today gently bigger and
   highlighted. Tap any other day and *it* becomes the highlighted one,
   with its Start Session button and change options right there. Browsing
   next week? Nothing is highlighted until you tap — and the top of the
   screen now says "Next week" or "Last week" so you always know where
   you are.

2. **Real dates everywhere.** Every day now shows its actual date (like
   "FRI 3/7"), on the week list and inside each session.

3. **"Want to change something?" lives inside sessions too.** Athletes
   open a session, read it, and *then* decide to change it — so the
   change door is now in both places.

4. **Binning asks "are you sure?"** and then takes you straight back to
   your week. No accidental deletions.

5. **The change menu now works like russian dolls.** Instead of a wall
   of 18 session options: pick "Conditioning" → "Light or Hard" → and
   the engine picks the best session *for you* — instantly, following
   all the coaching rules (hard sessions only appear on bye weeks, and
   it avoids giving you something already in your week). There's a new
   "Recovery" option too — a proper restorative flow. No AI chat
   involved, so it's instant and can never pick something illegal.

Sam also signed off the bigger roadmap tonight: swapping between any two
days (not just onto rest days), binning just one part of a double-session
day (including team training if you can't make it), strength swaps that
use the real programming engine, and an "I'm not 100%" flow — tired,
sick, or injured, with a couple of taps for how bad it is, and the AI
coach only stepping in when it's genuinely needed.

**Numbers for the nerds:** 8 commits tonight, 72 producer tests all
green (up from 49), and every new menu option is provably unable to
offer something the safety validator would reject.

**What's next.** Restart the app and try the new week view and change
menu live. Then, in order: day-swapping, partial binning, strength
swaps, "I'm not 100%".

---
