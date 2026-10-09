import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { createWorkerPool } = await import(
	`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
class FakeWorker {
	terminated = false
	postMessage(data) {
		this.request = data
	}
	terminate() {
		this.terminated = true
	}
	emit(data) {
		this.onmessage?.({ data })
	}
}

test('four concurrent workers retain slots for progress and release on final messages', async () => {
	const pool = createWorkerPool(4)
	const workers = []
	let publications = 0
	const tasks = Array.from({ length: 6 }, (_, data) =>
		pool.open({
			createWorker: () => {
				const worker = new FakeWorker()
				workers.push(worker)
				return worker
			},
			data,
			isComplete: (message) => message.done,
			onMessage: () => publications++,
		}),
	)
	assert.equal(workers.length, 4)
	workers[0].emit({ done: false })
	assert.equal(workers.length, 4)
	workers[0].emit({ done: true })
	assert.equal(workers.length, 5)
	assert.ok(workers[0].terminated)
	for (let i = 1; i < 6; i++) workers[i].emit({ done: true })
	await Promise.all(tasks)
	assert.equal(publications, 7)
	assert.ok(workers.every((worker) => worker.terminated))
})

test('cancellation releases running and queued jobs without starting disposed work', async () => {
	const pool = createWorkerPool(1)
	const workers = []
	const tasks = Array.from({ length: 3 }, () =>
		pool.open({
			createWorker: () => {
				const worker = new FakeWorker()
				workers.push(worker)
				return worker
			},
		}),
	)
	const results = Promise.allSettled(tasks)
	pool.dispose()
	assert.equal(workers.length, 1)
	assert.ok(workers[0].terminated)
	assert.ok(
		(await results).every(
			(result) => result.status === 'rejected' && result.reason.name === 'AbortError',
		),
	)
	await assert.rejects(pool.open({ createWorker: () => new FakeWorker() }), { name: 'AbortError' })
})

test('constructor, posting, worker, decoding and callback failures release slots', async () => {
	for (const failure of ['construct', 'post', 'worker', 'decode', 'callback']) {
		const pool = createWorkerPool(1)
		const first = new FakeWorker()
		const second = new FakeWorker()
		const result = pool.open({
			createWorker: () => {
				if (failure === 'construct') throw new Error('construct')
				if (failure === 'post')
					first.postMessage = () => {
						throw new Error('post')
					}
				return first
			},
			onMessage: () => {
				throw new Error('callback')
			},
		})
		const rejected = assert.rejects(result)
		const next = pool.open({ createWorker: () => second })
		if (failure === 'worker') first.onerror({ message: 'worker' })
		if (failure === 'decode') first.onmessageerror({})
		if (failure === 'callback') first.emit({})
		await rejected
		second.emit('ok')
		assert.equal(await next, 'ok')
		if (failure !== 'construct') assert.ok(first.terminated)
	}
})

test('timeout and abort terminate active workers and reject only once', async () => {
	const pool = createWorkerPool(1)
	const first = new FakeWorker()
	await assert.rejects(pool.open({ createWorker: () => first, timeoutMs: 10 }), /保护时限/)
	assert.ok(first.terminated)
	const controller = new AbortController()
	const second = new FakeWorker()
	const next = pool.open({ createWorker: () => second, signal: controller.signal })
	const rejected = assert.rejects(next, { name: 'AbortError' })
	controller.abort()
	await rejected
	assert.ok(second.terminated)
	pool.dispose()
})
