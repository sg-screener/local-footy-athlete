import type { CoachSnapshot } from '../../rules/liveAthleteSnapshot';
import type { CoachLabKnowledgeSource } from './coachLab';

export type CanonicalCoachKnowledgeAuthority = CoachLabKnowledgeSource['authority'];

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

const QUERY_EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
  root: ['tired', 'fatigue', 'cooked', 'sore', 'soreness', 'readiness', 'slight', 'reduction', 'volume', 'accessories'],
  flat: ['tired', 'fatigue', 'cooked', 'readiness', 'deload', 'recovery'],
  skip: ['missed', 'session', 'delete', 'keep', 'reduction'],
  miss: ['session', 'skip', 'move', 'cram', 'overload'],
  cram: ['missed', 'session', 'move', 'overload', 'week'],
  shoulder: ['injury', 'pain', 'pressing', 'alternative', 'swap', 'movement'],
  knee: ['injury', 'pain', 'sore', 'range', 'alternative', 'lower'],
  sore: ['soreness', 'injury', 'pain', 'readiness', 'reduction'],
  painful: ['pain', 'injury', 'severity', 'alternative'],
  machine: ['equipment', 'apparatus', 'kit', 'exercise', 'alternative', 'swap'],
  same: ['alternative', 'swap', 'movement', 'pattern', 'muscle'],
  thurs: ['thursday', 'schedule', 'week', 'session', 'program'],
  play: ['game', 'fixture', 'match', 'week', 'schedule'],
  footy: ['game', 'team', 'training', 'fixture', 'recovery'],
  strength: ['lift', 'load', 'progress', 'maintain', 'volume'],
  los: ['progress', 'maintain', 'strength', 'load'],
  deload: ['fatigue', 'readiness', 'recovery', 'cooked', 'week'],
};

function stem(token: string): string {
  if (token.length > 5 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
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
  expand: boolean,
): void {
  for (const token of tokens(text)) {
    weights.set(token, Math.max(weights.get(token) ?? 0, weight));
    if (!expand) continue;
    for (const expanded of QUERY_EXPANSIONS[token] ?? []) {
      const normalised = stem(expanded);
      weights.set(normalised, Math.max(weights.get(normalised) ?? 0, Math.max(1, weight - 2)));
    }
  }
}

function queryWeights(message: string, snapshot: CoachSnapshot): ReadonlyMap<string, number> {
  const weights = new Map<string, number>();
  addWeightedTerms(weights, message, 8, true);
  addWeightedTerms(weights, JSON.stringify(snapshot.readiness), 4, true);
  addWeightedTerms(weights, JSON.stringify(snapshot.restrictions), 4, true);
  addWeightedTerms(weights, JSON.stringify(snapshot.load), 2, false);
  addWeightedTerms(weights, JSON.stringify(snapshot.progress), 2, false);
  for (const day of snapshot.visibleWeek.days) {
    addWeightedTerms(weights, `${day.kind} ${day.headline}`, 1, true);
    for (const part of day.parts) addWeightedTerms(weights, `${part.kind} ${part.headline}`, 1, true);
  }
  return weights;
}

function queryPhrases(message: string): readonly string[] {
  const messageTokens = new Set(tokens(message));
  const phrases: string[] = [];
  if (['root', 'tired', 'flat', 'sore'].some((token) => messageTokens.has(token))) {
    phrases.push('tired today', 'sore', 'slight reduction');
  }
  if (['miss', 'cram', 'skip'].some((token) => messageTokens.has(token))) {
    phrases.push('missed session', 'missed multiple sessions');
  }
  if (['shoulder', 'knee', 'painful'].some((token) => messageTokens.has(token))) {
    phrases.push('injury', 'pain', 'reintroduction rules');
  }
  if (['machine', 'equipment'].some((token) => messageTokens.has(token))) {
    phrases.push('equipment', 'exercise alternatives');
  }
  if (messageTokens.has('deload')) phrases.push('when to deload', 'deload rules');
  return phrases;
}

function chunkSource(source: CanonicalCoachKnowledgeSource): readonly RetrievedCoachKnowledgeChunk[] {
  const lines = source.content.split('\n');
  const chunks: RetrievedCoachKnowledgeChunk[] = [];
  let start = 0;
  while (start < lines.length) {
    let end = Math.min(lines.length, start + 36);
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
    start = end;
  }
  return chunks;
}

function scoreChunk(
  chunk: RetrievedCoachKnowledgeChunk,
  weights: ReadonlyMap<string, number>,
  phrases: readonly string[],
): number {
  const bodyCounts = new Map<string, number>();
  for (const token of tokens(chunk.content)) bodyCounts.set(token, (bodyCounts.get(token) ?? 0) + 1);
  const headingTokens = new Set(tokens(chunk.content.split('\n')
    .filter((line) => line.trim().length > 1 && line.trim().length <= 80 && !line.trim().startsWith('*'))
    .join(' ')));
  let score = 0;
  for (const [term, weight] of weights) {
    const count = bodyCounts.get(term) ?? 0;
    if (count === 0) continue;
    score += weight * Math.min(count, 4);
    if (headingTokens.has(term)) score += weight * 6;
  }
  const normalisedContent = chunk.content.toLowerCase();
  const normalisedLines = chunk.content.split('\n').map((line) => line.trim().toLowerCase());
  for (const phrase of phrases) {
    if (normalisedContent.includes(phrase)) score += 120;
    if (normalisedLines.includes(phrase)) score += 400;
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
  readonly snapshot: CoachSnapshot;
  readonly sources: readonly CanonicalCoachKnowledgeSource[];
  readonly maxSelectedCharacters?: number;
  readonly maxRankedChunks?: number;
}): CoachLabKnowledgeRetrieval {
  const maximumSelectedCharacters = args.maxSelectedCharacters ?? 60_000;
  const allChunks = args.sources.flatMap(chunkSource);
  const weights = queryWeights(args.athleteMessage, args.snapshot);
  const phrases = queryPhrases(args.athleteMessage);
  const ranked = allChunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(chunk, weights, phrases) }))
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
