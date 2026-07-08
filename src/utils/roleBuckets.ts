import type { OnboardingData, Position, RoleBucket } from '../types/domain';

export const ROLE_BUCKET_OPTIONS: Array<{ id: RoleBucket; label: string }> = [
  { id: 'inside_mid', label: 'Inside mid' },
  { id: 'outside_runner', label: 'Outside mid' },
  { id: 'key_position_ruck_tall', label: 'Key position / ruck' },
  { id: 'high_forward_back', label: 'High forward / back' },
  { id: 'small_forward_back', label: 'Small forward / back' },
];

export const DEFAULT_ROLE_BUCKET: RoleBucket = 'inside_mid';

export type ProgrammingRoleBias =
  | 'inside_mid'
  | 'outside_runner'
  | 'key_position_ruck_tall'
  | 'small_forward_back';

const ROLE_BUCKET_LABELS: Record<RoleBucket, string> = ROLE_BUCKET_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option.label;
    return acc;
  },
  {} as Record<RoleBucket, string>,
);

const ROLE_ALIASES: Record<string, RoleBucket> = {
  inside_mid: 'inside_mid',
  inside_midfielder: 'inside_mid',
  inside_midfield: 'inside_mid',
  inside_midfielders: 'inside_mid',
  inside_midfield_runner: 'inside_mid',
  midfielder: 'inside_mid',
  midfield: 'inside_mid',
  mid: 'inside_mid',
  mids: 'inside_mid',

  outside_runner: 'outside_runner',
  outside_mid: 'outside_runner',
  outside_midfielder: 'outside_runner',
  outside_midfield: 'outside_runner',
  outside: 'outside_runner',
  wing: 'outside_runner',
  winger: 'outside_runner',
  wingman: 'outside_runner',
  runner: 'outside_runner',

  high_forward_back: 'high_forward_back',
  high_forward: 'high_forward_back',
  high_back: 'high_forward_back',
  high_fwd: 'high_forward_back',
  high_half_forward: 'high_forward_back',
  high_half_back: 'high_forward_back',
  half_forward: 'high_forward_back',
  half_back: 'high_forward_back',
  hff: 'high_forward_back',
  hbf: 'high_forward_back',

  key_position_ruck_tall: 'key_position_ruck_tall',
  key_position_ruck: 'key_position_ruck_tall',
  key_position: 'key_position_ruck_tall',
  key_pos: 'key_position_ruck_tall',
  key_back: 'key_position_ruck_tall',
  key_defender: 'key_position_ruck_tall',
  key_forward: 'key_position_ruck_tall',
  tall_forward: 'key_position_ruck_tall',
  tall_back: 'key_position_ruck_tall',
  tall_defender: 'key_position_ruck_tall',
  tall: 'key_position_ruck_tall',
  ruck: 'key_position_ruck_tall',
  ruckman: 'key_position_ruck_tall',

  small_forward_back: 'small_forward_back',
  small_forward: 'small_forward_back',
  small_back: 'small_forward_back',
  small_defender: 'small_forward_back',
  small: 'small_forward_back',
  forward_pocket: 'small_forward_back',
  back_pocket: 'small_forward_back',
  pressure_forward: 'small_forward_back',
};

function normalizedKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' ')
    .replace(/\//g, ' ')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '_');
}

export function normalizeRoleBucket(value: unknown): RoleBucket {
  const key = normalizedKey(value);
  if (!key) return DEFAULT_ROLE_BUCKET;
  return ROLE_ALIASES[key] ?? DEFAULT_ROLE_BUCKET;
}

export function roleBucketLabel(value: unknown): string {
  return ROLE_BUCKET_LABELS[normalizeRoleBucket(value)];
}

export function getRoleDisplayLabel(value: unknown): string {
  return roleBucketLabel(value);
}

export function getProgrammingRoleBias(value: unknown): ProgrammingRoleBias {
  const role = normalizeRoleBucket(value);
  if (role === 'high_forward_back') return 'outside_runner';
  return role;
}

export function programmingRoleBiasLabel(value: unknown): string {
  const bias = getProgrammingRoleBias(value);
  if (bias === 'outside_runner') return 'Outside mid / high forward-back style bias';
  return roleBucketLabel(bias);
}

export function normalizePosition(value: unknown): Position {
  return normalizeRoleBucket(value);
}

export function normalizeOnboardingRole(data: OnboardingData): OnboardingData {
  if (!data.position) return data;
  const normalized = normalizeRoleBucket(data.position);
  if (data.position === normalized) return data;
  return {
    ...data,
    position: normalized,
  };
}
