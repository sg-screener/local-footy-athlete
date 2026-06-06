import type { ReadinessQuickOption, ReadinessSignal } from '../utils/readiness';

interface ReadinessQuickCheckProps {
  signal?: ReadinessSignal | null;
  onSelect: (option: ReadinessQuickOption) => void;
  onClear: () => void;
}

export function ReadinessQuickCheck(_props: ReadinessQuickCheckProps) {
  return null;
}
