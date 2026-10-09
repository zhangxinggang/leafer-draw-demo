import type {
	CabinetConfiguration,
	CabinetDirection,
	CabinetMode,
	CabinetProgress,
	CabinetSearchShard,
} from '@momo/utils/extremeCabinet'
import { getCabinetConfigurationError, optimizeCabinet } from '@momo/utils/extremeCabinet'
import {
	recommendCompactCabinet,
	usesCompactCabinet,
	validateCompactCabinet,
} from '@momo/utils/compactCabinet'

export interface CabinetWorkerRequest {
	configuration: CabinetConfiguration
	direction: CabinetDirection
	mode?: CabinetMode
	shard: CabinetSearchShard
}

export interface CabinetWorkerResponse {
	direction: CabinetDirection
	progress?: CabinetProgress
	error?: string
}

self.onmessage = async (event: MessageEvent<CabinetWorkerRequest>) => {
	const { direction } = event.data
	try {
		const configurationError = getCabinetConfigurationError(event.data.configuration)
		if (configurationError) throw new Error(configurationError)
		if (usesCompactCabinet(event.data.configuration)) {
			const solution = recommendCompactCabinet(
				event.data.configuration,
				direction,
				event.data.mode ?? 'regular',
				event.data.shard,
			)
			const errors = validateCompactCabinet(solution)
			if (errors.length) throw new Error(errors.join('；'))
			self.postMessage({
				direction,
				progress: { stage: 'recommended', visitedStates: solution.visitedStates, solution },
			} satisfies CabinetWorkerResponse)
			return
		}
		const generator = optimizeCabinet(
			event.data.configuration,
			direction,
			event.data.mode,
			event.data.shard,
		)
		let lastYield = performance.now()
		let lastPublication = -Infinity
		let pending: CabinetProgress = { stage: 'constructing', visitedStates: 0 }
		let hasPublishedSolution = false
		let publicationInterval = 100
		while (true) {
			const step = generator.next()
			if (step.done) break
			pending = { ...step.value, solution: step.value.solution ?? pending.solution }
			if (step.value.stage !== 'complete' && step.value.visitedStates >= 250000)
				throw new Error(
					'搜索已达到 250000 个状态的资源保护上限，已保留当前可行方案，尚未证明最优。',
				)
			if (step.value.solution)
				publicationInterval = Math.min(1000, Math.max(100, step.value.solution.cost[1] / 2))
			if (
				step.value.stage === 'complete' ||
				(!hasPublishedSolution && pending.solution) ||
				performance.now() - lastPublication > publicationInterval
			) {
				self.postMessage({ direction, progress: pending } satisfies CabinetWorkerResponse)
				hasPublishedSolution ||= !!pending.solution
				pending = { stage: step.value.stage, visitedStates: step.value.visitedStates }
				lastPublication = performance.now()
			}
			if (performance.now() - lastYield > 16) {
				await new Promise((resolve) => setTimeout(resolve, 0))
				lastYield = performance.now()
			}
		}
	} catch (error) {
		self.postMessage({
			direction,
			error: error instanceof Error ? error.message : '计算失败，请调整参数。',
		} satisfies CabinetWorkerResponse)
	}
}
