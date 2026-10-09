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
	mergeCabinetShards,
	compareCabinetSolutions,
	validateCabinetSolution,
	getCabinetConfigurationError,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const config = (overrides = {}) => ({
	screenWidth: 5,
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
function solve(c, direction, mode, shard) {
	let result
	for (const progress of optimizeCabinet(c, direction, mode, shard)) {
		if (progress.solution) assert.deepEqual(validateCabinetSolution(progress.solution), [])
		result = progress
	}
	assert.equal(result.stage, 'complete')
	return result
}

test('four disjoint direction shards merge to the serial optimum in both modes', () => {
	let unprovedShards = 0
	for (let width = 2; width <= 5; width++)
		for (const ports of [1, 2, 3])
			for (const mode of ['regular', 'free'])
				for (const direction of ['row', 'column']) {
					const c = config({ screenWidth: width, senderPorts: ports })
					const serial = solve(c, direction, mode)
					const shards = [0, 1].map((index) => solve(c, direction, mode, { index, count: 2 }))
					for (const shard of shards) {
						if (!shard.solution.isOptimal) {
							unprovedShards++
							assert.equal(mergeCabinetShards([shard, null]).solution.isOptimal, false)
							assert.notEqual(mergeCabinetShards([shard, null]).stage, 'complete')
						}
					}
					const merged = mergeCabinetShards(shards)
					assert.equal(merged.stage, 'complete')
					assert.equal(merged.solution.isOptimal, true)
					assert.equal(compareCabinetSolutions(merged.solution, serial.solution), 0)
					assert.deepEqual(validateCabinetSolution(merged.solution), [])
				}
	assert.ok(unprovedShards > 0, 'corpus must include branch exhaustion without a global floor')
})

test('large grids and long single axes are accepted without arbitrary size caps', () => {
	for (const c of [
		config({ screenWidth: 1_000_000 }),
		config({ screenWidth: 513, screenHeight: 1 }),
		config({ screenWidth: 129, screenHeight: 129 }),
	]) {
		assert.equal(getCabinetConfigurationError(c), null)
	}
	assert.equal(getCabinetConfigurationError(config({ screenWidth: 128, screenHeight: 128 })), null)
	assert.equal(
		getCabinetConfigurationError(
			config({
				screenWidth: 10_000_000,
				screenHeight: 1,
				moduleWidth: 10_000_000,
				senderMaxWidth: 10_000_000,
				senderMaxLoad: 10_000_000,
				portLoad: 10_000_000,
			}),
		),
		null,
	)
})

test('invalid shard indices fail without starting computation', () => {
	for (const shard of [
		{ index: 2, count: 2 },
		{ index: -1, count: 2 },
		{ index: 0, count: 0 },
	])
		assert.throws(() => optimizeCabinet(config(), 'row', 'regular', shard), /分片/)
})
