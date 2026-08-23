import type { InjuryBucket } from './programAdjustmentEngine';
import type { ConstraintRegion } from './exposureEngine';

const BUCKET_TO_REGION: Record<InjuryBucket, ConstraintRegion> = {
  shoulder: 'shoulder',
  elbow: 'elbow',
  'wrist/hand': 'wrist',
  knee: 'knee',
  'ankle/foot': 'ankle',
  calf: 'calf',
  hamstring: 'hamstring',
  groin: 'groin',
  lowerBack: 'back',
  hip: 'hip',
  quad: 'quad',
  neck: 'neck',
  ribs: 'ribs',
};

export function bucketToRegion(bucket: InjuryBucket): ConstraintRegion {
  return BUCKET_TO_REGION[bucket];
}
