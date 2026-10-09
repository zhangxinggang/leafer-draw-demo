import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { optimizeCabinet } = await import(
	`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const base = {
	screenWidth: 12,
	screenHeight: 12,
	moduleWidth: 1,
	moduleHeight: 1,
	receiverColumns: 2,
	receiverRows: 2,
	senderMaxWidth: 24,
	senderMaxHeight: 24,
	senderMaxLoad: 180,
	senderPorts: 4,
	portLoad: 45,
}
const cases = [
	['default grid', {}],
	[
		'9600 modules',
		{
			screenWidth: 120,
			screenHeight: 80,
			senderMaxWidth: 12,
			senderMaxHeight: 10,
			senderMaxLoad: 120,
			portLoad: 40,
		},
	],
	[
		'mixed sender rectangles',
		{
			screenWidth: 5,
			screenHeight: 5,
			senderMaxWidth: 4,
			senderMaxHeight: 4,
			senderMaxLoad: 6,
			senderPorts: 1,
			portLoad: 6,
		},
	],
	[
		'fractional pixel capacity',
		{
			moduleWidth: 160,
			moduleHeight: 90,
			screenWidth: 1920,
			screenHeight: 1080,
			senderMaxWidth: 3840,
			senderMaxHeight: 2160,
			senderMaxLoad: 2600000,
			portLoad: 650000,
		},
	],
	['1024 modules', { screenWidth: 32, screenHeight: 32 }],
	[
		'prime port capacity with compound coloring proof',
		{
			screenWidth: 32,
			screenHeight: 23,
			receiverColumns: 6,
			receiverRows: 5,
			senderMaxWidth: 18,
			senderMaxHeight: 21,
			senderMaxLoad: 74,
			senderPorts: 1,
			portLoad: 11,
		},
	],
	[
		'nondivisible height with slice composition proof',
		{
			screenWidth: 18,
			screenHeight: 11,
			receiverColumns: 2,
			receiverRows: 3,
			senderMaxWidth: 6,
			senderMaxHeight: 21,
			senderMaxLoad: 14,
			senderPorts: 1,
			portLoad: 15,
		},
	],
	[
		'transposed long sender interior',
		{
			screenWidth: 16,
			screenHeight: 4,
			receiverColumns: 6,
			receiverRows: 3,
			senderMaxWidth: 16,
			senderMaxHeight: 4,
			senderMaxLoad: 64,
			senderPorts: 5,
			portLoad: 13,
		},
	],
	[
		'sender sampling with optimal receiver restrictions',
		{
			screenWidth: 34,
			screenHeight: 19,
			receiverColumns: 4,
			receiverRows: 5,
			senderMaxWidth: 6,
			senderMaxHeight: 13,
			senderMaxLoad: 78,
			senderPorts: 5,
			portLoad: 39,
		},
	],
	[
		'fixed sender count with slice sum certificate',
		{
			screenWidth: 23,
			screenHeight: 10,
			receiverColumns: 1,
			receiverRows: 4,
			senderMaxWidth: 5,
			senderMaxHeight: 8,
			senderMaxLoad: 139,
			senderPorts: 2,
			portLoad: 10,
		},
	],
	[
		'incompatible slice projections',
		{
			screenWidth: 15,
			screenHeight: 14,
			receiverColumns: 3,
			receiverRows: 6,
			senderMaxWidth: 17,
			senderMaxHeight: 24,
			senderMaxLoad: 61,
			senderPorts: 2,
			portLoad: 14,
		},
	],
	[
		'paired exceptional projections with nonslicing construction',
		{
			screenWidth: 22,
			screenHeight: 13,
			receiverColumns: 2,
			receiverRows: 1,
			senderMaxWidth: 16,
			senderMaxHeight: 19,
			senderMaxLoad: 18,
			senderPorts: 1,
			portLoad: 17,
		},
	],
	[
		'saturated receiver columns with cable proof',
		{
			screenWidth: 34,
			screenHeight: 19,
			receiverColumns: 2,
			receiverRows: 5,
			senderMaxWidth: 22,
			senderMaxHeight: 17,
			senderMaxLoad: 40,
			senderPorts: 5,
			portLoad: 15,
		},
	],
	[
		'partial skyline slice proof with fewer receivers',
		{
			screenWidth: 19,
			screenHeight: 26,
			receiverColumns: 3,
			receiverRows: 6,
			senderMaxWidth: 13,
			senderMaxHeight: 16,
			senderMaxLoad: 23,
			senderPorts: 6,
			portLoad: 42,
		},
	],
	[
		'partial skyline cable proof',
		{
			screenWidth: 34,
			screenHeight: 25,
			receiverColumns: 2,
			receiverRows: 3,
			senderMaxWidth: 24,
			senderMaxHeight: 23,
			senderMaxLoad: 64,
			senderPorts: 3,
			portLoad: 45,
		},
	],
	[
		'repeated resource budgets with mixed receiver sizes',
		{
			screenWidth: 22,
			screenHeight: 25,
			receiverColumns: 6,
			receiverRows: 3,
			senderMaxWidth: 24,
			senderMaxHeight: 15,
			senderMaxLoad: 66,
			senderPorts: 5,
			portLoad: 13,
		},
	],
	[
		'sender infeasibility followed by receiver and cable proofs',
		{
			screenWidth: 31,
			screenHeight: 28,
			receiverColumns: 3,
			receiverRows: 6,
			senderMaxWidth: 7,
			senderMaxHeight: 22,
			senderMaxLoad: 67,
			senderPorts: 4,
			portLoad: 28,
		},
	],
	[
		'tight port geometry',
		{
			screenWidth: 9,
			screenHeight: 9,
			senderMaxWidth: 5,
			senderMaxHeight: 7,
			senderMaxLoad: 20,
			portLoad: 7,
			senderPorts: 3,
		},
	],
	...['row', 'column'].map((direction) => [
		`near-full interval proof (${direction})`,
		{
			screenWidth: 23,
			screenHeight: 24,
			receiverColumns: 3,
			receiverRows: 6,
			senderMaxWidth: 11,
			senderMaxHeight: 22,
			senderMaxLoad: 15,
			senderPorts: 4,
			portLoad: 16,
		},
		direction,
	]),
	...(process.env.CABINET_BENCH_STRESS
		? [
				[
					'8100 modules with tight receiver/port geometry',
					{
						screenWidth: 90,
						screenHeight: 90,
						receiverColumns: 6,
						receiverRows: 6,
						senderMaxWidth: 90,
						senderMaxHeight: 90,
						senderMaxLoad: 40,
						senderPorts: 3,
						portLoad: 15,
					},
				],
			]
		: []),
]
// This diagnostic alone is bounded. Production exact search has no timeout.
const budget = Number(process.env.CABINET_BENCH_MS ?? 1500)
const filter = process.env.CABINET_BENCH_FILTER?.toLowerCase()
for (const [name, changes, direction = 'row'] of cases) {
	if (filter && !name.toLowerCase().includes(filter)) continue
	const start = performance.now()
	let firstMs
	let result
	let states = 0
	const timeline = []
	for (const progress of optimizeCabinet({ ...base, ...changes }, direction)) {
		states = progress.visitedStates
		if (progress.solution) {
			firstMs ??= performance.now() - start
			result = progress.solution
			if (process.env.CABINET_BENCH_TRACE) {
				const previous = timeline.at(-1)
				if (
					!previous ||
					previous.provedPrefix !== result.provedPrefix ||
					previous.cost.join(',') !== result.cost.join(',') ||
					previous.lowerBound.join(',') !== result.lowerBound.join(',') ||
					progress.stage === 'complete'
				)
					timeline.push({
						elapsedMs: Math.round((performance.now() - start) * 10) / 10,
						cost: result.cost,
						lowerBound: result.lowerBound,
						provedPrefix: result.provedPrefix,
						states,
					})
			}
		}
		if (performance.now() - start > budget) break
	}
	console.log(
		JSON.stringify({
			name,
			firstMs: Math.round(firstMs * 10) / 10,
			elapsedMs: Math.round((performance.now() - start) * 10) / 10,
			cost: result?.cost,
			optimal: result?.isOptimal,
			states,
			...(process.env.CABINET_BENCH_TRACE ? { timeline } : {}),
		}),
	)
}
