/** Diagnostic actions use the athlete's durable door, never a copied workout. */
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import type { DevE2EAuxiliaryState } from './devE2ESeedRegistry';

export async function applyDevE2ESeedAction(
  item: Extract<DevE2EAuxiliaryState, { kind: 'program_control' }>,
): Promise<void> {
  const result = await executeProgramControlActionDurably(item.action, { todayISO: item.todayISO });
  if (!result.ok || !result.changedProgram) {
    throw new Error(`dev_e2e_seed_action_refused:${item.action.type}:${result.message ?? 'unchanged'}`);
  }
}
