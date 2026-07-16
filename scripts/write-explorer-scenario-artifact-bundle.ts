import fs from 'node:fs';
import path from 'node:path';
import {
  assertExplorerScenarioArtifactBundleV1,
  type ExplorerScenarioArtifactBundleV1,
  type ExplorerScenarioArtifactFailureCode,
  ExplorerScenarioArtifactValidationError,
} from '../src/dev/e2e/explorerScenarioArtifactBundle';

export const EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE = {
  OVERWRITE_REFUSED: 'explorer_scenario_artifact_overwrite_refused',
  ATOMIC_WRITE_FAILED: 'explorer_scenario_artifact_atomic_write_failed',
  INPUT_JSON_INVALID: 'explorer_scenario_artifact_input_json_invalid',
  USAGE_INVALID: 'explorer_scenario_artifact_writer_usage_invalid',
} as const;

export type ExplorerScenarioArtifactWriterFailureCode =
  (typeof EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE)[keyof typeof EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE];

export class ExplorerScenarioArtifactWriterError extends Error {
  readonly code: ExplorerScenarioArtifactWriterFailureCode;

  constructor(code: ExplorerScenarioArtifactWriterFailureCode) {
    super(code);
    this.name = 'ExplorerScenarioArtifactWriterError';
    this.code = code;
  }
}

export interface ExplorerScenarioArtifactWriterFileSystem {
  exists: (filePath: string) => boolean;
  makeDirectory: (directoryPath: string) => void;
  writeExclusive: (filePath: string, contents: string) => void;
  rename: (fromPath: string, toPath: string) => void;
  remove: (filePath: string) => void;
}

const nodeFileSystem: ExplorerScenarioArtifactWriterFileSystem = {
  exists: (filePath) => fs.existsSync(filePath),
  makeDirectory: (directoryPath) => fs.mkdirSync(directoryPath, { recursive: true }),
  writeExclusive: (filePath, contents) =>
    fs.writeFileSync(filePath, contents, { encoding: 'utf8', flag: 'wx' }),
  rename: (fromPath, toPath) => fs.renameSync(fromPath, toPath),
  remove: (filePath) => fs.unlinkSync(filePath),
};

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => [key, sortJsonValue((value as Record<string, unknown>)[key])]));
}

/** Stable object-key order; array order remains evidence order. */
export function serializeExplorerScenarioArtifactBundleV1(
  bundle: ExplorerScenarioArtifactBundleV1,
): string {
  assertExplorerScenarioArtifactBundleV1(bundle);
  return `${JSON.stringify(sortJsonValue(bundle), null, 2)}\n`;
}

let temporarySequence = 0;

function temporaryPathFor(
  outputPath: string,
  fileSystem: ExplorerScenarioArtifactWriterFileSystem,
): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    temporarySequence += 1;
    const candidate = `${outputPath}.tmp-${process.pid}-${temporarySequence}`;
    if (!fileSystem.exists(candidate)) return candidate;
  }
  throw new ExplorerScenarioArtifactWriterError(
    EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE.ATOMIC_WRITE_FAILED,
  );
}

/**
 * Validates before touching disk, writes a same-directory temporary file, and
 * atomically publishes it by rename. Nothing is uploaded or transmitted.
 */
export function writeExplorerScenarioArtifactBundleV1(
  bundle: ExplorerScenarioArtifactBundleV1,
  outputPath: string,
  options: {
    overwrite?: boolean;
    fileSystem?: ExplorerScenarioArtifactWriterFileSystem;
  } = {},
): string {
  const serialized = serializeExplorerScenarioArtifactBundleV1(bundle);
  const fileSystem = options.fileSystem ?? nodeFileSystem;
  const resolvedOutputPath = path.resolve(outputPath);
  if (fileSystem.exists(resolvedOutputPath) && options.overwrite !== true) {
    throw new ExplorerScenarioArtifactWriterError(
      EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE.OVERWRITE_REFUSED,
    );
  }
  fileSystem.makeDirectory(path.dirname(resolvedOutputPath));
  const temporaryPath = temporaryPathFor(resolvedOutputPath, fileSystem);
  try {
    fileSystem.writeExclusive(temporaryPath, serialized);
    fileSystem.rename(temporaryPath, resolvedOutputPath);
  } catch {
    if (fileSystem.exists(temporaryPath)) {
      try {
        fileSystem.remove(temporaryPath);
      } catch {
        // Keep the exact primary atomic-write failure code.
      }
    }
    throw new ExplorerScenarioArtifactWriterError(
      EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE.ATOMIC_WRITE_FAILED,
    );
  }
  return resolvedOutputPath;
}

function errorCode(error: unknown):
  | ExplorerScenarioArtifactFailureCode
  | ExplorerScenarioArtifactWriterFailureCode {
  if (error instanceof ExplorerScenarioArtifactValidationError ||
    error instanceof ExplorerScenarioArtifactWriterError) {
    return error.code;
  }
  return EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE.INPUT_JSON_INVALID;
}

function runCli(args: string[]): void {
  const overwrite = args.includes('--overwrite');
  const positional = args.filter((arg) => arg !== '--overwrite');
  if (positional.length !== 2) {
    throw new ExplorerScenarioArtifactWriterError(
      EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE.USAGE_INVALID,
    );
  }
  let bundle: ExplorerScenarioArtifactBundleV1;
  try {
    bundle = JSON.parse(fs.readFileSync(positional[0], 'utf8')) as
      ExplorerScenarioArtifactBundleV1;
  } catch {
    throw new ExplorerScenarioArtifactWriterError(
      EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE.INPUT_JSON_INVALID,
    );
  }
  writeExplorerScenarioArtifactBundleV1(bundle, positional[1], { overwrite });
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${errorCode(error)}\n`);
    process.exitCode = 1;
  }
}
