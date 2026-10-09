import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { Worker } from 'node:worker_threads'

async function moduleUrl(path, imports = {}) {
	const source = await readFile(new URL(path, import.meta.url), 'utf8')
	let { outputText } = ts.transpileModule(source, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
	})
	for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(name, url)
	return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}
const solverUrl = await moduleUrl('./index.ts')
const poolUrl = await moduleUrl('../worker/index.ts')
const runnerUrl = await moduleUrl(
	'../../../../apps/momoAlgorithm/src/pages/cabinetCalculation.ts',
	{
		'@momo/utils/extremeCabinet': solverUrl,
		'@momo/utils/worker': poolUrl,
	},
)
const { startCabinetCalculation } = await import(runnerUrl)
const { optimizeCabinet } = await import(solverUrl)
const configuration = {
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
}

function start() {
	const workers = []
	const updates = []
	const errors = []
	const stopped = []
	const dispose = startCabinetCalculation({
		configuration,
		mode: 'regular',
		createWorker: () => {
			const worker = {
				terminated: false,
				postMessage(data) {
					this.request = data
				},
				terminate() {
					this.terminated = true
				},
				emit(progress) {
					this.onmessage?.({ data: { direction: this.request.direction, progress } })
				},
			}
			workers.push(worker)
			return worker
		},
		onProgress: (update) => updates.push(update),
		onError: (error) => errors.push(error),
		onDirectionStopped: (direction) => stopped.push(direction),
	})
	return { workers, updates, errors, stopped, dispose }
}

test('page orchestration starts exactly four distinct tasks and merges real solver results', async () => {
	const run = start()
	assert.deepEqual(
		run.workers.map((worker) => [
			worker.request.direction,
			worker.request.shard.index,
			worker.request.shard.count,
		]),
		[
			['row', 0, 2],
			['row', 1, 2],
			['column', 0, 2],
			['column', 1, 2],
		],
	)
	for (const worker of run.workers) {
		const { direction, mode, shard } = worker.request
		for (const progress of optimizeCabinet(configuration, direction, mode, shard)) {
			if (worker.terminated) break
			worker.emit(progress)
		}
	}
	await Promise.resolve()
	assert.deepEqual(run.errors, [])
	assert.ok(run.workers.every((worker) => worker.terminated))
	assert.ok(run.updates.at(-1).row.solution.isOptimal)
	assert.ok(run.updates.at(-1).column.solution.isOptimal)
	run.dispose()
})

test('one failed shard stops its direction and retains the current unproved solution', async () => {
	const run = start()
	const initial = optimizeCabinet(configuration).next().value
	run.workers[0].emit(initial)
	const beforeError = run.updates.at(-1)
	run.workers[1].onerror({ message: 'resource limit' })
	await Promise.resolve()
	assert.deepEqual(run.errors, ['resource limit'])
	assert.deepEqual(run.stopped, ['row'])
	assert.ok(run.workers[0].terminated && run.workers[1].terminated)
	assert.equal(run.updates.at(-1), beforeError)
	assert.equal(beforeError.row.solution.isOptimal, false)
	assert.equal(run.workers[2].terminated, false)
	run.dispose()
})

test('disposal suppresses stale captured callbacks after a run is replaced', async () => {
	const run = start()
	const oldMessage = run.workers[0].onmessage
	run.dispose()
	oldMessage({ data: { direction: 'row', progress: optimizeCabinet(configuration).next().value } })
	await Promise.resolve()
	assert.equal(run.updates.length, 0)
	assert.equal(run.errors.length, 0)
	assert.ok(run.workers.every((worker) => worker.terminated))
})

test('four actual worker threads recommend a million-receiver layout without premature completion', async () => {
	const compactUrl = await moduleUrl('./compact.ts')
	const workerUrl = await moduleUrl('../../../../apps/momoAlgorithm/src/pages/cabinet.worker.ts', {
		'@momo/utils/extremeCabinet': solverUrl,
		'@momo/utils/compactCabinet': compactUrl,
	})
	const entry = `import { parentPort } from 'node:worker_threads';
		globalThis.self = { postMessage: (data) => parentPort.postMessage(data) };
		await import(${JSON.stringify(workerUrl)});
		parentPort.on('message', (data) => self.onmessage({ data }));`
	const workers = [],
		updates = [],
		received = []
	let dispose
	try {
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('million worker run timed out')), 10000)
			dispose = startCabinetCalculation({
				configuration: {
					...configuration,
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
				},
				mode: 'regular',
				createWorker: () => {
					const thread = new Worker(
						new URL(`data:text/javascript;base64,${Buffer.from(entry).toString('base64')}`),
					)
					const adapter = {
						postMessage: (data) => thread.postMessage(data),
						terminate: () => {
							adapter.terminated = true
							void thread.terminate()
						},
					}
					thread.on('message', (data) => {
						received.push(data)
						adapter.onmessage?.({ data })
					})
					thread.on('error', (error) => adapter.onerror?.(error))
					workers.push(adapter)
					return adapter
				},
				onProgress: (progress) => updates.push(progress),
				onError: (error) => {
					clearTimeout(timeout)
					reject(new Error(error))
				},
				onDirectionStopped: () => {
					const latest = updates.at(-1)
					if (latest?.row?.stage === 'recommended' && latest?.column?.stage === 'recommended') {
						clearTimeout(timeout)
						resolve()
					}
				},
			})
		})
		assert.equal(workers.length, 4)
		assert.equal(received.length, 4, 'both shards per direction must finish')
		for (const direction of ['row', 'column']) {
			const result = updates.at(-1)[direction]
			assert.equal(result.stage, 'recommended')
			assert.deepEqual(result.solution.cost, [12500, 1000000, 200000])
			assert.equal(result.solution.isOptimal, false)
			assert.ok(result.solution.compact)
			assert.ok(updates.some((p) => p[direction]?.stage === 'constructing'))
		}
		assert.ok(workers.every((w) => w.terminated))
	} finally {
		dispose?.()
	}
})
