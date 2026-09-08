(global as any).__DEV__ = false;
import assert from 'node:assert/strict';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import { muscleMetadataFor } from '../data/muscleExperienceMetadata';
import { POWER_EXERCISE_POOL } from '../rules/powerExercisePool';
import type { ExperienceLevel } from '../types/domain';

let cases = 0;
for (const experienceLevel of ['Complete beginner', '1-2 years', '2-5 years', '5+ years'] as ExperienceLevel[]) {
  for (const name of ['Broad Jumps', 'Jump Squats', 'Depth Jumps']) {
    assert.equal(muscleMetadataFor(name)?.experienceGate, 'one_plus_years', name);
    assert.equal(POWER_EXERCISE_POOL.find(row => row.name === name)?.minTrainingAge, 'developing', name);
    for (const route of ['automatic', 'warmup', 'primer', 'manual'] as const) {
      // Game/injury/phase restrictions are independently preserved.
      assert.equal(exerciseProgrammingAllows(name, { experienceLevel, route }),
        experienceLevel !== 'Complete beginner', `${name}/${experienceLevel}/${route}`);
      cases++;
    }
  }
  for (const route of ['automatic', 'warmup', 'primer'] as const) {
    assert.equal(exerciseProgrammingAllows('Dragon Flag', { experienceLevel, route }),
      experienceLevel === '5+ years', `Dragon Flag/${experienceLevel}/${route}`);
    cases++;
  }
}
console.log(`PASS automatic experience admission: ${cases} distinct exercise/experience/route cases`);
