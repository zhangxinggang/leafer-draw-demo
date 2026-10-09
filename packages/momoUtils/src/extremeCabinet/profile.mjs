import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { optimizeCabinet, validateCabinetSolution } = await import(
	`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

// Diagnostic budget only. Production search has no timeout or scope reduction.
const budget = Number(process.env.CABINET_PROFILE_MS ?? 300)
const cases = Number(process.env.CABINET_PROFILE_CASES ?? 40)
const selectedIds = process.env.CABINET_PROFILE_IDS?.split(',').map(Number)
let seed = 30921
const random = (maximum) => {
	seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
	return 1 + (seed % maximum)
}
const samples = []
for (let index = 0; index < cases; index++) {
	const configuration = {
		screenWidth: 6 + random(30),
		screenHeight: 6 + random(24),
		moduleWidth: 1,
		moduleHeight: 1,
		receiverColumns: random(6),
		receiverRows: random(6),
		senderMaxWidth: 4 + random(20),
		senderMaxHeight: 4 + random(20),
		senderMaxLoad: 10 + random(130),
		senderPorts: random(6),
		portLoad: 5 + random(40),
	}
	if (selectedIds && !selectedIds.includes(index)) continue
	const start = performance.now()
	let firstMs
	let solution
	let visitedStates = 0
	const timeline = []
	for (const progress of optimizeCabinet(configuration)) {
		visitedStates = progress.visitedStates
		if (progress.solution) {
			firstMs ??= performance.now() - start
			solution = progress.solution
			if (process.env.CABINET_PROFILE_TRACE) {
				const previous = timeline.at(-1)
				if (
					!previous ||
					previous.provedPrefix !== solution.provedPrefix ||
					previous.cost.join(',') !== solution.cost.join(',') ||
					previous.lowerBound.join(',') !== solution.lowerBound.join(',') ||
					progress.stage === 'complete'
				)
					timeline.push({
						elapsedMs: Math.round((performance.now() - start) * 10) / 10,
						cost: solution.cost,
						lowerBound: solution.lowerBound,
						provedPrefix: solution.provedPrefix,
						visitedStates,
					})
			}
		}
		if (performance.now() - start > budget) break
	}
	const elapsedMs = performance.now() - start
	if (solution) {
		const errors = validateCabinetSolution(solution)
		if (errors.length) throw new Error(JSON.stringify({ configuration, errors }))
	}
	samples.push({
		index,
		firstMs: Math.round(firstMs * 10) / 10,
		elapsedMs: Math.round(elapsedMs * 10) / 10,
		optimal: !!solution?.isOptimal,
		cost: solution?.cost,
		lowerBound: solution?.lowerBound,
		provedPrefix: solution?.provedPrefix,
		visitedStates,
		configuration,
		...(process.env.CABINET_PROFILE_TRACE ? { timeline } : {}),
		...(process.env.CABINET_PROFILE_LAYOUT
			? {
					senders: solution?.senders.map((sender) => ({
						x: sender.x,
						y: sender.y,
						width: sender.width,
						height: sender.height,
						receivers: sender.cables.reduce((sum, cable) => sum + cable.receivers.length, 0),
						cables: sender.cables.length,
					})),
				}
			: {}),
	})
}
console.log(
	JSON.stringify({
		completed: samples.filter((sample) => sample.optimal).length,
		total: samples.length,
		budgetMs: budget,
		firstMaximumMs: Math.max(...samples.map((sample) => sample.firstMs)),
		unfinished: samples.filter((sample) => !sample.optimal),
		slowestCompleted: samples
			.filter((sample) => sample.optimal)
			.sort((a, b) => b.elapsedMs - a.elapsedMs)
			.slice(0, 3),
	}),
)
