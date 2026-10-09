import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// Compile only the pure geometry entry so the existing worker entry is never evaluated.
const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const {
	getRectangleBounds,
	getEscapeViolation,
	isValidEscapeLimits,
	findRectanglePlacement,
	constrainRectangleMove,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const limits = { width: 100, height: 100, maxWidth: 300, maxHeight: 300 }
const rectangle = (id, x, y, width = 10, height = 10) => ({ id, x, y, width, height })
const approximately = (actual, expected) =>
	assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`)

test('empty scene and tight bounds include negative coordinates', () => {
	assert.equal(getRectangleBounds([]), null)
	assert.deepEqual(
		getRectangleBounds([rectangle('a', -20, 5, 30, 20), rectangle('b', 40, -10, 20, 15)]),
		{ x: -20, y: -10, width: 80, height: 35 },
	)
})

test('configuration rejects zero, negative, nonfinite and inconsistent edge limits', () => {
	assert.equal(isValidEscapeLimits(limits), true)
	for (const width of [0, -1, NaN, Infinity, 301])
		assert.equal(isValidEscapeLimits({ ...limits, width }), false)
	assert.throws(() => getRectangleBounds([rectangle('a', 0, 0, -1)]), RangeError)
})

test('area baseline dimensions are independent from actual edge dimensions', () => {
	assert.equal(getEscapeViolation({ x: 0, y: 0, width: 200, height: 50 }, limits), null)
	assert.equal(getEscapeViolation({ x: 0, y: 0, width: 200, height: 51 }, limits), 'area')
	assert.equal(getEscapeViolation({ x: 0, y: 0, width: 301, height: 1 }, limits), 'width')
})

test('placement prefers nonoverlap and validates the entire expanded bounds', () => {
	const initial = findRectanglePlacement([], { width: 20, height: 30 }, limits, 'a')
	assert.ok(initial)
	assert.equal(initial.hasOverlap, false)
	const second = findRectanglePlacement([initial.rectangle], { width: 20, height: 30 }, limits, 'b')
	assert.ok(second)
	assert.equal(second.hasOverlap, false)
	assert.equal(
		getEscapeViolation(getRectangleBounds([initial.rectangle, second.rectangle]), limits),
		null,
	)
	assert.equal(findRectanglePlacement([], { width: 300, height: 100 }, limits, 'a'), null)
	assert.equal(
		findRectanglePlacement([initial.rectangle], { width: 20, height: 20 }, limits, 'a'),
		null,
	)
})

test('placement permits overlap when bounds are full and rejects impossible joint shapes', () => {
	const full = rectangle('a', 0, 0, 100, 100)
	const result = findRectanglePlacement(
		[full],
		{ width: 40, height: 40 },
		{ ...limits, maxWidth: 100, maxHeight: 100 },
		'b',
	)
	assert.ok(result)
	assert.equal(result.hasOverlap, true)
	assert.equal(
		findRectanglePlacement(
			[rectangle('a', 0, 0, 200, 50)],
			{ width: 50, height: 200 },
			limits,
			'b',
		),
		null,
	)
})

test('a lone rectangle moves freely and its bounds follow without empty padding', () => {
	const result = constrainRectangleMove(
		[rectangle('a', 0, 0, 30, 20)],
		'a',
		{ x: -900, y: 1200 },
		limits,
	)
	assert.equal(result.isLimited, false)
	assert.deepEqual(result.bounds, { x: -900, y: 1200, width: 30, height: 20 })
})

test('horizontal and vertical expansion stop at exact edge boundaries', () => {
	const horizontal = constrainRectangleMove(
		[rectangle('a', 0, 0), rectangle('b', 10, 0)],
		'b',
		{ x: 500, y: 0 },
		limits,
	)
	assert.equal(horizontal.constraint, 'width')
	approximately(horizontal.rectangle.x, 290)
	assert.equal(getEscapeViolation(horizontal.bounds, limits), null)
	const vertical = constrainRectangleMove(
		[rectangle('a', 0, 0), rectangle('b', 0, 10)],
		'b',
		{ x: 0, y: 500 },
		limits,
	)
	assert.equal(vertical.constraint, 'height')
	approximately(vertical.rectangle.y, 290)
	const left = constrainRectangleMove(
		[rectangle('a', 0, 0), rectangle('b', 10, 0)],
		'b',
		{ x: -500, y: 0 },
		limits,
	)
	approximately(left.rectangle.x, -290)
})

test('diagonal expansion stops at area boundary and permits inward retreat', () => {
	const original = [rectangle('a', 0, 0, 50, 50), rectangle('b', 50, 0, 50, 50)]
	const result = constrainRectangleMove(original, 'b', { x: 200, y: 150 }, limits)
	assert.equal(result.constraint, 'area')
	approximately(result.bounds.width * result.bounds.height, 10000)
	const next = [original[0], result.rectangle]
	const retreat = constrainRectangleMove(next, 'b', { x: 25, y: 0 }, limits)
	assert.equal(retreat.isLimited, false)
	assert.ok(retreat.bounds.width * retreat.bounds.height < 10000)
})

test('legal endpoints cannot skip an illegal intermediate area', () => {
	const cap = { width: 80, height: 100, maxWidth: 300, maxHeight: 300 }
	const original = [rectangle('a', 0, 0, 20, 20), rectangle('b', 180, 0, 20, 20)]
	assert.equal(
		getEscapeViolation(getRectangleBounds([original[0], { ...original[1], x: 0, y: 180 }]), cap),
		null,
	)
	const result = constrainRectangleMove(original, 'b', { x: 0, y: 180 }, cap)
	assert.equal(result.constraint, 'area')
	assert.ok(result.rectangle.x > 90)
	approximately(result.bounds.width * result.bounds.height, 8000)
})

test('touching the intermediate area limit without exceeding it is allowed', () => {
	const original = [rectangle('a', 0, 0, 20, 20), rectangle('b', 180, 0, 20, 20)]
	const result = constrainRectangleMove(
		original,
		'b',
		{ x: 0, y: 180 },
		{ width: 110, height: 110, maxWidth: 300, maxHeight: 300 },
	)
	assert.equal(result.isLimited, false)
})

test('invalid targets do not change valid geometry', () => {
	const original = [rectangle('a', 0, 0)]
	const result = constrainRectangleMove(original, 'a', { x: NaN, y: 0 }, limits)
	assert.equal(result.constraint, 'invalid')
	assert.deepEqual(result.rectangle, original[0])
	assert.throws(
		() => constrainRectangleMove(original, 'missing', { x: 0, y: 0 }, limits),
		RangeError,
	)
})

test('seeded movement invariants: containment, full-path legality and immutable inputs', () => {
	let seed = 248197
	const random = () => {
		seed = (seed * 1664525 + 1013904223) >>> 0
		return seed / 4294967296
	}
	const cap = { width: 180, height: 160, maxWidth: 350, maxHeight: 320 }
	for (let iteration = 0; iteration < 250; iteration++) {
		const original = Array.from({ length: 2 + Math.floor(random() * 5) }, (_, index) =>
			rectangle(
				String(index),
				random() * 60 - 30,
				random() * 60 - 30,
				random() * 40 + 10,
				random() * 40 + 10,
			),
		)
		const snapshot = structuredClone(original)
		const active = original[1]
		const result = constrainRectangleMove(
			original,
			active.id,
			{ x: random() * 1400 - 700, y: random() * 1400 - 700 },
			cap,
		)
		assert.equal(getEscapeViolation(result.bounds, cap), null)
		assert.deepEqual(original, snapshot)
		for (let step = 0; step <= 50; step++) {
			const progress = step / 50
			const moved = {
				...active,
				x: active.x + (result.rectangle.x - active.x) * progress,
				y: active.y + (result.rectangle.y - active.y) * progress,
			}
			const bounds = getRectangleBounds(
				original.map((item) => (item.id === active.id ? moved : item)),
			)
			assert.equal(getEscapeViolation(bounds, cap), null)
		}
		const next = original.map((item) => (item.id === active.id ? result.rectangle : item))
		for (const item of next) {
			assert.ok(item.x >= result.bounds.x && item.y >= result.bounds.y)
			assert.ok(item.x + item.width <= result.bounds.x + result.bounds.width + 1e-10)
			assert.ok(item.y + item.height <= result.bounds.y + result.bounds.height + 1e-10)
		}
	}
})
