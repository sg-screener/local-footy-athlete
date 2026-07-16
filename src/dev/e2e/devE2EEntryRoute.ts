import { isDevE2ESeedId, type DevE2ESeedId } from './devE2ESeedIds';

export type DevE2EEntryRoute =
  | { kind: 'reset'; seedId: DevE2ESeedId }
  | { kind: 'checkpoint'; checkpointId: DevE2ESeedId };

const EXACT_E2E_ROUTE = /^localfootyathlete:\/\/e2e\/(reset|checkpoint)\/([a-z0-9-]+)$/;

export function parseDevE2EEntryRoute(url: string | null | undefined): DevE2EEntryRoute | null {
  if (!url) return null;
  const match = EXACT_E2E_ROUTE.exec(url);
  if (!match || !isDevE2ESeedId(match[2])) return null;
  return match[1] === 'reset'
    ? { kind: 'reset', seedId: match[2] }
    : { kind: 'checkpoint', checkpointId: match[2] };
}
