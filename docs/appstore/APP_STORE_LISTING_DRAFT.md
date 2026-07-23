# App Store Listing — draft 2026-07-22 (Sam to edit)

## App name (30 chars max)
Local Footy Athlete
(19 chars — fits. Alternative with a keyword: "Local Footy Athlete: Training" = 29)

## Subtitle (30 chars max)
Footy strength & conditioning
(FINAL — Sam, 2026-07-23, entered in App Store Connect)

## Promotional text (170 chars max, changeable without review)
Built for local footballers: a strength and conditioning program shaped
around YOUR season, team training and game day — with a coach that adapts
when life gets in the way.

## Description (FINAL — Sam's rewrite 2026-07-23, entered in App Store Connect)

Local Footy Athlete builds your complete year-round strength and
conditioning program around team training, game day and real life -
then adapts it when your week changes.

YOUR PROGRAM, BUILT AROUND FOOTY
Your program is shaped around your team training days, game day, season
phase, available equipment, injuries or training limitations, goals and
the time you actually have.
Pre-season, in-season and off-season require different training. LFA
changes with your season so strength, conditioning, speed, power and
recovery are placed where they belong.
This is not a library of random workouts or a generic template. It is
one connected program built for your footy year.

WHEN YOUR WEEK CHANGES, YOUR PROGRAM CHANGES
Move a session, swap it, remove it or ask the coach what to do. LFA
rebuilds the affected week around the change, protects game day and
tells you exactly what changed in plain language. Every change can be
undone with a tap. You stay in control.

TRAIN FOR HOW YOU FEEL TODAY
Sore, fatigued or short on sleep? Tell LFA. The coach can offer a
lighter version of the day by reducing unnecessary work or adjusting
what no longer makes sense.
Accept the change or keep your original session.

REAL PROGRAMMING, NOT RANDOM WORKOUTS
• Exact sessions with exercises, sets, reps and targets
• Strength work that progresses from what you actually lift
• Conditioning matched to your fitness and season
• Sprint and power work placed around team training and games
• Recovery organised to support performance
• Sessions adapted to your equipment, schedule and limitations

BUILT FOR LOCAL FOOTBALLERS
Made in Australia for footballers balancing work, club training and
game day.
Set up your season. Get your program. Know exactly what to do each day.

(NOTE: "tells you exactly what changed" phrasing is deliberate —
disclose-after-with-undo is the shipped behavior. Do NOT reintroduce
"before you approve it" until the preview-approve UX exists.)

## Keywords (100 chars max, comma-separated, no spaces after commas)
afl,aussie rules,football,gym,preseason,offseason,speed,power,sprint,training,program,coach,recovery
(FINAL — 100 chars, no words repeated from name/subtitle. "afl" is hidden-field
only; if review objects (2.3.7), swap for "australian football".)

## Category
Primary: Health & Fitness. Secondary: Sports.

## Age rating
4+ (no objectionable content).

## Support URL
https://localfootyathlete.app

## Privacy Policy URL
https://localfootyathlete.app/#privacy  (Carrd hidden section named "privacy" — text in PRIVACY_POLICY_DRAFT.md; Carrd is single-page so the URL uses #)

---

## App Privacy "nutrition label" answers (App Store Connect questionnaire)

Basis: v1 is single-user; training data lives on the athlete's device.
The feedback form collects an email address. TWO OPEN QUESTIONS below
must be confirmed against the production build before submitting.

- Contact Info → Email Address: YES, collected — user-provided via the
  feedback form only. Purpose: App Functionality / Customer Support.
  Linked to identity: Yes (it's their email). Used for tracking: NO.
- Health & Fitness → Fitness: YES, collected (RESOLVED 2026-07-23
  against code) — program generation and coach chat transmit training
  setup (week sessions, season phase, injury settings) to our server
  and AI provider to produce a response; not stored by us, but it
  leaves the device, so declare it. Purpose: App Functionality. Linked
  to identity: NO (no accounts, no identifiers attached). Tracking: NO.
- User Content → Other User Content: YES, collected (RESOLVED
  2026-07-23) — coach messages are processed by the AI provider via
  our edge function; feedback messages are stored. Purpose: App
  Functionality. Coach messages linked to identity: NO. Feedback
  messages: linked (accompanied by email). Tracking: NO. Provider named
  in the privacy policy (OpenAI — confirmed against Supabase secrets
  2026-07-23; if COACH_LLM_PROVIDER ever changes, update the policy).
- Identifiers / Usage Data / Diagnostics: NO (no analytics SDK, no ads,
  no tracking in v1). If crash reporting is added later, update.
- Tracking (ATT): No tracking. No App Tracking Transparency prompt
  needed.
