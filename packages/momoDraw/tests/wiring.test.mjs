import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function load(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputText)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, module, module.exports)
  return module.exports
}
const { wiringData, cableColor } = await load('../src/renderer/utils/wiring.ts')
const rect = (x, y, width = 100, height = 80) => ({ x, y, width, height })
const style = { color: '#123456', badge: '12-3', start: true, end: true }

test('center lines and arrows exit the source boundary in all four directions', () => {
  for (const [target, expected] of [[rect(100, 0), [100, 40, 0]], [rect(-100, 0), [0, 40, 180]],
    [rect(0, 80), [50, 80, 90]], [rect(0, -80), [50, 0, -90]]]) {
    const children = wiringData(rect(0, 0), target, style)
    const arrow = children.find((node) => node.name === 'wiring-arrow')
    assert.deepEqual([arrow.x, arrow.y, arrow.rotation], expected)
    assert.equal(children[0].path, `M50 40 L${target.x + 50} ${target.y + 40}`)
    assert.ok(children.every((node) => node.hittable === false))
  }
})
test('unequal and diagonal cards use a finite source-boundary marker', () => {
  const arrow = wiringData(rect(0, 0), rect(150, 80, 50, 40), style).find((node) => node.name === 'wiring-arrow')
  assert.equal(arrow.x, 100)
  assert.equal(arrow.y, 64)
  assert.ok(Number.isFinite(arrow.rotation))
})

test('adjacent unequal receivers route orthogonally through their common edge', () => {
  for (const [source, target, expected, rotation] of [
    [rect(0, 0, 100, 400), rect(100, 0, 300, 80), [100, 40], 0],
    [rect(100, 0, 300, 80), rect(0, 0, 100, 400), [100, 40], 180],
    [rect(0, 0, 400, 80), rect(0, 80, 100, 240), [50, 80], 90],
    [rect(0, 80, 100, 240), rect(0, 0, 400, 80), [50, 80], -90],
  ]) {
    const data = wiringData(source, target, { ...style, adjacent: true })
    const arrow = data.find((node) => node.name === 'wiring-arrow')
    assert.deepEqual([arrow.x, arrow.y], expected)
    assert.equal(arrow.rotation, rotation)
    const points = [...data[0].path.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i]
      assert.ok(a[0] === b[0] || a[1] === b[1])
      for (let j = 0; j <= 20; j++) {
        const x = a[0] + (b[0] - a[0]) * j / 20, y = a[1] + (b[1] - a[1]) * j / 20
        assert.ok([source, target].some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height))
      }
    }
  }
})
test('interior links have no duplicate endpoints; one receiver keeps both marks', () => {
  const middle = wiringData(rect(0, 0), rect(100, 0), { ...style, start: false, end: false })
  assert.equal(middle.length, 2)
  const single = wiringData(rect(0, 0), rect(0, 0), { ...style, single: true })
  assert.equal(single.some((node) => node.tag === 'Path'), false)
  const end = single.find((node) => node.name === 'wiring-end')
  const start = single.find((node) => node.name === 'wiring-start')
  assert.equal(end.fill, undefined)
  assert.ok(end.width > start.width)
  assert.equal(single.find((node) => node.name === 'wiring-badge').text, '12-3')
})
test('ports of one sender have distinct, stable colors', () => {
  assert.equal(new Set(Array.from({ length: 12 }, (_, i) => cableColor(1, i + 1))).size, 12)
  assert.notEqual(cableColor(1, 1), cableColor(2, 1))
})

const nodes = new Map()
const { getBoundingMaxMinTotal } = await load('../src/utils/utils.ts', { '../types': {} })
const business = await load('../src/utils/business.ts', {
  '../renderer/utils/conn': { getConnStartCircleId: (id) => `${id}_startCircle` },
  '../types': { CmpType: { RectLine: 8, Connector: 10, rectGroup: 11 } },
  './cmp': {
    getCmpByIds: (ids) => ids.map((id) => nodes.get(id)),
    updateMaps: (updates) => updates.forEach(({ id, backendData }) => {
      nodes.set(id, { ...nodes.get(id), backendData: { ...nodes.get(id)?.backendData, ...backendData } })
    }),
  },
  './leafer': { getApp: () => null },
  './utils': { getBoundingMaxMinTotal },
})
const limits = { connGroupLimit: 100000, rectGroupLimitWidth: 1000, rectGroupLimitHeight: 1000 }
function chain(rects) {
  nodes.clear()
  const cmps = rects.map((value, index) => ({ ...value, id: `${index}`, backendData: {
    type: 8, sourceConnId: index ? `${index - 1}` : undefined,
    targetConnId: index < rects.length - 1 ? `${index + 1}` : undefined,
  } }))
  cmps.forEach((cmp) => nodes.set(cmp.id, cmp))
  return cmps
}
test('rectangle validation accepts a full snake and rejects holes, overlap and broken links', () => {
  const valid = chain([rect(0, 0), rect(100, 0), rect(100, 80), rect(0, 80)])
  assert.deepEqual(business.checkConnIsSquare(valid, limits), [])
  const hole = chain([rect(0, 0), rect(200, 0)])
  assert.equal(business.checkConnIsSquare(hole, limits).length, 2)
  const overlap = chain([rect(0, 0), rect(50, 0)])
  assert.equal(business.checkConnIsSquare(overlap, limits).length, 2)
  const broken = chain([rect(0, 0), rect(100, 0)])
  broken[0].backendData.targetConnId = 'missing'
  assert.equal(business.checkConnIsSquare(broken, limits).length, 2)
  assert.deepEqual(business.checkConnIsSquare(null, limits), [])
})
test('area and each dimensional limit apply independently and include the next receiver', () => {
  const cmps = chain([rect(0, 0), rect(100, 0)])
  assert.equal(business.checkConnIsSquare(cmps, { ...limits, rectGroupLimitWidth: 150 }).length, 2)
  assert.equal(business.checkConnIsSquare(cmps, { ...limits, connGroupLimit: 15999 }).length, 2)
  assert.deepEqual(business.checkConnIsSquare(cmps, { ...limits, rectGroupLimitHeight: 80 }), [])
  assert.equal(business.checkIsOverMaxArea({ cmps: cmps.slice(0, 1), maxArea: 8000 }), false)
  assert.equal(business.checkIsOverMaxArea({ cmps, maxArea: 8000 }), true)
})
test('deleting a middle receiver removes both incident links, preserving unrelated chain data', () => {
  const cmps = chain([rect(0, 0), rect(100, 0), rect(200, 0)])
  const a = { id: 'a', backendData: { type: 10, sourceConnId: '0', targetConnId: '1' } }
  const b = { id: 'b', backendData: { type: 10, sourceConnId: '1', targetConnId: '2' } }
  nodes.set('a', a); nodes.set('b', b)
  globalThis.spuEditorCmpRenderMap = nodes
  assert.deepEqual(new Set(business.getExtraRemoveIds(['1'])), new Set(['1', 'a', 'b']))
  business.onBusDeleteCmp(b)
  assert.equal(nodes.get('1').backendData.sourceConnId, '0')
  assert.equal(nodes.get('1').backendData.targetConnId, undefined)
  assert.equal(nodes.get('2').backendData.sourceConnId, undefined)
  delete globalThis.spuEditorCmpRenderMap
})
