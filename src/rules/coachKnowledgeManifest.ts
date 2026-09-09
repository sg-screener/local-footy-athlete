export type CoachKnowledgeAuthority = 'lfa_bible' | 'active_rule' | 'canonical_source' | 'app_map';

export interface CoachKnowledgeSourceSpec {
  readonly path: string;
  readonly authority: CoachKnowledgeAuthority;
}

/** One source list for Lab retrieval and the deployed read-only Coach. */
export const COACH_KNOWLEDGE_SOURCE_SPECS: readonly CoachKnowledgeSourceSpec[] = [
  { path: 'docs/LFA_PROGRAMMING_BIBLE.md', authority: 'lfa_bible' },
  { path: 'docs/RULINGS_REGISTRY.md', authority: 'active_rule' },
  { path: 'src/data/exercisePoolsStrength.ts', authority: 'canonical_source' },
  { path: 'src/data/exerciseTags.ts', authority: 'canonical_source' },
  { path: 'src/data/exerciseEquipmentRequirement.ts', authority: 'canonical_source' },
  { path: 'src/data/conditioningTemplates.ts', authority: 'canonical_source' },
  /** Generated from `src/rules/coachAppMap.ts` by `npm run coach:app-map:build` (slice S3). */
  { path: 'docs/generated/COACH_APP_MAP.md', authority: 'app_map' },
] as const;
