# Coach deploy receipts

One row per `supabase functions deploy coach-chat`. The deploy is Sam's call
every time; this file is the receipt, not the authority.

| date (UTC) | function version | git sha of the tree deployed | bundle highest ruling | what changed | by |
| --- | --- | --- | --- | --- | --- |
| 2026-09-09 21:05:58 | coach-chat v10 | b71fd747 + rebuilt bundle | R-396 | F14 grounding gate (readiness/fixture claims, 7dd7f9e6); bundle R-393 → R-396 | PHONEBUILD, on Sam's "deploy the coach" |
| 2026-08-24 02:12:30 | coach-chat v9 | see STATUS_COACH_HARDENING.md | ≤ R-393 | JWT on, durable rate limit | coach hardening seat |

Post-deploy smoke (`coach:chat:smoke`, Lab fixture): Nordic-for-leg-curl now
answers "if you're in season, leg curls don't replace the Nordic minimum";
"game on Friday?" → "No, Saturday"; phase still guessed from day kinds (Rock 1).
Log: `/private/tmp/lfa-yearfix-evidence/coach-post-deploy-smoke.log`.
