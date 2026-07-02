# Local Footy Athlete — Dev Diary

A plain-English log of what got built, why it matters for the app, and what's
next. Written so anyone can read it — no jargon, no code. Newest entries at
the top.

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
