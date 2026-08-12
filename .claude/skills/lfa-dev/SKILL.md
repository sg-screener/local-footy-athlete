---
name: lfa-dev
description: Start this app — simulator, Metro and a launched build — with the one command that already exists. Use whenever the app needs to be running: a UI check, a device pass, a Maestro flow, or "run the app". Never re-derive the startup steps.
---

# Starting Local Footy Athlete

```bash
npm run lfa:dev
```

**That is the whole recipe.** It is `scripts/qa-start.sh`, the ONE startup script
in this repo. **Do not write a second one, and do not paste a variant into a
session** — that is the rediscovery this skill exists to end (Sam, 2026-08-12).
If it needs to behave differently, add a flag to that script.

It checks `.env`, picks a simulator, boots it, starts Metro from THIS checkout on
`:8081`, and **launches the app**. It is safe to run twice — an already-booted
simulator and an already-running Metro are reported, not restarted.

## Which simulator it picks, and how to override

First match wins: `$QA_SIM_UDID` → `$QA_SIM_NAME` → **a booted simulator that has
the app** → `iPhone 17 Pro` → any simulator that has the app. This machine keeps
a dozen `LFA Explorer` simulators; the one already on screen is the one you mean.

If nothing has the app installed it **fails closed** and tells you to build:

```bash
npx expo run:ios     # Debug, never Release
```

## Reset to a known week before testing anything

```bash
E2E_METRO_URL=http://127.0.0.1:8081 scripts/dev-e2e/run-maestro-ios.sh \
  .maestro/common/reset-seed.yaml -e SEED_ID=standard-in-season-week
```

**Never bare `maestro test`** — it crashed a session once and the crash is
recorded. Always go through `run-maestro-ios.sh`, which verifies Metro first.
Seed ids: `src/dev/e2e/devE2ESeedIds.ts`.

## Facts that cost someone a session already

- **Metro on `:8081` may belong to another checkout.** The script says so rather
  than guessing; if a screen looks impossibly stale, that is why.
- **A plain icon-relaunch after a seed session white-screens** (the dev-harness
  cold-start gate fails closed). Relaunch through the checkpoint protocol or
  reseed — do not diagnose it as a product bug.
- **Worktrees do not inherit `.env`.** Without it Metro bundles with no Supabase
  vars and the Coach screen dies.

Everything else about running a QA session — the audit order, the session rules,
the known pre-existing reds — is `docs/QA_RUNBOOK.md`. This skill does not repeat
it.
