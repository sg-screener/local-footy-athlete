/**
 * Hand-curated personas + scenario sequences.
 *
 * Each persona targets a specific edge case Sam has hit (or could hit)
 * in the UI. Add a new entry whenever you find a UI bug — that way the
 * regression is locked in before you fix it.
 */

import type { OnboardingData, DayOfWeek } from '../../types/domain';
import type { Invariant, Scenario } from './types';
import {
  STANDARD_INVARIANTS,
  inseason_minOneConditioningWhenSafe,
  inseason_no48hConditioning,
  inseason_aerobicOnlyDuringGameWeek,
  inseason_lowerSCNonRunning,
  sanity_focusAndDay,
  sanity_coreCountBounds,
  sanity_oneSessionPerDay,
} from './invariants';

// ─────────────────────────────────────────────────────────────────
// Profile builders — keep boilerplate light
// ─────────────────────────────────────────────────────────────────

const baseHealthy: Partial<OnboardingData> = {
  firstName: 'TestAthlete',
  ageRange: '25-34',
  position: 'Midfielder' as any,
  motivation: 'Get stronger, run longer',
  experienceLevel: 'Intermediate' as any,
  squatStrength: '1.5x BW' as any,
  benchStrength: '1x BW' as any,
  // NOTE: enum values must match src/types/domain.ts exactly. If the
  // values don't match, readiness silently falls back to 'low' and the
  // healthy-only invariants (H-IS-3, H-PRE-7/8/9) gate themselves out.
  conditioningLevel: 'Good',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  sessionDurationMinutes: 60 as any,
  trainingLocation: 'Gym' as any,
  teamTrainingDuration: '90 min' as any,
  teamTrainingIntensity: 'High',
};

function inseasonHealthy5d2tSat(): OnboardingData {
  return {
    ...baseHealthy,
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as OnboardingData;
}

function preseasonHealthy5d2tNoGame(): OnboardingData {
  return {
    ...baseHealthy,
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
  } as OnboardingData;
}

/**
 * Pre-season + healthy + 6 available days + custom team-day combo (no game).
 *
 * Used to reproduce the conditioning-omission regression Sam reported on
 * 2026-04-23: Friday team training week generated 0 conditioning sessions.
 * The harness sweeps the full lattice of 1- and 2-team-day combinations to
 * answer "is this Friday-specific or a broader rest-slot collision?".
 *
 * `availableDays` defaults to 6 (Mon–Sat) so all team day positions land in
 * a real training week. Team days are also added to `preferredTrainingDays`
 * via the engine-input boundary union, so configuring Sat/Sun team days is
 * still valid even if Sam typically excludes Sunday from preferredTrainingDays.
 */
function preseasonHealthyCustomTeamDays(
  teamDays: DayOfWeek[],
  availableDays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
): OnboardingData {
  return {
    ...baseHealthy,
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: Math.min(availableDays.length, 6) as any,
    preferredTrainingDays: availableDays,
    teamTrainingDaysPerWeek: teamDays.length as any,
    teamTrainingDays: teamDays,
  } as OnboardingData;
}

function offseason4dFlexible(): OnboardingData {
  return {
    ...baseHealthy,
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  } as OnboardingData;
}

function offseason5dMonToFri(): OnboardingData {
  return {
    ...baseHealthy,
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  } as OnboardingData;
}

function inseasonLowReadiness(): OnboardingData {
  return {
    ...baseHealthy,
    conditioningLevel: 'Poor',
    sprintExposure: 'None',
    recentTrainingLoad: 'Minimal',
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as OnboardingData;
}

function inseasonSevereInjury(): OnboardingData {
  return {
    ...baseHealthy,
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    injuries: [{ area: 'Hamstring' as any, severity: 'Severe' as any }],
  } as OnboardingData;
}

// ─── In-season conditioning-floor profiles ───────────────────────────────
// Healthy + Sat game + custom team-day combo. Used to validate the new
// in-season WITH-game conditioning floor (`applyInSeasonConditioningFloor`
// in coachingEngine.ts ~line 3425). Trigger gate: ≤2 team days, healthy,
// no severe injuries, ≥5 available days. Three combos cover the placement
// priority paths: G−3 standalone, G−4 S+C upper, and the saturation cap.
function inseasonHealthyFriOnlyTeamSat(): OnboardingData {
  return {
    ...baseHealthy,
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Friday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as OnboardingData;
}

function inseasonHealthyWedFriTeamSat(): OnboardingData {
  return {
    ...baseHealthy,
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Wednesday', 'Friday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as OnboardingData;
}

// Reproduces the 2-core (low readiness) push/pull-imbalance gap Sam flagged:
// the in-season WITH-game branch only emits a single upper slot in 2-core
// weeks, leaving push or pull silently missing. Locked in as a regression
// guard for `enforceInSeasonPushPullBalance`.
function inseasonLowReadinessWedFriTeamSat(): OnboardingData {
  return {
    ...baseHealthy,
    conditioningLevel: 'Poor',
    sprintExposure: 'No sprint training',
    recentTrainingLoad: 'Hardly at all',
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Wednesday', 'Friday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as OnboardingData;
}

function inseasonLowReadinessTueThuTeamSat(): OnboardingData {
  return {
    ...baseHealthy,
    conditioningLevel: 'Poor',
    sprintExposure: 'No sprint training',
    recentTrainingLoad: 'Hardly at all',
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as OnboardingData;
}

function inseason3TeamSat(): OnboardingData {
  return {
    ...baseHealthy,
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 3,
    teamTrainingDays: ['Tuesday', 'Wednesday', 'Thursday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as OnboardingData;
}

// ─────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────

export const PERSONA_SCENARIOS: Scenario[] = [
  // ─── Phase B regression: H-IS-3 ───
  {
    name: 'in-season-healthy-3-exposure',
    intent: 'Healthy in-season + Sat game + Tue/Thu team → core=3 (H-IS-3 invariant)',
    profile: inseasonHealthy5d2tSat(),
    actions: [{ type: 'onboard' }],
  },

  // ─── Phase C regression: NO-game Saturday peak ───
  {
    name: 'in-season-game-removed',
    intent: 'Onboard with Sat game, then removeGame → Saturday must be CORE peak (Phase C)',
    profile: inseasonHealthy5d2tSat(),
    actions: [
      { type: 'onboard' },
      { type: 'removeGame' },
    ],
  },

  // ─── Phase shift INTO in-season then remove game ───
  {
    name: 'phase-shift-into-in-season-then-remove-game',
    intent: 'The exact failure path Sam reported: start pre-season → shift into in-season → removeGame should still produce Sat peak',
    profile: preseasonHealthy5d2tNoGame(),
    actions: [
      { type: 'onboard' },
      {
        type: 'phaseShift',
        targetPhase: 'In-season',
        teamTrainingDays: ['Tuesday', 'Thursday'],
        gameDay: 'Saturday',
      },
      { type: 'removeGame' },
    ],
  },

  // ─── Move game cross-DOW then back ───
  {
    name: 'move-game-cross-dow-and-back',
    intent: 'Move Sat game → Sun, then back to Sat. Engine should flip branches both times without leaking state.',
    profile: inseasonHealthy5d2tSat(),
    actions: [
      { type: 'onboard' },
      { type: 'moveGame', day: 'Sunday' },
      { type: 'moveGame', day: 'Saturday' },
    ],
  },

  // ─── Add game to a no-game in-season athlete ───
  {
    name: 'add-game-to-no-game-in-season',
    intent: 'Onboard in-season w/o game → addGame Sat → should switch to WITH-game branch and pass H-IS-3',
    profile: (() => {
      const p = inseasonHealthy5d2tSat();
      // Strip the game anchor so the initial onboard runs the NO-game branch.
      return { ...p, usualGameDay: undefined, gameDay: undefined };
    })(),
    actions: [
      { type: 'onboard' },
      { type: 'addGame', day: 'Saturday' },
    ],
  },

  // ─── Pre-season default: H-PRE-7/8/9 ───
  {
    name: 'pre-season-healthy-4-exposure',
    intent: 'Pre-season + 5d + 2 team days + no game + healthy → core=4 (H-PRE-7/8/9)',
    profile: preseasonHealthy5d2tNoGame(),
    actions: [{ type: 'onboard' }],
  },

  // ─── Off-season baseline ───
  {
    name: 'off-season-flexible-4d',
    intent: 'Off-season 4d/week with no team — sanity invariants only',
    profile: offseason4dFlexible(),
    actions: [{ type: 'onboard' }],
  },

  // ─── Phase shift across all three phases ───
  {
    name: 'full-phase-cycle',
    intent: 'Off-season → Pre-season → In-season → Off-season. Catches profile-overlay state leaks.',
    profile: offseason4dFlexible(),
    actions: [
      { type: 'onboard' },
      {
        type: 'phaseShift',
        targetPhase: 'Pre-season',
        teamTrainingDays: ['Tuesday', 'Thursday'],
      },
      {
        type: 'phaseShift',
        targetPhase: 'In-season',
        teamTrainingDays: ['Tuesday', 'Thursday'],
        gameDay: 'Saturday',
      },
      {
        type: 'phaseShift',
        targetPhase: 'Off-season',
      },
    ],
  },

  // ─── Low readiness safety rail ───
  {
    name: 'in-season-low-readiness-safety-rail',
    intent: 'Low readiness in-season — H-IS-3 must back off (rule does NOT trigger), engine drops to safer plan',
    profile: inseasonLowReadiness(),
    actions: [{ type: 'onboard' }],
  },

  // ─── Severe injury safety rail ───
  {
    name: 'in-season-severe-injury-safety-rail',
    intent: 'Severe injury in-season — H-IS-3 must back off (rule does NOT trigger)',
    profile: inseasonSevereInjury(),
    actions: [{ type: 'onboard' }],
  },

  // ─── Phase shift FROM in-season clears game anchor ───
  {
    name: 'leave-in-season-clears-game-anchor',
    intent: 'In-season → Off-season must wipe usualGameDay/gameDay so virtual games disappear',
    profile: inseasonHealthy5d2tSat(),
    actions: [
      { type: 'onboard' },
      { type: 'phaseShift', targetPhase: 'Off-season' },
    ],
  },

  // ─── Game on a non-weekend day (Wednesday) ───
  {
    name: 'in-season-midweek-game',
    intent: 'Some clubs have midweek games. usualGameDay=Wednesday should still produce a coherent week.',
    profile: (() => {
      const p = inseasonHealthy5d2tSat();
      return { ...p, usualGameDay: 'Wednesday', gameDay: 'Varies' } as OnboardingData;
    })(),
    actions: [{ type: 'onboard' }],
  },

  // ─── Phase shift with athlete-edited availability (Apr 2026) ───
  //
  // Reproduces the exact regression class surfaced when phase-shift grew
  // an "availability" re-confirm step: athlete onboards with
  // preferredTrainingDays = [Mon-Fri] (off-season), months later shifts
  // into Pre-season and drops Monday, picks up Saturday (e.g. because
  // the club's team training + game days now run Wed/Fri/Sat).
  //
  // Before the fix, `applyPhaseShift` only touched seasonPhase /
  // teamTrainingDays / gameDay — `preferredTrainingDays` was never
  // rewritten, so `onboardingToCoachingInputs` kept emitting the stale
  // Mon-Fri set and the rebuilt plan silently ran Monday (user didn't
  // pick) and never touched Saturday (user DID pick).
  //
  // Scenario-scoped invariant asserts the mutation took hold. The
  // generic `allSessions_inSelectedDays` invariant in STANDARD_INVARIANTS
  // provides downstream output coverage.
  {
    name: 'phase-shift-availability-changed',
    intent: 'Off-season (pref: Mon-Fri) → Pre-season with edited availability (pref: Tue-Sat, team: Tue/Thu). Rebuild MUST honour the new day set — no Monday session, Saturday session present.',
    profile: offseason5dMonToFri(),
    actions: [
      { type: 'onboard' },
      {
        type: 'phaseShift',
        targetPhase: 'Pre-season',
        preferredTrainingDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        teamTrainingDays: ['Tuesday', 'Thursday'],
      },
    ],
    invariants: [
      ...STANDARD_INVARIANTS,
      // Scenario-scoped: fires only after the phase shift (Pre-season),
      // guaranteeing it doesn't trip on the initial Off-season onboard.
      ((): Invariant => ({ profile, plan }) => {
        if (profile.seasonPhase !== 'Pre-season') return null;
        const expected: DayOfWeek[] = [
          'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
        ];
        const pref = (profile.preferredTrainingDays || []) as DayOfWeek[];
        const sameSet =
          pref.length === expected.length &&
          expected.every((d) => pref.includes(d));
        const hasMon = plan.weeklyPlan.some((s) => s.dayOfWeek === 'Monday');
        const hasSat = plan.weeklyPlan.some((s) => s.dayOfWeek === 'Saturday');
        const ok = sameSet && !hasMon && hasSat;
        const detailParts: string[] = [];
        if (!sameSet) detailParts.push(`preferredTrainingDays stale: [${pref.join(', ')}]`);
        if (hasMon) detailParts.push('Monday has a session (should be dropped)');
        if (!hasSat) detailParts.push('Saturday missing (should be added)');
        return {
          rule: 'phase-shift honoured edited availability (no stale Monday, Saturday present)',
          passed: ok,
          detail: ok
            ? `preferredTrainingDays: ${pref.join(', ')}; Mon dropped ✓, Sat present ✓`
            : detailParts.join('; '),
        };
      })(),
    ],
  },

  // ─── Pre-season conditioning floor across team-day combinations ─────────
  //
  // Reproduces the bug Sam reported (2026-04-23): pre-season + Friday team
  // training generated 0 conditioning sessions. The hypothesis is a
  // collision between the rest-slot distribution (positions 1 and 3 in a
  // 5-slot week) and team-day blocking rules (H-PRE-1 / H-PRE-3 / H-PRE-7),
  // but it could also be MIN_COND_FLOOR / H5b not retrofitting hard enough
  // when the surviving non-team slots are already assigned strength.
  //
  // The combos below sweep both single- and two-team-day Friday positions
  // alongside the known-good Tue/Thu baseline so the report can answer
  // "is this Friday-specific or a broader rest-slot collision?".
  //
  // Each case runs `STANDARD_INVARIANTS` plus the new `preseason_conditioningFloor`
  // assertion (asserts conditioningCount >= 1 for pre-season weeks with
  // team days — matches the engine's MIN_COND_FLOOR floor).
  {
    name: 'pre-season-team-mon-wed',
    intent: 'Pre-season Mon+Wed team — should produce ≥1 conditioning (no rest-slot collision)',
    profile: preseasonHealthyCustomTeamDays(['Monday', 'Wednesday']),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'pre-season-team-wed-fri',
    intent: 'Pre-season Wed+Fri team — Friday team is the suspected failure trigger',
    profile: preseasonHealthyCustomTeamDays(['Wednesday', 'Friday']),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'pre-season-team-friday-only',
    intent: 'Pre-season Fri only team — minimal team load, conditioning must still appear',
    profile: preseasonHealthyCustomTeamDays(['Friday']),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'pre-season-team-mon-fri',
    intent: 'Pre-season Mon+Fri team — book-end teams, max rest-slot pressure on mid-week',
    profile: preseasonHealthyCustomTeamDays(['Monday', 'Friday']),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'pre-season-team-thu-fri',
    intent: 'Pre-season Thu+Fri team — back-to-back team triggers the H-PRE-5 streak guard',
    profile: preseasonHealthyCustomTeamDays(['Thursday', 'Friday']),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'pre-season-team-tue-fri',
    intent: 'Pre-season Tue+Fri team — sandwiched-day-blocking (H-PRE-7) fires for Wed/Thu',
    profile: preseasonHealthyCustomTeamDays(['Tuesday', 'Friday']),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'pre-season-team-sat-sun',
    intent: 'Pre-season Sat+Sun team — weekend block, Mon-Fri must carry all conditioning',
    profile: preseasonHealthyCustomTeamDays(
      ['Saturday', 'Sunday'],
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    ),
    actions: [{ type: 'onboard' }],
  },

  // ─── Phase shift off→pre with team days NOT in existing preferred days ───
  //
  // Reproduces the exact bug Sam reported (2026-04-24): off-season with
  // preferredTrainingDays = [Mon, Tue, Thu, Sat], shifts to pre-season and
  // picks [Monday, Wednesday] as team days. Monday renders correctly as
  // "Team Training + Upper Push", but Wednesday silently becomes Rest —
  // the engine's `selectedDays` inherits stale preferred days and never
  // gets a daySlot for Wednesday, so the universal team-day label pass
  // has no session to promote.
  //
  // Guarded by the new `teamDay_everyConfiguredDayHasSession` invariant.
  // Team days are hard calendar anchors — the engine must honour them
  // even if the user hasn't explicitly added them to preferredTrainingDays.
  {
    name: 'phase-shift-team-day-outside-preferred-days',
    intent: 'Off-season (pref: Mon/Tue/Thu/Sat) → Pre-season (team: Mon/Wed). Wednesday MUST appear as a team day — not silently dropped because it wasn\'t in the existing preferredTrainingDays.',
    profile: offseason4dFlexible(),
    actions: [
      { type: 'onboard' },
      {
        type: 'phaseShift',
        targetPhase: 'Pre-season',
        teamTrainingDays: ['Monday', 'Wednesday'],
      },
    ],
  },

  // ─── In-season WITH-game conditioning floor ─────────────────────────────
  // Validates the new applyInSeasonConditioningFloor pass: trigger-gate
  // matching weeks must land ≥1 aerobic_base exposure outside the 48h game
  // window. Three combos exercise the priority paths.
  {
    name: 'in-season-fri-only-team-sat-game-healthy',
    intent:
      'In-season + Sat game + Friday-only team + healthy → conditioning ' +
      'floor places G−3 (Wed) standalone aerobic_base AND G−5 (Mon) S+C ' +
      'non-running aerobic on the lower-strength session.',
    profile: inseasonHealthyFriOnlyTeamSat(),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'in-season-wed-fri-team-sat-game-healthy',
    intent:
      'In-season + Sat game + Wed/Fri team (2 team days) + healthy → ' +
      'Wed (G−3) is a team day so the core tier deliberately skips (Tue ' +
      'fallback only fires for ≤1 team day per Sam\'s policy). Optional ' +
      'tier still lands on Mon (G−5) as S+C non-running aerobic on the ' +
      'lower-strength session. Net: 0 core conditioning + 1 optional = 1 ' +
      'aerobic exposure (per Case 1).',
    profile: inseasonHealthyWedFriTeamSat(),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'in-season-2core-low-readiness-push-missing-recovers',
    intent:
      'In-season + Sat game + Wed/Fri team + LOW readiness → 2-core branch ' +
      'emits Mon=Lower + Tue=Pull, leaving push silently missing. The new ' +
      'enforceInSeasonPushPullBalance pass MUST promote Tue → upper_combined ' +
      'so both push and pull are covered. Regression guard for Sam\'s ' +
      'reported failure shape.',
    profile: inseasonLowReadinessWedFriTeamSat(),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'in-season-2core-low-readiness-pull-missing-recovers',
    intent:
      'In-season + Sat game + Tue/Thu team + LOW readiness → 2-core branch ' +
      'emits Mon=Lower + Thu=Push (G−2 lateWeek), leaving pull silently ' +
      'missing. Balance pass MUST promote Thu → upper_combined.',
    profile: inseasonLowReadinessTueThuTeamSat(),
    actions: [{ type: 'onboard' }],
  },
  {
    name: 'in-season-3-team-days-sat-game-no-supplementary',
    intent:
      'In-season + Sat game + 3 team days (Tue/Wed/Thu) → conditioning ' +
      'floor MUST exit at the trigger gate (length>2). Plan carries 0 ' +
      'standalone conditioning, no S+C — saturation rule. Custom invariant ' +
      'set focuses on the conditioning-floor contract; H-IS-3 is omitted ' +
      'because 3-team-day budgets surface a pre-existing 2L+1push+1pull ' +
      'overlay quirk that is unrelated to this rule.',
    profile: inseason3TeamSat(),
    actions: [{ type: 'onboard' }],
    invariants: [
      sanity_focusAndDay,
      sanity_coreCountBounds,
      sanity_oneSessionPerDay,
      inseason_minOneConditioningWhenSafe,
      inseason_no48hConditioning,
      inseason_aerobicOnlyDuringGameWeek,
      inseason_lowerSCNonRunning,
    ],
  },
];
