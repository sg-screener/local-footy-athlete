import type { GeneratedDomain, GeneratedPropertyCase } from '../types';

export const DEFAULT_EXTENDED_SEED = '20260323';

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class DeterministicRandom {
  private state: number;

  constructor(seed: string) {
    this.state = hashSeed(seed) || 0x9e3779b9;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  integer(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error('Cannot pick from an empty deterministic domain');
    return values[this.integer(values.length)];
  }

  shuffle<T>(values: readonly T[]): T[] {
    const output = [...values];
    for (let index = output.length - 1; index > 0; index--) {
      const swap = this.integer(index + 1);
      [output[index], output[swap]] = [output[swap], output[index]];
    }
    return output;
  }
}

const DOMAINS: readonly GeneratedDomain[] = [
  'strength', 'components', 'conditioning', 'power', 'constraints', 'placement', 'edits',
];
const PATTERNS = ['squat', 'hinge', 'push', 'pull'] as const;
const COMPONENTS = ['strength', 'conditioning', 'team_training', 'power', 'trunk_support', 'recovery'] as const;
const MODALITIES = ['bike', 'row', 'ski', 'running'] as const;

function caseData(domain: GeneratedDomain, random: DeterministicRandom, ordinal: number): Record<string, unknown> {
  if (domain === 'strength') {
    const count = 1 + random.integer(4);
    const planned = random.shuffle(PATTERNS).slice(0, count);
    const effective = planned.filter((_, index) => index <= random.integer(planned.length));
    return {
      planned,
      effective: effective.length > 0 ? effective : [planned[0]],
      primary: random.pick(planned),
      archetype: planned.some((value) => value === 'squat' || value === 'hinge') &&
        planned.some((value) => value === 'push' || value === 'pull')
        ? 'full_body'
        : planned.some((value) => value === 'squat' || value === 'hinge') ? 'lower' : 'upper',
    };
  }
  if (domain === 'components') {
    const count = 1 + random.integer(COMPONENTS.length);
    return { components: random.shuffle(COMPONENTS).slice(0, count) };
  }
  if (domain === 'conditioning') {
    const modalities = random.shuffle(MODALITIES).slice(0, 1 + random.integer(3));
    return {
      modalities,
      intent: random.pick(['aerobic', 'tempo', 'high-intensity'] as const),
      duration: random.pick([8, 10, 20, 25, 30] as const),
    };
  }
  if (domain === 'power') {
    return {
      state: random.pick(['none', 'primer', 'contrast'] as const),
      phase: random.pick(['early_offseason', 'mid_offseason', 'late_offseason', 'in_season'] as const),
      heavyLift: random.pick(['present', 'missing', 'mismatched'] as const),
      gOffset: random.pick([-2, -1, 0, 2, 4] as const),
    };
  }
  if (domain === 'constraints') {
    return {
      restriction: random.pick(['none', 'upper', 'hamstring', 'knee', 'low_readiness'] as const),
      equipment: random.pick(['bodyweight', 'home', 'commercial'] as const),
      severity: random.pick([0, 4, 6, 9] as const),
    };
  }
  if (domain === 'placement') {
    const from = 1 + random.integer(5);
    let to = 1 + random.integer(5);
    if (to === from) to = to === 5 ? 1 : to + 1;
    return { from, to, gameDay: random.pick([0, 6] as const), swap: ordinal % 2 === 0 };
  }
  const operations = random.shuffle([
    'add_exercise', 'remove_exercise', 'replace_exercise', 'add_conditioning',
    'replace_modality', 'add_support', 'move', 'swap', 'remove_main_lift',
    'repeat_week', 'rebuild',
  ]).slice(0, 3 + random.integer(4));
  return { operations };
}

export function generatePropertyCases(args: {
  seed?: string;
  countPerDomain?: number;
  domain?: GeneratedDomain;
  caseId?: string;
} = {}): GeneratedPropertyCase[] {
  const seed = args.seed ?? DEFAULT_EXTENDED_SEED;
  const domains = args.domain ? [args.domain] : DOMAINS;
  const count = args.countPerDomain ?? 12;
  const cases: GeneratedPropertyCase[] = [];
  for (const domain of domains) {
    const random = new DeterministicRandom(`${seed}:${domain}`);
    for (let index = 0; index < count; index++) {
      const id = `${domain}-${String(index + 1).padStart(2, '0')}`;
      if (args.caseId && args.caseId !== id) continue;
      cases.push({
        id, seed, domain,
        referenceDate: '2026-03-23',
        timezone: 'Australia/Melbourne',
        data: caseData(domain, random, index),
      });
    }
  }
  return cases;
}
