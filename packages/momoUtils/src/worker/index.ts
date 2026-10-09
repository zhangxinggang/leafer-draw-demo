type WorkerSource = string | URL | ((event: MessageEvent) => void)

export interface WorkerTask<T> {
	createWorker: () => Worker
	data?: unknown
	onMessage?: (data: T) => void
	isComplete?: (data: T) => boolean
	signal?: AbortSignal
	timeoutMs?: number
	/** Legacy callers explicitly own posting and successful-worker termination. */
	beforeWorker?: (worker: Worker) => void
}

/** Independent, bounded task queue. Progress does not release a worker slot. */
export function createWorkerPool(maxWorkerNum: number) {
	if (!Number.isSafeInteger(maxWorkerNum) || maxWorkerNum < 1)
		throw new RangeError('Worker 数量必须是正整数。')
	const queue: (() => void)[] = []
	const cancellations = new Set<() => void>()
	let active = 0
	let isDisposed = false
	const pump = () => {
		while (!isDisposed && active < maxWorkerNum && queue.length) queue.shift()!()
	}
	return {
		open<T>(task: WorkerTask<T>): Promise<T> {
			return new Promise((resolve, reject) => {
				if (isDisposed || task.signal?.aborted) {
					reject(new DOMException('计算已取消', 'AbortError'))
					return
				}
				let worker: Worker | undefined
				let timer: ReturnType<typeof setTimeout> | undefined
				let isStarted = false
				let isSettled = false
				const finish = (error?: unknown, value?: T) => {
					if (isSettled) return
					isSettled = true
					clearTimeout(timer)
					task.signal?.removeEventListener('abort', cancel)
					cancellations.delete(cancel)
					if (worker) {
						worker.onmessage = worker.onerror = worker.onmessageerror = null
						if (!task.beforeWorker || error !== undefined) worker.terminate()
					}
					if (isStarted) active--
					else {
						const index = queue.indexOf(start)
						if (index >= 0) queue.splice(index, 1)
					}
					if (error !== undefined) reject(error)
					else resolve(value!)
					pump()
				}
				function cancel() {
					finish(new DOMException('计算已取消', 'AbortError'))
				}
				function start() {
					isStarted = true
					active++
					try {
						worker = task.createWorker()
						worker.onmessage = ({ data }: MessageEvent<T>) => {
							if (isSettled) return
							try {
								task.onMessage?.(data)
								if (!task.isComplete || task.isComplete(data)) finish(undefined, data)
							} catch (error) {
								finish(error)
							}
						}
						worker.onerror = (event) => finish(new Error(event.message || '计算进程异常。'))
						worker.onmessageerror = () => finish(new Error('计算结果无法读取。'))
						if (task.timeoutMs)
							timer = setTimeout(
								() =>
									finish(
										new Error(
											'搜索达到保护时限，已保留当前可行方案；尚未证明最优，可调整参数后重试。',
										),
									),
								task.timeoutMs,
							)
						if (task.beforeWorker) task.beforeWorker(worker)
						else worker.postMessage(task.data)
					} catch (error) {
						finish(error)
					}
				}
				cancellations.add(cancel)
				task.signal?.addEventListener('abort', cancel, { once: true })
				queue.push(start)
				pump()
			})
		},
		dispose() {
			isDisposed = true
			for (const cancel of cancellations) cancel()
		},
	}
}

function initWorker(src: WorkerSource | WorkerSource[], options?: WorkerOptions) {
	if (typeof src !== 'function' && !Array.isArray(src)) return new Worker(src, options)
	const sources = Array.isArray(src) ? src : [src]
	const script = sources.map((item) =>
		typeof item === 'function' ? `onmessage = (${item.toString()})` : String(item),
	)
	const url = URL.createObjectURL(new Blob(script, { type: 'text/javascript' }))
	try {
		return new Worker(url, options)
	} finally {
		URL.revokeObjectURL(url)
	}
}

// Preserve the existing one-message helper; new streaming clients use isolated pools.
let defaultPool = createWorkerPool(3)
export const richWorker = {
	init(options: { maxWorkerNum: number }) {
		defaultPool.dispose()
		defaultPool = createWorkerPool(options.maxWorkerNum)
	},
	open(params: {
		src: WorkerSource | WorkerSource[]
		data?: Record<string, unknown>
		workerOptions?: WorkerOptions
		beforeWorker?: (worker: Worker) => void
	}) {
		return defaultPool.open({
			createWorker: () => initWorker(params.src, params.workerOptions),
			data: params.data,
			beforeWorker: params.beforeWorker,
		})
	},
}
