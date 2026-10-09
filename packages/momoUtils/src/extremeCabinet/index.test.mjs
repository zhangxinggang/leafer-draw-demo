import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(
	`${source}\nexport { gridLimits, sliceResourceBound, remainingSliceBound, relaxedPackingBound, smallRemainingCost, sampleBound, horizontalSliceWeights, createSliceTracker, projectedDeficitBound, projectionIntervalInfeasible, sideSumPackingInfeasible, skylineComponents, canonicalSkylineKey }`,
	{
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
	},
)
const {
	optimizeCabinetCounts: optimizeCabinet,
	compareCabinetCost,
	getCabinetConfigurationError,
	validateCabinetSolution,
	gridLimits,
	sliceResourceBound,
	remainingSliceBound,
	relaxedPackingBound,
	smallRemainingCost,
	sampleBound,
	horizontalSliceWeights,
	createSliceTracker,
	projectedDeficitBound,
	projectionIntervalInfeasible,
	sideSumPackingInfeasible,
	skylineComponents,
	canonicalSkylineKey,
	shareCabinetOptimality,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

const config = (overrides = {}) => ({
	screenWidth: 4,
	screenHeight: 4,
	moduleWidth: 1,
	moduleHeight: 1,
	receiverColumns: 2,
	receiverRows: 2,
	senderMaxWidth: 4,
	senderMaxHeight: 4,
	senderMaxLoad: 16,
	senderPorts: 4,
	portLoad: 4,
	...overrides,
})
function solve(c, direction = 'row') {
	let last
	const history = []
	for (const progress of optimizeCabinet(c, direction)) {
		if (progress.solution) {
			assert.deepEqual(validateCabinetSolution(progress.solution), [])
			if (last) {
				assert.ok(compareCabinetCost(progress.solution.cost, last.cost) <= 0)
				assert.ok(progress.solution.provedPrefix >= last.provedPrefix)
			}
			last = progress.solution
			history.push(last)
		}
	}
	assert.equal(last.isOptimal, true)
	assert.equal(last.provedPrefix, 3)
	for (const snapshot of history) {
		assert.ok(compareCabinetCost(snapshot.lowerBound, last.cost) <= 0)
		assert.deepEqual(
			snapshot.cost.slice(0, snapshot.provedPrefix),
			last.cost.slice(0, snapshot.provedPrefix),
		)
	}
	return last
}

// Independent occupied-cell bitmask oracle. It never uses skyline states, the
// production bounds or receiver-count formula. All three hierarchy levels are
// tiled exhaustively, including arbitrary/non-slicing rectangular partitions.
function bruteTiles(width, height, shapes, budget = width * height, occupied = 0, exact = false) {
	const all = (1 << (width * height)) - 1
	const memo = new Map()
	function visit(mask, left) {
		if (mask === all) return exact && left ? null : [0, 0, 0]
		if (!left) return null
		const key = `${mask}/${left}`
		if (memo.has(key)) return memo.get(key)
		let index = 0
		while (mask & (1 << index)) index++
		const x = index % width
		const y = Math.floor(index / width)
		let best = null
		for (const shape of shapes) {
			if (x + shape.width > width || y + shape.height > height) continue
			let bits = 0
			for (let ry = y; ry < y + shape.height; ry++)
				for (let rx = x; rx < x + shape.width; rx++) bits |= 1 << (ry * width + rx)
			if (mask & bits) continue
			const tail = visit(mask | bits, left - 1)
			if (!tail) continue
			const next = tail.map((count, level) => count + shape.cost[level])
			if (!best || compareCabinetCost(next, best) < 0) best = next
		}
		memo.set(key, best)
		return best
	}
	return visit(occupied, budget)
}
function oracle(c) {
	const senderShapes = []
	const receiverShapes = []
	for (let w = 1; w <= c.receiverColumns; w++)
		for (let h = 1; h <= c.receiverRows; h++)
			receiverShapes.push({ width: w, height: h, cost: [0, 1, 0] })
	const cableShapes = []
	for (let w = 1; w <= c.screenWidth; w++) {
		for (let h = 1; h <= c.screenHeight; h++) {
			if (w * h > c.portLoad) continue
			const rx = bruteTiles(w, h, receiverShapes)
			cableShapes.push({ width: w, height: h, cost: [0, rx[1], 1] })
		}
	}
	for (let w = 1; w <= Math.min(c.screenWidth, c.senderMaxWidth); w++) {
		for (let h = 1; h <= Math.min(c.screenHeight, c.senderMaxHeight); h++) {
			if (w * h > Math.min(c.senderMaxLoad, c.senderPorts * c.portLoad)) continue
			const inner = bruteTiles(w, h, cableShapes, c.senderPorts)
			if (inner) senderShapes.push({ width: w, height: h, cost: [1, inner[1], inner[2]] })
		}
	}
	return bruteTiles(c.screenWidth, c.screenHeight, senderShapes)
}

test('configuration rejects incomplete, noninteger, unsafe and infeasible values', () => {
	assert.equal(getCabinetConfigurationError(config()), null)
	const incomplete = config()
	delete incomplete.senderMaxWidth
	assert.ok(getCabinetConfigurationError(incomplete))
	for (const value of [null, 0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER])
		assert.ok(getCabinetConfigurationError(config({ screenWidth: value })))
	for (const overrides of [
		{ screenWidth: 1, moduleWidth: 2 },
		{ screenHeight: 1, moduleHeight: 2 },
		{ moduleWidth: 2, senderMaxWidth: 1 },
		{ moduleHeight: 2, senderMaxHeight: 1 },
		{ moduleWidth: 2, portLoad: 1 },
		{ moduleHeight: 2, senderMaxLoad: 1 },
		{ senderPorts: Number.MAX_SAFE_INTEGER },
	])
		assert.throws(() => solve(config(overrides)), RangeError)
})

test('nondivisible screens floor module rows and columns without cropping modules', () => {
	const c = config({
		screenWidth: 5,
		screenHeight: 7,
		moduleWidth: 2,
		moduleHeight: 3,
		senderMaxWidth: 4,
		senderMaxHeight: 6,
		senderMaxLoad: 24,
		portLoad: 12,
	})
	assert.equal(getCabinetConfigurationError(c), null)
	for (const direction of ['row', 'column']) {
		const result = solve(c, direction)
		assert.equal(result.moduleCount, 4)
		assert.equal(Math.max(...result.senders.map((sender) => sender.x + sender.width)), 2)
		assert.equal(Math.max(...result.senders.map((sender) => sender.y + sender.height)), 2)
		assert.ok(result.senders.every((sender) => sender.width * c.moduleWidth <= c.screenWidth))
		assert.ok(result.senders.every((sender) => sender.height * c.moduleHeight <= c.screenHeight))
	}
})

test('default dimensions and real sender load, both orientations, every invariant', () => {
	const c = config({
		screenWidth: 1920,
		screenHeight: 1080,
		moduleWidth: 160,
		moduleHeight: 90,
		senderMaxWidth: 3840,
		senderMaxHeight: 2160,
		senderMaxLoad: 5000000,
		portLoad: 650000,
	})
	for (const direction of ['row', 'column']) {
		const result = solve(c, direction)
		assert.deepEqual(result.cost, [1, 36, 4])
		assert.equal(result.moduleCount, 144)
		assert.equal(result.realSenderLoad, 2600000)
	}
})

test('a fixed 100-case corpus publishes a valid incumbent before exact search', () => {
	let seed = 30921
	const random = (maximum) => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
		return 1 + (seed % maximum)
	}
	let maximumElapsed = 0
	for (let index = 0; index < 100; index++) {
		const c = config({
			screenWidth: 6 + random(30),
			screenHeight: 6 + random(24),
			receiverColumns: random(6),
			receiverRows: random(6),
			senderMaxWidth: 4 + random(20),
			senderMaxHeight: 4 + random(20),
			senderMaxLoad: 10 + random(130),
			senderPorts: random(6),
			portLoad: 5 + random(40),
		})
		const start = performance.now()
		let first
		for (const progress of optimizeCabinet(c)) {
			if (!progress.solution) continue
			first = progress.solution
			break
		}
		const elapsed = performance.now() - start
		maximumElapsed = Math.max(maximumElapsed, elapsed)
		assert.ok(first, `case ${index} did not publish a feasible layout`)
		assert.equal(first.visitedStates, 0, `case ${index} entered exact search first`)
		assert.deepEqual(validateCabinetSolution(first), [], `case ${index}`)
		assert.ok(elapsed < 100, `case ${index} first layout took ${elapsed} ms`)
	}
	assert.ok(maximumElapsed < 100, `slowest first layout took ${maximumElapsed} ms`)
})

test('an equal-cost directional layout inherits a completed global proof', () => {
	const optimal = solve(config())
	const candidate = {
		...optimal,
		isOptimal: false,
		provedPrefix: 1,
		lowerBound: [optimal.cost[0], 0, 0],
		elapsedMs: 0,
	}
	const columnProgress = {
		stage: 'searching',
		visitedStates: 17,
		solution: candidate,
	}
	const shared = shareCabinetOptimality({
		row: { stage: 'complete', visitedStates: 23, solution: optimal },
		column: columnProgress,
	})
	assert.deepEqual(shared.promoted, ['column'])
	assert.equal(shared.progress.column.stage, 'complete')
	assert.equal(shared.progress.column.solution.isOptimal, true)
	assert.equal(shared.progress.column.solution.provedPrefix, 3)
	assert.deepEqual(shared.progress.column.solution.lowerBound, optimal.cost)
	assert.equal(shared.progress.column.solution.elapsedMs, optimal.elapsedMs)
	assert.equal(columnProgress.stage, 'searching')
	assert.equal(candidate.isOptimal, false)
})

test('directional proof sharing keeps a different-cost candidate searching', () => {
	const optimal = solve(config())
	const candidate = {
		...optimal,
		cost: [optimal.cost[0], optimal.cost[1] + 1, optimal.cost[2]],
		isOptimal: false,
		provedPrefix: 1,
	}
	const pair = {
		row: { stage: 'searching', visitedStates: 17, solution: candidate },
		column: { stage: 'complete', visitedStates: 23, solution: optimal },
	}
	const shared = shareCabinetOptimality(pair)
	assert.deepEqual(shared.promoted, [])
	assert.equal(shared.progress, pair)
})

test('lexicographic optimum agrees with independent three-level exhaustive oracle', () => {
	let seed = 89107
	const random = (maximum) => {
		seed ^= seed << 13
		seed ^= seed >>> 17
		seed ^= seed << 5
		return 1 + ((seed >>> 0) % maximum)
	}
	for (let index = 0; index < 200; index++) {
		const c = config({
			screenWidth: random(4),
			screenHeight: random(4),
			receiverColumns: random(4),
			receiverRows: random(4),
			senderMaxWidth: random(4),
			senderMaxHeight: random(4),
			senderMaxLoad: random(16),
			senderPorts: random(4),
			portLoad: random(12),
		})
		const expected = oracle(c)
		assert.deepEqual(solve(c).cost, expected, JSON.stringify(c))
		assert.deepEqual(solve(c, 'column').cost, expected, `column: ${JSON.stringify(c)}`)
	}
})

test('area alone does not prove port feasibility, and receiver dimensions must shrink', () => {
	for (const c of [
		config({ screenWidth: 3, screenHeight: 3, portLoad: 5, senderPorts: 2 }),
		config({ screenWidth: 4, screenHeight: 3, receiverColumns: 4, receiverRows: 3, portLoad: 3 }),
		config({ screenWidth: 4, screenHeight: 4, portLoad: 3, senderPorts: 3 }),
	])
		assert.deepEqual(solve(c).cost, oracle(c))
})

test('staged feasibility bounds agree with the independent oracle on dense 4×4 and 5×3 cases', () => {
	let seed = 14009
	const random = (maximum) => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
		return 1 + (seed % maximum)
	}
	for (let index = 0; index < 240; index++) {
		const c = config({
			screenWidth: index % 2 ? 5 : 4,
			screenHeight: index % 2 ? 3 : 4,
			receiverColumns: random(5),
			receiverRows: random(4),
			senderMaxWidth: random(5),
			senderMaxHeight: random(4),
			senderMaxLoad: random(16),
			senderPorts: random(4),
			portLoad: random(10),
		})
		const expected = oracle(c)
		for (const direction of ['row', 'column'])
			assert.deepEqual(solve(c, direction).cost, expected, JSON.stringify(c))
	}
})

test('rectangular partitions can require mixed sizes rather than a uniform sender grid', () => {
	const result = solve(
		config({
			screenWidth: 5,
			screenHeight: 5,
			receiverColumns: 5,
			receiverRows: 5,
			senderMaxWidth: 4,
			senderMaxHeight: 4,
			senderMaxLoad: 6,
			portLoad: 6,
			senderPorts: 1,
		}),
	)
	assert.deepEqual(result.cost, [5, 5, 5])
	assert.ok(result.visitedStates > 0)
})

test('unattainable integer capacities and failed sender floors still prove every later objective', () => {
	const c = config({
		screenWidth: 5,
		screenHeight: 5,
		senderMaxWidth: 4,
		senderMaxHeight: 4,
		senderMaxLoad: 8,
		portLoad: 8,
		senderPorts: 1,
		receiverColumns: 4,
		receiverRows: 4,
	})
	// Both simple sender floors give four, but this board needs five rectangles.
	assert.equal(Math.ceil(25 / 8), 4)
	assert.deepEqual(oracle(c), [5, 5, 5])
	for (const direction of ['row', 'column']) assert.deepEqual(solve(c, direction).cost, [5, 5, 5])
	const prime = config({
		screenWidth: 5,
		screenHeight: 5,
		senderMaxWidth: 3,
		senderMaxHeight: 3,
		senderMaxLoad: 7,
		portLoad: 7,
		senderPorts: 1,
		receiverColumns: 3,
		receiverRows: 3,
	})
	const first = optimizeCabinet(prime).next().value.solution
	// No integer rectangle within 3×3 has area 7; effective capacity is 6.
	assert.equal(first.lowerBound[0], Math.ceil(25 / 6))
	assert.deepEqual(solve(prime).cost, oracle(prime))
})

test('compound coloring certificate proves the prime-capacity receiver optimum without geometric search', () => {
	const receiverShapes = []
	for (let width = 1; width <= 6; width++)
		for (let height = 1; height <= 5; height++)
			receiverShapes.push({ width, height, cost: [0, 1, 0] })
	const stripes = (length) => (length % 11 ? [-(length % 11), 11 - (length % 11)] : [0])
	for (const [width, height] of [
		[1, 11],
		[11, 1],
		[1, 10],
		[2, 5],
		[5, 2],
		[10, 1],
	]) {
		const rx = bruteTiles(width, height, receiverShapes)[1]
		for (const x of stripes(width))
			for (const y of stripes(height)) {
				const weight = x * (5 * height + y)
				assert.ok(55 * (rx - 2) >= -weight - 150 * (11 - width * height))
			}
	}
	// S=67 has area deficit 1. Board phases x=10/y=0 yield weight −1250;
	// summing the independently verified inequalities forces R >= 154.
	assert.equal(2 * 67 + (1250 - 150) / 55, 154)
	const c = config({
		screenWidth: 32,
		screenHeight: 23,
		receiverColumns: 6,
		receiverRows: 5,
		senderMaxWidth: 18,
		senderMaxHeight: 21,
		senderMaxLoad: 74,
		senderPorts: 1,
		portLoad: 11,
	})
	for (const direction of ['row', 'column']) {
		const result = solve(c, direction)
		assert.deepEqual(result.cost, [67, 154, 67])
		assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
	}
})

test('slice composition independently proves the receiver optimum for a nondivisible height', () => {
	const receiverShapes = []
	for (let width = 1; width <= 2; width++)
		for (let height = 1; height <= 3; height++)
			receiverShapes.push({ width, height, cost: [0, 1, 0] })
	const heightPrices = new Map()
	for (let width = 1; width <= 6; width++) {
		for (let height = 1; height <= 11 && width * height <= 14; height++) {
			const receivers = bruteTiles(width, height, receiverShapes)[1]
			// R >= -deficit/2 + width * heightPrice/120.
			// 60 is a common multiple of every possible width, so this is exact.
			const numerator = BigInt(2 * receivers + 14 - width * height) * BigInt(60 / width)
			const prior = heightPrices.get(height)
			if (prior === undefined || numerator < prior) heightPrices.set(height, numerator)
		}
	}
	const chain = Array(12)
	chain[0] = 0n
	for (let height = 1; height <= 11; height++)
		for (const [step, price] of heightPrices) {
			if (step > height || chain[height - step] === undefined) continue
			const candidate = chain[height - step] + price
			if (chain[height] === undefined || candidate < chain[height]) chain[height] = candidate
		}
	assert.equal(chain[11], 340n)
	// Area requires 15 senders, total deficit 12. Every vertical slice has
	// price at least 340/120, forcing -12/2 + 18*(340/120) = 45 receivers.
	assert.equal((-12n * 60n + 18n * chain[11]) / 120n, 45n)
	const c = config({
		screenWidth: 18,
		screenHeight: 11,
		receiverColumns: 2,
		receiverRows: 3,
		senderMaxWidth: 6,
		senderMaxHeight: 21,
		senderMaxLoad: 14,
		senderPorts: 1,
		portLoad: 15,
	})
	for (const direction of ['row', 'column']) {
		const result = solve(c, direction)
		assert.deepEqual(result.cost, [15, 45, 15])
		assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
	}
})

test('local port area and transposed interior search agree with an occupied-cell oracle', () => {
	const receiverShapes = []
	for (let width = 1; width <= 6; width++)
		for (let height = 1; height <= 3; height++)
			receiverShapes.push({ width, height, cost: [0, 1, 0] })
	const ports = []
	for (let width = 1; width <= 16; width++)
		for (let height = 1; height <= 4; height++) {
			const area = width * height
			// 64 cells / 5 ports / capacity 13 leaves deficit 1: every port
			// must have area 12 or 13. Smaller shapes are independently impossible.
			if (area < 12 || area > 13) continue
			ports.push({ width, height, receivers: bruteTiles(width, height, receiverShapes)[1] })
		}
	const full = (1n << 64n) - 1n
	const memo = new Map()
	function visit(mask, left) {
		if (mask === full) return 0
		if (!left) return Infinity
		const key = `${mask}/${left}`
		if (memo.has(key)) return memo.get(key)
		let position = 0
		while (mask & (1n << BigInt(position))) position++
		const x = position % 16
		const y = Math.floor(position / 16)
		let best = Infinity
		for (const port of ports) {
			if (x + port.width > 16 || y + port.height > 4) continue
			let bits = 0n
			for (let py = y; py < y + port.height; py++)
				for (let px = x; px < x + port.width; px++) bits |= 1n << BigInt(py * 16 + px)
			if (bits & mask) continue
			best = Math.min(best, port.receivers + visit(mask | bits, left - 1))
		}
		memo.set(key, best)
		return best
	}
	assert.equal(visit(0n, 5), 14)
	const c = config({
		screenWidth: 16,
		screenHeight: 4,
		receiverColumns: 6,
		receiverRows: 3,
		senderMaxWidth: 16,
		senderMaxHeight: 4,
		senderMaxLoad: 64,
		senderPorts: 5,
		portLoad: 13,
	})
	for (const direction of ['row', 'column']) {
		assert.deepEqual(solve(c, direction).cost, [1, 14, 5])
		// Inside 8×8, no integer rectangle has area 13. Five ports carry at
		// most 60 cells, so one sender cannot cover the 64-cell screen.
		const local = solve(
			{ ...c, screenWidth: 8, screenHeight: 8, senderMaxWidth: 8, senderMaxHeight: 8 },
			direction,
		)
		assert.deepEqual(local.cost, [2, 6, 6])
	}
})

test('fractional port capacity is floored per port rather than after adding ports', () => {
	const result = solve(
		config({
			screenWidth: 20,
			screenHeight: 10,
			moduleWidth: 10,
			moduleHeight: 10,
			receiverColumns: 2,
			receiverRows: 1,
			senderMaxWidth: 20,
			senderMaxHeight: 10,
			senderMaxLoad: 1000,
			senderPorts: 2,
			portLoad: 150,
		}),
	)
	assert.deepEqual(result.cost, [1, 2, 2])
	assert.equal(result.realSenderLoad, 300)
	assert.equal(result.senders[0].cables.length, 2)
})

test('saturated receiver columns independently force one receiver per cable', () => {
	// Four sampled horizontal lines need 17 width-2 receivers each. Equality
	// at 68 receivers forces every receiver to intersect exactly one sampled
	// line, have width 2, and stay in one of the 17 columns. Exhaust all height
	// compositions of a column, independently of the production bound.
	const compositions = []
	for (let a = 1; a <= 5; a++)
		for (let b = 1; b <= 5; b++)
			for (let d = 1; d <= 5; d++)
				for (let e = 1; e <= 5; e++) if (a + b + d + e === 19) compositions.push([a, b, d, e])
	assert.equal(compositions.length, 4)
	for (const heights of compositions) {
		for (const height of heights) assert.ok(2 * 2 * height > 15)
		for (let index = 1; index < heights.length; index++)
			assert.ok(2 * (heights[index - 1] + heights[index]) > 15)
	}
	const c = config({
		screenWidth: 34,
		screenHeight: 19,
		receiverColumns: 2,
		receiverRows: 5,
		senderMaxWidth: 22,
		senderMaxHeight: 17,
		senderMaxLoad: 40,
		senderPorts: 5,
		portLoad: 15,
	})
	assert.ok(16 * 40 < 34 * 19)
	for (const direction of ['row', 'column']) {
		const result = solve(c, direction)
		assert.deepEqual(result.cost, [17, 68, 68])
		assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
		// A shorter screen admits height-1 receivers; two fit horizontally on
		// one port. Receiver-bound equality alone must not force C = R.
		const mergeable = config({
			screenWidth: 4,
			screenHeight: 3,
			senderMaxHeight: 3,
			senderMaxLoad: 12,
			senderPorts: 3,
		})
		assert.deepEqual(oracle(mergeable), [1, 4, 3])
		assert.deepEqual(solve(mergeable, direction).cost, [1, 4, 3])
	}
})

test('sender sampling equality and receiver optimality independently force the cable count', () => {
	// Width 34 / maximum sender width 6 needs six senders at each of two
	// sampled horizontal lines; height 19 / maximum height 13 needs two at
	// each sampled vertical line. Equality at 12 senders forces w >= 4, h >= 6.
	// Exhaust the six widths of one row, independently of the production DP.
	const rowWidths = []
	function compose(widths, remaining) {
		if (widths.length === 6) {
			if (remaining === 0) rowWidths.push(widths)
			return
		}
		for (let width = 4; width <= 6; width++) compose([...widths, width], remaining - width)
	}
	compose([], 34)
	const units = (widths) => widths.reduce((sum, width) => sum + Math.ceil(width / 4), 0)
	assert.equal(Math.min(...rowWidths.map(units)), 11)
	const cheapest = rowWidths.filter((widths) => units(widths) === 11)
	assert.equal(cheapest.length, 6)
	for (const widths of cheapest) assert.deepEqual(widths.slice().sort(), [4, 6, 6, 6, 6, 6])
	// Each sender needs two receiver rows (h >= 6). R >= 2*2*11 = 44;
	// equality forbids h > 10 and width-5 senders. The sampled vertical lines
	// now force h >= 9. There are ten width-6 and two width-4 senders.
	const combinations = []
	for (let tallWide = 0; tallWide <= 10; tallWide++)
		for (let tallNarrow = 0; tallNarrow <= 2; tallNarrow++) {
			const area = 10 * 6 * 9 + 2 * 4 * 9 + tallWide * 6 + tallNarrow * 4
			if (area === 34 * 19) combinations.push([tallWide, tallNarrow])
		}
	assert.deepEqual(combinations, [[5, 1]])
	// All ten wide senders exceed one port's 39-cell capacity. One narrow
	// sender has area 40, the other 36: at least 20 + 2 + 1 = 23 cables.
	assert.ok(6 * 9 > 39 && 4 * 10 > 39 && 4 * 9 <= 39)
	const c = config({
		screenWidth: 34,
		screenHeight: 19,
		receiverColumns: 4,
		receiverRows: 5,
		senderMaxWidth: 6,
		senderMaxHeight: 13,
		senderMaxLoad: 78,
		senderPorts: 5,
		portLoad: 39,
	})
	for (const direction of ['row', 'column']) {
		const result = solve(c, direction)
		assert.deepEqual(result.cost, [12, 44, 23])
		assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
	}
})

test('fixed sender count and slice sums independently prove the 23 by 10 optimum', () => {
	const receiverShapes = [1, 2, 3, 4].map((height) => ({ width: 1, height, cost: [0, 1, 0] }))
	const ports = []
	for (let width = 1; width <= 5; width++)
		for (let height = 1; height <= 8; height++)
			if (width * height <= 10)
				ports.push({ width, height, cost: [0, bruteTiles(width, height, receiverShapes)[1], 1] })
	const shapes = []
	for (let width = 1; width <= 5; width++)
		for (let height = 1; height <= 8; height++) {
			const area = width * height
			if (area < 10 || area > 20) continue
			const cost = bruteTiles(width, height, ports, 2)
			if (cost) shapes.push({ width, height, area, receivers: cost[1], cables: cost[2] })
		}
	const full = shapes.filter((shape) => shape.area === 20)
	assert.deepEqual(
		full.map((shape) => [shape.width, shape.height, shape.receivers]),
		[
			[4, 5, 8],
			[5, 4, 10],
		],
	)
	const partial = shapes.filter((shape) => shape.area < 20)
	// Enumerate multisets directly by shape counts, not by the production area/
	// color DP. Deficit is 12*20 - 230 = 10. Fill all remaining slots with the
	// two area-20 types, and retain every multiset with at most 89 receivers.
	const multisets = []
	function collect(index, loss, chosen) {
		if (index === partial.length) {
			if (loss !== 10) return
			const left = 12 - chosen.length
			for (let expensive = 0; expensive <= left; expensive++) {
				const tiles = [
					...chosen,
					...Array(left - expensive).fill(full[0]),
					...Array(expensive).fill(full[1]),
				]
				const receivers = tiles.reduce((sum, shape) => sum + shape.receivers, 0)
				if (receivers <= 89)
					multisets.push({
						tiles,
						receivers,
						cables: tiles.reduce((sum, shape) => sum + shape.cables, 0),
					})
			}
			return
		}
		const shape = partial[index]
		const addedLoss = 20 - shape.area
		for (let count = 0; count * addedLoss + loss <= 10 && count + chosen.length <= 12; count++)
			collect(index + 1, loss + count * addedLoss, [...chosen, ...Array(count).fill(shape)])
	}
	collect(0, 0, [])
	assert.ok(multisets.some((entry) => entry.receivers === 88))
	assert.equal(Math.min(...multisets.map((entry) => entry.cables)), 24)
	const excluded = (tiles) => {
		const dimensions = [...new Set(tiles.map((shape) => shape.height))]
		const compositions = []
		function compose(chain, remaining) {
			if (!remaining) compositions.push(chain)
			for (const height of dimensions)
				if (height <= remaining) compose([...chain, height], remaining - height)
		}
		compose([], 10)
		if (
			!compositions.length ||
			dimensions.some((height) => !compositions.some((chain) => chain.includes(height)))
		)
			return true
		const counts = new Set(compositions.map((chain) => chain.length))
		if (
			counts.size === 1 &&
			tiles.reduce((sum, shape) => sum + shape.width, 0) !== compositions[0].length * 23
		)
			return true
		// Period-2 height stripe has zero total on the height-10 screen. Even
		// rectangles contribute zero; odd rectangles contribute +/- their width.
		let sums = new Set([0])
		for (const shape of tiles)
			if (shape.height % 2)
				sums = new Set([...sums].flatMap((sum) => [sum - shape.width, sum + shape.width]))
		return !sums.has(0)
	}
	for (const entry of multisets)
		if (entry.receivers <= 88) assert.ok(excluded(entry.tiles), JSON.stringify(entry))
	const c = config({
		screenWidth: 23,
		screenHeight: 10,
		receiverColumns: 1,
		receiverRows: 4,
		senderMaxWidth: 5,
		senderMaxHeight: 8,
		senderMaxLoad: 139,
		senderPorts: 2,
		portLoad: 10,
	})
	assert.ok(11 * 20 < 230)
	for (const direction of ['row', 'column']) {
		const result = solve(c, direction)
		assert.deepEqual(result.cost, [12, 89, 24])
		assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
	}
})

test('incompatible slice projections independently prove the 15 by 14 optimum', () => {
	const receiverShapes = []
	for (let width = 1; width <= 3; width++)
		for (let height = 1; height <= 6; height++)
			receiverShapes.push({ width, height, cost: [0, 1, 0] })
	const ports = []
	for (let width = 1; width <= 15; width++)
		for (let height = 1; height <= 14; height++)
			if (width * height <= 14)
				ports.push({ width, height, cost: [0, bruteTiles(width, height, receiverShapes)[1], 1] })
	const shapes = []
	for (let width = 1; width <= 15; width++)
		for (let height = 1; height <= 14; height++) {
			const area = width * height
			if (area < 14 || area > 28) continue
			const cost = bruteTiles(width, height, ports, 2)
			if (cost) shapes.push({ width, height, area, receivers: cost[1], cables: cost[2] })
		}
	const full = shapes.filter((shape) => shape.area === 28)
	assert.deepEqual(
		full.map((shape) => [shape.width, shape.height, shape.receivers]),
		[
			[2, 14, 4],
			[4, 7, 4],
			[7, 4, 6],
			[14, 2, 6],
		],
	)
	const partial = shapes.filter((shape) => shape.area < 28)
	const multisets = []
	function fillFull(index, left, chosen) {
		if (index === full.length) {
			if (left) return
			const receivers = chosen.reduce((sum, shape) => sum + shape.receivers, 0)
			if (receivers <= 28)
				multisets.push({
					tiles: chosen,
					receivers,
					cables: chosen.reduce((sum, shape) => sum + shape.cables, 0),
				})
			return
		}
		for (let count = 0; count <= left; count++)
			fillFull(index + 1, left - count, [...chosen, ...Array(count).fill(full[index])])
	}
	function collect(index, loss, chosen) {
		if (index === partial.length) {
			if (loss === 14) fillFull(0, 8 - chosen.length, chosen)
			return
		}
		const shape = partial[index]
		const addedLoss = 28 - shape.area
		for (let count = 0; count * addedLoss + loss <= 14 && count + chosen.length <= 8; count++)
			collect(index + 1, loss + count * addedLoss, [...chosen, ...Array(count).fill(shape)])
	}
	collect(0, 0, [])
	assert.ok(multisets.some((entry) => entry.receivers === 27))
	assert.equal(Math.min(...multisets.map((entry) => entry.cables)), 16)
	const excluded = (tiles) => {
		const dimensions = [...new Set(tiles.map((shape) => shape.height))]
		const compositions = []
		function compose(chain, remaining) {
			if (!remaining) compositions.push(chain)
			for (const height of dimensions)
				if (height <= remaining) compose([...chain, height], remaining - height)
		}
		compose([], 14)
		if (
			!compositions.length ||
			dimensions.some((height) => !compositions.some((chain) => chain.includes(height)))
		)
			return true
		// Examine the actual multiset, not a relaxed capacity formula. Two
		// rectangles that cannot coexist on any height-14 slice have disjoint
		// horizontal projections. Sum their exact areas and compare the space
		// outside the chosen rectangle's projection.
		for (let index = 0; index < tiles.length; index++) {
			const chosen = tiles[index]
			let outsideArea = 0
			for (let other = 0; other < tiles.length; other++) {
				if (other === index) continue
				const tile = tiles[other]
				const canShare = compositions.some((chain) =>
					chosen.height === tile.height
						? chain.filter((height) => height === chosen.height).length >= 2
						: chain.includes(chosen.height) && chain.includes(tile.height),
				)
				if (!canShare) outsideArea += tile.area
			}
			if (outsideArea > (15 - chosen.width) * 14) return true
		}
		return false
	}
	for (const entry of multisets)
		if (entry.receivers <= 27) assert.ok(excluded(entry.tiles), JSON.stringify(entry))
	const c = config({
		screenWidth: 15,
		screenHeight: 14,
		receiverColumns: 3,
		receiverRows: 6,
		senderMaxWidth: 17,
		senderMaxHeight: 24,
		senderMaxLoad: 61,
		senderPorts: 2,
		portLoad: 14,
	})
	assert.ok(7 * 28 < 210)
	for (const direction of ['row', 'column']) {
		const result = solve(c, direction)
		assert.deepEqual(result.cost, [8, 28, 16])
		assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
	}
})

test('paired exceptional projections prove a nonslicing 22 by 13 optimum', () => {
	const receiverShapes = [
		{ width: 1, height: 1, cost: [0, 1, 0] },
		{ width: 2, height: 1, cost: [0, 1, 0] },
	]
	const shapes = []
	for (let width = 1; width <= 16; width++)
		for (let height = 1; height <= 13; height++) {
			const area = width * height
			if (area >= 14 && area <= 16)
				shapes.push({
					width,
					height,
					area,
					receivers: bruteTiles(width, height, receiverShapes)[1],
				})
		}
	const full = shapes.filter((shape) => shape.area === 16)
	assert.deepEqual(
		full.map((shape) => [shape.width, shape.height, shape.receivers]),
		[
			[2, 8, 8],
			[4, 4, 8],
			[8, 2, 8],
			[16, 1, 8],
		],
	)
	// Independently sum every cell for every phase of a 16 by 2 product
	// coloring. All full-area tiles have zero sum. With a single area-14
	// tile, its possible sums cannot equal those of the whole screen.
	function sums(width, height) {
		const possible = new Set()
		for (let px = 0; px < 16; px++)
			for (let py = 0; py < 2; py++) {
				let sum = 0
				for (let x = 0; x < width; x++)
					for (let y = 0; y < height; y++)
						sum += (16 * Number((x + px) % 16 === 0) - 1) * (2 * Number((y + py) % 2 === 0) - 1)
				possible.add(sum)
			}
		return possible
	}
	const targets = sums(22, 13)
	assert.deepEqual(
		[...targets].sort((a, b) => a - b),
		[-10, -6, 6, 10],
	)
	for (const shape of full) assert.deepEqual([...sums(shape.width, shape.height)], [0])
	for (const shape of shapes.filter((tile) => tile.area === 14))
		for (const value of sums(shape.width, shape.height)) assert.ok(!targets.has(value))
	// The remaining deficit-two possibility is two area-15 rectangles and
	// sixteen full tiles. Every full tile has even width. Each horizontal
	// slice of an even-width screen must therefore meet either both odd
	// rectangles or neither. Their vertical projections must coincide.
	const partial = shapes.filter((shape) => shape.area === 15)
	const pairs = []
	for (let a = 0; a < partial.length; a++)
		for (let b = a; b < partial.length; b++) {
			const left = partial[a]
			const right = partial[b]
			if (16 * 8 + left.receivers + right.receivers > 145) continue
			pairs.push([left.width, right.width])
			assert.ok(left.height !== right.height || left.width + right.width > 22)
		}
	assert.deepEqual(pairs, [
		[5, 15],
		[15, 15],
	])
	assert.ok(17 * 16 < 22 * 13)
	const c = config({
		screenWidth: 22,
		screenHeight: 13,
		receiverColumns: 2,
		receiverRows: 1,
		senderMaxWidth: 16,
		senderMaxHeight: 19,
		senderMaxLoad: 18,
		senderPorts: 1,
		portLoad: 17,
	})
	for (const direction of ['row', 'column']) {
		const result = solve(c, direction)
		assert.deepEqual(result.cost, [18, 146, 18])
		for (let cut = 1; cut < 22; cut++)
			assert.ok(result.senders.some((tile) => tile.x < cut && tile.x + tile.width > cut))
		for (let cut = 1; cut < 13; cut++)
			assert.ok(result.senders.some((tile) => tile.y < cut && tile.y + tile.height > cut))
		assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
	}
})

test('side-sum packing certificate matches exhaustive multiset enumeration', () => {
	let seed = 71903
	const random = (maximum) => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
		return 1 + (seed % maximum)
	}
	const possible = (shapes, limits, senders, receivers, cables) => {
		if (!shapes.length) return false
		const maximumWidth = Math.max(...shapes.map((shape) => shape.width))
		const maximumHeight = Math.max(...shapes.map((shape) => shape.height))
		const minimumWidthSum = limits.width * Math.ceil(limits.height / maximumHeight)
		const minimumHeightSum = limits.height * Math.ceil(limits.width / maximumWidth)
		const visit = (start, left, area, receiverCount, cableCount, width, height) => {
			if (!left)
				return (
					area === limits.width * limits.height &&
					receiverCount <= receivers &&
					cableCount <= cables &&
					width >= minimumWidthSum &&
					height >= minimumHeightSum
				)
			for (let index = start; index < shapes.length; index++) {
				const shape = shapes[index]
				if (
					visit(
						index,
						left - 1,
						area + shape.width * shape.height,
						receiverCount + shape.cost[1],
						cableCount + shape.cost[2],
						width + shape.width,
						height + shape.height,
					)
				)
					return true
			}
			return false
		}
		return visit(0, senders, 0, 0, 0, 0, 0)
	}
	for (let sample = 0; sample < 300; sample++) {
		const shapes = Array.from({ length: random(7) }, () => ({
			width: random(4),
			height: random(4),
			cost: [1, random(5), random(4)],
		}))
		const limits = { width: random(6), height: random(6) }
		const senders = random(4)
		const receivers = random(16)
		const cables = random(12)
		assert.equal(
			sideSumPackingInfeasible(shapes, limits, senders, receivers, cables),
			!possible(shapes, limits, senders, receivers, cables),
		)
	}
})

test('side sums quickly prove the four-sender cable optimum', () => {
	const result = solve(
		config({
			screenWidth: 31,
			screenHeight: 12,
			receiverColumns: 5,
			receiverRows: 6,
			senderMaxWidth: 15,
			senderMaxHeight: 22,
			senderMaxLoad: 119,
			senderPorts: 4,
			portLoad: 44,
		}),
	)
	assert.deepEqual(result.cost, [4, 14, 12])
	assert.ok(result.elapsedMs < 1000, `elapsed ${result.elapsedMs} ms`)
})

test('skyline orientation preserves strong height-one receiver bounds', () => {
	const result = solve(
		config({
			screenWidth: 26,
			screenHeight: 17,
			receiverColumns: 6,
			receiverRows: 1,
			senderMaxWidth: 24,
			senderMaxHeight: 15,
			senderMaxLoad: 82,
			senderPorts: 3,
			portLoad: 13,
		}),
	)
	assert.deepEqual(result.cost, [12, 94, 36])
	assert.ok(result.visitedStates < 10000, `${result.visitedStates} states`)
	assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
})

test('a local nonslicing seed quickly constructs and audits the 31 by 16 mixed layout', () => {
	const c = config({
		screenWidth: 31,
		screenHeight: 16,
		receiverColumns: 1,
		receiverRows: 4,
		senderMaxWidth: 19,
		senderMaxHeight: 6,
		senderMaxLoad: 41,
		senderPorts: 6,
		portLoad: 16,
	})
	// Area-41 integer rectangles cannot fit the sender dimensions. Hence 40
	// is the attainable capacity, independently forcing at least 13 senders.
	assert.ok(12 * 40 < 31 * 16)
	for (const direction of ['row', 'column']) {
		let found
		for (const progress of optimizeCabinet(c, direction)) {
			if (progress.solution) {
				assert.deepEqual(validateCabinetSolution(progress.solution), [])
				if (compareCabinetCost(progress.solution.cost, [13, 161, 38]) <= 0) {
					found = progress
					break
				}
			}
		}
		assert.ok(found)
		assert.deepEqual(found.solution.cost, [13, 161, 38])
		// This tests a feasible upper bound only. It must not claim the two
		// secondary objectives are proved before their complete searches.
		assert.ok(found.solution.provedPrefix < 3)
		assert.ok(found.visitedStates < 1500, `visited ${found.visitedStates} states`)
		assert.ok(found.solution.elapsedMs < 2000, `elapsed ${found.solution.elapsedMs} ms`)
	}
})

test('height-one sampling phases are valid on every small occupied profile', () => {
	const shapes = [1, 2, 3].map((width) => ({ width, height: 1, cost: [0, 1, 0] }))
	let improved = 0
	for (let profile = 0; profile < 4 ** 5; profile++) {
		let remaining = profile
		let occupied = 0
		const heights = []
		for (let x = 0; x < 5; x++) {
			const height = remaining % 4
			remaining = Math.floor(remaining / 4)
			heights.push(height)
			for (let y = 0; y < height; y++) occupied |= 1 << (y * 5 + x)
		}
		const bound = sampleBound(heights, 3, 3, 1)
		const exact = bruteTiles(5, 3, shapes, 15, occupied)
		assert.ok(bound <= exact[1], JSON.stringify({ heights, bound, exact }))
		const oldPhase = 6 - heights[0] - heights[3]
		if (bound > oldPhase) improved++
	}
	assert.ok(improved > 100)
	assert.equal(sampleBound([2, 0, 2, 2, 0], 3, 3, 1), 6)
})

test('merged horizontal slices match independent per-cell interval counts', () => {
	for (const [width, height] of [
		[4, 3],
		[5, 2],
	]) {
		for (let profile = 0; profile < (height + 1) ** width; profile++) {
			let remaining = profile
			const heights = []
			for (let x = 0; x < width; x++) {
				heights.push(remaining % (height + 1))
				remaining = Math.floor(remaining / (height + 1))
			}
			const expected = Array(width + 1).fill(0)
			for (let y = 0; y < height; y++) {
				let run = 0
				for (let x = 0; x <= width; x++) {
					if (x < width && y >= heights[x]) run++
					else if (run) {
						expected[run]++
						run = 0
					}
				}
			}
			const before = [...heights]
			assert.deepEqual(horizontalSliceWeights(heights, height), expected)
			assert.deepEqual(heights, before)
		}
	}
	const height = Math.floor(Number.MAX_SAFE_INTEGER / 4)
	assert.deepEqual(horizontalSliceWeights([0, height - 1, height - 1, 0], height), [
		0,
		2 * (height - 1),
		0,
		0,
		1,
	])
	// Simultaneously activated columns may briefly create an impossible width
	// during merging. Only intervals present in a positive-height slice count.
	const certificate = {
		vertical: false,
		maximumArea: 1,
		countFactor: 0,
		lossFactor: 0,
		denominator: 1n,
		chain: [0, undefined, 3],
	}
	assert.equal(remainingSliceBound([0, 0], 4, 8, 0, [certificate]), 12)
})

test('allocation-free skyline keys equal the independent mirror and component definition', () => {
	let checked = 0
	for (let width = 1; width <= 5; width++) {
		const height = 4
		for (let encoded = 0; encoded < (height + 1) ** width; encoded++) {
			let value = encoded
			const heights = Array.from({ length: width }, () => {
				const next = value % (height + 1)
				value = Math.floor(value / (height + 1))
				return next
			})
			const components = skylineComponents(heights, height)
			const expected = components
				.map(({ start, end, base }) => {
					const profile = heights.slice(start, end).map((entry) => entry - base)
					const forward = profile.join(',')
					const reverse = profile.reverse().join(',')
					return `${height - base}:${forward < reverse ? forward : reverse}`
				})
				.sort()
				.join('|')
			assert.equal(canonicalSkylineKey(heights, height, components), expected)
			checked++
		}
	}
	assert.equal(checked, 3905)
})

test('incremental slice certificates equal full scans across skyline placements and restores', () => {
	let checked = 0
	for (const [width, height] of [
		[4, 3],
		[5, 2],
	]) {
		const maximumSenders = 5
		const maximumArea = width * height
		const length = Math.max(width, height)
		const certificates = [
			{
				vertical: true,
				maximumArea,
				countFactor: 2,
				lossFactor: -1,
				denominator: 3n,
				chain: Array.from({ length: length + 1 }, (_, index) =>
					index === 2 ? undefined : index * 2 - 3,
				),
			},
			{
				vertical: false,
				maximumArea,
				countFactor: -2,
				lossFactor: 1,
				denominator: 2n,
				chain: Array.from({ length: length + 1 }, (_, index) =>
					index === 1 ? undefined : 4 - index,
				),
			},
			{
				vertical: false,
				maximumArea,
				countFactor: 0,
				lossFactor: 0,
				denominator: 1n,
				chain: Array.from({ length: length + 1 }, (_, index) =>
					index === 3 ? undefined : index - 2,
				),
			},
		]
		for (let profile = 0; profile < (height + 1) ** width; profile++) {
			let encoded = profile
			const heights = Array.from({ length: width }, () => {
				const value = encoded % (height + 1)
				encoded = Math.floor(encoded / (height + 1))
				return value
			})
			const original = [...heights]
			const tracker = createSliceTracker(heights, height, maximumSenders, certificates)
			assert.ok(tracker)
			const remainingArea = maximumArea - heights.reduce((sum, value) => sum + value, 0)
			assert.equal(
				tracker.bound(maximumSenders, remainingArea),
				remainingSliceBound(heights, height, remainingArea, maximumSenders, certificates),
			)
			for (let x = 0; x < width; x++) {
				const y = heights[x]
				if (y === height) continue
				for (let w = 1; x + w <= width && heights[x + w - 1] === y; w++) {
					for (let h = 1; y + h <= height; h++) {
						for (let column = x; column < x + w; column++) heights[column] += h
						const change = tracker.place(x, w, y, h)
						const tailArea = remainingArea - w * h
						assert.equal(
							tracker.bound(maximumSenders - 1, tailArea),
							remainingSliceBound(heights, height, tailArea, maximumSenders - 1, certificates),
							JSON.stringify({ width, height, original, x, w, h }),
						)
						const secondX = heights.findIndex((value) => value < height)
						if (secondX !== -1) {
							const secondY = heights[secondX]
							heights[secondX]++
							const secondChange = tracker.place(secondX, 1, secondY, 1)
							assert.equal(
								tracker.bound(maximumSenders - 2, tailArea - 1),
								remainingSliceBound(
									heights,
									height,
									tailArea - 1,
									maximumSenders - 2,
									certificates,
								),
								JSON.stringify({ width, height, original, x, w, h, secondX }),
							)
							tracker.restore(secondChange)
							heights[secondX]--
						}
						tracker.restore(change)
						for (let column = x; column < x + w; column++) heights[column] -= h
						assert.equal(
							tracker.bound(maximumSenders, remainingArea),
							remainingSliceBound(heights, height, remainingArea, maximumSenders, certificates),
							JSON.stringify({ width, height, original, x, w, h, restored: true }),
						)
						checked++
					}
				}
			}
			assert.deepEqual(heights, original)
		}
	}
	assert.ok(checked > 3000, `checked ${checked} reversible placements`)
	const unsafe = [
		{
			vertical: false,
			maximumArea: 4,
			countFactor: 0,
			lossFactor: 0,
			denominator: 1n,
			chain: [0, Math.floor(Number.MAX_SAFE_INTEGER / 8), 0],
		},
	]
	assert.equal(createSliceTracker([0, 0], 2, 1, unsafe), undefined)
	assert.ok(Number.isFinite(remainingSliceBound([0, 0], 2, 4, 1, unsafe)))
})

test('loss-aware projected columns remain below independent rectangular tiling optima', () => {
	let checked = 0
	for (const [width, height] of [
		[4, 3],
		[5, 2],
	]) {
		for (let maximumArea = 3; maximumArea <= 7; maximumArea++) {
			for (let receiverWidth = 1; receiverWidth <= 3; receiverWidth++) {
				for (let receiverHeight = 1; receiverHeight <= 3; receiverHeight++) {
					const receiverShapes = []
					for (let w = 1; w <= receiverWidth; w++)
						for (let h = 1; h <= receiverHeight; h++)
							receiverShapes.push({ width: w, height: h, cost: [0, 1, 0] })
					const shapes = []
					for (let w = 1; w <= width; w++) {
						for (let h = 1; h <= height; h++) {
							if (w * h > maximumArea) continue
							const receiverCost = bruteTiles(w, h, receiverShapes)
							shapes.push({ width: w, height: h, cost: [1, receiverCost[1], 1] })
						}
					}
					const attainable = Math.max(...shapes.map((shape) => shape.width * shape.height))
					const minimumSenders = Math.ceil((width * height) / attainable)
					for (let senders = minimumSenders; senders <= minimumSenders + 2; senders++) {
						const exact = bruteTiles(width, height, shapes, senders, 0, true)
						if (!exact) continue
						const bound = projectedDeficitBound(shapes, { width, height }, senders)
						assert.ok(
							bound <= exact[1],
							JSON.stringify({
								width,
								height,
								receiverWidth,
								receiverHeight,
								maximumArea,
								senders,
								bound,
								exact,
							}),
						)
						assert.equal(
							projectionIntervalInfeasible(shapes, { width, height }, senders, exact[1]),
							false,
							JSON.stringify({ width, height, maximumArea, senders, exact }),
						)
						checked++
					}
				}
			}
		}
	}
	assert.ok(checked >= 100, `checked ${checked} independent optima`)
	const receivers = []
	for (let w = 1; w <= 3; w++)
		for (let h = 1; h <= 6; h++) receivers.push({ width: w, height: h, cost: [0, 1, 0] })
	const shapes = []
	for (let w = 1; w <= 11; w++)
		for (let h = 1; h <= 22; h++) {
			if (w * h < 12 || w * h > 15) continue
			const receiverCost = bruteTiles(w, h, receivers)
			shapes.push({ width: w, height: h, cost: [1, receiverCost[1], 1] })
		}
	assert.equal(projectedDeficitBound(shapes, { width: 23, height: 24 }, 37), 49)
	assert.equal(projectionIntervalInfeasible(shapes, { width: 23, height: 24 }, 37, 51), true)
	assert.equal(projectionIntervalInfeasible(shapes, { width: 23, height: 24 }, 37, 52), false)
})

test('interval projection certifies the 23 by 24 optimum after a valid layout is found', () => {
	const configuration = config({
		screenWidth: 23,
		screenHeight: 24,
		receiverColumns: 3,
		receiverRows: 6,
		senderMaxWidth: 11,
		senderMaxHeight: 22,
		senderMaxLoad: 15,
		senderPorts: 4,
		portLoad: 16,
	})
	for (const direction of ['row', 'column'])
		assert.deepEqual(solve(configuration, direction).cost, [37, 52, 37])
})

test('partial-region bounds and exact small suffixes agree with occupied-cell optima', () => {
	let checked = 0
	let separated = 0
	let smallChecked = 0
	for (const c of [
		config({ screenWidth: 4, screenHeight: 3, senderMaxLoad: 5, senderPorts: 2, portLoad: 3 }),
		config({ screenWidth: 5, screenHeight: 2, senderMaxLoad: 7, senderPorts: 3, portLoad: 3 }),
	]) {
		const receivers = []
		for (let width = 1; width <= c.receiverColumns; width++)
			for (let height = 1; height <= c.receiverRows; height++)
				receivers.push({ width, height, cost: [0, 1, 0] })
		const ports = []
		for (let width = 1; width <= c.screenWidth; width++)
			for (let height = 1; height <= c.screenHeight; height++)
				if (width * height <= c.portLoad)
					ports.push({ width, height, cost: [0, bruteTiles(width, height, receivers)[1], 1] })
		const shapes = []
		for (let width = 1; width <= Math.min(c.screenWidth, c.senderMaxWidth); width++)
			for (let height = 1; height <= Math.min(c.screenHeight, c.senderMaxHeight); height++) {
				if (width * height > c.senderMaxLoad) continue
				const cost = bruteTiles(width, height, ports, c.senderPorts)
				if (cost) shapes.push({ width, height, cost: [1, cost[1], cost[2]] })
			}
		const cableOnly = shapes.map((shape) => ({ ...shape, cost: [1, 0, shape.cost[2]] }))
		const shapeCosts = new Map(
			shapes.map((shape) => [`${shape.width}/${shape.height}`, shape.cost]),
		)
		const maximumArea = Math.max(...shapes.map((shape) => shape.width * shape.height))
		const area = c.screenWidth * c.screenHeight
		const optimum = bruteTiles(c.screenWidth, c.screenHeight, shapes)
		for (const count of [optimum[0], optimum[0] + 1]) {
			const certificates = []
			sliceResourceBound(shapes, gridLimits(c), count, 1, undefined, certificates)
			assert.ok(certificates.length)
			const context = { visitedStates: 0, checkpoint: function* () {} }
			const iterator = relaxedPackingBound(shapes, area, count, maximumArea, context)
			let step = iterator.next()
			while (!step.done) step = iterator.next()
			const packing = step.value
			assert.ok(packing)
			const deficit = count * maximumArea - area
			const smallCache = new Map()
			for (let profile = 0; profile < (c.screenHeight + 1) ** c.screenWidth; profile++) {
				let remaining = profile
				let occupied = 0
				let tailArea = area
				const heights = []
				for (let x = 0; x < c.screenWidth; x++) {
					const height = remaining % (c.screenHeight + 1)
					remaining = Math.floor(remaining / (c.screenHeight + 1))
					heights.push(height)
					tailArea -= height
					for (let y = 0; y < height; y++) occupied |= 1 << (y * c.screenWidth + x)
				}
				for (let left = 0; left <= count; left++) {
					if (left === 1 || left === 2) {
						const exactSmall = bruteTiles(
							c.screenWidth,
							c.screenHeight,
							shapes,
							left,
							occupied,
							true,
						)
						const actualSmall = smallRemainingCost(
							heights,
							c.screenHeight,
							left,
							shapes,
							shapeCosts,
							smallCache,
						)
						assert.deepEqual(actualSmall, exactSmall, JSON.stringify({ c, heights, left }))
						smallChecked++
					}
					const loss = left * maximumArea - tailArea
					if (loss < 0 || loss > deficit) continue
					// Exhaustively tile the remaining cells with exactly `left`
					// rectangles, including non-slicing and separated arrangements.
					const exact = bruteTiles(c.screenWidth, c.screenHeight, shapes, left, occupied, true)
					if (!exact) continue
					const slice = remainingSliceBound(heights, c.screenHeight, tailArea, left, certificates)
					assert.ok(slice <= exact[1], JSON.stringify({ c, heights, left, slice, exact }))
					assert.ok(
						compareCabinetCost(
							[left, packing.receiverLayers[left][loss], packing.cableLayers[left][loss]],
							exact,
						) <= 0,
					)
					const cables = bruteTiles(c.screenWidth, c.screenHeight, cableOnly, left, occupied, true)
					assert.ok(packing.minimumCableLayers[left][loss] <= cables[2])
					checked++
					if (
						heights.some((height, x) => x > 0 && x < c.screenWidth - 1 && height === c.screenHeight)
					)
						separated++
				}
			}
		}
	}
	assert.ok(checked >= 300, `checked ${checked} future tilings`)
	assert.ok(separated >= 100, `checked ${separated} separated regions`)
	assert.ok(smallChecked >= 1000, `checked ${smallChecked} exact small suffixes`)
})

test('audit detects overlap, missing coverage, wrong port index and overstated counts', () => {
	const result = solve(config())
	const invalid = structuredClone(result)
	invalid.senders[0].cables[0].receivers[0].x++
	invalid.senders[0].cables[0].port++
	invalid.cost[1]++
	assert.ok(validateCabinetSolution(invalid).length >= 3)
})

test('large regular grids reach a certified optimum quickly without enumerating module placements', () => {
	const result = solve(
		config({
			screenWidth: 120,
			screenHeight: 80,
			receiverColumns: 2,
			receiverRows: 2,
			senderMaxWidth: 12,
			senderMaxHeight: 10,
			senderMaxLoad: 120,
			senderPorts: 4,
			portLoad: 40,
		}),
	)
	assert.deepEqual(result.cost, [80, 2400, 240])
	assert.equal(result.visitedStates, 0)
	assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
})

test('optimal receiver count tightens the cable bound despite fractional port capacity', () => {
	const result = solve(
		config({
			screenWidth: 32,
			screenHeight: 32,
			senderMaxWidth: 24,
			senderMaxHeight: 24,
			senderMaxLoad: 180,
			portLoad: 45,
		}),
	)
	assert.deepEqual(result.cost, [6, 256, 24])
	// 256 receivers for area 1024 forces every receiver to have area 4.
	// A port can then carry at most 44, so 23 ports cannot carry the screen.
	assert.ok(23 * (Math.floor(45 / 4) * 4) < 1024)
	assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
})

// A separate BigInt occupied-cell feasibility oracle for the coloring regression.
// At the proposed receiver lower bound every receiver is also one cable.
function receiverPartitionExists(width, height, count) {
	const all = (1n << BigInt(width * height)) - 1n
	const memo = new Set()
	function visit(mask, left) {
		if (mask === all) return left === 0
		if (!left) return false
		const key = `${mask}/${left}`
		if (memo.has(key)) return false
		let cell = 0
		while (mask & (1n << BigInt(cell))) cell++
		const x = cell % width
		const y = Math.floor(cell / width)
		for (let w = 1; w <= Math.min(6, width - x); w++) {
			for (let h = 1; h <= Math.min(6, height - y); h++) {
				if (w * h > 15) continue
				let bits = 0n
				for (let ry = y; ry < y + h; ry++)
					for (let rx = x; rx < x + w; rx++) bits |= 1n << BigInt(ry * width + rx)
				if (!(mask & bits) && visit(mask | bits, left - 1)) return true
			}
		}
		memo.add(key)
		return false
	}
	return visit(0n, count)
}

test('8100-module mixed layout has an independently checked coloring proof and exact optimum', () => {
	// Area requires at least 203 senders. Concave 40/15 capacity requires at
	// least 607 receivers and cables. Equality for 607 receivers forces 201
	// area-40/three-receiver senders and two area-30/two-receiver senders.
	assert.ok(202 * 40 < 8100)
	assert.ok(203 * 30 + (606 - 203 * 2) * 10 < 8100)
	const shapesFor = (area, count) => {
		const shapes = []
		for (let w = 1; w <= area; w++)
			if (area % w === 0 && receiverPartitionExists(w, area / w, count)) shapes.push([w, area / w])
		return shapes
	}
	assert.deepEqual(shapesFor(40, 3), [
		[5, 8],
		[8, 5],
	])
	assert.deepEqual(shapesFor(30, 2), [
		[3, 10],
		[5, 6],
		[6, 5],
		[10, 3],
	])
	// Weight (8*[x%8=0]-1)*(8*[y%8=0]-1) is zero on every
	// feasible area-40 shape. Area-30 shapes contribute one of these four
	// values, and two such shapes cannot supply the screen's weight 4.
	const weights = new Set([6, -10, -18, 30])
	for (const a of weights) for (const b of weights) assert.notEqual(a + b, 4)
	for (const direction of ['row', 'column']) {
		const result = solve(
			config({
				screenWidth: 90,
				screenHeight: 90,
				receiverColumns: 6,
				receiverRows: 6,
				senderMaxWidth: 90,
				senderMaxHeight: 90,
				senderMaxLoad: 40,
				senderPorts: 3,
				portLoad: 15,
			}),
			direction,
		)
		assert.deepEqual(result.cost, [203, 608, 607])
		assert.ok(result.elapsedMs < 2000, `elapsed ${result.elapsedMs} ms`)
	}
})
