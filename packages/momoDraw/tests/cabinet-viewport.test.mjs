import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module,
    module.exports,
  );
  return module.exports;
}
const compact = await load('../../momoUtils/src/extremeCabinet/compact.ts');
const wiring = await load('../src/renderer/utils/wiring.ts');
const structure = await load('../src/renderer/cabinet/structure.ts', {
  '@momo/utils/compactCabinet': compact,
  'leafer-ui': {},
});
const { CabinetViewportRenderer } = await load('../src/renderer/cabinet/viewport.ts', {
  '@momo/utils/compactCabinet': compact,
  '../utils/wiring': wiring,
  './structure': structure,
});
const c = {
  screenWidth: 480000,
  screenHeight: 270000,
  moduleWidth: 480,
  moduleHeight: 270,
  receiverColumns: 1,
  receiverRows: 1,
  senderMaxWidth: 10240,
  senderMaxHeight: 10240,
  senderMaxLoad: 10485760,
  senderPorts: 16,
  portLoad: 650000,
};

test('million scene renders full overview and exact end detail with viewport-sized backing storage', () => {
  let operations = 0;
  const context = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'measureText'
          ? () => ({ width: 10 })
          : () => {
              operations++;
            },
    },
  );
  const canvas = { width: 0, height: 0, getContext: () => context };
  const solution = compact.recommendCompactCabinet(c, 'row', 'regular', { index: 0, count: 2 });
  const renderer = new CabinetViewportRenderer(canvas, solution);
  const view = { x: 0, y: 0, scale: 800 / c.screenWidth, width: 800, height: 450, pixelRatio: 2 };
  const options = { modules: true, labels: true, senderName: 'H16' };
  const overview = renderer.render(view, options);
  assert.equal(overview.totalReceivers, 1000000);
  assert.equal(overview.representedReceivers, 1000000);
  assert.equal(overview.detailedReceivers, 0);
  assert.ok(overview.drawnGroups <= Math.ceil(800 / 7) * Math.ceil(450 / 7));
  assert.ok(
    operations < 30000,
    'canvas work must be bounded by the viewport, not the million cells',
  );
  assert.deepEqual([canvas.width, canvas.height], [1600, 900]);
  const last = renderer.findReceiver(999.5, 999.5);
  assert.equal(last.id, 1000000);
  assert.equal(renderer.getCable(last.cable).port, 16);
  const scale = 0.4;
  const detail = renderer.render(
    {
      ...view,
      scale,
      x: 400 - 999.5 * c.moduleWidth * scale,
      y: 225 - 999.5 * c.moduleHeight * scale,
    },
    options,
  );
  assert.ok(detail.detailedReceivers > 0 && detail.detailedReceivers < 100);
  assert.equal(detail.detailedReceivers, detail.representedReceivers);
  assert.deepEqual(
    structure
      .getCabinetReceiverTypes(solution)
      .map(({ width, height, count }) => ({ width, height, count })),
    [{ width: 1, height: 1, count: 1000000 }],
  );
  renderer.destroy();
  assert.deepEqual([canvas.width, canvas.height], [1, 1]);
});
