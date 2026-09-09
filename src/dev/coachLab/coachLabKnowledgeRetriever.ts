export type CanonicalCoachKnowledgeAuthority =
  | 'lfa_bible'
  | 'active_rule'
  | 'canonical_source'
  | 'approved_example';

interface RetrievalSnapshot {
  readonly readiness: unknown;
  readonly restrictions: unknown;
  /** Where the athlete is in the year (R-397); phase words steer the ruling search. */
  readonly situation?: { readonly season?: unknown };
  readonly load: unknown;
  readonly progress: unknown;
  readonly visibleWeek: {
    readonly days: readonly {
      readonly kind: string;
      readonly headline: unknown;
      readonly parts: readonly { readonly kind: string; readonly headline: unknown }[];
    }[];
  };
}

export interface CanonicalCoachKnowledgeSource {
  readonly path: string;
  readonly authority: CanonicalCoachKnowledgeAuthority;
  readonly content: string;
}

export interface RetrievedCoachKnowledgeChunk {
  readonly id: string;
  readonly path: string;
  readonly authority: CanonicalCoachKnowledgeAuthority;
  readonly startLine: number;
  readonly endLine: number;
  readonly content: string;
  readonly score: number;
}

export interface CoachLabRetrievalReceipt {
  readonly unit: 'characters';
  readonly availableCharacters: number;
  readonly selectedCharacters: number;
  readonly selectedChunks: number;
  readonly maximumSelectedCharacters: number;
}

export interface CoachLabKnowledgeRetrieval {
  readonly chunks: readonly RetrievedCoachKnowledgeChunk[];
  readonly receipt: CoachLabRetrievalReceipt;
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'can', 'do', 'for', 'from',
  'got', 'have', 'i', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or',
  'that', 'the', 'this', 'to', 'wanna', 'what', 'when', 'with', 'you', 'your',
]);

function stem(token: string): string {
  if (token.length > 6 && token.endsWith('ness')) return token.slice(0, -4);
  if (token.length > 5 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith('ing')) {
    const base = token.slice(0, -3);
    return /(.)\1$/.test(base) ? base.slice(0, -1) : base;
  }
  if (token.length > 4 && token.endsWith('ed')) {
    const base = token.slice(0, -2);
    return /(.)\1$/.test(base) ? base.slice(0, -1) : base;
  }
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function readinessCanonicalSearchText(readiness: unknown): string {
  if (!readiness || typeof readiness !== 'object') return '';
  const signal = (readiness as { signal?: unknown }).signal;
  if (!signal || typeof signal !== 'object') return '';
  const typed = signal as {
    energy?: unknown;
    soreness?: unknown;
    painFlag?: unknown;
    flatToday?: unknown;
    poorSleepPattern?: unknown;
  };
  const canonicalTerms: string[] = [];
  if (typed.energy === 'low') canonicalTerms.push('tired fatigue reduction');
  if (typeof typed.soreness === 'string' && typed.soreness !== 'none') {
    canonicalTerms.push('sore soreness reduction');
  }
  if (typed.soreness === 'moderate') canonicalTerms.push('moderate reduction');
  if (typed.painFlag === true) canonicalTerms.push('pain injury');
  if (typed.flatToday === true) canonicalTerms.push('flat tired fatigue readiness deload');
  if (typed.poorSleepPattern === true) canonicalTerms.push('poor sleep tired recovery readiness');
  return canonicalTerms.join(' ');
}

function tokens(text: string): readonly string[] {
  return text.toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(stem);
}

function addWeightedTerms(
  weights: Map<string, number>,
  text: string,
  weight: number,
): void {
  for (const token of tokens(text)) {
    weights.set(token, Math.max(weights.get(token) ?? 0, weight));
  }
}

function queryWeights(message: string, snapshot: RetrievalSnapshot): ReadonlyMap<string, number> {
  const weights = new Map<string, number>();
  addWeightedTerms(weights, message, 8);
  addWeightedTerms(weights, JSON.stringify(snapshot.readiness), 2);
  addWeightedTerms(weights, readinessCanonicalSearchText(snapshot.readiness), 12);
  addWeightedTerms(weights, JSON.stringify(snapshot.restrictions), 4);
  addWeightedTerms(weights, JSON.stringify(snapshot.situation?.season ?? null), 5);
  return weights;
}

function chunkSource(source: CanonicalCoachKnowledgeSource): readonly RetrievedCoachKnowledgeChunk[] {
  const lines = source.content.split('\n');
  const chunks: RetrievedCoachKnowledgeChunk[] = [];
  let start = 0;
  while (start < lines.length) {
    let end = Math.min(lines.length, start + 72);
    while (end > start + 8 && lines.slice(start, end).join('\n').length > 7_000) end -= 1;
    const content = lines.slice(start, end).join('\n');
    chunks.push({
      id: `${source.path}:L${start + 1}-L${end}`,
      path: source.path,
      authority: source.authority,
      startLine: start + 1,
      endLine: end,
      content,
      score: 0,
    });
    if (end === lines.length) break;
    start += Math.max(12, Math.floor((end - start) / 3));
  }
  return chunks;
}

function scoreChunk(
  chunk: RetrievedCoachKnowledgeChunk,
  weights: ReadonlyMap<string, number>,
  inverseDocumentFrequency: ReadonlyMap<string, number>,
): number {
  const bodyCounts = new Map<string, number>();
  for (const token of tokens(chunk.content)) bodyCounts.set(token, (bodyCounts.get(token) ?? 0) + 1);
  const headingTokens = new Set(tokens(chunk.content.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 1
      && line.length <= 60
      && line.split(/\s+/).length <= 8
      && !line.startsWith('*')
      && !/[.!?:;]$/.test(line))
    .join(' ')));
  let score = 0;
  for (const [term, weight] of weights) {
    const count = bodyCounts.get(term) ?? 0;
    if (count === 0) continue;
    const rarity = inverseDocumentFrequency.get(term) ?? 1;
    score += weight * rarity * Math.min(count, 4);
    if (headingTokens.has(term)) score += weight * rarity * 6;
  }
  if (score > 0 && chunk.authority === 'active_rule') score += 3;
  return score;
}

function safetyChunk(chunks: readonly RetrievedCoachKnowledgeChunk[]): RetrievedCoachKnowledgeChunk | null {
  return chunks.find((chunk) => chunk.path === 'docs/LFA_PROGRAMMING_BIBLE.md' && chunk.startLine === 1)
    ?? chunks.find((chunk) => chunk.authority === 'lfa_bible')
    ?? null;
}

/**
 * Pure local retrieval over exact canonical source text. Nothing is summarised
 * or persisted: a source edit changes the next retrieval immediately.
 */
export function retrieveCoachLabKnowledge(args: {
  readonly athleteMessage: string;
  readonly snapshot: RetrievalSnapshot;
  readonly sources: readonly CanonicalCoachKnowledgeSource[];
  readonly maxSelectedCharacters?: number;
  readonly maxRankedChunks?: number;
}): CoachLabKnowledgeRetrieval {
  const maximumSelectedCharacters = args.maxSelectedCharacters ?? 60_000;
  const allChunks = args.sources.flatMap(chunkSource);
  const documentFrequency = new Map<string, number>();
  for (const chunk of allChunks) {
    for (const token of new Set(tokens(chunk.content))) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const inverseDocumentFrequency = new Map(
    [...documentFrequency].map(([term, frequency]) => [
      term,
      Math.log((allChunks.length + 1) / (frequency + 1)) + 1,
    ]),
  );
  const weights = queryWeights(args.athleteMessage, args.snapshot);
  const ranked = allChunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(chunk, weights, inverseDocumentFrequency) }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score
      || left.path.localeCompare(right.path)
      || left.startLine - right.startLine);

  const selected: RetrievedCoachKnowledgeChunk[] = [];
  const mandatory = safetyChunk(allChunks);
  if (mandatory) selected.push({ ...mandatory, score: Number.MAX_SAFE_INTEGER });
  const selectedByAuthority: Record<CanonicalCoachKnowledgeAuthority, number> = {
    active_rule: 0,
    lfa_bible: 0,
    canonical_source: 0,
    approved_example: 0,
  };
  const authorityLimits: Record<CanonicalCoachKnowledgeAuthority, number> = {
    active_rule: 2,
    lfa_bible: 6,
    canonical_source: 2,
    approved_example: 1,
  };
  let rankedSelections = 0;
  for (const chunk of ranked) {
    if (rankedSelections >= (args.maxRankedChunks ?? 10)) break;
    if (selected.some((entry) => entry.id === chunk.id)) continue;
    if (selectedByAuthority[chunk.authority] >= authorityLimits[chunk.authority]) continue;
    const nextCharacters = selected.reduce((total, entry) => total + entry.content.length, 0)
      + chunk.content.length;
    if (nextCharacters > maximumSelectedCharacters) continue;
    selected.push(chunk);
    selectedByAuthority[chunk.authority] += 1;
    rankedSelections += 1;
  }

  selected.sort((left, right) => {
    const authorityOrder: Record<CanonicalCoachKnowledgeAuthority, number> = {
      active_rule: 0,
      lfa_bible: 1,
      canonical_source: 2,
      approved_example: 3,
    };
    return authorityOrder[left.authority] - authorityOrder[right.authority]
      || left.path.localeCompare(right.path)
      || left.startLine - right.startLine;
  });
  const selectedCharacters = selected.reduce((total, chunk) => total + chunk.content.length, 0);
  return {
    chunks: selected,
    receipt: {
      unit: 'characters',
      availableCharacters: args.sources.reduce((total, source) => total + source.content.length, 0),
      selectedCharacters,
      selectedChunks: selected.length,
      maximumSelectedCharacters,
    },
  };
}
