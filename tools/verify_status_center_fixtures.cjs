const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');

function registerTsRequire() {
  const compile = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
  require.extensions['.ts'] = compile;
  require.extensions['.tsx'] = compile;
}

registerTsRequire();

const { runStatusCenterN2nFixtureScenarios } = require(path.join(repoRoot, 'src/product-ui/statusCenterFixtures.ts'));
const results = runStatusCenterN2nFixtureScenarios();
const failed = results.filter((item) => !item.passed);
const outputPath = path.join(repoRoot, 'docs/acceptance-artifacts/status-center-n2n-fixtures-2026-06-08.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({
  generated_at: new Date().toISOString(),
  scenario_count: results.length,
  passed: failed.length === 0,
  results,
}, null, 2)}\n`, 'utf8');

if (failed.length > 0) {
  console.error(`statusCenter fixture failed: ${failed.map((item) => item.id).join(', ')}`);
  console.error(`wrote ${outputPath}`);
  process.exit(1);
}

console.log(`statusCenter fixture passed: ${results.length} scenarios`);
console.log(`wrote ${outputPath}`);
