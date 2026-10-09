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
const cabinet = await load('../../momoUtils/src/extremeCabinet/index.ts');
const wiring = await load('../src/renderer/utils/wiring.ts');
const structure = await load('../src/renderer/cabinet/structure.ts', {
  '@momo/utils/compactCabinet': compact,
  '@momo/utils/extremeCabinet': cabinet,
  'leafer-ui': {},
});
const { CabinetViewportRenderer } = await load('../src/renderer/cabinet/viewport.ts', {
  '@momo/utils/compactCabinet': compact,
  '@momo/utils/extremeCabinet': cabinet,
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
    [{ width: 480, height: 270, count: 1000000 }],
  );
  const smartModules = structure.getCabinetModuleTypes({
    configuration: {
      screenWidth: 10480,
      screenHeight: 1720,
      moduleWidth: 120,
      moduleHeight: 120,
      isSmartCompletion: true,
    },
  });
  assert.deepEqual(
    smartModules.map(({ width, height, count }) => ({ width, height, count })),
    [
      { width: 120, height: 120, count: 1118 },
      { width: 160, height: 120, count: 13 },
      { width: 120, height: 160, count: 86 },
      { width: 160, height: 160, count: 1 },
    ],
  );
  assert.equal(new Set(smartModules.map(({ fill }) => fill)).size, 4);
  renderer.destroy();
  assert.deepEqual([canvas.width, canvas.height], [1, 1]);
});

test('screen-information rendering bounds LED and grid work to the visible viewport', () => {
  let operations = 0;
  let backgroundDrawn;
  let backgroundClip;
  let clipCount = 0;
  let clipsAtImage = 0;
  let fillStyle;
  let globalAlpha = 1;
  let alphaAtImage;
  const apertureRadii = [];
  const fillRects = [];
  const strokeStyles = [];
  const context = new Proxy(
    {},
    {
      set: (_, key, value) => {
        if (key === 'fillStyle') fillStyle = value;
        if (key === 'strokeStyle') strokeStyles.push(value);
        if (key === 'globalAlpha') globalAlpha = value;
        return true;
      },
      get: (_, key) =>
        key === 'measureText'
          ? () => ({ width: 10 })
          : key === 'fillRect'
            ? (...args) => {
                fillRects.push({ color: fillStyle, args });
                operations++;
              }
          : key === 'drawImage'
            ? (...args) => {
                backgroundDrawn = args;
                clipsAtImage = clipCount;
                alphaAtImage = globalAlpha;
                operations++;
              }
            : key === 'arc'
              ? (...args) => {
                  apertureRadii.push(args[2]);
                  operations++;
                }
            : key === 'clip'
              ? () => {
                  clipCount++;
                  operations++;
                }
            : key === 'rect'
              ? (...args) => {
                  backgroundClip ??= args;
                  operations++;
                }
            : () => {
              operations++;
            },
    },
  );
  const canvas = { width: 0, height: 0, getContext: () => context };
  const configuration = {
    ...c,
    screenWidth: 4_800_000_000,
    screenHeight: 2_700_000_000,
    moduleWidth: 48,
    moduleHeight: 27,
    pointRatio: 1,
  };
  const renderer = new CabinetViewportRenderer(canvas, {
    configuration,
    compact: {},
    cost: [1, 1, 1],
  });
  const screenBackground = { naturalWidth: 1600, naturalHeight: 900 };
  const stats = renderer.render(
    { x: 0, y: 0, scale: 0.2, width: 800, height: 450, pixelRatio: 1 },
    { modules: true, labels: false, senderName: 'H16', structure: true, screenBackground },
  );
  assert.equal(stats.totalReceivers, 0);
  assert.deepEqual(backgroundDrawn, [screenBackground, 0, 0, 960_000_000, 540_000_000]);
  assert.deepEqual(backgroundClip, [0, 0, 960_000_000, 540_000_000]);
  assert.equal(clipsAtImage, 2, 'background should be clipped to the screen and populated board');
  assert.equal(alphaAtImage, 1, 'the image should retain its source opacity');
  assert.equal(apertureRadii.length, 0, 'unresolvable LEDs should merge into the image without fake large dots');
  const screenBounds = backgroundDrawn.slice(1);
  assert.deepEqual(fillRects.map(({ color }) => color), ['#fff', '#000']);
  assert.ok(strokeStyles.includes('#2878ad'), 'module borders should use their module-type color');
  assert.ok(operations < 20000, `expected bounded canvas work, received ${operations} operations`);
  const arcsBeforePitchChange = apertureRadii.length;
  configuration.pointRatio = 0.5;
  renderer.render(
    { x: 0, y: 0, scale: 0.2, width: 800, height: 450, pixelRatio: 1 },
    { modules: true, labels: false, senderName: 'H16', structure: true, screenBackground },
  );
  assert.equal(apertureRadii.length, arcsBeforePitchChange, 'denser subpixel LEDs should remain fully merged');
  assert.deepEqual(backgroundDrawn.slice(1), screenBounds, 'point pitch should not scale display geometry');
  const arcsBeforeContinuousPitch = apertureRadii.length;
  const clipsBeforeContinuousPitch = clipCount;
  configuration.pointRatio = 0;
  renderer.render(
    { x: 0, y: 0, scale: 0.2, width: 800, height: 450, pixelRatio: 1 },
    { modules: true, labels: false, senderName: 'H16', structure: true, screenBackground },
  );
  assert.equal(apertureRadii.length, arcsBeforeContinuousPitch, 'zero pitch should omit the LED aperture mask');
  assert.equal(clipsAtImage, clipsBeforeContinuousPitch + 1, 'zero pitch should show the full image inside the display');
  const beforeHiddenRender = strokeStyles.length;
  renderer.render(
    { x: 0, y: 0, scale: 0.2, width: 800, height: 450, pixelRatio: 1 },
    { modules: true, labels: false, senderName: 'H16', structure: true, screenBackground, showStructureModules: false },
  );
  assert.equal(
    strokeStyles.slice(beforeHiddenRender).includes('#2878ad'),
    false,
    'module borders should be hidden when the structure-layer switch is off',
  );
  renderer.destroy();
});

function ledScene(pointRatio) {
  const calls = [];
  const tileCalls = [];
  const transforms = [];
  const patterns = [];
  const stack = [];
  const state = { globalAlpha: 1, fillStyle: '' };
  const context = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'save') return () => stack.push({ ...state });
      if (key === 'restore') return () => Object.assign(state, stack.pop());
      if (key === 'createPattern') return (tile) => {
        assert.deepEqual([tile.width, tile.height], [256, 256]);
        const pattern = { setTransform: (matrix) => transforms.push(matrix) };
        patterns.push(pattern);
        return pattern;
      };
      return (...args) => calls.push({ kind: key, args, alpha: state.globalAlpha, fill: state.fillStyle });
    },
  });
  const tileContext = new Proxy({}, {
    get: (_, key) => (...args) => tileCalls.push({ kind: key, args }),
  });
  const canvas = {
    width: 0, height: 0, getContext: () => context,
    ownerDocument: { createElement: () => ({ getContext: () => tileContext }) },
  };
  const configuration = { ...c, pointRatio };
  const renderer = new CabinetViewportRenderer(canvas, { configuration, compact: {}, cost: [1, 1, 1] });
  const render = (scale, extra = {}) => {
    calls.length = 0;
    renderer.render({ x: 0, y: 0, scale, width: 800, height: 450, pixelRatio: 1, ...extra }, {
      senderName: 'V6', modules: false, labels: false, structure: true, showStructureModules: false,
      screenBackground: { naturalWidth: 1600, naturalHeight: 900 },
    });
    assert.equal(state.globalAlpha, 1, 'LED mask opacity must not leak to other layers');
    return calls.find((call) => call.kind === 'fillRect' && typeof call.fill === 'object')?.alpha ?? 0;
  };
  return { render, renderer, calls, tileCalls, transforms, patterns, configuration };
}

test('all positive pitches fade gaps continuously with projected spacing, independent of DPR', () => {
  for (const pitch of [0.8, 1, 2.5, 5, 10, 100, 10000]) {
    const scene = ledScene(pitch);
    const opacities = [12, 9, 6, 3, 1.5, 0.1].map((spacing) => scene.render(spacing / pitch));
    assert.equal(opacities[0], 1);
    assert.equal(opacities.at(-1), 0);
    assert.ok(opacities.slice(1).every((value, index) => value <= opacities[index]));
    assert.ok(opacities[3] < 0.1, 'small LED gaps should be nearly invisible');
    const normal = scene.render(6 / pitch);
    assert.equal(scene.render(6 / pitch, { pixelRatio: 2 }), normal);
    assert.ok(Math.abs(scene.render(6.001 / pitch) - normal) < 0.001, 'zoom must not jump between sampled grids');
    assert.equal(scene.patterns.length, 1, 'zoom should reuse the tiny mask instead of allocating a screen bitmap');
    assert.equal(scene.tileCalls.filter((call) => call.kind === 'arc').length, 9);
    assert.ok(scene.calls.length < 40, 'dense LED drawing must have constant work');
    scene.renderer.destroy();
  }
});

test('lattice follows pan, preserves actual pitch and rebuilds only when aperture coverage changes', () => {
  const scene = ledScene(5);
  scene.render(2, { x: -17.25, y: 8.5 });
  assert.deepEqual(scene.transforms.at(-1), { a: 10 / 256, d: 10 / 256, e: -17.25, f: 8.5 });
  const radius = scene.tileCalls.find((call) => call.kind === 'arc').args[2];
  scene.configuration.pointRatio = 2.5;
  scene.render(2);
  assert.equal(scene.patterns.length, 2);
  assert.equal(scene.tileCalls.filter((call) => call.kind === 'arc')[9].args[2], radius * 2);
  assert.equal(scene.transforms.at(-1).a, 5 / 256);
});

test('very large LED spacing retains exact small emitters and partially visible edge beads', () => {
  const scene = ledScene(1000);
  scene.render(1, { x: -500.25, y: -500 });
  const arcs = scene.calls.filter((call) => call.kind === 'arc');
  assert.equal(arcs.length, 1);
  assert.deepEqual(arcs[0].args.slice(0, 3), [-0.25, 0, 0.48]);
  assert.equal(scene.patterns.length, 0);
  assert.equal(scene.calls.filter((call) => call.kind === 'drawImage').at(-1).alpha, 1);
});

test('zero, very small, and invalid imported pitch remain safe', () => {
  for (const pitch of [0, 0.01, Number.MIN_VALUE, NaN, Infinity, -1]) {
    const scene = ledScene(pitch);
    assert.equal(scene.render(0.2), 0);
    assert.equal(scene.patterns.length, 0);
    assert.equal(scene.calls.filter((call) => call.kind === 'drawImage').length, 1);
  }
});
