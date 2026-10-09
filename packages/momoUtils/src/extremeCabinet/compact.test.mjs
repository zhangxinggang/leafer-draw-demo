import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const { outputText } = ts.transpileModule(
	await readFile(new URL('./compact.ts', import.meta.url), 'utf8'),
	{
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
	},
)
const api = await import(
	`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const config = (overrides = {}) => ({
	screenWidth: 23,
	screenHeight: 17,
	moduleWidth: 1,
	moduleHeight: 1,
	receiverColumns: 3,
	receiverRows: 2,
	senderMaxWidth: 12,
	senderMaxHeight: 9,
	senderMaxLoad: 60,
	senderPorts: 4,
	portLoad: 17,
	...overrides,
})
const million = config({
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
})

// An independent recursive expansion used only on small fixtures.
function split(length, spans, offset = 0) {
	if (!spans.length) return [{ start: offset, size: length }]
	const result = []
	for (let start = 0; start < length; start += spans[0])
		result.push(...split(Math.min(spans[0], length - start), spans.slice(1), offset + start))
	return result
}
function inside(parent, child) {
	return (
		child.x >= parent.x &&
		child.y >= parent.y &&
		child.x + child.width <= parent.x + parent.width &&
		child.y + child.height <= parent.y + parent.height
	)
}
function adjacent(a, b) {
	return (
		((a.x + a.width === b.x || b.x + b.width === a.x) &&
			Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height)) ||
		((a.y + a.height === b.y || b.y + b.height === a.y) &&
			Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width))
	)
}

test('nested clipped axes match independent expansion, random access, inverse and type counts', () => {
	assert.equal(
		api.cabinetAxisIndex(Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER, [16, 4, 1]),
		Number.MAX_SAFE_INTEGER - 1,
	)
	for (let length = 1; length <= 65; length++)
		for (const spans of [[17, 6, 4], [13, 5, 2], [20, 5, 1], [7], [100, 50, 25]]) {
			const cells = split(length, spans)
			assert.equal(api.cabinetAxisCount(length, spans), cells.length)
			const sizes = new Map()
			cells.forEach((cell, index) => {
				assert.deepEqual(api.cabinetAxisCell(index, length, spans), cell)
				assert.equal(api.cabinetAxisIndex(cell.start + cell.size / 2, length, spans), index)
				assert.equal(api.cabinetAxisIndex(cell.start, length, spans), index)
				sizes.set(cell.size, (sizes.get(cell.size) || 0) + 1)
			})
			assert.deepEqual(api.cabinetAxisSizes(length, spans), sizes)
		}
})

test('compact recommendations expand to full coverage, feasible devices and adjacent snake chains', () => {
	for (const direction of ['row', 'column'])
		for (const mode of ['regular', 'free'])
			for (let width = 11; width <= 35; width += 3) {
				const c = config({ screenWidth: width, screenHeight: width - 4 })
				const s = api.recommendCompactCabinet(c, direction, mode, { index: width % 2, count: 2 })
				assert.deepEqual(api.validateCompactCabinet(s), [])
				const senders = Array.from({ length: s.cost[0] }, (_, i) => api.getCompactSender(s, i))
				const cables = Array.from({ length: s.cost[2] }, (_, i) => api.getCompactCable(s, i))
				const receivers = Array.from({ length: s.cost[1] }, (_, i) => api.getCompactReceiver(s, i))
				const occupied = new Set(),
					counts = new Map(),
					types = new Map()
				for (const r of receivers) {
					const sender = senders[r.sender - 1],
						cable = cables[r.cable - 1]
					assert.ok(inside(sender, r) && inside(cable, r))
					assert.equal(cable.sender, sender.id)
					assert.equal(r.port, cable.port)
					assert.ok(r.width <= c.receiverColumns && r.height <= c.receiverRows)
					assert.deepEqual(api.findCompactReceiver(s, r.x + r.width / 2, r.y + r.height / 2), r)
					counts.set(r.sender, (counts.get(r.sender) || 0) + 1)
					const key = `${r.width}x${r.height}`
					types.set(key, (types.get(key) || 0) + 1)
					for (let y = r.y; y < r.y + r.height; y++)
						for (let x = r.x; x < r.x + r.width; x++) {
							assert.ok(!occupied.has(`${x},${y}`), 'receivers must not overlap')
							occupied.add(`${x},${y}`)
						}
				}
				assert.equal(occupied.size, c.screenWidth * c.screenHeight)
				assert.deepEqual(
					new Map(
						api.getCompactReceiverTypes(s.compact).map((t) => [`${t.width}x${t.height}`, t.count]),
					),
					types,
				)
				for (const cable of cables) {
					const chain = receivers
						.filter((r) => r.cable === cable.id)
						.sort((a, b) => a.order - b.order)
					assert.equal(chain.length, cable.receiverCount)
					assert.equal(
						chain.reduce((sum, r) => sum + r.width * r.height, 0),
						cable.load,
					)
					assert.ok(cable.load <= c.portLoad)
					chain.forEach((r, i) => {
						assert.deepEqual(api.compactReceiverAtOrder(s, cable, i + 1), r)
						if (i) assert.ok(adjacent(chain[i - 1], r))
					})
					assert.equal(api.compactReceiverAtOrder(s, cable, chain.length + 1), undefined)
				}
				for (const sender of senders) {
					const ports = cables.filter((cable) => cable.sender === sender.id)
					assert.equal(ports.length, sender.cableCount)
					assert.equal(new Set(ports.map((p) => p.port)).size, ports.length)
					assert.ok(ports.every((p) => p.port >= 1 && p.port <= c.senderPorts && inside(sender, p)))
					assert.equal(counts.get(sender.id), sender.receiverCount)
					assert.ok(
						sender.load <= s.realSenderLoad &&
							sender.width <= c.senderMaxWidth &&
							sender.height <= c.senderMaxHeight,
					)
				}
				assert.equal(
					s.receiverBalance.sumSquares,
					[...counts.values()].reduce((sum, n) => sum + n * n, 0),
				)
			}
})

test('million receivers and hundred-million or thin layouts stay compact without a size ceiling', () => {
	for (const c of [
		million,
		{ ...million, screenWidth: 4800000, screenHeight: 2700000 },
		{ ...million, screenWidth: 480000000, screenHeight: 270 },
	]) {
		for (const direction of ['row', 'column'])
			for (const index of [0, 1]) {
				const start = performance.now()
				const s = api.recommendCompactCabinet(c, direction, 'free', { index, count: 2 })
				assert.ok(performance.now() - start < 2000, 'bounded recommendation must finish promptly')
				assert.deepEqual(api.validateCompactCabinet(s), [])
				assert.equal(s.cost[1], (c.screenWidth / c.moduleWidth) * (c.screenHeight / c.moduleHeight))
				assert.ok(JSON.stringify(s).length < 3000, 'no object per receiver in transfer data')
				assert.equal(s.senders.length, 0)
				assert.equal(s.isOptimal, false)
				const last = api.getCompactReceiver(s, s.cost[1] - 1)
				assert.equal(last.x + last.width, s.compact.width)
				assert.equal(last.y + last.height, s.compact.height)
				assert.equal(last.sender, s.cost[0])
				assert.equal(last.cable, s.cost[2])
			}
	}
})

test('viewport samples cover all logical receivers while limiting draw groups', () => {
	const s = api.recommendCompactCabinet(million, 'row', 'regular', { index: 0, count: 2 })
	const axes = api.compactAxes(s.compact, 'receiver')
	const xs = api.sampleCabinetAxis(1000, axes.x, 0, 1000, 100)
	const ys = api.sampleCabinetAxis(1000, axes.y, 0, 1000, 70)
	assert.ok(xs.length <= 100 && ys.length <= 70)
	assert.equal(xs.reduce((n, x) => n + x.count, 0) * ys.reduce((n, y) => n + y.count, 0), 1000000)
	assert.equal(xs.at(-1).start + xs.at(-1).size, 1000)
	const detail = api.sampleCabinetAxis(1000, axes.x, 995, 1000, 100)
	assert.ok(detail.every((sample) => sample.count === 1))
	assert.equal(detail.at(-1).index, 999)
	assert.deepEqual(api.sampleCabinetAxis(1000, axes.x, 1001, 1010, 100), [])
})

test('compact audit rejects invalid geometry, false optimality and mismatched statistics', () => {
	const s = api.recommendCompactCabinet(config(), 'row', 'regular', { index: 0, count: 2 })
	for (const change of [
		{ cost: [0, 0, 0] },
		{ isOptimal: true },
		{ realSenderLoad: 999999 },
		{ compact: { ...s.compact, senderWidth: 999 } },
		{ compact: { ...s.compact, receiverWidth: 99 } },
		{ compact: { ...s.compact, cableWidth: 0 } },
	])
		assert.ok(api.validateCompactCabinet({ ...s, ...change }).length > 0)
})
