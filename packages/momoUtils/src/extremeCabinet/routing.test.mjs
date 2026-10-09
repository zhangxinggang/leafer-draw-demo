import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const {
	optimizeCabinet,
	validateCabinetSolution,
	compareCabinetSolutions,
	getCabinetReceiverBalance,
	shareCabinetOptimality,
	areCabinetReceiversAdjacent,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const configuration = (overrides = {}) => ({
	screenWidth: 4,
	screenHeight: 3,
	moduleWidth: 1,
	moduleHeight: 1,
	receiverColumns: 2,
	receiverRows: 2,
	senderMaxWidth: 4,
	senderMaxHeight: 3,
	senderMaxLoad: 8,
	senderPorts: 2,
	portLoad: 4,
	...overrides,
})
const score = (solution) => [
	solution.cost[0],
	solution.cost[1],
	getCabinetReceiverBalance(solution).sumSquares,
	solution.cost[2],
]
const compare = (a, b) => {
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
	return 0
}
function solve(c, mode, direction = 'row') {
	let result
	for (const progress of optimizeCabinet(c, direction, mode)) {
		if (!progress.solution) continue
		assert.deepEqual(validateCabinetSolution(progress.solution), [])
		if (result)
			assert.ok(
				compareCabinetSolutions(progress.solution, result) <= 0,
				'published objective must improve',
			)
		result = progress.solution
	}
	assert.equal(result.isOptimal, true)
	assert.equal(result.receiverBalance.isOptimal, true)
	return result
}

// Independent occupied-cell enumeration: no production skyline, receiver count,
// capacity bound, materializer or bin packer is used by this oracle.
function placements(width, height, x, y, shapes) {
	return shapes
		.filter((s) => x + s.w <= width && y + s.h <= height)
		.map((s) => {
			let mask = 0
			for (let yy = y; yy < y + s.h; yy++)
				for (let xx = x; xx < x + s.w; xx++) mask |= 1 << (yy * width + xx)
			return { ...s, mask }
		})
}
function receiverAreaSets(width, height, c) {
	const all = (1 << (width * height)) - 1
	const shapes = []
	for (let w = 1; w <= Math.min(width, c.receiverColumns); w++)
		for (let h = 1; h <= Math.min(height, c.receiverRows); h++)
			if (w * h <= c.portLoad) shapes.push({ w, h })
	const memo = new Map()
	const visit = (mask) => {
		if (mask === all) return new Set([''])
		if (memo.has(mask)) return memo.get(mask)
		let i = 0
		while (mask & (1 << i)) i++
		const result = new Set()
		for (const p of placements(width, height, i % width, Math.floor(i / width), shapes)) {
			if (p.mask & mask) continue
			for (const tail of visit(mask | p.mask))
				result.add(
					[p.w * p.h, ...tail.split(',').filter(Boolean).map(Number)]
						.sort((a, b) => b - a)
						.join(','),
				)
		}
		memo.set(mask, result)
		return result
	}
	return [...visit(0)].map((value) => value.split(',').map(Number))
}
function* receiverPartitions(width, height, c) {
	const all = (1 << (width * height)) - 1
	const shapes = []
	for (let w = 1; w <= Math.min(width, c.receiverColumns); w++)
		for (let h = 1; h <= Math.min(height, c.receiverRows); h++)
			if (w * h <= c.portLoad) shapes.push({ w, h })
	shapes.sort((a, b) => b.w * b.h - a.w * a.h)
	function* visit(mask, path) {
		if (mask === all) {
			yield path
			return
		}
		let i = 0
		while (mask & (1 << i)) i++
		for (const p of placements(width, height, i % width, Math.floor(i / width), shapes))
			if (!(p.mask & mask)) yield* visit(mask | p.mask, [...path, p])
	}
	yield* visit(0, [])
}
// Independent cell-neighbor graph, enumerate one-ended simple paths from EVERY
// start, then solve subset cover. No production two-ended path search is reused.
function adjacentPorts(items, width, height, capacity) {
	const touching = items.map((p) => {
		let mask = 0
		for (let i = 0; i < width * height; i++)
			if (p.mask & (1 << i)) {
				if (i % width) mask |= 1 << (i - 1)
				if ((i % width) + 1 < width) mask |= 1 << (i + 1)
				if (i >= width) mask |= 1 << (i - width)
				if (i + width < width * height) mask |= 1 << (i + width)
			}
		return items.map((q, j) => (p !== q && q.mask & mask ? j : -1)).filter((j) => j >= 0)
	})
	const paths = new Set()
	const visited = new Set()
	const visit = (end, mask, load) => {
		const key = `${end}/${mask}`
		if (visited.has(key)) return
		visited.add(key)
		paths.add(mask)
		for (const j of touching[end])
			if (!(mask & (1 << j)) && load + items[j].w * items[j].h <= capacity)
				visit(j, mask | (1 << j), load + items[j].w * items[j].h)
	}
	items.forEach((p, i) => visit(i, 1 << i, p.w * p.h))
	const memo = new Map()
	const cover = (remaining) => {
		if (!remaining) return 0
		if (memo.has(remaining)) return memo.get(remaining)
		const anchor = remaining & -remaining
		let best = items.length
		for (const path of paths)
			if (path & anchor && (path & remaining) === path)
				best = Math.min(best, 1 + cover(remaining ^ path))
		memo.set(remaining, best)
		return best
	}
	return cover((1 << items.length) - 1)
}
function tileOracle(width, height, shapes, portLimit = Infinity) {
	const all = (1 << (width * height)) - 1
	const memo = new Map()
	const visit = (mask, left) => {
		if (mask === all) return [0, 0, 0, 0]
		if (!left) return null
		const key = `${mask}/${left}`
		if (memo.has(key)) return memo.get(key)
		let i = 0
		while (mask & (1 << i)) i++
		let best = null
		for (const p of placements(width, height, i % width, Math.floor(i / width), shapes)) {
			if (p.mask & mask) continue
			const tail = visit(mask | p.mask, left - 1)
			if (!tail) continue
			const next = tail.map((n, level) => n + p.cost[level])
			if (!best || compare(next, best) < 0) best = next
		}
		memo.set(key, best)
		return best
	}
	return visit(0, Math.min(width * height, portLimit))
}
function oracle(c, mode) {
	const portShapes = []
	if (mode === 'regular')
		for (let w = 1; w <= c.screenWidth; w++)
			for (let h = 1; h <= c.screenHeight; h++) {
				if (w * h > c.portLoad) continue
				const r = Math.min(...receiverAreaSets(w, h, c).map((items) => items.length))
				portShapes.push({ w, h, cost: [0, r, 0, 1] })
			}
	const senders = []
	for (let w = 1; w <= Math.min(c.screenWidth, c.senderMaxWidth); w++)
		for (let h = 1; h <= Math.min(c.screenHeight, c.senderMaxHeight); h++) {
			if (w * h > Math.min(c.senderMaxLoad, c.senderPorts * c.portLoad)) continue
			let inner = null
			if (mode === 'regular') inner = tileOracle(w, h, portShapes, c.senderPorts)
			else
				for (const items of receiverPartitions(w, h, c)) {
					if (inner && items.length > inner[1]) continue
					const ports = adjacentPorts(items, w, h, c.portLoad)
					if (ports > c.senderPorts) continue
					const next = [0, items.length, 0, ports]
					if (!inner || compare(next, inner) < 0) inner = next
				}
			if (inner) senders.push({ w, h, cost: [1, inner[1], inner[1] ** 2, inner[3]] })
		}
	return tileOracle(c.screenWidth, c.screenHeight, senders)
}

test('both modes agree with independent four-objective occupied-cell oracle', () => {
	let seed = 4971
	const random = (max) => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
		return 1 + (seed % max)
	}
	for (let i = 0; i < 64; i++) {
		const c = configuration({
			screenWidth: random(4),
			screenHeight: random(3),
			receiverColumns: random(3),
			receiverRows: random(3),
			senderMaxWidth: random(4),
			senderMaxHeight: random(3),
			senderMaxLoad: random(12),
			senderPorts: random(3),
			portLoad: random(7),
		})
		for (const mode of ['regular', 'free']) {
			const expected = oracle(c, mode)
			for (const direction of ['row', 'column'])
				assert.deepEqual(
					score(solve(c, mode, direction)),
					expected,
					JSON.stringify({ c, mode, direction }),
				)
		}
	}
})

test('dense grids and port fragmentation match the independent full partition oracle', () => {
	for (const [width, height] of [
		[3, 3],
		[4, 3],
	])
		for (const load of [5, 7, 10])
			for (const portLoad of [3, 5, 7]) {
				const c = configuration({
					screenWidth: width,
					screenHeight: height,
					receiverRows: 3,
					senderMaxWidth: 3,
					senderMaxLoad: load,
					senderPorts: 2,
					portLoad,
				})
				for (const mode of ['regular', 'free'])
					assert.deepEqual(score(solve(c, mode)), oracle(c, mode), JSON.stringify({ c, mode }))
			}
})

test('the public solver publishes a feasible incumbent promptly before exact balance proof', () => {
	let seed = 49197
	const random = (max) => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
		return 1 + Math.floor((seed / 4294967296) * max)
	}
	for (let i = 0; i < 40; i++) {
		const c = configuration({
			screenWidth: 5 + random(20),
			screenHeight: 5 + random(16),
			receiverColumns: random(5),
			receiverRows: random(5),
			senderMaxWidth: 3 + random(12),
			senderMaxHeight: 3 + random(12),
			senderMaxLoad: 5 + random(70),
			senderPorts: random(4),
			portLoad: 3 + random(30),
		})
		for (const mode of ['regular', 'free']) {
			const generator = optimizeCabinet(c, 'row', mode)
			const start = performance.now()
			let first
			while (!first) {
				const step = generator.next()
				assert.equal(step.done, false)
				first = step.value.solution
			}
			assert.ok(
				performance.now() - start < 1000,
				'first incumbent should precede potentially expensive proofs',
			)
			assert.deepEqual(validateCabinetSolution(first), [])
			assert.equal(first.isOptimal, false)
			generator.return()
		}
	}
})

test('default-size solutions finish in both modes with complete balance metadata', () => {
	const c = configuration({
		screenWidth: 1920,
		screenHeight: 1080,
		moduleWidth: 160,
		moduleHeight: 90,
		senderMaxWidth: 3840,
		senderMaxHeight: 2160,
		senderMaxLoad: 2600000,
		senderPorts: 4,
		portLoad: 650000,
	})
	for (const mode of ['regular', 'free'])
		for (const direction of ['row', 'column']) {
			const result = solve(c, mode, direction)
			assert.deepEqual(result.cost, [1, 36, 4])
			assert.equal(result.receiverBalance.sumSquares, result.receiverBalance.lowerBound)
		}
})

test('receiver width and height are independent maxima and may shrink to 1 by 3', () => {
	const c = configuration({
		screenWidth: 1,
		screenHeight: 3,
		receiverColumns: 2,
		receiverRows: 4,
		senderMaxLoad: 12,
		portLoad: 12,
	})
	for (const mode of ['regular', 'free']) {
		const solution = solve(c, mode)
		const receiver = solution.senders[0].cables[0].receivers[0]
		assert.deepEqual([receiver.width, receiver.height], [1, 3])
		for (const [width, height] of [
			[3, 2],
			[1, 5],
		]) {
			const invalid = structuredClone(solution)
			Object.assign(invalid.senders[0].cables[0].receivers[0], { width, height })
			assert.ok(validateCabinetSolution(invalid).includes('接收卡尺寸超限'))
		}
	}
})

test('receiver allocation reaches the attainable integer balance without extra devices', () => {
	const c = configuration({
		screenWidth: 10,
		screenHeight: 1,
		receiverColumns: 1,
		receiverRows: 1,
		senderMaxWidth: 8,
		senderMaxHeight: 1,
		senderMaxLoad: 8,
		senderPorts: 1,
		portLoad: 8,
	})
	for (const mode of ['regular', 'free']) {
		const result = solve(c, mode)
		assert.deepEqual(result.cost, [2, 10, 2])
		assert.deepEqual(result.receiverBalance.counts, [5, 5])
	}
})

test('free mode regroups a count-optimal regular seed across its old cable rectangles', () => {
	const c = configuration({
		screenWidth: 12,
		screenHeight: 12,
		senderMaxWidth: 12,
		senderMaxHeight: 12,
		senderMaxLoad: 180,
		senderPorts: 4,
		portLoad: 45,
	})
	const regular = solve(c, 'regular')
	for (const direction of ['row', 'column']) {
		const free = solve(c, 'free', direction)
		assert.deepEqual(free.cost, regular.cost)
		assert.ok(
			free.senders
				.flatMap((s) => s.cables)
				.some(
					(cable) =>
						cable.width * cable.height >
						cable.receivers.reduce((sum, r) => sum + r.width * r.height, 0),
				),
			'free routing should retain a continuous nonrectangular path when counts are unchanged',
		)
		for (const sender of free.senders)
			for (const cable of sender.cables) {
				assert.ok(cable.receivers.reduce((sum, r) => sum + r.width * r.height, 0) <= c.portLoad)
				for (let i = 1; i < cable.receivers.length; i++)
					assert.ok(areCabinetReceiversAdjacent(cable.receivers[i - 1], cable.receivers[i]))
			}
	}
})

test('free routing permits shared edges but rejects corner contact and skipped receivers', () => {
	const a = { x: 0, y: 0, width: 2, height: 2 }
	for (const b of [
		{ x: 2, y: 1, width: 1, height: 3 },
		{ x: -1, y: 0, width: 1, height: 1 },
		{ x: 1, y: 2, width: 1, height: 1 },
		{ x: 0, y: -1, width: 1, height: 1 },
	])
		assert.equal(areCabinetReceiversAdjacent(a, b), true)
	for (const b of [
		{ x: 2, y: 2, width: 1, height: 1 },
		{ x: 3, y: 0, width: 1, height: 1 },
		{ x: 1, y: 1, width: 2, height: 2 },
	])
		assert.equal(areCabinetReceiversAdjacent(a, b), false)
	const result = solve(
		configuration({
			screenWidth: 4,
			screenHeight: 1,
			receiverColumns: 1,
			receiverRows: 1,
			senderMaxLoad: 4,
			portLoad: 4,
		}),
		'free',
	)
	const cable = result.senders[0].cables[0]
	;[cable.receivers[1], cable.receivers[2]] = [cable.receivers[2], cable.receivers[1]]
	cable.receivers.forEach((receiver, i) => {
		receiver.order = i + 1
	})
	assert.ok(validateCabinetSolution(result).includes('自由网线必须连接共享边的相邻接收卡'))
})

test('free mode uses nonrectangular adjacent paths and sums actual load', () => {
	const c = configuration({
		screenWidth: 3,
		screenHeight: 3,
		receiverColumns: 2,
		receiverRows: 2,
		senderMaxWidth: 3,
		senderMaxHeight: 3,
		senderMaxLoad: 9,
		senderPorts: 2,
		portLoad: 5,
	})
	const regular = solve(c, 'regular')
	const free = solve(c, 'free')
	assert.deepEqual(free.cost, [1, 4, 2])
	assert.deepEqual(score(free), oracle(c, 'free'))
	assert.ok(compare(free.cost, regular.cost) < 0)
	assert.ok(free.senders[0].cables.some((cable) => cable.width * cable.height > c.portLoad))
	for (const cable of free.senders[0].cables)
		assert.ok(cable.receivers.reduce((n, r) => n + r.width * r.height, 0) <= c.portLoad)
})

test('proof sharing requires equal mode, configuration and balance objective', () => {
	const proven = solve(configuration(), 'regular')
	const peer = {
		...proven,
		isOptimal: false,
		provedPrefix: 2,
		receiverBalance: { ...proven.receiverBalance, isOptimal: false },
	}
	assert.deepEqual(
		shareCabinetOptimality({
			row: { stage: 'complete', solution: proven },
			column: { stage: 'balancing', solution: peer },
		}).promoted,
		['column'],
	)
	for (const different of [
		{ ...peer, mode: 'free' },
		{ ...peer, configuration: { ...peer.configuration, portLoad: 10 } },
	])
		assert.deepEqual(
			shareCabinetOptimality({
				row: { stage: 'complete', solution: proven },
				column: { stage: 'searching', solution: different },
			}).promoted,
			[],
		)
})
