import type {
	CabinetConfiguration,
	CabinetDirection,
	CabinetMode,
	CabinetProgress,
	CabinetProgressPair,
} from '@momo/utils/extremeCabinet'
import { mergeCabinetShards, shareCabinetOptimality } from '@momo/utils/extremeCabinet'
import { createWorkerPool } from '@momo/utils/worker'
import type { CabinetWorkerRequest, CabinetWorkerResponse } from './cabinet.worker'

export function startCabinetCalculation(options: {
	configuration: CabinetConfiguration
	mode: CabinetMode
	createWorker: () => Worker
	onProgress: (progress: CabinetProgressPair) => void
	onDirectionStopped: (direction: CabinetDirection) => void
	onError: (message: string) => void
}) {
	const pool = createWorkerPool(4)
	const controllers = { row: new AbortController(), column: new AbortController() }
	const shards: Record<CabinetDirection, (CabinetProgress | null)[]> = {
		row: [null, null],
		column: [null, null],
	}
	let progress: CabinetProgressPair = { row: null, column: null }
	let isDisposed = false
	const stopDirection = (direction: CabinetDirection) => {
		controllers[direction].abort()
		options.onDirectionStopped(direction)
	}
	const startShard = (direction: CabinetDirection, index: number) => {
		const data: CabinetWorkerRequest = {
			configuration: options.configuration,
			mode: options.mode,
			direction,
			shard: { index, count: 2 },
		}
		void pool
			.open<CabinetWorkerResponse>({
				createWorker: options.createWorker,
				data,
				signal: controllers[direction].signal,
				timeoutMs: 30000,
				isComplete: (message) =>
					message.progress?.stage === 'complete' || message.progress?.stage === 'recommended',
				onMessage: (message) => {
					if (isDisposed || controllers[direction].signal.aborted) return
					if (message.error) throw new Error(message.error)
					if (!message.progress) throw new Error('计算进程未返回有效结果。')
					shards[direction][index] = {
						...message.progress,
						solution: message.progress.solution ?? shards[direction][index]?.solution,
					}
					const merged = mergeCabinetShards(shards[direction])
					const shared = shareCabinetOptimality({ ...progress, [direction]: merged })
					progress = shared.progress
					options.onProgress(progress)
					if (merged.stage === 'complete' || merged.stage === 'recommended')
						stopDirection(direction)
					for (const promoted of shared.promoted) stopDirection(promoted)
				},
			})
			.catch((error: unknown) => {
				if (isDisposed || controllers[direction].signal.aborted) return
				stopDirection(direction)
				options.onError(error instanceof Error ? error.message : '计算失败，请调整参数。')
			})
	}
	for (const direction of ['row', 'column'] as const)
		for (let index = 0; index < 2; index++) startShard(direction, index)
	return () => {
		isDisposed = true
		pool.dispose()
	}
}
