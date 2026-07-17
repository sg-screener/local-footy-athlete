const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const expoRoot = path.dirname(require.resolve('expo/package.json'));
const transformerPath = require.resolve('@expo/metro-config/babel-transformer', {
  paths: [expoRoot],
});
const metroBabelTransformer = require(transformerPath);

const explorerLivePathFiles = [
  'src/dev/e2e/explorerRenderReceiptBindings.ts',
  'src/dev/e2e/explorerPhysicalEvidence.ts',
  'src/dev/e2e/explorerCanonicalLiveHost.ts',
  'src/dev/e2e/explorerLiveScenarioRuntime.ts',
  'src/dev/e2e/explorerScenarioRunner.ts',
];

async function main() {
  const failures = [];

  console.log('\n-- Explorer Metro/Babel transforms --');
  for (const relativePath of explorerLivePathFiles) {
    const filename = path.join(root, relativePath);
    try {
      const result = await metroBabelTransformer.transform({
        filename,
        src: fs.readFileSync(filename, 'utf8'),
        options: {
          customTransformOptions: {},
          dev: true,
          enableBabelRCLookup: true,
          experimentalImportSupport: false,
          hot: false,
          inlineRequires: false,
          minify: false,
          platform: 'ios',
          projectRoot: root,
          type: 'module',
        },
      });
      if (!result || !result.ast) {
        throw new Error('Expo Metro Babel transformer returned no AST');
      }
      console.log(`  ✓ ${relativePath}`);
    } catch (error) {
      failures.push({ relativePath, error });
      console.error(`  ✗ ${relativePath}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  console.log(`\nExplorer Metro/Babel transforms: ${
    explorerLivePathFiles.length - failures.length
  } passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
