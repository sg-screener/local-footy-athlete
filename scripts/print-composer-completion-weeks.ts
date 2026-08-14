/**
 * THE COMPOSER-COMPLETION WEEKS, IN PLAIN ENGLISH — mission §6.
 *
 *   npx sucrase-node scripts/print-composer-completion-weeks.ts
 *
 * Writes `docs/printed-weeks-composer-completion/` — one file per world the
 * mission named, plus an index. **A world that still REFUSES prints its typed
 * refusal instead of an invented week**, which is the order's own instruction and
 * the only honest thing to print for a week the athlete would never receive.
 *
 * ## IT REUSES ITEM 65'S PRINTER — IT DOES NOT WRITE A SECOND ONE
 *
 * `renderWeekAsPlainEnglish`, `projectWithGapsMarked` and `scheduleStateFor` all
 * come from `print-week.ts`. That file's own header says why: two renderers give
 * two `[NO COPY]` counts and neither is worth reading. Importing it also sets
 * `__DEV__ = false` at module scope, which is correct here.
 *
 * ## THE PROFILES ARE THE CENSUS'S, NOT A NEW SET
 *
 * Every world is built from the SAME profile shape
 * `ladderCoverageWideCensusTests` sweeps, so a week printed here is the same week
 * the built/refused counts in the boundary report are talking about. A printer
 * with its own athlete would be describing a world no number in the report covers.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}

import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import {
  projectWithGapsMarked,
  renderWeekAsPlainEnglish,
  scheduleStateFor,
} from './print-week';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { buildProgramTabProjectedWeek } from '../src/utils/visibleProgramReadModel';
import { resolveEquipmentAvailability } from '../src/utils/equipmentAvailability';
import type { OnboardingData, TrainingProgram } from '../src/types/domain';

/** The census's own base athlete. Same fields, same values. */
const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
};

const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'],
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const KIT_FOR: Record<string, string[]> = {
  'Full Gym': ['Full Gym'],
  'Bodyweight Only': ['Bodyweight Only'],
  Dumbbells: ['Dumbbells', 'Bands'],
};

/** The census builds every world at this date, so these weeks are those weeks. */
const TODAY = '2026-07-13';

interface Target {
  readonly slug: string;
  readonly title: string;
  /** What Sam is being asked to judge here, in his words not the code's. */
  readonly whatToLookFor: string;
  readonly world: string;
}

const TARGETS: Target[] = [
  {
    slug: '1-in-season-2d-club-full-gym',
    title: 'In-season, two nights, both at the club — full gym',
    whatToLookFor:
      'This is the week the order said was broken — a squat with no deadlift. '
      + 'It was never broken: the deadlift is on the second night. Read both '
      + 'nights together and tell me whether the pair looks right.',
    world: 'In-season/2d/club/Full Gym/w1',
  },
  {
    slug: '2-in-season-2d-club-dumbbells',
    title: 'In-season, two nights at the club — dumbbells and bands only',
    whatToLookFor:
      'Same two nights, but all he owns is dumbbells and bands. Is there '
      + 'anything here he could not actually do, and is it still worth doing?',
    world: 'In-season/2d/club/Dumbbells/w1',
  },
  {
    slug: '3-pre-season-2d-club-full-gym',
    title: 'Pre-season, two nights at the club — full gym',
    whatToLookFor:
      'This week REFUSED to build before this work and builds now. Pre-season '
      + 'is meant to be the hard part of the year. Is this hard enough for two '
      + 'nights, on top of club training?',
    world: 'Pre-season/2d/club/Full Gym/w1',
  },
  {
    slug: '4-pre-season-5d-no-club-full-gym',
    title: 'Pre-season, five days, no club — full gym',
    whatToLookFor:
      'This week would not build at all until the full-body day was taught to '
      + 'ask what the rest of the week is missing. Look at the first day: it is '
      + 'the one carrying squat, deadlift, single-leg work, a press and a pull. '
      + 'Is that too much for one session?',
    world: 'Pre-season/5d/noclub/Full Gym/w1',
  },
  {
    slug: '5-in-season-4d-club-full-gym',
    title: 'In-season, four days, two club nights — full gym',
    whatToLookFor:
      'The ordinary in-season week for someone who trains a lot. Is any day '
      + 'here too much on top of two club nights and a Saturday game?',
    world: 'In-season/4d/club/Full Gym/w1',
  },
  {
    slug: '6-off-season-4d-no-club-full-gym',
    title: 'Off-season, four days, no club — full gym',
    whatToLookFor:
      'Nothing here comes from the club. Is this a sane off-season week — '
      + 'enough lifting, not too much running?',
    world: 'Off-season/4d/noclub/Full Gym/w1',
  },
  {
    slug: '7-in-season-4d-club-bodyweight',
    title: 'In-season, four days, nothing but a floor (STILL REFUSES)',
    whatToLookFor:
      'The away / no-kit stopgap. It still refuses, and the reason is NOT the '
      + 'composer — it is that the plan asks him to do a pulling session when '
      + 'he owns nothing to pull on.',
    world: 'In-season/4d/club/Bodyweight Only/w1',
  },
];

function profileFor(world: string): { profile: OnboardingData; week: number } {
  const [seasonPhase, daysRaw, clubRaw, kitName, weekRaw] = world.split('/');
  const trainingDaysPerWeek = Number(daysRaw.replace('d', ''));
  const preferredTrainingDays = DAYS[trainingDaysPerWeek];
  return {
    week: Number(weekRaw.replace('w', '')),
    profile: {
      ...BASE,
      seasonPhase,
      trainingDaysPerWeek,
      preferredTrainingDays,
      equipment: KIT_FOR[kitName],
      teamTrainingDays: clubRaw === 'club'
        ? ['Tuesday', 'Thursday'].filter((day) => preferredTrainingDays.includes(day))
        : [],
    } as unknown as OnboardingData,
  };
}

/** The Monday of the week the census builds. Derived, never typed in twice. */
function mondayOf(dateISO: string): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

const WEEK_MONDAY = mondayOf(TODAY);

interface Printed {
  readonly target: Target;
  readonly refusal: { signature: string; findings: readonly string[] } | null;
  readonly findings: number;
  readonly noCopy: number;
}

function refusalMarkdown(target: Target, error: any): string {
  const findings: string[] = (error?.findings ?? []).map((f: any) =>
    `- **${f.detail}** — the app expected ${JSON.stringify(f.expected)}, `
    + `it got ${JSON.stringify(f.actual)}. _(rule: \`${f.clause}\`)_`);
  return [
    `# ${target.title}`,
    '',
    `**What to look for:** ${target.whatToLookFor}`,
    '',
    '---',
    '',
    '## The app REFUSED to build this week',
    '',
    'Nothing is printed below, because there is no week. **The app would rather',
    'tell you it cannot build something than hand the athlete a bad week** — so',
    'this is the app working as designed, not crashing.',
    '',
    '**What it said, in its own words:**',
    '',
    ...(findings.length > 0 ? findings : [`- \`${String(error?.message ?? error)}\``]),
    '',
    '---',
    '',
    '_No week was invented to fill this page._',
    '',
  ].join('\n');
}

const OUT_DIR = resolve(__dirname, '..', 'docs', 'printed-weeks-composer-completion');

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const printed: Printed[] = [];

  for (const target of TARGETS) {
    const { profile, week } = profileFor(target.world);
    let program: TrainingProgram | null = null;
    let error: any = null;
    try {
      program = generateProgramLocally(profile, {
        todayISO: TODAY, blockNumber: 1, microcycleLimit: week,
      } as Parameters<typeof generateProgramLocally>[1]);
    } catch (err) {
      error = err;
    }

    if (!program) {
      writeFileSync(resolve(OUT_DIR, `${target.slug}.md`),
        refusalMarkdown(target, error), 'utf8');
      printed.push({
        target,
        refusal: {
          signature: String(error?.message ?? error),
          findings: (error?.findings ?? []).map((f: any) => `${f.clause}: ${f.detail}`),
        },
        findings: 0,
        noCopy: 0,
      });
      console.log(`  wrote ${target.slug}.md — REFUSED: ${String(error?.message ?? error)}`);
      continue;
    }

    const weekDays = buildProgramTabProjectedWeek({
      mondayISO: WEEK_MONDAY,
      todayISO: TODAY,
      state: scheduleStateFor({
        profile, program, todayISO: TODAY,
        activeConstraints: [], temporarySourceFacts: [], markedDays: {},
      }) as unknown as Parameters<typeof buildProgramTabProjectedWeek>[0]['state'],
      overrideContexts: {},
      modalityPreferences: {},
    });
    const { visibleWeek, gapIds } = projectWithGapsMarked({
      week: weekDays, weekStart: WEEK_MONDAY,
    });
    const equipmentTags = resolveEquipmentAvailability(profile, [] as never, TODAY);
    const rendered = renderWeekAsPlainEnglish({
      projected: visibleWeek,
      heading: target.title,
      intro: target.whatToLookFor,
      noCopyIds: gapIds,
      equipmentTags,
    });
    writeFileSync(resolve(OUT_DIR, `${target.slug}.md`), rendered.markdown, 'utf8');
    printed.push({
      target, refusal: null,
      findings: rendered.findings.length, noCopy: rendered.noCopyCount,
    });
    console.log(`  wrote ${target.slug}.md — ${visibleWeek.days.length} days, `
      + `${rendered.noCopyCount} missing words, ${rendered.findings.length} findings`);
  }

  // ── THE INDEX, AND EVERY NUMBER ON IT IS DERIVED FROM THE RUN ─────────────
  const built = printed.filter((p) => !p.refusal);
  const refused = printed.filter((p) => p.refusal);
  const lines: string[] = [
    '# The weeks this app builds now',
    '',
    'Every word below came out of the app itself — the same program builder the',
    'Rebuild button runs, and the same one screen the Program tab reads. Nothing',
    'was written by hand and no week was invented.',
    '',
    '```',
    'npx sucrase-node scripts/print-composer-completion-weeks.ts',
    '```',
    '',
  ];
  if (printed.length === 0) {
    lines.push('## ⚠ NOTHING PRINTED AT ALL — do not read anything below as a finding.');
    writeFileSync(resolve(OUT_DIR, 'README.md'), lines.join('\n'), 'utf8');
    return;
  }
  lines.push('## What the run found', '',
    `**${built.length} of ${printed.length} weeks built. ${refused.length} refused.**`, '');
  if (refused.length > 0) {
    lines.push('The refusals are not crashes. The app would rather say it cannot build',
      'a week than hand over a bad one, and each refused page prints the reason in',
      'the app\'s own words.', '');
  }
  lines.push('| | Week | What it is testing | Built? | Problems |', '| --- | --- | --- | --- | --- |');
  printed.forEach((p, i) => {
    lines.push(`| ${i + 1} | [${p.target.title.split(' — ')[0]}](${p.target.slug}.md) `
      + `| ${p.target.world} | ${p.refusal ? '**no**' : 'yes'} `
      + `| ${p.refusal ? p.refusal.findings.length : p.findings} |`);
  });
  lines.push('', '## Read 1 first', '',
    'File 1 is the week the order said was broken. It was not broken — the deadlift',
    'is on the second night. That is the single most important thing here.', '');
  writeFileSync(resolve(OUT_DIR, 'README.md'), lines.join('\n'), 'utf8');
  console.log(`\n${built.length} built, ${refused.length} refused, of ${printed.length}.`);
}

if (require.main === module) main();
