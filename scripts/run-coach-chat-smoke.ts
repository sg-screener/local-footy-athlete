import { resolve } from 'path';
import { loadEnvFile } from 'process';
import { coachLabFixtureSnapshot } from '../src/dev/coachLab/coachLabCases';
import { askCoachReadOnly } from '../src/services/api/coachChat';

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), '.env'));
  const message = process.argv.slice(2).join(' ').trim() || 'whats on thurs?';
  const answer = await askCoachReadOnly({
    message,
    snapshot: coachLabFixtureSnapshot(),
    conversationContext: { recentTurns: [], activeProgramTarget: null },
  });
  console.log(JSON.stringify({ message, answer, programActions: [] }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Coach chat smoke failed.');
  process.exit(1);
});
