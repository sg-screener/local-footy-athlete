export type CanonicalCoachKnowledgeAuthority =
  | 'lfa_bible'
  | 'active_rule'
  | 'canonical_source'
  | 'approved_example'
  /** The app's doors, generated from the signed labels (slice S3). */
  | 'app_map';

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
      readonly timing?: { readonly relationToAsOf?: unknown };
      readonly parts: readonly {
        readonly kind: string;
        readonly headline: unknown;
        /** Model-projected rows carry `exercise`; a raw Snapshot's rows carry `name`. */
        readonly rows?: readonly unknown[];
      }[];
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
  /** The `R-nnn` a registry chunk IS, when the chunk is one ruling (slice S2). */
  readonly ruling?: string;
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

/**
 * The words of the session the question is about: today's parts and exercise
 * rows, or the named weekday's when the message names one. "can i do leg
 * curls instead of nordics" reaches R-394 because "nordic" is both in the
 * message and in today's rows (slice S2, 2026-09-10).
 */
function sessionSearchText(message: string, snapshot: RetrievalSnapshot): string {
  const days = snapshot.visibleWeek?.days ?? [];
  const lower = message.toLowerCase();
  const named = days.find((day) => {
    const weekday = (day as { weekday?: unknown }).weekday;
    return typeof weekday === 'string' && lower.includes(weekday.toLowerCase().slice(0, 3));
  });
  const today = days.find((day) => day.timing?.relationToAsOf === 'today');
  const target = named ?? today;
  if (!target) return '';
  const rowName = (row: unknown): string => {
    if (!row || typeof row !== 'object') return '';
    const typed = row as { exercise?: unknown; name?: unknown };
    return String(typed.exercise ?? typed.name ?? '');
  };
  return target.parts.flatMap((part) => [
    String(part.headline ?? ''),
    part.kind,
    ...(part.rows ?? []).map(rowName),
  ]).join(' ');
}

function queryWeights(message: string, snapshot: RetrievalSnapshot): ReadonlyMap<string, number> {
  const weights = new Map<string, number>();
  addWeightedTerms(weights, message, 8);
  addWeightedTerms(weights, JSON.stringify(snapshot.readiness), 2);
  addWeightedTerms(weights, readinessCanonicalSearchText(snapshot.readiness), 12);
  addWeightedTerms(weights, JSON.stringify(snapshot.restrictions), 4);
  addWeightedTerms(weights, JSON.stringify(snapshot.situation?.season ?? null), 5);
  addWeightedTerms(weights, sessionSearchText(message, snapshot), 3);
  return weights;
}

/** A registry ruling row, or an app-map door row — both are one chunk each. */
const RULING_HEADING = /^(?:\*\*|## )(R-\d{3}|DOOR-[a-z0-9-]+)\b/;
/** Ruling slots ranked by the athlete's words alone, seated before the context fills the rest. */
const QUESTION_RULING_SLOTS = 6;
/** Door slots ranked by the athlete's words alone (slice S3). */
const QUESTION_DOOR_SLOTS = 2;
const SECTION_HEADING = /^## /;

/**
 * The registry is ONE CHUNK PER RULING (slice S2). Sliding windows cut a
 * ruling in half and put two unrelated rulings in one window; the ranker then
 * scored the window, not the rule. A ruling row runs from its `**R-nnn**` or
 * `## R-nnn` heading to the line before the next heading or section title.
 * Ids keep the exact line-slice form; `ruling` names the row.
 */
function chunkRulings(source: CanonicalCoachKnowledgeSource): readonly RetrievedCoachKnowledgeChunk[] {
  const lines = source.content.split('\n');
  const chunks: RetrievedCoachKnowledgeChunk[] = [];
  let start = -1;
  let ruling = '';
  const flush = (end: number): void => {
    if (start < 0) return;
    let last = end;
    while (last > start + 1 && lines[last - 1].trim() === '') last -= 1;
    const content = lines.slice(start, last).join('\n');
    chunks.push({
      id: `${source.path}:L${start + 1}-L${last}`,
      path: source.path,
      authority: source.authority,
      startLine: start + 1,
      endLine: last,
      content: content.length > 7_000 ? content.slice(0, 7_000) : content,
      score: 0,
      ruling,
    });
  };
  lines.forEach((line, index) => {
    const heading = RULING_HEADING.exec(line);
    if (heading) {
      flush(index);
      start = index;
      ruling = heading[1];
      return;
    }
    if (SECTION_HEADING.test(line) || line.trim() === '---') {
      flush(index);
      start = -1;
    }
  });
  flush(lines.length);
  return chunks;
}

/** A ruling written for the athlete's phase outranks one written for another. */
function phaseAffinity(chunk: RetrievedCoachKnowledgeChunk, season: unknown): number {
  if (chunk.authority !== 'active_rule' || !season || typeof season !== 'object') return 1;
  const phase = (season as { phase?: unknown }).phase;
  if (typeof phase !== 'string') return 1;
  const own = phase.toLowerCase().replace(/[^a-z]/g, '');
  const mentions = (name: string): boolean => new RegExp(`\\b${name}[- ]?season\\b`, 'i').test(chunk.content);
  // Only a boost: a row that names another phase is often the row that
  // gates BY phase (R-003's COD gate names all three), so it is never demoted.
  return mentions(own.replace('season', '')) ? 1.3 : 1;
}

/**
 * How much of the question's SUBJECT a ruling row's title carries: the sum of
 * the rarity of each question term found in the title. "sprint" (60 rows)
 * outweighs "every" + "week" (hundreds), so R-062's title wins the sprint
 * question over a row titled "Every canonical week …".
 */
function headingMatches(
  chunk: RetrievedCoachKnowledgeChunk,
  questionWeights: ReadonlyMap<string, number>,
  inverseDocumentFrequency: ReadonlyMap<string, number>,
): number {
  if (!chunk.ruling) return 0;
  const heading = new Set(tokens(chunk.authority === 'app_map'
    ? chunk.content
    : chunk.content.split('\n')[0].slice(0, 240)));
  let matched = 0;
  for (const term of questionWeights.keys()) {
    if (heading.has(term)) matched += inverseDocumentFrequency.get(term) ?? 1;
  }
  return matched;
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
  // A ruling chunk's heading is its first line (`**R-nnn** · title …`),
  // however long; a window's headings are its short title-shaped lines.
  // A door row is one line whose subject is spread across label, place and
  // "when"; the whole row is its title. A ruling's title is its first line.
  const headingSource = chunk.authority === 'app_map'
    ? chunk.content
    : chunk.ruling
    ? chunk.content.split('\n')[0].slice(0, 240)
    : chunk.content.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 1
        && line.length <= 60
        && line.split(/\s+/).length <= 8
        && !line.startsWith('*')
        && !/[.!?:;]$/.test(line))
      .join(' ');
  const headingTokens = new Set(tokens(headingSource));
  let score = 0;
  for (const [term, weight] of weights) {
    const count = bodyCounts.get(term) ?? 0;
    if (count === 0) continue;
    const rarity = inverseDocumentFrequency.get(term) ?? 1;
    score += weight * rarity * Math.min(count, 4);
    // A term in the row's own title is the row's subject: a short ruling must
    // beat a long one that merely mentions the word four times.
    if (headingTokens.has(term)) score += weight * rarity * (chunk.ruling ? 10 : 6);
  }
  if (score > 0 && chunk.authority === 'active_rule') score += 3;
  // A door row is short and written in the athlete's words; a "how do i" or
  // "where do i" question is about the app, and the door must win it.
  if (score > 0 && chunk.authority === 'app_map') score += 3;
  // One ruling per chunk means chunks of very different length compete; a
  // long row must not win on bulk alone (slice S2).
  if (chunk.ruling && chunk.content.length > 1_500) {
    score /= 1 + Math.log(chunk.content.length / 1_500);
  }
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
  const allChunks = args.sources.flatMap((source) => (
    source.authority === 'active_rule' || source.authority === 'app_map'
      ? chunkRulings(source)
      : chunkSource(source)
  ));
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
  const season = args.snapshot.situation?.season ?? null;
  const byScore = (left: RetrievedCoachKnowledgeChunk, right: RetrievedCoachKnowledgeChunk): number =>
    right.score - left.score
      || left.path.localeCompare(right.path)
      || left.startLine - right.startLine;
  const ranked = allChunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, weights, inverseDocumentFrequency) * phaseAffinity(chunk, season),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort(byScore);

  const selected: RetrievedCoachKnowledgeChunk[] = [];
  const mandatory = safetyChunk(allChunks);
  if (mandatory) selected.push({ ...mandatory, score: Number.MAX_SAFE_INTEGER });

  // Slice S2: the QUESTION gets its own ruling slots. The readiness and
  // session words in the context are weighted for the tired/sore case and
  // would otherwise pull the same readiness rows into every answer; the
  // rulings the athlete's own words reach are ranked by those words alone
  // and seated first, then the context fills the rest.
  const questionWeights = new Map<string, number>();
  addWeightedTerms(questionWeights, args.athleteMessage, 8);
  // A ruling whose TITLE carries the question's words is the row about that
  // subject; it outranks every row that only mentions them in the body.
  const questionRulings = allChunks
    .filter((chunk) => chunk.authority === 'active_rule')
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, questionWeights, inverseDocumentFrequency) * phaseAffinity(chunk, season),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => headingMatches(right, questionWeights, inverseDocumentFrequency)
      - headingMatches(left, questionWeights, inverseDocumentFrequency)
      || byScore(left, right))
    .slice(0, QUESTION_RULING_SLOTS);
  // Doors are seated the same way (slice S3): "where do i log the game" is
  // about the app, and the readiness context must not crowd the door out.
  const questionDoors = allChunks
    .filter((chunk) => chunk.authority === 'app_map')
    .map((chunk) => ({ ...chunk, score: scoreChunk(chunk, questionWeights, inverseDocumentFrequency) }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => headingMatches(right, questionWeights, inverseDocumentFrequency)
      - headingMatches(left, questionWeights, inverseDocumentFrequency)
      || byScore(left, right))
    .slice(0, QUESTION_DOOR_SLOTS);
  for (const chunk of [...questionRulings, ...questionDoors]) {
    const nextCharacters = selected.reduce((total, entry) => total + entry.content.length, 0)
      + chunk.content.length;
    if (nextCharacters > maximumSelectedCharacters) continue;
    selected.push(chunk);
  }
  const selectedByAuthority: Record<CanonicalCoachKnowledgeAuthority, number> = {
    active_rule: selected.filter((chunk) => chunk.authority === 'active_rule').length,
    lfa_bible: 0,
    canonical_source: 0,
    approved_example: 0,
    app_map: selected.filter((chunk) => chunk.authority === 'app_map').length,
  };
  // Slice S2: a ruling chunk is one short row, so eight of them cost less
  // than the two 72-line windows they replace.
  const authorityLimits: Record<CanonicalCoachKnowledgeAuthority, number> = {
    active_rule: 8,
    lfa_bible: 6,
    canonical_source: 2,
    approved_example: 1,
    app_map: 4,
  };
  let rankedSelections = 0;
  for (const chunk of ranked) {
    if (rankedSelections >= (args.maxRankedChunks ?? 16)) break;
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
      app_map: 4,
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
