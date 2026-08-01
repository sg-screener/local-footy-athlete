# Home screen & button redesign — Sam's rulings (running, via Cowork)

Captured live from Sam's screenshots + dictation, 2026-07-30 evening. These
are DESIGN RULINGS for the buttons/UI pass; copy herein is Sam-authored and
feeds the signed-copy sheet when implemented.

## Week screen, bottom section (from screenshot, 2026-07-30)

1. **"Repeat this week into next week": FEATURE DIES ENTIRELY (Sam-ruled).**
   Button removed and the repeat-week capability retired — not relocated.
   Code, tests, and copy for it are deletion candidates.
2. **Busy/Away split into two buttons:**
   - **"Short on time today"** (was the busy half of "Busy or away this week?")
   - **"Away this week?"**
3. **New button: "I'm injured"** — confirmed, matches the copy-sheet batch-4
   ruling.
4. **"I'm not 100%" becomes "I'm sick/flat today"** on this screen.
5. **"Missing equipment?" and "Practice match: Saturday" buttons: unchanged.**
6. **Every button carries an appropriate icon.**

## Session card → "Want to change something?" (from screenshots 2+3)

7. **The intermediate menu is DELETED.** Tapping "Want to change something?"
   goes STRAIGHT to the four-action menu — no "Edit this session" step, no
   "I'm not 100%" here (it lives at the bottom of the week screen), no
   "Something else - ask the coach" here (the Coach tab covers it).
8. **The four-action menu is the whole menu:** Swap this session / Add to
   this day / Move this session / Remove this session (+ Back). Each with a
   proper icon.
9. Cross-references for implementation (existing rulings, not new ones):
   "Bin this session" is already ruled → "Remove this session" with signed
   sub "Remove it — anything else on the day stays."; the Swap sub "Change to
   strength, conditioning or recovery" must drop recovery (type deleted) and
   reflect the charter menu; the Add sub must offer the five signed types
   (Strength U/L/F · Conditioning · Gunshow · Mobility · Accessories).

## Option sheets: equipment / feeling flat / sick / injury (screenshots 4-7)

10. **GLOBAL ICON RULE (Sam-ruled):** every option row on every choice sheet
    carries an appropriate, meaningful icon. Current state called out:
    "Limited equipment this week" has none (ugly); "Feeling flat" icons make
    no sense (a ">" chevron as an icon for Rough sleep, lightning for
    Totally cooked); "Sick — how bad?" same problem; injury "Where is the
    issue?" has none. Icon choices are design-proposed by the terminal,
    Sam eyeballs them in the device pass — they are imagery, not copy, so
    they don't need per-icon signing, but nonsense pairings are defects.

11. **INVESTIGATION REQUIRED — injury "Other" data path (Sam's question):**
    when an athlete taps Other on the injury sheet (and/or types free text
    like the "e.g. calf, wrist, elbow" field), where does that answer GO?
    Is it stored as a typed fact, routed to one of the 13 ruled injury
    regions via the phrase map, or silently dropped? If free text can't
    resolve to a region, what does the program DO with it? A stored answer
    that affects nothing — or an answer that goes nowhere — is a silent
    swallow, the worst class. Terminal must trace the full path with
    receipts and report; if it dead-ends, that's a charter-style gap:
    an input door whose answer no owner consumes.

## Session detail — "Edit exercises" re-jig (screenshot 8)

12. **The "Edit exercises" modal menu is RETIRED.** Editing moves inline:
    - **Per exercise row:** a swap button (arrow-in-circle icon) and a "−"
      remove button, directly on the row. (Replaces the current "Change"
      pill + the modal's Swap/Remove entries.)
    - **Top of the session page:** a row of icon buttons — "+" (add an
      exercise), an equipment icon (no-equipment flow), an injury icon
      (something-hurts flow). Replaces the modal's Add and "Something
      hurts / no equipment" entries.
    Result: no intermediate "Edit exercises" sheet at all — every action is
    one tap from the session view. Existing guided flows behind these
    buttons are unchanged; only the entry surface changes.

## Coach screen (screenshot 9)

13. **All seven preset question chips REMOVED** from the Coach screen
    (I missed a session / I'm sore / Feeling cooked this week / Game day
    changed / Swap an exercise / Busy week / I'm injured). The athlete just
    talks to the coach via the input. UI-surface change only — no coach
    pipeline logic is touched (LR-6 stop on coach work stands).

## SESSION CLOSED 2026-07-30 — 13 rulings captured

Implementation note: this whole file is the BUTTONS/UI REDESIGN unit's
authoring source. It lands after/with the charter + one-projection work
(the menus it redesigns are the surfaces being rewired — build them once,
on project(), with signed copy). New/changed athlete-visible strings come
back to Sam through COPY_SHEET_RULINGS before shipping. Icons are
terminal-proposed, checked on Sam's device pass.
