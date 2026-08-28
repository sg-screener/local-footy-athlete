import { readFileSync } from 'fs';
import { dirname } from 'path';
import { transform } from 'sucrase';

/** Compile the actual source with one asserted mutation; never alter checkout or require cache. */
export function sourceMutation<T>(file: string, before: string, after: string): T {
  const source = readFileSync(file, 'utf8');
  if (!before || source.split(before).length !== 2) throw new Error(`Mutation anchor must occur exactly once: ${file}: ${before}`);
  const Module = require('module');
  const mutated = new Module(file, module);
  mutated.filename = file;
  mutated.paths = Module._nodeModulePaths(dirname(file));
  const code = transform(source.replace(before, after), { transforms: ['typescript', 'imports', 'jsx'], filePath: file }).code;
  mutated._compile(code, file);
  return mutated.exports as T;
}
