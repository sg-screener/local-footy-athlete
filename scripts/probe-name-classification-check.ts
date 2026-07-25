/** DIAGNOSTIC: sanity-check the probe's exact/matcher/unresolved classifier. */
import {
  curatedExerciseVocabulary,
  canonicalExerciseName,
  hasCuratedCue,
} from '../src/utils/exerciseCanonicalisation';

const vocab = new Set(curatedExerciseVocabulary());
const samples = [
  'RDLs', 'Pull-Ups', 'Chest Supported Row', 'Bicep Curl (Dumbbell)',
  'Box Squat', 'Nordic Lower', 'Ab Wheel', 'Calf Raises', 'Face Pull',
  'Band Pallof Press', 'Hamstring Curl',
  'Totally Made Up Movement',
];
for (const n of samples) {
  console.log(
    `${JSON.stringify(n).padEnd(28)} exact=${String(vocab.has(n)).padEnd(5)} `
      + `canonical=${JSON.stringify(canonicalExerciseName(n)).padEnd(30)} hasCue=${hasCuratedCue(n)}`,
  );
}
console.log('curated vocabulary size:', vocab.size);
