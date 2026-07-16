import fs from 'node:fs';
import path from 'node:path';
import {
  assertAthleteActionArtifactBundleV2,
  type AthleteActionArtifactBundleV2,
} from '../src/dev/e2e/athleteActionArtifactBundle';

/** Node runner adapter for the pure in-app collector. */
export function writeAthleteActionArtifactBundleV2(
  bundle: AthleteActionArtifactBundleV2,
  repositoryRoot = process.cwd(),
): string[] {
  assertAthleteActionArtifactBundleV2(bundle);
  const artifactRoot = path.resolve(repositoryRoot, 'artifacts');
  const written: string[] = [];
  for (const [relativePath, contents] of Object.entries(bundle.files)) {
    const outputPath = path.resolve(repositoryRoot, relativePath);
    if (outputPath !== artifactRoot && !outputPath.startsWith(`${artifactRoot}${path.sep}`)) {
      throw new Error(`athlete_action_artifact_path_escape:${relativePath}`);
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, contents, 'utf8');
    written.push(outputPath);
  }
  return written.sort();
}
