/**
 * Script to find ExerciseDB IDs and GIF URLs for our staple exercises.
 * Run with: node scripts/find-exercise-ids.js
 *
 * This queries the free ExerciseDB API and outputs a mapping we can hardcode.
 */

const EXERCISES_TO_FIND = [
  // Lower Body
  'back squat', 'box squat', 'trap bar deadlift', 'romanian deadlift',
  'single leg deadlift', 'bulgarian split squat', 'goblet squat',
  'lunge', 'walking lunge', 'nordic curl',
  'lying leg curl', 'leg extension', 'standing calf raise',
  'jump squat', 'box jump',
  // Upper Push
  'bench press', 'incline dumbbell bench press', 'military press',
  'dumbbell shoulder press', 'seated overhead press', 'landmine press',
  'chest dip', 'push up',
  // Upper Pull
  'pull up', 'chin up', 'barbell bent over row',
  'dumbbell incline row', 'dumbbell one arm row', 'cable face pull',
  // Arms/Accessories
  'skull crusher', 'dumbbell bicep curl', 'dumbbell incline curl',
  'dumbbell lateral raise', 'dumbbell shrug',
  // Core/Carries
  'wheel rollout', 'hanging leg raise',
  'back extension', 'glute ham raise',
  'farmer walk',
];

const API_ENDPOINTS = [
  'https://exercisedb-api.vercel.app/api/v1',
];

async function searchExercise(baseUrl, name) {
  const urls = [
    `${baseUrl}/exercises/name/${encodeURIComponent(name)}?limit=3`,
    `${baseUrl}/exercises?search=${encodeURIComponent(name)}&limit=3`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      const list = data?.data?.exercises || data?.data || data?.exercises || (Array.isArray(data) ? data : null);
      if (list && list.length > 0) return list.slice(0, 3);
    } catch {
      continue;
    }
  }
  return null;
}

async function main() {
  console.log('Searching ExerciseDB for exercises...\n');
  console.log('// Paste this into exerciseVideoService.ts as EXERCISE_DEMO_VIDEOS\n');
  console.log('const EXERCISE_DEMO_VIDEOS: Record<string, string | null> = {');

  for (const name of EXERCISES_TO_FIND) {
    let found = false;
    for (const endpoint of API_ENDPOINTS) {
      const results = await searchExercise(endpoint, name);
      if (results && results.length > 0) {
        const best = results[0];
        const gifUrl = best.gifUrl || best.imageUrl || 'NO_GIF';
        console.log(`  // ${name} → ${best.name} (id: ${best.id})`);
        console.log(`  '${name}': '${gifUrl}',`);

        // Show alternatives if first result doesn't look right
        if (results.length > 1) {
          for (let i = 1; i < results.length; i++) {
            const alt = results[i];
            console.log(`  // ALT: ${alt.name} (id: ${alt.id}) → ${alt.gifUrl || alt.imageUrl || 'NO_GIF'}`);
          }
        }
        console.log('');
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`  // ❌ NOT FOUND: ${name}`);
      console.log('');
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('};');
  console.log('\n✅ Done! Review the output above and pick the correct entries.');
  console.log('For any wrong matches, manually search at: https://exercisedb-api.vercel.app/api/v1/exercises/name/{name}');
}

main().catch(console.error);
