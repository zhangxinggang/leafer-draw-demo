import type { CabinetCompactLayout } from './compact'

/** Geometry and exact lexicographic optimization; no browser dependency. */
export interface CabinetConfiguration {
	screenWidth: number
	screenHeight: number
	moduleWidth: number
	moduleHeight: number
	receiverColumns: number
	receiverRows: number
	senderMaxWidth: number
	senderMaxHeight: number
	senderMaxLoad: number
	senderPorts: number
	portLoad: number
}

export interface GridRectangle {
	x: number
	y: number
	width: number
	height: number
}

export interface CabinetReceiver extends GridRectangle {
	id: number
	sender: number
	cable: number
	port: number
	order: number
}

export interface CabinetCable extends GridRectangle {
	id: number
	sender: number
	port: number
	receivers: CabinetReceiver[]
}

export interface CabinetSender extends GridRectangle {
	id: number
	cables: CabinetCable[]
}

export type CabinetCost = [senders: number, receivers: number, cables: number]
export type CabinetMode = 'regular' | 'free'

export interface CabinetReceiverBalance {
	counts: number[]
	/** Repeated sender classes for compact plans; counts is not expanded. */
	distribution?: { receivers: number; senders: number }[]
	sumSquares: number
	/** Unconstrained integer distribution bound, attained when counts differ by at most one. */
	lowerBound: number
	isOptimal: boolean
}

export interface CabinetSolution {
	compact?: CabinetCompactLayout
	mode?: CabinetMode
	receiverBalance?: CabinetReceiverBalance
	configuration: CabinetConfiguration
	senders: CabinetSender[]
	cost: CabinetCost
	moduleCount: number
	realSenderLoad: number
	lowerBound: CabinetCost
	isOptimal: boolean
	/** Number of objectives proved optimal in order: sender, receiver, cable. */
	provedPrefix: number
	visitedStates: number
	elapsedMs: number
}

export interface CabinetProgress {
	stage: 'constructing' | 'searching' | 'balancing' | 'complete' | 'recommended'
	visitedStates: number
	solution?: CabinetSolution
}

export interface CabinetSearchShard {
	index: number
	count: number
}

interface GridLimits {
	width: number
	height: number
	receiverWidth: number
	receiverHeight: number
	receiverArea: number
	senderWidth: number
	senderHeight: number
	senderArea: number
	portArea: number
	ports: number
	moduleArea: number
}

interface Tile extends GridRectangle {
	cost: CabinetCost
	children?: Tile[]
}

interface Tiling {
	cost: CabinetCost
	tiles: Tile[]
}

function transposeTile(tile: Tile): Tile {
	return {
		...tile,
		x: tile.y,
		y: tile.x,
		width: tile.height,
		height: tile.width,
		children: tile.children?.map(transposeTile),
	}
}

function transposeTiling(tiling: Tiling): Tiling {
	return { cost: tiling.cost, tiles: tiling.tiles.map(transposeTile) }
}

const addCost = (a: CabinetCost, b: CabinetCost): CabinetCost => [
	a[0] + b[0],
	a[1] + b[1],
	a[2] + b[2],
]

const compareCabinetCostSum = (a: CabinetCost, b: CabinetCost, limit: CabinetCost) =>
	a[0] + b[0] - limit[0] || a[1] + b[1] - limit[1] || a[2] + b[2] - limit[2]

export function compareCabinetCost(a: CabinetCost, b: CabinetCost) {
	return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

export function getCabinetConfigurationError(configuration: CabinetConfiguration): string | null {
	const fields: (keyof CabinetConfiguration)[] = [
		'screenWidth',
		'screenHeight',
		'moduleWidth',
		'moduleHeight',
		'receiverColumns',
		'receiverRows',
		'senderMaxWidth',
		'senderMaxHeight',
		'senderMaxLoad',
		'senderPorts',
		'portLoad',
	]
	if (fields.some((key) => !Number.isSafeInteger(configuration[key]) || configuration[key] <= 0))
		return '请填写全部参数，使用大于 0 的安全整数。'
	const c = configuration
	if (
		![
			c.screenWidth * c.screenHeight,
			c.moduleWidth * c.moduleHeight,
			c.moduleWidth * c.receiverColumns,
			c.moduleHeight * c.receiverRows,
			c.senderPorts * c.portLoad,
		].every(Number.isSafeInteger)
	)
		return '尺寸或带载的乘积超过安全整数范围，请减小参数。'
	if (c.screenWidth < c.moduleWidth || c.screenHeight < c.moduleHeight)
		return '显示屏宽、高必须至少容纳一个完整模组。'
	if (c.moduleWidth > c.senderMaxWidth || c.moduleHeight > c.senderMaxHeight)
		return '发送卡极限宽、高必须至少容纳一个模组。'
	if (c.moduleWidth * c.moduleHeight > Math.min(c.portLoad, c.senderMaxLoad))
		return '网口带载和发送卡极限带载必须至少容纳一个模组。'
	return null
}

/** Maximum attainable integer rectangle area, grouping equal floor(capacity / w). */
function maximumRectangleArea(maxWidth: number, maxHeight: number, capacity: number) {
	if (maxWidth * maxHeight <= capacity) return maxWidth * maxHeight
	if (Math.max(maxWidth, maxHeight) >= capacity) return capacity
	let maximum = 1
	let width = 1
	while (width <= maxWidth) {
		let height = Math.min(maxHeight, Math.floor(capacity / width))
		if (width * height > capacity) height--
		if (!height) break
		let lastWidth = Math.min(maxWidth, Math.floor(capacity / height))
		if (lastWidth * height > capacity) lastWidth--
		maximum = Math.max(maximum, lastWidth * height)
		width = lastWidth + 1
	}
	return maximum
}

function gridLimits(c: CabinetConfiguration): GridLimits {
	const moduleArea = c.moduleWidth * c.moduleHeight
	const width = Math.floor(c.screenWidth / c.moduleWidth)
	const height = Math.floor(c.screenHeight / c.moduleHeight)
	const senderWidth = Math.min(width, Math.floor(c.senderMaxWidth / c.moduleWidth))
	const senderHeight = Math.min(height, Math.floor(c.senderMaxHeight / c.moduleHeight))
	const receiverWidth = Math.min(width, c.receiverColumns)
	const receiverHeight = Math.min(height, c.receiverRows)
	const load = Math.min(
		Math.floor(c.senderMaxLoad / moduleArea),
		c.senderPorts * Math.floor(c.portLoad / moduleArea),
	)
	const portArea = maximumRectangleArea(
		senderWidth,
		senderHeight,
		Math.min(load, Math.floor(c.portLoad / moduleArea)),
	)
	const senderArea = maximumRectangleArea(
		senderWidth,
		senderHeight,
		Math.min(load, c.senderPorts * portArea),
	)
	return {
		width,
		height,
		receiverWidth,
		receiverHeight,
		receiverArea: maximumRectangleArea(
			Math.min(receiverWidth, senderWidth),
			Math.min(receiverHeight, senderHeight),
			portArea,
		),
		senderWidth,
		senderHeight,
		senderArea,
		portArea,
		ports: c.senderPorts,
		moduleArea,
	}
}

/** Points separated by maximum rectangle dimensions cannot share one rectangle. */
function sampleBound(
	heights: number[],
	height: number,
	maxWidth: number,
	maxHeight: number,
	start = 0,
	end = heights.length,
	base = 0,
) {
	if (maxHeight === 1 && maxWidth > 1) {
		// Different integer rows cannot share a height-one rectangle. Every
		// horizontal sampling phase is valid; retain the strongest phase.
		const phases = Array<number>(Math.min(maxWidth, end - start)).fill(0)
		for (let x = start; x < end; x++) phases[(x - start) % maxWidth] += height - heights[x]
		return Math.max(0, ...phases)
	}
	let count = 0
	for (let x = start; x < end; x += maxWidth)
		count += Math.max(
			0,
			Math.ceil((height - base) / maxHeight) - Math.ceil((heights[x] - base) / maxHeight),
		)
	return count
}

interface SkylineComponent {
	start: number
	end: number
	base: number
	area: number
}

/** A completely covered column separates independent remaining regions. */
function skylineComponents(heights: number[], height: number): SkylineComponent[] {
	const components: SkylineComponent[] = []
	let start = 0
	while (start < heights.length) {
		if (heights[start] === height) {
			start++
			continue
		}
		let end = start
		let base = height
		let area = 0
		while (end < heights.length && heights[end] < height) {
			base = Math.min(base, heights[end])
			area += height - heights[end++]
		}
		components.push({ start, end, base, area })
		start = end
	}
	return components
}

/** Independent translations, mirrors and region permutations preserve all future costs. */
function canonicalSkylineKey(heights: number[], height: number, components: SkylineComponent[]) {
	const componentKey = ({ start, end, base }: SkylineComponent) => {
		let forward = ''
		let reverse = ''
		for (let offset = 0; offset < end - start; offset++) {
			if (offset) {
				forward += ','
				reverse += ','
			}
			forward += heights[start + offset] - base
			reverse += heights[end - 1 - offset] - base
		}
		return `${height - base}:${forward < reverse ? forward : reverse}`
	}
	if (components.length === 1) return componentKey(components[0])
	return components.map(componentKey).sort().join('|')
}

/** Concave per-sender capacity: once a sender is full, another receiver/port adds no load. */
function capacityCount(area: number, senders: number, senderArea: number, itemArea: number) {
	const fullItems = Math.floor(senderArea / itemArea)
	const baseArea = senders * fullItems * itemArea
	const remainder = senderArea % itemArea
	return area <= baseArea || !remainder
		? Math.ceil(area / itemArea)
		: senders * fullItems + Math.ceil((area - baseArea) / remainder)
}

/** Reverse the port/receiver concave capacity after receiver optimality is known. */
function cableBoundForReceivers(
	area: number,
	receivers: number,
	low: number,
	high: number,
	limits: GridLimits,
) {
	let minimum = low
	let maximum = high
	const receiverArea = limits.receiverArea
	while (minimum < maximum) {
		const middle = Math.floor((maximum - minimum) / 2) + minimum
		if (
			middle < Math.ceil(area / limits.portArea) ||
			capacityCount(area, middle, limits.portArea, receiverArea) > receivers
		)
			minimum = middle + 1
		else maximum = middle
	}
	return minimum
}

/**
 * Equality in the spaced-line receiver bound forces full-width columns when
 * that axis is divisible. Each column then has exactly ceil(H / receiverH)
 * receivers. If neither a horizontal nor a vertical pair fits a port, every
 * cable contains exactly one receiver. Apply the same proof after transposing.
 */
function saturatedReceiverCableBound(limits: GridLimits, receivers: number) {
	for (const transpose of [false, true]) {
		const width = transpose ? limits.height : limits.width
		const height = transpose ? limits.width : limits.height
		const receiverWidth = transpose ? limits.receiverHeight : limits.receiverWidth
		const receiverHeight = transpose ? limits.receiverWidth : limits.receiverHeight
		if (width % receiverWidth) continue
		const columns = width / receiverWidth
		const rows = Math.ceil(height / receiverHeight)
		if (receivers !== columns * rows) continue
		const minimumHeight = height - (rows - 1) * receiverHeight
		const portHeight = Math.floor(limits.portArea / receiverWidth)
		const horizontalPairFits = columns > 1 && portHeight >= 2 * minimumHeight
		const verticalPairFits = rows > 1 && portHeight >= height - (rows - 2) * receiverHeight
		if (!horizontalPairFits && !verticalPairFits) return receivers
	}
	return 0
}

/**
 * Equality at the two-axis sender sampling bound forces every sender to
 * intersect one sampled row and one sampled column. Each sampled row/column
 * has exactly the minimum number of senders, forcing these minimum side lengths.
 */
function minimumSenderSides(limits: GridLimits, count: number) {
	const columns = Math.ceil(limits.width / limits.senderWidth)
	const rows = Math.ceil(limits.height / limits.senderHeight)
	return count === columns * rows
		? [
				limits.width - (columns - 1) * limits.senderWidth,
				limits.height - (rows - 1) * limits.senderHeight,
			]
		: [1, 1]
}

interface SenderReceiverRestriction {
	transpose: boolean
	width: number
	columns: number
	senderWidth: number
	receiverWidth: number
	baseRows: number
	rowUnits: number
	maximumHeight: number
}

/** Equality in the sampled-row receiver capacity leaves no room for extra receivers. */
function senderReceiverRestrictions(limits: GridLimits, senders: number, receivers: number) {
	const restrictions: SenderReceiverRestriction[] = []
	for (const transpose of [false, true]) {
		const width = transpose ? limits.height : limits.width
		const height = transpose ? limits.width : limits.height
		const senderWidth = transpose ? limits.senderHeight : limits.senderWidth
		const senderHeight = transpose ? limits.senderWidth : limits.senderHeight
		const receiverWidth = transpose ? limits.receiverHeight : limits.receiverWidth
		const receiverHeight = transpose ? limits.receiverWidth : limits.receiverHeight
		const columns = Math.ceil(width / senderWidth)
		const rows = Math.ceil(height / senderHeight)
		if (senders !== columns * rows) continue
		const minimumHeight = height - (rows - 1) * senderHeight
		const baseRows = Math.ceil(minimumHeight / receiverHeight)
		const rowUnits = capacityCount(width, columns, senderWidth, receiverWidth)
		if (receivers !== rows * baseRows * rowUnits) continue
		restrictions.push({
			transpose,
			width,
			columns,
			senderWidth,
			receiverWidth,
			baseRows,
			rowUnits,
			maximumHeight: Math.min(senderHeight, baseRows * receiverHeight),
		})
	}
	return restrictions
}

function matchesReceiverRestriction(shape: SenderShapeCost, rule: SenderReceiverRestriction) {
	const width = rule.transpose ? shape.height : shape.width
	const height = rule.transpose ? shape.width : shape.height
	const units = Math.ceil(width / rule.receiverWidth)
	return (
		height <= rule.maximumHeight &&
		shape.cost[1] === units * rule.baseRows &&
		units +
			capacityCount(rule.width - width, rule.columns - 1, rule.senderWidth, rule.receiverWidth) <=
			rule.rowUnits
	)
}

function remainingBound(
	heights: number[],
	height: number,
	limits: GridLimits,
	isSender: boolean,
	senderBudget?: number,
	components = skylineComponents(heights, height),
) {
	const receiverArea = limits.receiverArea
	const senderArea = Math.min(limits.senderArea, limits.senderWidth * limits.senderHeight)
	let senders = 0
	const senderCounts = isSender ? Array<number>(components.length) : undefined
	if (senderCounts)
		for (let index = 0; index < components.length; index++) {
			const { start, end, base, area } = components[index]
			const count = Math.max(
				Math.ceil(area / senderArea),
				sampleBound(heights, height, limits.senderWidth, limits.senderHeight, start, end, base),
			)
			senderCounts[index] = count
			senders += count
		}
	// Secondary costs matter only when a smaller sender count is already impossible.
	const useSecondary = isSender && senderBudget === senders
	let receivers = 0
	let cables = 0
	for (let index = 0; index < components.length; index++) {
		const { start, end, base, area } = components[index]
		const senderCount = senderCounts?.[index] ?? 0
		let cableCount = Math.max(senderCount, Math.ceil(area / limits.portArea))
		let receiverTotal = Math.max(
			cableCount,
			Math.ceil(area / receiverArea),
			sampleBound(heights, height, limits.receiverWidth, limits.receiverHeight, start, end, base),
		)
		if (useSecondary && Number.isSafeInteger(senderCount * senderArea)) {
			cableCount = Math.max(
				cableCount,
				capacityCount(area, senderCount, senderArea, Math.min(senderArea, limits.portArea)),
			)
			receiverTotal = Math.max(
				receiverTotal,
				cableCount,
				capacityCount(area, senderCount, senderArea, receiverArea),
			)
		}
		receivers += receiverTotal
		cables += cableCount
	}
	return [senders, receivers, cables] as CabinetCost
}

function receiverCount(width: number, height: number, limits: GridLimits) {
	// This product is both a spaced-point lower bound and achievable by a regular grid.
	return Math.ceil(width / limits.receiverWidth) * Math.ceil(height / limits.receiverHeight)
}

function regularTiling(
	width: number,
	height: number,
	tileWidth: number,
	tileHeight: number,
	getTile: (width: number, height: number) => Omit<Tile, 'x' | 'y'> | null,
): Tiling | null {
	const tiles: Tile[] = []
	let cost: CabinetCost = [0, 0, 0]
	for (let y = 0; y < height; y += tileHeight) {
		for (let x = 0; x < width; x += tileWidth) {
			const tile = getTile(Math.min(tileWidth, width - x), Math.min(tileHeight, height - y))
			if (!tile) return null
			tiles.push({ ...tile, x, y })
			cost = addCost(cost, tile.cost)
		}
	}
	return { tiles, cost }
}

function seedCables(width: number, height: number, limits: GridLimits): Tiling | null {
	if (width * height <= limits.portArea)
		return {
			cost: [0, receiverCount(width, height, limits), 1],
			tiles: [{ x: 0, y: 0, width, height, cost: [0, receiverCount(width, height, limits), 1] }],
		}
	let best: Tiling | null = null
	// Fast uniform constructions only seed an upper bound; exact search below has no such restriction.
	for (let cableWidth = 1; cableWidth <= Math.min(width, limits.portArea); cableWidth++) {
		const maximumHeight = Math.min(height, Math.floor(limits.portArea / cableWidth))
		const heights = new Set([
			maximumHeight,
			Math.min(maximumHeight, limits.receiverHeight),
			Math.floor(maximumHeight / limits.receiverHeight) * limits.receiverHeight,
		])
		for (const cableHeight of heights) {
			if (!cableHeight) continue
			const count = Math.ceil(width / cableWidth) * Math.ceil(height / cableHeight)
			if (count > limits.ports) continue
			const xCount =
				Math.floor(width / cableWidth) * Math.ceil(cableWidth / limits.receiverWidth) +
				Math.ceil((width % cableWidth) / limits.receiverWidth)
			const yCount =
				Math.floor(height / cableHeight) * Math.ceil(cableHeight / limits.receiverHeight) +
				Math.ceil((height % cableHeight) / limits.receiverHeight)
			const cost: CabinetCost = [0, xCount * yCount, count]
			if (best && compareCabinetCost(cost, best.cost) >= 0) continue
			best = regularTiling(width, height, cableWidth, cableHeight, (w, h) => ({
				width: w,
				height: h,
				cost: [0, receiverCount(w, h, limits), 1],
			}))
			if (best) {
				// Move an aligned remainder stripe first so shortened receivers stay at the outer edge.
				const remainderWidth = width % cableWidth
				const remainderHeight = height % cableHeight
				const alignX =
					remainderWidth > 0 &&
					remainderWidth % limits.receiverWidth === 0 &&
					cableWidth % limits.receiverWidth !== 0
				const alignY =
					remainderHeight > 0 &&
					remainderHeight % limits.receiverHeight === 0 &&
					cableHeight % limits.receiverHeight !== 0
				for (const tile of best.tiles) {
					if (alignX) tile.x = tile.x === width - remainderWidth ? 0 : tile.x + remainderWidth
					if (alignY) tile.y = tile.y === height - remainderHeight ? 0 : tile.y + remainderHeight
				}
				if (alignX || alignY) best.tiles.sort((a, b) => a.y - b.y || a.x - b.x)
			}
		}
	}
	return best
}

interface SearchContext {
	visitedStates: number
	provedPrefix: number
	checkpoint: () => Generator<CabinetProgress, void>
}

interface TilingSearchOptions {
	/** Strict cost ceiling for a feasibility trial; never emitted as a solution. */
	ceiling?: CabinetCost
	/** Proven lexicographic lower bounds from completed earlier phases. */
	provedFloor?: CabinetCost
	stopWhen?: (tiling: Tiling) => boolean
	/** Prove sender count without comparing or optimizing secondary objectives. */
	onlySenders?: boolean
	/** Exact resource relaxation at the already proven sender count. */
	packingBound?: PackingBound | null
	/** Complete sender spectrum for geometry-dependent resource bounds. */
	shapeCosts?: SenderShapeCost[] | null
	/** Completed rational slice certificates for partial skyline regions. */
	sliceCertificates?: SliceCertificate[]
	/** Completed infeasible suffix trials, shared across resource budgets. */
	failedTrials?: Map<string, CabinetCost>
}

/**
 * Complete skyline enumeration. The first uncovered cell must be the top-left
 * corner of its tile. Enumerating every fitting width/height therefore includes
 * every rectangular partition, including non-guillotine arrangements.
 */
function* searchTiling(
	width: number,
	height: number,
	limits: GridLimits,
	isSender: boolean,
	seed: Tiling | null,
	context: SearchContext,
	getTile: (
		width: number,
		height: number,
	) => Generator<CabinetProgress, Omit<Tile, 'x' | 'y'> | null>,
	onImprovement?: (tiling: Tiling) => CabinetProgress,
	estimateTile?: (width: number, height: number) => CabinetCost,
	options: TilingSearchOptions = {},
): Generator<CabinetProgress, Tiling | null> {
	// Narrow the outer skyline without changing construction preferences or
	// returned geometry. All callbacks and nested cable coordinates use the
	// caller's coordinate system; the complete search remains identical.
	const currentOrientationScore =
		width * Math.ceil(width / limits.senderWidth) * Math.sqrt(limits.receiverHeight)
	const rotatedOrientationScore =
		height * Math.ceil(height / limits.senderHeight) * Math.sqrt(limits.receiverWidth)
	if (isSender && width > height && rotatedOrientationScore <= currentOrientationScore) {
		const stopWhen = options.stopWhen
		const rotated = yield* searchTiling(
			height,
			width,
			{
				...limits,
				width: limits.height,
				height: limits.width,
				receiverWidth: limits.receiverHeight,
				receiverHeight: limits.receiverWidth,
				senderWidth: limits.senderHeight,
				senderHeight: limits.senderWidth,
			},
			true,
			seed ? transposeTiling(seed) : null,
			context,
			function* (w, h) {
				const tile = yield* getTile(h, w)
				return tile
					? {
							width: tile.height,
							height: tile.width,
							cost: tile.cost,
							children: tile.children?.map(transposeTile),
						}
					: null
			},
			onImprovement ? (tiling) => onImprovement(transposeTiling(tiling)) : undefined,
			estimateTile ? (w, h) => estimateTile(h, w) : undefined,
			{
				...options,
				shapeCosts: options.shapeCosts?.map((shape) => ({
					...shape,
					width: shape.height,
					height: shape.width,
				})),
				sliceCertificates: options.sliceCertificates?.map((certificate) => ({
					...certificate,
					vertical: !certificate.vertical,
				})),
				stopWhen: stopWhen ? (tiling) => stopWhen(transposeTiling(tiling)) : undefined,
			},
		)
		return rotated ? transposeTiling(rotated) : null
	}
	let best =
		seed && (!options.ceiling || compareCabinetCost(seed.cost, options.ceiling) < 0) ? seed : null
	let isStopped = false
	const heights = Array<number>(width).fill(0)
	const sliceTracker =
		isSender && options.provedFloor && options.sliceCertificates?.length
			? createSliceTracker(heights, height, options.provedFloor[0], options.sliceCertificates)
			: undefined
	const undoPlacement = (x: number, w: number, h: number, change?: SliceChange) => {
		if (change) sliceTracker!.restore(change)
		for (let i = x; i < x + w; i++) heights[i] -= h
	}
	const smallTailCache = new Map<string, CabinetCost | null>()
	const shapeCostMap = options.shapeCosts
		? new Map(options.shapeCosts.map((shape) => [`${shape.width}/${shape.height}`, shape.cost]))
		: undefined
	const getLimit = () => {
		if (best && options.onlySenders) return [best.cost[0], 0, 0] as CabinetCost
		return best && (!options.ceiling || compareCabinetCost(best.cost, options.ceiling) < 0)
			? best.cost
			: options.ceiling
	}
	const applyProvedFloor = (cost: CabinetCost, bound: CabinetCost, area: number): CabinetCost => {
		const floor = options.provedFloor
		if (!floor) return bound
		bound[0] = Math.max(bound[0], floor[0] - cost[0])
		if (cost[0] + bound[0] === floor[0]) {
			bound[1] = Math.max(bound[1], floor[1] - cost[1])
			const packing = options.packingBound
			const limit = getLimit()
			if (isSender && limit?.[0] === floor[0] && options.sliceCertificates?.length)
				bound[1] = Math.max(
					bound[1],
					sliceTracker
						? sliceTracker.bound(floor[0] - cost[0], area)
						: remainingSliceBound(
								heights,
								height,
								area,
								floor[0] - cost[0],
								options.sliceCertificates,
							),
				)
			if (isSender && packing && packing.receiverFirst[0] === floor[0] && limit?.[0] === floor[0]) {
				const count = floor[0] - cost[0]
				const loss = count * packing.maximumArea - area
				const receivers = packing.receiverLayers[count]?.[loss]
				if (receivers === undefined || !Number.isFinite(receivers))
					return [Infinity, Infinity, Infinity]
				bound[1] = Math.max(bound[1], receivers)
				// The cable cost at minimum R is valid only when the combined R
				// bound is still that DP minimum. Otherwise use its independent C bound.
				bound[2] = Math.max(
					bound[2],
					bound[1] === receivers
						? packing.cableLayers[count][loss]
						: packing.minimumCableLayers[count][loss],
				)
			}
			if (cost[1] + bound[1] === floor[1]) bound[2] = Math.max(bound[2], floor[2] - cost[2])
		}
		return bound
	}
	const path: Tile[] = []
	const memo = new Map<string, CabinetCost>()
	const initialBound = applyProvedFloor(
		[0, 0, 0],
		remainingBound(heights, height, limits, isSender),
		width * height,
	)
	if (best && (compareCabinetCost(best.cost, initialBound) === 0 || options.stopWhen?.(best)))
		return best
	const maxWidth = Math.min(
		isSender ? limits.senderWidth : width,
		isSender ? limits.senderArea : limits.portArea,
	)
	const maxHeight = isSender ? limits.senderHeight : height
	const maxArea = isSender ? limits.senderArea : limits.portArea
	type Candidate = {
		width: number
		height: number
		area: number
		estimate?: CabinetCost
		exact?: CabinetCost
	}
	const poolWidth = Math.min(maxWidth, width)
	const poolHeight = Math.min(maxHeight, height)
	let candidateCount = 0
	if (poolWidth <= 512)
		for (let w = 1; w <= poolWidth && candidateCount <= 512; w++)
			candidateCount += Math.min(poolHeight, Math.floor(maxArea / w))
	else candidateCount = Infinity
	// Candidate order depends on dimensions and interior costs, not the current
	// skyline. Reuse it on bounded spectra, filtering fitting sizes at each node.
	// Larger spectra retain the complete per-node enumeration below.
	let candidatePool: Candidate[] | undefined
	if (candidateCount <= 512) {
		candidatePool = []
		for (let w = 1; w <= poolWidth; w++)
			for (let h = Math.min(poolHeight, Math.floor(maxArea / w)); h >= 1; h--) {
				const exact = shapeCostMap?.get(`${w}/${h}`)
				if (shapeCostMap && !exact) continue
				candidatePool.push({
					width: w,
					height: h,
					area: w * h,
					estimate: estimateTile?.(w, h),
					exact,
				})
			}
		candidatePool.sort((a, b) => {
			const areaDifference = b.area - a.area
			if (areaDifference) return areaDifference
			return a.estimate && b.estimate
				? compareCabinetCost(a.estimate, b.estimate)
				: receiverCount(a.width, a.height, limits) - receiverCount(b.width, b.height, limits)
		})
	}

	function* visit(
		cost: CabinetCost,
		area: number,
		knownBound?: CabinetCost,
	): Generator<CabinetProgress, void> {
		context.visitedStates++
		if (context.visitedStates % 256 === 0) yield* context.checkpoint()
		const components = skylineComponents(heights, height)
		let y = height
		let x = -1
		for (let column = 0; column < width; column++) {
			if (heights[column] < y) {
				y = heights[column]
				x = column
			}
		}
		if (x === -1) {
			const finalLimit = getLimit()
			if (finalLimit && compareCabinetCost(cost, finalLimit) >= 0) return
			best = { cost, tiles: path.slice() }
			if (options.stopWhen?.(best)) isStopped = true
			if (onImprovement) yield onImprovement(best)
			return
		}
		// Cable budget makes states with different consumed ports incomparable.
		const key = `${canonicalSkylineKey(heights, height, components)}/${isSender ? '' : cost[2]}`
		const previous = memo.get(key)
		if (previous && compareCabinetCost(previous, cost) <= 0) return
		memo.set(key, cost)
		const limit = getLimit()
		const bound =
			knownBound ??
			applyProvedFloor(
				cost,
				remainingBound(
					heights,
					height,
					limits,
					isSender,
					limit ? limit[0] - cost[0] : undefined,
					components,
				),
				area,
			)
		if (!isSender && cost[2] + bound[2] > limits.ports) return
		if (limit && compareCabinetCostSum(cost, bound, limit) >= 0) return
		const failureKey =
			options.failedTrials && options.ceiling && options.provedFloor && isSender
				? `${limits.senderWidth},${limits.senderHeight},${limits.senderArea}/${options.provedFloor[0] - cost[0]}/${key}`
				: null
		const tailCeiling = options.ceiling?.map((value, index) => value - cost[index]) as
			| CabinetCost
			| undefined
		if (failureKey && tailCeiling) {
			const failed = options.failedTrials!.get(failureKey)
			if (failed && compareCabinetCost(failed, tailCeiling) >= 0) return
		}
		let run = 1
		while (x + run < width && heights[x + run] === y && run < maxWidth) run++
		const shapes: Candidate[] = candidatePool ?? []
		const [minimumWidth, minimumHeight] =
			isSender && limit ? minimumSenderSides(limits, limit[0]) : [1, 1]
		if (!candidatePool) {
			for (let w = minimumWidth; w <= run; w++) {
				for (
					let h = Math.min(maxHeight, height - y, Math.floor(maxArea / w));
					h >= minimumHeight;
					h--
				)
					shapes.push({ width: w, height: h, area: w * h })
			}
			shapes.sort((a, b) => {
				const areaDifference = b.area - a.area
				if (areaDifference) return areaDifference
				const aCost = estimateTile?.(a.width, a.height)
				const bCost = estimateTile?.(b.width, b.height)
				return aCost && bCost
					? compareCabinetCost(aCost, bCost)
					: receiverCount(a.width, a.height, limits) - receiverCount(b.width, b.height, limits)
			})
		}
		const tailCapacity = isSender
			? limit
				? (limit[0] - cost[0] - 1) * maxArea
				: Infinity
			: (limits.ports - cost[2] - 1) * maxArea
		const minimumCandidateArea = Number.isSafeInteger(tailCapacity) ? area - tailCapacity : 1
		for (const shape of shapes) {
			// Descending area order permits skipping the entire smaller suffix.
			// Its uncovered area cannot fit the remaining sender/port capacity.
			if (shape.area < minimumCandidateArea) break
			if (
				shape.width < minimumWidth ||
				shape.height < minimumHeight ||
				shape.width > run ||
				shape.height > height - y
			)
				continue
			// Cheap admissible checks avoid solving sender interiors which cannot improve the incumbent.
			const exactCost = shape.exact ?? shapeCostMap?.get(`${shape.width}/${shape.height}`)
			if (shapeCostMap && !exactCost) continue
			const cheapCost: CabinetCost =
				exactCost ??
				(isSender
					? [
							1,
							Math.max(
								receiverCount(shape.width, shape.height, limits),
								Math.ceil((shape.width * shape.height) / limits.receiverArea),
								capacityCount(
									shape.width * shape.height,
									limits.ports,
									limits.portArea,
									limits.receiverArea,
								),
							),
							Math.ceil((shape.width * shape.height) / limits.portArea),
						]
					: [0, receiverCount(shape.width, shape.height, limits), 1])
			if (isSender && cheapCost[2] > limits.ports) continue
			const nextCost = addCost(cost, cheapCost)
			const currentLimit = getLimit()
			const remainingArea = area - shape.area
			// Area/resource table lookups precede geometry scans. Small rectangles
			// often already exceed the fixed count's deficit or resource budget.
			let impossible = false
			if (currentLimit) {
				const count = currentLimit[0] - nextCost[0]
				impossible = isSender && Math.ceil(remainingArea / maxArea) > count
				const packing = options.packingBound
				if (
					!impossible &&
					isSender &&
					packing &&
					options.provedFloor?.[0] === currentLimit[0] &&
					packing.receiverFirst[0] === currentLimit[0]
				) {
					const loss = count * packing.maximumArea - remainingArea
					const receivers = packing.receiverLayers[count]?.[loss]
					impossible =
						receivers === undefined ||
						!Number.isFinite(receivers) ||
						(nextCost[0] + count - currentLimit[0] ||
							nextCost[1] + receivers - currentLimit[1] ||
							nextCost[2] + packing.cableLayers[count][loss] - currentLimit[2]) >= 0
				}
				if (!isSender && nextCost[2] + Math.ceil(remainingArea / limits.portArea) > limits.ports)
					impossible = true
			}
			if (impossible) continue
			for (let i = x; i < x + shape.width; i++) heights[i] += shape.height
			if (
				shapeCostMap &&
				options.shapeCosts &&
				currentLimit &&
				options.provedFloor?.[0] === currentLimit[0]
			) {
				const small = smallRemainingCost(
					heights,
					height,
					currentLimit[0] - nextCost[0],
					options.shapeCosts,
					shapeCostMap,
					smallTailCache,
				)
				if (
					small === null ||
					(small && compareCabinetCostSum(nextCost, small, currentLimit) >= 0)
				) {
					undoPlacement(x, shape.width, shape.height)
					continue
				}
			}
			const sliceChange = sliceTracker?.place(x, shape.width, y, shape.height)
			const tailBound = applyProvedFloor(
				nextCost,
				remainingBound(
					heights,
					height,
					limits,
					isSender,
					currentLimit ? currentLimit[0] - nextCost[0] : undefined,
				),
				remainingArea,
			)
			if (currentLimit && compareCabinetCostSum(nextCost, tailBound, currentLimit) >= 0) {
				undoPlacement(x, shape.width, shape.height, sliceChange)
				continue
			}
			const tile = yield* getTile(shape.width, shape.height)
			if (tile) {
				path.push({ ...tile, x, y })
				// The parent already checked this same residual geometry. Prefix-
				// dependent bounds can be reused only when its estimated cost is exact.
				const exactPrefix = compareCabinetCost(tile.cost, cheapCost) === 0
				yield* visit(
					exactPrefix ? nextCost : addCost(cost, tile.cost),
					remainingArea,
					exactPrefix ? tailBound : undefined,
				)
				path.pop()
			}
			undoPlacement(x, shape.width, shape.height, sliceChange)
			if (isStopped || (best && compareCabinetCost(best.cost, initialBound) === 0)) return
		}
		// A successful or interrupted trial must never be cached as infeasible.
		// The cache is optional and bounded; skipping an entry changes no proof.
		if (failureKey && tailCeiling && !isStopped && !best) {
			const cache = options.failedTrials!
			const previousFailure = cache.get(failureKey)
			if (
				(!previousFailure || compareCabinetCost(previousFailure, tailCeiling) < 0) &&
				(cache.size < 50000 || previousFailure)
			)
				cache.set(failureKey, tailCeiling)
		}
	}
	yield* visit([0, 0, 0], width * height)
	return best
}

interface CutPlan {
	cost: CabinetCost
	tile?: Omit<Tile, 'x' | 'y'>
	cut?: number
	isVertical?: boolean
	children?: [CutPlan, CutPlan]
	regions?: { x: number; y: number; width: number; height: number; plan: CutPlan }[]
}

/** Mixed-size cuts and an optional five-region pinwheel, only a feasible upper bound. */
function* improveByCuts(
	width: number,
	height: number,
	limits: GridLimits,
	context: SearchContext,
	getTile: (
		width: number,
		height: number,
	) => Generator<CabinetProgress, Omit<Tile, 'x' | 'y'> | null>,
	incumbent?: CabinetCost,
): Generator<CabinetProgress, Tiling | null> {
	// Budget this optional construction, never the complete optimization/proof.
	if (width * height * (width + height) > 2000000 || limits.senderArea > 96) return null
	const plans: CutPlan[][] = Array.from({ length: width + 1 }, () => [])
	for (let w = 1; w <= width; w++) {
		for (let h = 1; h <= height; h++) {
			context.visitedStates++
			if (context.visitedStates % 256 === 0) yield* context.checkpoint()
			if (w <= limits.senderWidth && h <= limits.senderHeight && w * h <= limits.senderArea) {
				const tile = yield* getTile(w, h)
				if (tile) {
					plans[w][h] = { cost: tile.cost, tile }
					continue
				}
			}
			let best: CutPlan | null = null
			for (let cut = 1; cut <= Math.floor(w / 2); cut++) {
				const cost = addCost(plans[cut][h].cost, plans[w - cut][h].cost)
				if (!best || compareCabinetCost(cost, best.cost) < 0) best = { cost, cut, isVertical: true }
			}
			for (let cut = 1; cut <= Math.floor(h / 2); cut++) {
				const cost = addCost(plans[w][cut].cost, plans[w][h - cut].cost)
				if (!best || compareCabinetCost(cost, best.cost) < 0)
					best = { cost, cut, isVertical: false }
			}
			if (!best) throw new Error('模组分区构造失败。')
			plans[w][h] = best
		}
	}
	// Freeze the guillotine table. Improved child plans hold explicit references:
	// replacing a table entry would silently change the geometry of older parents
	// without updating their recorded costs. A pinwheel may occupy the whole
	// screen or either side of a root cut, covering local non-slicing layouts.
	let best = plans[width][height]
	const maximumSenders = Math.min(best.cost[0], incumbent?.[0] ?? Infinity)
	// Small layouts finish a fixed number of construction trials. A short wall
	// clock budget can otherwise discard the best seed when the host is busy.
	// The complete-screen pinwheel is especially valuable and has no recursive
	// alternatives, so finish it deterministically when its own spectrum is small.
	const constructionBudget = maximumSenders <= 20 ? Infinity : 15
	const start = performance.now()
	let attempts = 0
	let stopped = false
	const pinwheels = new Map<string, CutPlan>()
	function* pinwheel(w: number, h: number): Generator<CabinetProgress, CutPlan> {
		const key = `${w}/${h}`
		const cached = pinwheels.get(key)
		if (cached) return cached
		let result = plans[w][h]
		const combinations = ((w - 1) * (w - 2) * (h - 1) * (h - 2)) / 4
		const finishRoot = w === width && h === height && combinations <= 100000
		if (w >= 3 && h >= 3 && combinations <= 500000 && !stopped) {
			for (let left = 1; left < w - 1 && !stopped; left++)
				for (let right = left + 1; right < w && !stopped; right++)
					for (let top = 1; top < h - 1 && !stopped; top++)
						for (let bottom = top + 1; bottom < h; bottom++) {
							const a = plans[right][top]
							const b = plans[w - right][bottom]
							const c = plans[w - left][h - bottom]
							const d = plans[left][h - top]
							const e = plans[right - left][bottom - top]
							const cost: CabinetCost = [
								a.cost[0] + b.cost[0] + c.cost[0] + d.cost[0] + e.cost[0],
								a.cost[1] + b.cost[1] + c.cost[1] + d.cost[1] + e.cost[1],
								a.cost[2] + b.cost[2] + c.cost[2] + d.cost[2] + e.cost[2],
							]
							if (compareCabinetCost(cost, result.cost) < 0)
								result = {
									cost,
									regions: [
										{ x: 0, y: 0, width: right, height: top, plan: a },
										{ x: right, y: 0, width: w - right, height: bottom, plan: b },
										{ x: left, y: bottom, width: w - left, height: h - bottom, plan: c },
										{ x: 0, y: top, width: left, height: h - top, plan: d },
										{ x: left, y: top, width: right - left, height: bottom - top, plan: e },
									],
								}
							if (++attempts % 1024 === 0) {
								context.visitedStates++
								if (context.visitedStates % 256 === 0) yield* context.checkpoint()
								if (
									(!finishRoot && performance.now() - start > constructionBudget) ||
									attempts >= 2000000
								) {
									stopped = true
									break
								}
							}
						}
		}
		pinwheels.set(key, result)
		return result
	}
	best = yield* pinwheel(width, height)
	const candidates: { cut: number; isVertical: boolean; gain: number; excess: number }[] = []
	for (const isVertical of [true, false]) {
		const length = isVertical ? width : height
		for (let cut = 1; cut < length; cut++) {
			const w = isVertical ? cut : width
			const h = isVertical ? height : cut
			const sibling = isVertical ? plans[width - cut][height] : plans[width][height - cut]
			const minimumSenders = Math.ceil((w * h) / limits.senderArea)
			if (minimumSenders + sibling.cost[0] > maximumSenders) continue
			candidates.push({
				cut,
				isVertical,
				excess: plans[w][h].cost[0] + sibling.cost[0] - maximumSenders,
				gain: plans[w][h].cost[1] - Math.ceil((w * h) / limits.receiverArea),
			})
		}
	}
	candidates.sort((a, b) => b.excess - a.excess || b.gain - a.gain)
	for (const candidate of candidates) {
		if (stopped) break
		const { cut, isVertical } = candidate
		const child = yield* pinwheel(isVertical ? cut : width, isVertical ? height : cut)
		const sibling = isVertical ? plans[width - cut][height] : plans[width][height - cut]
		const cost = addCost(child.cost, sibling.cost)
		if (compareCabinetCost(cost, best.cost) < 0)
			best = { cost, cut, isVertical, children: [child, sibling] }
	}
	const tiles: Tile[] = []
	function collect(w: number, h: number, x: number, y: number, plan = plans[w][h]) {
		if (plan.tile) {
			tiles.push({ ...plan.tile, x, y })
			return
		}
		if (plan.regions) {
			for (const region of plan.regions)
				collect(region.width, region.height, x + region.x, y + region.y, region.plan)
			return
		}
		const cut = plan.cut!
		if (plan.isVertical) {
			collect(cut, h, x, y, plan.children?.[0])
			collect(w - cut, h, x + cut, y, plan.children?.[1])
		} else {
			collect(w, cut, x, y, plan.children?.[0])
			collect(w, h - cut, x, y + cut, plan.children?.[1])
		}
	}
	collect(width, height, 0, 0, best)
	return { cost: best.cost, tiles }
}

interface SenderShapeCost {
	width: number
	height: number
	cost: CabinetCost
}

/** Exact one/two-rectangle suffix, checked before costly general skyline bounds. */
function smallRemainingCost(
	heights: number[],
	height: number,
	count: number,
	shapes: SenderShapeCost[],
	costs: Map<string, CabinetCost>,
	cache: Map<string, CabinetCost | null>,
): CabinetCost | null | undefined {
	if (count < 1 || count > 2 || heights.length * shapes.length > 20000) return undefined
	const key = `${count}/${heights.join(',')}`
	if (cache.has(key)) return cache.get(key)
	function rectangle() {
		const start = heights.findIndex((value) => value < height)
		if (start < 0) return null
		let end = start + 1
		while (end < heights.length && heights[end] === heights[start]) end++
		for (let x = end; x < heights.length; x++) if (heights[x] !== height) return null
		return costs.get(`${end - start}/${height - heights[start]}`) ?? null
	}
	let best: CabinetCost | null = null
	if (count === 1) best = rectangle()
	else {
		const y = Math.min(...heights)
		const x = heights.indexOf(y)
		let run = 1
		while (x + run < heights.length && heights[x + run] === y) run++
		for (const shape of shapes) {
			if (shape.width > run || shape.height > height - y) continue
			for (let column = x; column < x + shape.width; column++) heights[column] += shape.height
			const tail = rectangle()
			for (let column = x; column < x + shape.width; column++) heights[column] -= shape.height
			if (!tail) continue
			const cost = addCost(shape.cost, tail)
			if (!best || compareCabinetCost(cost, best) < 0) best = cost
		}
	}
	if (cache.size < 2000) cache.set(key, best)
	return best
}

interface PackingBound {
	receiverFirst: CabinetCost
	minimumCables: number
	maximumArea: number
	/** Exact count/deficit layers reused for remaining-region bounds. */
	receiverLayers: number[][]
	cableLayers: number[][]
	minimumCableLayers: number[][]
	/** Receiver lower bounds for the same area-deficit states with one fewer tile. */
	remainingReceivers: number[]
}

/**
 * Exact area/resource DP with tile positions relaxed. Every actual layout is
 * represented, so its minimum costs are lower bounds, never a feasible layout.
 * null proves this sender count impossible; undefined means the optional check
 * was skipped and the complete geometric search must still decide it.
 */
function* relaxedPackingBound(
	shapes: SenderShapeCost[],
	area: number,
	senders: number,
	maximumArea: number,
	context: SearchContext,
): Generator<CabinetProgress, PackingBound | null | undefined> {
	if (!Number.isSafeInteger(senders * maximumArea)) return undefined
	const deficit = senders * maximumArea - area
	if (
		!Number.isSafeInteger(deficit) ||
		deficit < 0 ||
		deficit > 512 ||
		senders * (deficit + 1) * Math.min(maximumArea, deficit + 1) > 500000
	)
		return undefined
	const choices = new Map<number, { receivers: number; cables: number; minimumCables: number }>()
	for (const shape of shapes) {
		const loss = maximumArea - shape.width * shape.height
		if (loss > deficit) continue
		const prior = choices.get(loss)
		const cost = shape.cost
		if (!prior) choices.set(loss, { receivers: cost[1], cables: cost[2], minimumCables: cost[2] })
		else {
			prior.minimumCables = Math.min(prior.minimumCables, cost[2])
			if (cost[1] < prior.receivers || (cost[1] === prior.receivers && cost[2] < prior.cables)) {
				prior.receivers = cost[1]
				prior.cables = cost[2]
			}
		}
	}
	let receivers = Array<number>(deficit + 1).fill(Infinity)
	let cables = Array<number>(deficit + 1).fill(Infinity)
	let minimumCables = Array<number>(deficit + 1).fill(Infinity)
	const receiverLayers = [receivers]
	const cableLayers = [cables]
	const minimumCableLayers = [minimumCables]
	let remainingReceivers = receivers
	receivers[0] = cables[0] = minimumCables[0] = 0
	for (let count = 0; count < senders; count++) {
		if (count === senders - 1) remainingReceivers = receivers
		const nextReceivers = Array<number>(deficit + 1).fill(Infinity)
		const nextCables = Array<number>(deficit + 1).fill(Infinity)
		const nextMinimumCables = Array<number>(deficit + 1).fill(Infinity)
		for (let loss = 0; loss <= deficit; loss++) {
			if (!Number.isFinite(receivers[loss])) continue
			for (const [addedLoss, choice] of choices) {
				const target = loss + addedLoss
				if (target > deficit) continue
				const nextRx = receivers[loss] + choice.receivers
				const nextCable = cables[loss] + choice.cables
				if (
					nextRx < nextReceivers[target] ||
					(nextRx === nextReceivers[target] && nextCable < nextCables[target])
				) {
					nextReceivers[target] = nextRx
					nextCables[target] = nextCable
				}
				nextMinimumCables[target] = Math.min(
					nextMinimumCables[target],
					minimumCables[loss] + choice.minimumCables,
				)
			}
		}
		receivers = nextReceivers
		cables = nextCables
		minimumCables = nextMinimumCables
		receiverLayers.push(receivers)
		cableLayers.push(cables)
		minimumCableLayers.push(minimumCables)
		context.visitedStates++
		if (context.visitedStates % 256 === 0) yield* context.checkpoint()
	}
	return Number.isFinite(receivers[deficit])
		? {
				receiverFirst: [senders, receivers[deficit], cables[deficit]],
				minimumCables: minimumCables[deficit],
				maximumArea,
				receiverLayers,
				cableLayers,
				minimumCableLayers,
				remainingReceivers,
			}
		: null
}

/** Translation-independent possible sums of p*[coordinate mod p=i]−1. */
function stripeWeights(length: number, period: number) {
	const remainder = length % period
	return remainder ? [-remainder, period - remainder] : [0]
}

/**
 * A rational dual certificate combining stripe and product colorings. Every
 * rectangle satisfies r−baseline >= lambda*color + mu*areaDeficit. Summing
 * proves an integer resource lower bound. BigInt verifies every inequality
 * before any bound is used, so floating point never certifies a prune.
 */
function resourceColoringBound(
	shapes: SenderShapeCost[],
	limits: GridLimits,
	senders: number,
	resource: 1 | 2,
) {
	const maximumArea = Math.max(...shapes.map((shape) => shape.width * shape.height))
	if (!Number.isSafeInteger(senders * maximumArea)) return 0
	const deficit = senders * maximumArea - limits.width * limits.height
	if (!Number.isSafeInteger(deficit) || deficit < 0 || deficit > 64) return 0
	const full = shapes.filter((shape) => shape.width * shape.height === maximumArea)
	const baseline = Math.min(...full.map((shape) => shape.cost[resource]))
	const neutral = full.filter((shape) => shape.cost[resource] === baseline)
	const start = performance.now()
	let bound = 0
	for (let period = 2; period <= 16; period++) {
		for (const isHorizontal of [true, false]) {
			if (
				(isHorizontal ? limits.width : limits.height) % period === 0 ||
				!neutral.every((shape) => (isHorizontal ? shape.width : shape.height) % period === 0)
			)
				continue
			for (const multiplier of [null, 1, 2, 3, 5, 8, 13]) {
				if (performance.now() - start > 25) return bound
				const weights = (width: number, height: number) => {
					const xWeights = stripeWeights(width, period)
					const yWeights = stripeWeights(height, period)
					return [
						...new Set(
							xWeights.flatMap((x) =>
								yWeights.map((y) =>
									multiplier === null
										? isHorizontal
											? x * height
											: y * width
										: isHorizontal
											? x * (multiplier * height + y)
											: y * (multiplier * width + x),
								),
							),
						),
					]
				}
				const edges = shapes
					.filter((shape) => maximumArea - shape.width * shape.height <= deficit)
					.flatMap((shape) =>
						weights(shape.width, shape.height).map((color) => ({
							loss: maximumArea - shape.width * shape.height,
							excess: shape.cost[resource] - baseline,
							color,
						})),
					)
				const lambdas: { numerator: number; denominator: number }[] = [
					{ numerator: 0, denominator: 1 },
				]
				let negative: (typeof lambdas)[number] | undefined
				let positive: typeof negative
				for (const edge of edges) {
					if (edge.loss || !edge.color) continue
					const lambda = {
						numerator: edge.color < 0 ? -edge.excess : edge.excess,
						denominator: Math.abs(edge.color),
					}
					if (
						edge.color < 0 &&
						(!negative ||
							lambda.numerator / lambda.denominator > negative.numerator / negative.denominator)
					)
						negative = lambda
					if (
						edge.color > 0 &&
						(!positive ||
							lambda.numerator / lambda.denominator < positive.numerator / positive.denominator)
					)
						positive = lambda
				}
				lambdas.push(
					negative ?? { numerator: -1, denominator: 1 },
					positive ?? { numerator: 1, denominator: 1 },
				)
				// The best dual coefficient can be an interior breakpoint, not an
				// endpoint imposed by maximum-area rectangles. Build the lower
				// envelope of (excess - lambda * color) / loss and inspect its bends.
				const ordered = edges
					.filter((edge) => edge.loss > 0)
					.sort(
						(a, b) => a.color / a.loss - b.color / b.loss || a.excess / a.loss - b.excess / b.loss,
					)
				const hull: { edge: (typeof edges)[number]; start?: (typeof lambdas)[number] }[] = []
				for (const edge of ordered) {
					let bend: (typeof lambdas)[number] | undefined
					let dominated = false
					while (hull.length) {
						const previous = hull[hull.length - 1]
						const denominator = edge.color * previous.edge.loss - previous.edge.color * edge.loss
						if (denominator === 0) {
							if (edge.excess * previous.edge.loss >= previous.edge.excess * edge.loss) {
								dominated = true
								break
							}
							hull.pop()
							continue
						}
						bend = {
							numerator: edge.excess * previous.edge.loss - previous.edge.excess * edge.loss,
							denominator,
						}
						if (
							!previous.start ||
							bend.numerator / bend.denominator >
								previous.start.numerator / previous.start.denominator
						)
							break
						hull.pop()
					}
					if (!dominated) hull.push({ edge, start: hull.length ? bend : undefined })
				}
				for (const piece of hull) if (piece.start) lambdas.push(piece.start)
				const targets = weights(limits.width, limits.height)
				if (!targets.every(Number.isSafeInteger)) continue
				const candidates: {
					lambda: (typeof lambdas)[number]
					mu: (typeof lambdas)[number]
					certified?: boolean
				}[] = []
				const seenLambdas = new Set<number>()
				for (const lambda of lambdas) {
					const coefficient = lambda.numerator / lambda.denominator
					if (
						seenLambdas.has(coefficient) ||
						lambda.denominator <= 0 ||
						(negative && coefficient < negative.numerator / negative.denominator) ||
						(positive && coefficient > positive.numerator / positive.denominator)
					)
						continue
					seenLambdas.add(coefficient)
					let mu = { numerator: 0, denominator: 1 }
					let hasMu = false
					for (const edge of edges) {
						if (!edge.loss) continue
						const value = edge.excess * lambda.denominator - lambda.numerator * edge.color
						if (!hasMu || value / edge.loss < mu.numerator / mu.denominator) {
							mu = { numerator: value, denominator: edge.loss }
							hasMu = true
						}
					}
					if (
						![lambda.numerator, lambda.denominator, mu.numerator, mu.denominator].every(
							Number.isSafeInteger,
						)
					)
						continue
					candidates.push({ lambda, mu })
				}
				for (const target of targets) {
					const score = (candidate: (typeof candidates)[number]) =>
						(candidate.lambda.numerator * target +
							(candidate.mu.numerator / candidate.mu.denominator) * deficit) /
						candidate.lambda.denominator
					candidates.sort((a, b) => score(b) - score(a))
					for (const candidate of candidates) {
						if (performance.now() - start > 25) return bound
						const n = BigInt(candidate.lambda.numerator)
						const d = BigInt(candidate.lambda.denominator)
						const m = BigInt(candidate.mu.numerator)
						const md = BigInt(candidate.mu.denominator)
						const denominator = d * md
						candidate.certified ??= edges.every(
							(edge) =>
								BigInt(edge.excess) * denominator >=
								n * BigInt(edge.color) * md + m * BigInt(edge.loss),
						)
						if (!candidate.certified) continue
						const numerator =
							BigInt(senders) * BigInt(baseline) * denominator +
							n * BigInt(target) * md +
							m * BigInt(deficit)
						const roundedUp =
							numerator >= 0n
								? (numerator + denominator - 1n) / denominator
								: numerator / denominator
						if (roundedUp <= BigInt(Number.MAX_SAFE_INTEGER))
							bound = Math.max(bound, Number(roundedUp))
						break
					}
				}
			}
		}
	}
	return bound
}

interface SliceCertificate {
	vertical: boolean
	maximumArea: number
	chain: (number | undefined)[]
	countFactor: number
	lossFactor: number
	denominator: bigint
	numerator: bigint
}

interface SliceChange {
	prices: number[]
	missing: number[]
}

/** Incremental prices for completed slice certificates, with reversible updates. */
function createSliceTracker(
	heights: number[],
	height: number,
	maximumSenders: number,
	certificates: SliceCertificate[],
) {
	const width = heights.length
	const area = width * height
	if (!Number.isSafeInteger(area)) return undefined
	for (const certificate of certificates) {
		if (
			!Number.isSafeInteger(maximumSenders * certificate.maximumArea) ||
			!Number.isSafeInteger(certificate.countFactor) ||
			!Number.isSafeInteger(certificate.lossFactor)
		)
			return undefined
		const loss = maximumSenders * certificate.maximumArea - area
		if (loss < 0) return undefined
		const absolute = (value: bigint) => (value < 0n ? -value : value)
		const maximumChain = certificate.chain.reduce<bigint>((maximum, value) => {
			if (value === undefined) return maximum
			if (!Number.isSafeInteger(value)) return BigInt(Number.MAX_SAFE_INTEGER) + 1n
			const magnitude = absolute(BigInt(value))
			return magnitude > maximum ? magnitude : maximum
		}, 0n)
		// Updating a price may temporarily add/subtract both the old and new
		// intervals. Budget four times the geometric magnitude before using
		// Number arithmetic; otherwise retain the original full slice scan.
		const magnitude =
			BigInt(maximumSenders) * absolute(BigInt(certificate.countFactor)) +
			BigInt(loss) * absolute(BigInt(certificate.lossFactor)) +
			4n * BigInt(area) * maximumChain
		if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) return undefined
	}
	const prices = certificates.map(() => 0)
	const missing = certificates.map(() => 0)
	let weights: number[] | undefined
	for (const [index, certificate] of certificates.entries()) {
		if (certificate.vertical) {
			for (const value of heights) {
				const price = certificate.chain[height - value]
				if (price === undefined) missing[index]++
				else prices[index] += price
			}
		} else {
			weights ??= horizontalSliceWeights(heights, height)
			for (let length = 1; length < weights.length; length++) {
				if (!weights[length]) continue
				const price = certificate.chain[length]
				if (price === undefined) missing[index] += weights[length]
				else prices[index] += weights[length] * price
			}
		}
	}
	const hasHorizontal = certificates.some((certificate) => !certificate.vertical)
	const changePool: SliceChange[] = []
	const deltaWeights = hasHorizontal ? Array<number>(width + 1).fill(0) : undefined
	const leftEvents: number[] = []
	const rightEvents: number[] = []
	return {
		bound(senders: number, remainingArea: number) {
			let bound = 0
			for (const [index, certificate] of certificates.entries()) {
				if (missing[index]) return Infinity
				const numerator = BigInt(
					senders * certificate.countFactor +
						(senders * certificate.maximumArea - remainingArea) * certificate.lossFactor +
						prices[index],
				)
				const denominator = certificate.denominator
				const rounded =
					numerator >= 0n ? (numerator + denominator - 1n) / denominator : numerator / denominator
				bound = Math.max(bound, Number(rounded))
			}
			return bound
		},
		place(x: number, w: number, y: number, h: number): SliceChange {
			const change = changePool.pop() ?? {
				prices: Array<number>(certificates.length).fill(0),
				missing: Array<number>(certificates.length).fill(0),
			}
			change.prices.fill(0)
			change.missing.fill(0)
			if (hasHorizontal) {
				const deltas = deltaWeights!
				deltas.fill(0)
				leftEvents.length = 0
				rightEvents.length = 0
				let barrier = y
				for (let column = x - 1; column >= 0; column--) {
					barrier = Math.max(barrier, heights[column])
					if (barrier >= y + h) break
					leftEvents.push(barrier)
				}
				barrier = y
				for (let column = x + w; column < width; column++) {
					barrier = Math.max(barrier, heights[column])
					if (barrier >= y + h) break
					rightEvents.push(barrier)
				}
				let a = 0
				let b = 0
				let level = y
				while (level < y + h) {
					while (a < leftEvents.length && leftEvents[a] <= level) a++
					while (b < rightEvents.length && rightEvents[b] <= level) b++
					const next = Math.min(leftEvents[a] ?? y + h, rightEvents[b] ?? y + h, y + h)
					const span = next - level
					if (a) deltas[a] += span
					if (b) deltas[b] += span
					deltas[a + w + b] -= span
					level = next
				}
			}
			for (let index = 0; index < certificates.length; index++) {
				const certificate = certificates[index]
				if (certificate.vertical) {
					const before = certificate.chain[height - y]
					const after = certificate.chain[height - y - h]
					change.prices[index] = w * ((after ?? 0) - (before ?? 0))
					change.missing[index] = w * (Number(after === undefined) - Number(before === undefined))
				} else {
					for (let length = 1; length < deltaWeights!.length; length++) {
						if (!deltaWeights![length]) continue
						const price = certificate.chain[length]
						if (price === undefined) change.missing[index] += deltaWeights![length]
						else change.prices[index] += deltaWeights![length] * price
					}
				}
				prices[index] += change.prices[index]
				missing[index] += change.missing[index]
			}
			return change
		},
		restore(change: SliceChange) {
			for (let index = 0; index < certificates.length; index++) {
				prices[index] -= change.prices[index]
				missing[index] -= change.missing[index]
			}
			changePool.push(change)
		},
	}
}

/** Integrate uncovered interval lengths using monotone column activation. */
function horizontalSliceWeights(heights: number[], height: number) {
	const width = heights.length
	const weights = Array<number>(width + 1).fill(0)
	const counts = Array<number>(width + 1).fill(0)
	const previous = Array<number>(width + 1).fill(0)
	const parents = Array<number>(width).fill(-1)
	const sizes = Array<number>(width).fill(0)
	const order = heights.map((_, x) => x).sort((a, b) => heights[a] - heights[b])
	const update = (length: number, delta: number, level: number) => {
		weights[length] += counts[length] * (level - previous[length])
		previous[length] = level
		counts[length] += delta
	}
	const root = (x: number) => {
		let result = x
		while (parents[result] !== result) result = parents[result]
		let cursor = x
		while (cursor !== result) {
			const next = parents[cursor]
			parents[cursor] = result
			cursor = next
		}
		return result
	}
	for (const x of order) {
		const level = heights[x]
		if (level >= height) break
		parents[x] = x
		sizes[x] = 1
		update(1, 1, level)
		for (const neighbor of [x - 1, x + 1]) {
			if (neighbor < 0 || neighbor >= width || parents[neighbor] === -1) continue
			const a = root(x)
			const b = root(neighbor)
			if (a === b) continue
			update(sizes[a], -1, level)
			update(sizes[b], -1, level)
			parents[b] = a
			sizes[a] += sizes[b]
			update(sizes[a], 1, level)
		}
	}
	for (let length = 1; length <= width; length++)
		weights[length] += counts[length] * (height - previous[length])
	return weights
}

/** Reuse exact one-dimensional composition prices on every remaining slice. */
function remainingSliceBound(
	heights: number[],
	height: number,
	area: number,
	senders: number,
	certificates: SliceCertificate[],
) {
	let bound = 0
	let horizontalWeights: number[] | undefined
	for (const certificate of certificates) {
		let slices = 0
		if (certificate.vertical) {
			for (const value of heights) {
				const cost = certificate.chain[height - value]
				if (cost === undefined) return Infinity
				slices += cost
			}
		} else {
			// A horizontal slice may contain separated uncovered intervals.
			// Integrate each run length once, sharing it across all certificates.
			horizontalWeights ??= horizontalSliceWeights(heights, height)
			for (let length = 1; length < horizontalWeights.length; length++) {
				if (!horizontalWeights[length]) continue
				const cost = certificate.chain[length]
				if (cost === undefined) return Infinity
				slices += cost * horizontalWeights[length]
			}
		}
		const numerator = BigInt(
			senders * certificate.countFactor +
				(senders * certificate.maximumArea - area) * certificate.lossFactor +
				slices,
		)
		const denominator = certificate.denominator
		const rounded =
			numerator >= 0n ? (numerator + denominator - 1n) / denominator : numerator / denominator
		bound = Math.max(bound, Number(rounded))
	}
	return bound
}

/**
 * Relax placement to independent full-height columns (or full-width rows),
 * but keep the exact total sender-area deficit across those slices. A tile of
 * width w contributes 1/w of its count, deficit and receiver cost to each of
 * its w columns; summing every column recovers its exact whole-tile values.
 */
function projectedDeficitBound(shapes: SenderShapeCost[], limits: GridLimits, senders: number) {
	if (!shapes.length) return 0
	const maximumArea = Math.max(...shapes.map((shape) => shape.width * shape.height))
	const screenArea = limits.width * limits.height
	if (!Number.isSafeInteger(senders * maximumArea)) return 0
	const deficit = senders * maximumArea - screenArea
	if (deficit < 0 || deficit > 32) return 0
	const allowed = shapes.filter((shape) => maximumArea - shape.width * shape.height <= deficit)
	const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
	let bound = 0
	for (const vertical of [true, false]) {
		const length = vertical ? limits.height : limits.width
		const cross = vertical ? limits.width : limits.height
		if (length > 64 || cross > 64) continue
		let scale = 1
		for (const shape of allowed) {
			const divisor = vertical ? shape.width : shape.height
			scale = (scale / gcd(scale, divisor)) * divisor
			if (scale > 512) break
		}
		const maximumLoss = deficit * scale
		if (scale > 512 || maximumLoss > 2048 || length * (maximumLoss + 1) * allowed.length > 600000)
			continue
		if (allowed.some((shape) => !Number.isSafeInteger(shape.cost[1] * scale))) continue
		const edges = allowed.map((shape) => {
			const divisor = vertical ? shape.width : shape.height
			return {
				length: vertical ? shape.height : shape.width,
				loss: ((maximumArea - shape.width * shape.height) * scale) / divisor,
				cost: (shape.cost[1] * scale) / divisor,
			}
		})
		const maximumCost = Math.max(...edges.map((edge) => edge.cost))
		if (
			!edges.every((edge) => Number.isSafeInteger(edge.loss) && Number.isSafeInteger(edge.cost)) ||
			!Number.isSafeInteger(maximumCost) ||
			BigInt(cross) * BigInt(length) * BigInt(maximumCost) > BigInt(Number.MAX_SAFE_INTEGER)
		)
			continue
		const slices = Array.from({ length: length + 1 }, () =>
			new Float64Array(maximumLoss + 1).fill(Infinity),
		)
		slices[0][0] = 0
		for (let filled = 0; filled <= length; filled++) {
			for (let loss = 0; loss <= maximumLoss; loss++) {
				const cost = slices[filled][loss]
				if (!Number.isFinite(cost)) continue
				for (const edge of edges) {
					if (filled + edge.length > length || loss + edge.loss > maximumLoss) continue
					const next = slices[filled + edge.length]
					next[loss + edge.loss] = Math.min(next[loss + edge.loss], cost + edge.cost)
				}
			}
		}
		const options: { loss: number; cost: number }[] = []
		for (let loss = 0; loss <= maximumLoss; loss++)
			if (Number.isFinite(slices[length][loss])) options.push({ loss, cost: slices[length][loss] })
		if (cross * (maximumLoss + 1) * options.length > 3000000) continue
		let totals = new Float64Array(maximumLoss + 1).fill(Infinity)
		totals[0] = 0
		for (let slice = 0; slice < cross; slice++) {
			const next = new Float64Array(maximumLoss + 1).fill(Infinity)
			for (let loss = 0; loss <= maximumLoss; loss++) {
				const cost = totals[loss]
				if (!Number.isFinite(cost)) continue
				for (const option of options) {
					if (loss + option.loss > maximumLoss) continue
					next[loss + option.loss] = Math.min(next[loss + option.loss], cost + option.cost)
				}
			}
			totals = next
		}
		if (Number.isFinite(totals[maximumLoss]))
			bound = Math.max(
				bound,
				Number((BigInt(totals[maximumLoss]) + BigInt(scale) - 1n) / BigInt(scale)),
			)
		else bound = Infinity
	}
	return bound
}

/**
 * An exact one-dimensional relaxation of sender placement. Every rectangle
 * projects to a contiguous interval of columns and contributes its height to
 * each column. Exceptional rectangles consume the small area deficit; a
 * modulo class isolates the only costly full-area shape, then the remaining
 * column heights must be covered by intervals of the other full-area shapes.
 * Ignoring vertical positions can only add layouts, so an exhaustive failure
 * proves the receiver budget impossible. Work caps merely decline a proof.
 */
function projectionIntervalAxisInfeasible(
	shapes: SenderShapeCost[],
	limits: GridLimits,
	senders: number,
	receivers: number,
) {
	if (!shapes.length || limits.width > 32 || limits.height > 32) return false
	const maximumArea = Math.max(...shapes.map((shape) => shape.width * shape.height))
	const deficit = senders * maximumArea - limits.width * limits.height
	if (!Number.isSafeInteger(deficit) || deficit < 0 || deficit > 3) return false
	const full = shapes.filter((shape) => shape.width * shape.height === maximumArea)
	const exceptional = shapes.filter((shape) => {
		const loss = maximumArea - shape.width * shape.height
		return loss > 0 && loss <= deficit
	})
	if (!full.length) return false
	const baseline = Math.min(...full.map((shape) => shape.cost[1]))
	const width = limits.width
	const height = limits.height
	for (let period = 2; period <= Math.min(8, height); period++) {
		const distinct = full.filter((shape) => shape.height % period)
		if (distinct.length !== 1) continue
		const target = distinct[0]
		const targetExtra = target.cost[1] - baseline
		if (targetExtra <= 0 || target.width < 2 || target.width > 8) continue
		const fillers = full.filter((shape) => shape !== target)
		if (!fillers.length) continue
		let work = 0
		let aborted = false
		let possible = false
		const exceptionalHeights = new Uint8Array(width)
		const fillerMemo = new Map<string, number>()
		const fill = (residual: number[]): number => {
			if (++work > 500000) {
				aborted = true
				return Infinity
			}
			const x = residual.findIndex((value) => value > 0)
			if (x < 0) return 0
			const key = residual.join(',')
			const cached = fillerMemo.get(key)
			if (cached !== undefined) return cached
			let minimum = Infinity
			for (const shape of fillers) {
				if (x + shape.width > width) continue
				let fits = true
				for (let next = x; next < x + shape.width; next++)
					if (residual[next] < shape.height) fits = false
				if (!fits) continue
				for (let next = x; next < x + shape.width; next++) residual[next] -= shape.height
				minimum = Math.min(minimum, shape.cost[1] - baseline + fill(residual))
				for (let next = x; next < x + shape.width; next++) residual[next] += shape.height
				if (aborted) return Infinity
			}
			fillerMemo.set(key, minimum)
			return minimum
		}
		const checkColumns = (exceptionExtra: number) => {
			if (++work > 500000) {
				aborted = true
				return
			}
			const budget = receivers - senders * baseline - exceptionExtra
			if (budget < 0) return
			const maximumTargets = Math.floor(budget / targetExtra)
			const options: number[][] = []
			let minimumIncidences = 0
			for (let x = 0; x < width; x++) {
				const remaining = height - exceptionalHeights[x]
				const choices: number[] = []
				for (let count = 0; count * target.height <= remaining; count++)
					if ((remaining - count * target.height) % period === 0) choices.push(count)
				if (!choices.length) return
				minimumIncidences += choices[0]
				options.push(choices)
			}
			if (minimumIncidences > maximumTargets * target.width) return
			const counts = new Uint8Array(width)
			const visit = (x: number, pending: number[], used: number) => {
				if (++work > 500000) {
					aborted = true
					return
				}
				if (x === width) {
					const residual = Array.from(
						counts,
						(count, index) => height - exceptionalHeights[index] - count * target.height,
					)
					if (used * targetExtra + fill(residual) <= budget) possible = true
					return
				}
				const active = pending.reduce((sum, count) => sum + count, 0)
				for (const count of options[x]) {
					const starts = count - active
					if (starts < 0 || (starts && x + target.width > width) || used + starts > maximumTargets)
						continue
					counts[x] = count
					visit(x + 1, [...pending.slice(1), starts], used + starts)
					if (possible || aborted) return
				}
			}
			visit(0, Array<number>(target.width - 1).fill(0), 0)
		}
		const placeExceptions = (index: number, loss: number, extra: number, previousX = 0) => {
			if (possible || aborted) return
			if (++work > 500000) {
				aborted = true
				return
			}
			if (loss === deficit) {
				checkColumns(extra)
				return
			}
			for (let choice = index; choice < exceptional.length; choice++) {
				const shape = exceptional[choice]
				const nextLoss = loss + maximumArea - shape.width * shape.height
				if (nextLoss > deficit) continue
				for (let x = choice === index ? previousX : 0; x + shape.width <= width; x++) {
					let fits = true
					for (let next = x; next < x + shape.width; next++)
						if (exceptionalHeights[next] + shape.height > height) fits = false
					if (!fits) continue
					for (let next = x; next < x + shape.width; next++)
						exceptionalHeights[next] += shape.height
					placeExceptions(choice, nextLoss, extra + shape.cost[1] - baseline, x)
					for (let next = x; next < x + shape.width; next++)
						exceptionalHeights[next] -= shape.height
					if (possible || aborted) return
				}
			}
		}
		placeExceptions(0, 0, 0)
		if (!aborted && !possible) return true
	}
	return false
}

function projectionIntervalInfeasible(
	shapes: SenderShapeCost[],
	limits: GridLimits,
	senders: number,
	receivers: number,
) {
	if (projectionIntervalAxisInfeasible(shapes, limits, senders, receivers)) return true
	return projectionIntervalAxisInfeasible(
		shapes.map((shape) => ({ ...shape, width: shape.height, height: shape.width })),
		{ ...limits, width: limits.height, height: limits.width },
		senders,
		receivers,
	)
}

/**
 * Every vertical/horizontal slice is a composition of rectangle side lengths.
 * Rational area and count prices turn a one-dimensional shortest composition
 * into a resource bound. All arithmetic, including the final ceiling, is exact.
 */
function sliceResourceBound(
	shapes: SenderShapeCost[],
	limits: GridLimits,
	senders: number,
	resource: 1 | 2,
	receiverPricing?: { price: number; count: number },
	certificates?: SliceCertificate[],
) {
	const maximumArea = Math.max(...shapes.map((shape) => shape.width * shape.height))
	if (!Number.isSafeInteger(senders * maximumArea)) return 0
	const deficit = senders * maximumArea - limits.width * limits.height
	if (deficit < 0 || deficit > 512) return 0
	const allowed = shapes.filter((shape) => maximumArea - shape.width * shape.height <= deficit)
	// At the proved receiver optimum, every sender uses its minimum receiver
	// count. Price C + price*R, then subtract the known global receiver price.
	// This penalizes cable savings that would require extra receivers.
	const pricedCost = (shape: SenderShapeCost) =>
		shape.cost[resource] + (receiverPricing?.price ?? 0) * shape.cost[1]
	const baseline = Math.min(
		...allowed.filter((shape) => shape.width * shape.height === maximumArea).map(pricedCost),
	)
	const ratios = new Map<number, { numerator: number; denominator: number }>()
	for (const shape of allowed) {
		const loss = maximumArea - shape.width * shape.height
		const excess = pricedCost(shape) - baseline
		if (loss && excess < 0) ratios.set(excess / loss, { numerator: excess, denominator: loss })
	}
	const prices = [...ratios.values()].sort(
		(a, b) => a.numerator / a.denominator - b.numerator / b.denominator,
	)
	prices.splice(
		1,
		0,
		{ numerator: -1, denominator: limits.receiverArea },
		{ numerator: 0, denominator: 1 },
	)
	const axes = [true, false].map((vertical) => {
		const length = vertical ? limits.height : limits.width
		const crossLength = vertical ? limits.width : limits.height
		const dimensions = [
			...new Set(allowed.map((shape) => (vertical ? shape.height : shape.width))),
		].sort((a, b) => a - b)
		if (length > 4096 || length * dimensions.length > 20000) return null
		let multiple = 1n
		for (const value of new Set(allowed.map((shape) => (vertical ? shape.width : shape.height)))) {
			let a = multiple
			let b = BigInt(value)
			while (b) [a, b] = [b, a % b]
			multiple = (multiple / a) * BigInt(value)
		}
		return {
			vertical,
			length,
			crossLength,
			dimensions,
			multiple,
			edges: allowed.map((shape) => ({
				dimension: vertical ? shape.height : shape.width,
				multiplier: multiple / BigInt(vertical ? shape.width : shape.height),
				loss: BigInt(maximumArea - shape.width * shape.height),
				resource: BigInt(pricedCost(shape)),
			})),
		}
	})
	let bound = 0
	const start = performance.now()
	const receiverPrice = receiverPricing
		? BigInt(receiverPricing.price) * BigInt(receiverPricing.count)
		: 0n
	const recordBound = (numerator: bigint, denominator: bigint) => {
		const adjusted = numerator - receiverPrice * denominator
		const roundedUp =
			adjusted >= 0n ? (adjusted + denominator - 1n) / denominator : adjusted / denominator
		if (roundedUp <= BigInt(Number.MAX_SAFE_INTEGER)) bound = Math.max(bound, Number(roundedUp))
	}
	for (const price of prices) {
		const p = BigInt(price.numerator)
		const q = BigInt(price.denominator)
		for (const axis of axes) {
			if (!axis) continue
			const memo = new Map<number, bigint>()
			const denominator = 2n * q * axis.multiple
			const score = (countPrice: number) => {
				if (memo.has(countPrice)) return memo.get(countPrice)!
				const count = BigInt(countPrice)
				const costs = new Map<number, bigint>()
				for (const edge of axis.edges) {
					const value = (2n * q * edge.resource - count * q - 2n * p * edge.loss) * edge.multiplier
					const previous = costs.get(edge.dimension)
					if (previous === undefined || value < previous) costs.set(edge.dimension, value)
				}
				const chain: (bigint | undefined)[] = Array(axis.length + 1)
				chain[0] = 0n
				for (let length = 1; length <= axis.length; length++) {
					for (const dimension of axis.dimensions) {
						if (dimension > length) break
						const previous = chain[length - dimension]
						if (previous === undefined) continue
						const value = previous + costs.get(dimension)!
						if (chain[length] === undefined || value < chain[length]!) chain[length] = value
					}
				}
				if (chain[axis.length] === undefined) return undefined
				const numerator =
					BigInt(senders) * count * q * axis.multiple +
					2n * p * BigInt(deficit) * axis.multiple +
					BigInt(axis.crossLength) * chain[axis.length]!
				memo.set(countPrice, numerator)
				recordBound(numerator, denominator)
				if (certificates && resource === 1 && !receiverPricing) {
					const countFactor = count * q * axis.multiple
					const lossFactor = 2n * p * axis.multiple
					const absolute = (value: bigint) => (value < 0n ? -value : value)
					const maximumChain = chain.reduce<bigint>(
						(maximum, value) =>
							value !== undefined && absolute(value) > maximum ? absolute(value) : maximum,
						0n,
					)
					// Preflight the sum of absolute terms for every possible partial
					// region. Safe integer additions are exact; the ceiling still uses BigInt.
					const magnitude =
						BigInt(senders) * absolute(countFactor) +
						BigInt(deficit) * absolute(lossFactor) +
						BigInt(limits.width * limits.height) * maximumChain
					if (magnitude <= BigInt(Number.MAX_SAFE_INTEGER)) {
						certificates.push({
							vertical: axis.vertical,
							maximumArea,
							chain: chain.map((value) => (value === undefined ? undefined : Number(value))),
							countFactor: Number(countFactor),
							lossFactor: Number(lossFactor),
							denominator,
							numerator,
						})
						certificates.sort((a, b) => {
							const difference = a.numerator * b.denominator - b.numerator * a.denominator
							return difference > 0n ? -1 : difference < 0n ? 1 : 0
						})
						let verticalCount = 0
						let horizontalCount = 0
						for (let index = 0; index < certificates.length; ) {
							const kept = certificates[index].vertical
								? ++verticalCount <= 2
								: ++horizontalCount <= 2
							if (kept) index++
							else certificates.splice(index, 1)
						}
					}
				}
				return numerator
			}
			// A minimum of affine functions is concave, so discrete bisection
			// finds the best half-integer count price in this optional interval.
			let low = -2 * baseline
			let high = 2 * baseline
			while (low < high) {
				if (performance.now() - start > 15) return bound
				const middle = Math.floor((low + high) / 2)
				const left = score(middle)
				const right = score(middle + 1)
				if (left === undefined || right === undefined) break
				if (left <= right) low = middle + 1
				else high = middle
			}
			if (performance.now() - start > 15) return bound
			score(low)
		}
	}
	return bound
}

/** Integer periodic coloring: sum_x(p·[x mod p=i]−1) · sum_y(q·[y mod q=j]−1). */
function colorWeights(width: number, height: number, p: number, q: number) {
	const x = width % p
	const y = height % q
	if (!x || !y) return [0]
	return [...new Set([x * y, (p - x) * (q - y), -x * (q - y), -(p - x) * y])]
}

/**
 * Relax area/resource/color feasibility. Dropping positions and the number of
 * exceptional tiles enlarges the feasible set: failure is a rigorous certificate.
 * Neutral maximum-area tiles have zero color; all other transitions have either
 * positive area deficit or nonnegative resource cost, so no negative cycles exist.
 */
function coloringInfeasible(
	shapeCosts: SenderShapeCost[],
	limits: GridLimits,
	senders: number,
	receivers: number,
	resource: 1 | 2,
	budget: number,
): boolean {
	const area = limits.width * limits.height
	const maximumArea = Math.max(...shapeCosts.map((shape) => shape.width * shape.height))
	if (!Number.isSafeInteger(senders * maximumArea)) return false
	const deficit = senders * maximumArea - area
	if (!Number.isSafeInteger(deficit) || deficit < 0 || deficit > 64) return false
	const receiverArea = Math.min(limits.receiverArea, maximumArea)
	const allowed = shapeCosts.filter((shape) => {
		const shapeArea = shape.width * shape.height
		const remainderArea = area - shapeArea
		return (
			maximumArea - shapeArea <= deficit &&
			remainderArea <= (senders - 1) * maximumArea &&
			shape.cost[1] + capacityCount(remainderArea, senders - 1, maximumArea, receiverArea) <=
				receivers
		)
	})
	const full = allowed.filter((shape) => shape.width * shape.height === maximumArea)
	if (!full.length) return false
	const baseline = Math.min(...full.map((shape) => shape.cost[resource]))
	const excessBudget = budget - senders * baseline
	const neutral = full.filter((shape) => shape.cost[resource] === baseline)
	const modulus = 31
	const mod = (value: number) => ((value % modulus) + modulus) % modulus
	const periods: [number, number][] = []
	for (let p = 2; p <= 16; p++) {
		for (let q = 2; q <= 16; q++) {
			if (limits.width % p === 0 || limits.height % q === 0) continue
			if (neutral.every((shape) => shape.width % p === 0 || shape.height % q === 0))
				periods.push([p, q])
		}
	}
	periods.sort((a, b) => Number(b[0] === b[1]) - Number(a[0] === a[1]) || a[0] + a[1] - b[0] - b[1])
	const certificateStart = performance.now()
	for (const [p, q] of periods) {
		// Optional acceleration only; unfinished checks are not certificates.
		if (performance.now() - certificateStart > 50) return false
		const zeroEdges = Array<number>(modulus).fill(Infinity)
		const transitions: { deficit: number; excess: number; colors: number[] }[] = []
		const seen = new Set<string>()
		for (const shape of allowed) {
			const loss = maximumArea - shape.width * shape.height
			const excess = shape.cost[resource] - baseline
			const colors = [...new Set(colorWeights(shape.width, shape.height, p, q).map(mod))]
			if (!loss) {
				for (const color of colors) zeroEdges[color] = Math.min(zeroEdges[color], excess)
			} else {
				const key = `${loss}/${excess}/${colors.join(',')}`
				if (!seen.has(key)) {
					seen.add(key)
					transitions.push({ deficit: loss, excess, colors })
				}
			}
		}
		const zeroDistance = Array<number>(modulus).fill(Infinity)
		const visited = Array<boolean>(modulus).fill(false)
		zeroDistance[0] = 0
		for (let step = 0; step < modulus; step++) {
			let next = -1
			for (let value = 0; value < modulus; value++)
				if (
					!visited[value] &&
					Number.isFinite(zeroDistance[value]) &&
					(next < 0 || zeroDistance[value] < zeroDistance[next])
				)
					next = value
			if (next < 0) break
			visited[next] = true
			for (let color = 0; color < modulus; color++)
				zeroDistance[(next + color) % modulus] = Math.min(
					zeroDistance[(next + color) % modulus],
					zeroDistance[next] + zeroEdges[color],
				)
		}
		const costs = Array.from({ length: deficit + 1 }, () => Array<number>(modulus).fill(Infinity))
		costs[0][0] = 0
		for (let loss = 0; loss <= deficit; loss++) {
			const closed = Array<number>(modulus).fill(Infinity)
			for (let color = 0; color < modulus; color++) {
				if (!Number.isFinite(costs[loss][color])) continue
				for (let addition = 0; addition < modulus; addition++) {
					const target = (color + addition) % modulus
					closed[target] = Math.min(closed[target], costs[loss][color] + zeroDistance[addition])
				}
			}
			costs[loss] = closed
			for (const transition of transitions) {
				if (loss + transition.deficit > deficit) continue
				const future = costs[loss + transition.deficit]
				for (let color = 0; color < modulus; color++) {
					if (!Number.isFinite(closed[color])) continue
					for (const addition of transition.colors) {
						const target = (color + addition) % modulus
						future[target] = Math.min(future[target], closed[color] + transition.excess)
					}
				}
			}
		}
		for (const target of colorWeights(limits.width, limits.height, p, q))
			if (costs[deficit][mod(target)] > excessBudget) return true
	}
	return false
}

/** Rectangles that cannot share any slice must fit outside one another's projection. */
function pruneSliceProjections(shapes: SenderShapeCost[], limits: GridLimits, senders: number) {
	let allowed = shapes
	const remaining = senders - 1
	const area = limits.width * limits.height
	for (const transpose of [false, true]) {
		const length = transpose ? limits.width : limits.height
		const crossLength = transpose ? limits.height : limits.width
		if (length > 512) continue
		const dimensions = [
			...new Set(allowed.map((shape) => (transpose ? shape.width : shape.height))),
		]
		const reachable = Array<boolean>(length + 1).fill(false)
		reachable[0] = true
		for (let value = 1; value <= length; value++)
			for (const dimension of dimensions)
				if (dimension <= value && reachable[value - dimension]) reachable[value] = true
		const next: SenderShapeCost[] = []
		for (const shape of allowed) {
			const side = transpose ? shape.width : shape.height
			const crossSide = transpose ? shape.height : shape.width
			let compatibleArea = 0
			let incompatibleArea = 0
			for (const other of allowed) {
				const otherSide = transpose ? other.width : other.height
				const otherArea = other.width * other.height
				if (side + otherSide <= length && reachable[length - side - otherSide])
					compatibleArea = Math.max(compatibleArea, otherArea)
				else incompatibleArea = Math.max(incompatibleArea, otherArea)
			}
			const remainingArea = area - shape.width * shape.height
			if (remainingArea > remaining * Math.max(compatibleArea, incompatibleArea)) continue
			if (incompatibleArea > compatibleArea && remainingArea > remaining * compatibleArea) {
				// Incompatible rectangles cannot overlap this rectangle's projection.
				// Fixed remaining count and area force a minimum area in that group;
				// it must fit outside the chosen projection. Use exact integer ceilings.
				const gap = BigInt(remainingArea) - BigInt(remaining) * BigInt(compatibleArea)
				const increment = BigInt(incompatibleArea - compatibleArea)
				const minimumCount = (gap + increment - 1n) / increment
				const minimumArea =
					BigInt(remainingArea) - (BigInt(remaining) - minimumCount) * BigInt(compatibleArea)
				if (minimumArea > BigInt(crossLength - crossSide) * BigInt(length)) continue
			}
			next.push(shape)
		}
		allowed = next
	}
	return allowed
}

/**
 * If a slice length is divisible by p, one exceptional side cannot occur alone.
 * When the area deficit permits at most two such rectangles, their perpendicular
 * projections must coincide: every slice meeting either must meet both. Their
 * perpendicular sides are equal and their parallel sides fit together. Relaxed
 * area/resource DP checks whether the other S-2 ordinary rectangles can exist.
 */
function* pruneExceptionalPairs(
	shapes: SenderShapeCost[],
	limits: GridLimits,
	senders: number,
	maximumArea: number,
	receivers: number,
	resource: 1 | 2,
	budget: number,
	deadline: number,
	context: SearchContext,
): Generator<CabinetProgress, SenderShapeCost[]> {
	let allowed = shapes
	const deficit = senders * maximumArea - limits.width * limits.height
	for (const transpose of [false, true])
		for (let period = 2; period <= 8; period++) {
			if (performance.now() > deadline) return allowed
			const length = transpose ? limits.height : limits.width
			if (length % period) continue
			const side = (shape: SenderShapeCost) => (transpose ? shape.height : shape.width)
			const crossSide = (shape: SenderShapeCost) => (transpose ? shape.width : shape.height)
			const exceptional = allowed.filter((shape) => side(shape) % period !== 0)
			if (!exceptional.length) continue
			const minimumLoss = Math.min(
				...exceptional.map((shape) => maximumArea - shape.width * shape.height),
			)
			if (!minimumLoss) continue
			const maximumExceptions = Math.min(senders, Math.floor(deficit / minimumLoss))
			if (maximumExceptions > 2) continue
			const ordinary = allowed.filter((shape) => side(shape) % period === 0)
			if (maximumExceptions < 2) {
				allowed = ordinary
				continue
			}
			if ((senders - 2) * (deficit + 1) * ordinary.length > 500000) continue
			const choices = new Map<number, { receivers: number; resource: number }>()
			for (const shape of ordinary) {
				const loss = maximumArea - shape.width * shape.height
				const previous = choices.get(loss)
				choices.set(loss, {
					receivers: Math.min(previous?.receivers ?? Infinity, shape.cost[1]),
					resource: Math.min(previous?.resource ?? Infinity, shape.cost[resource]),
				})
			}
			let minimumReceivers = Array<number>(deficit + 1).fill(Infinity)
			let minimumResource = Array<number>(deficit + 1).fill(Infinity)
			minimumReceivers[0] = minimumResource[0] = 0
			for (let step = 0; step < senders - 2; step++) {
				const nextReceivers = Array<number>(deficit + 1).fill(Infinity)
				const nextResource = Array<number>(deficit + 1).fill(Infinity)
				for (let loss = 0; loss <= deficit; loss++)
					for (const [addition, choice] of choices) {
						if (loss + addition > deficit) continue
						nextReceivers[loss + addition] = Math.min(
							nextReceivers[loss + addition],
							minimumReceivers[loss] + choice.receivers,
						)
						nextResource[loss + addition] = Math.min(
							nextResource[loss + addition],
							minimumResource[loss] + choice.resource,
						)
					}
				minimumReceivers = nextReceivers
				minimumResource = nextResource
				context.visitedStates++
				if (context.visitedStates % 256 === 0) yield* context.checkpoint()
				if (performance.now() > deadline) return allowed
			}
			allowed = allowed.filter((shape) => {
				if (side(shape) % period === 0) return true
				return exceptional.some((other) => {
					if (
						crossSide(shape) !== crossSide(other) ||
						side(shape) + side(other) > length ||
						(side(shape) + side(other)) % period
					)
						return false
					const loss = 2 * maximumArea - shape.width * shape.height - other.width * other.height
					return (
						loss <= deficit &&
						shape.cost[1] + other.cost[1] + minimumReceivers[deficit - loss] <= receivers &&
						shape.cost[resource] + other.cost[resource] + minimumResource[deficit - loss] <= budget
					)
				})
			})
		}
	return allowed
}

interface SideSumChoice {
	area: number
	receivers: number
	cables: number
	width: number
	height: number
}

/**
 * Every horizontal slice needs ceil(screenWidth / maxTileWidth) rectangles;
 * integrating those incidences gives a lower bound on the sum of tile heights.
 * Vertical slices analogously bound the sum of tile widths. Enumerating two
 * multiset halves with exact area and resource budgets is a position-relaxed
 * certificate: failure here makes a geometric tiling impossible as well.
 */
function sideSumPackingInfeasible(
	shapeCosts: SenderShapeCost[],
	limits: GridLimits,
	senders: number,
	receivers: number,
	cables: number,
) {
	if (!shapeCosts.length) return true
	if (senders < 1 || senders > 8 || shapeCosts.length > 256) return false
	const screenArea = limits.width * limits.height
	const maximumWidth = Math.max(...shapeCosts.map((shape) => shape.width))
	const maximumHeight = Math.max(...shapeCosts.map((shape) => shape.height))
	const minimumWidthSum = limits.width * Math.ceil(limits.height / maximumHeight)
	const minimumHeightSum = limits.height * Math.ceil(limits.width / maximumWidth)
	if (
		![screenArea, minimumWidthSum, minimumHeightSum].every(Number.isSafeInteger) ||
		!Number.isFinite(receivers)
	)
		return false
	let work = 0
	const maximumWork = 500000
	const enumerate = (count: number): SideSumChoice[] | null => {
		const choices: SideSumChoice[] = []
		const visit = (
			start: number,
			left: number,
			area: number,
			receiverTotal: number,
			cableCount: number,
			width: number,
			height: number,
		) => {
			if (++work > maximumWork) return false
			if (!left) {
				choices.push({ area, receivers: receiverTotal, cables: cableCount, width, height })
				return true
			}
			for (let index = start; index < shapeCosts.length; index++) {
				const shape = shapeCosts[index]
				const nextArea = area + shape.width * shape.height
				const nextReceivers = receiverTotal + shape.cost[1]
				const nextCables = cableCount + shape.cost[2]
				if (nextArea > screenArea || nextReceivers > receivers || nextCables > cables) continue
				if (
					!visit(
						index,
						left - 1,
						nextArea,
						nextReceivers,
						nextCables,
						Math.min(minimumWidthSum, width + shape.width),
						Math.min(minimumHeightSum, height + shape.height),
					)
				)
					return false
			}
			return true
		}
		return visit(0, count, 0, 0, 0, 0, 0) ? choices : null
	}
	const leftCount = Math.floor(senders / 2)
	const rightCount = senders - leftCount
	const left = enumerate(leftCount)
	if (!left) return false
	const right = leftCount === rightCount ? left : enumerate(rightCount)
	if (!right) return false
	const rightByArea = new Map<number, SideSumChoice[]>()
	for (const choice of right) {
		const group = rightByArea.get(choice.area)
		if (group) group.push(choice)
		else rightByArea.set(choice.area, [choice])
	}
	for (const first of left) {
		const options = rightByArea.get(screenArea - first.area)
		if (!options) continue
		for (const second of options) {
			if (++work > maximumWork) return false
			if (
				first.receivers + second.receivers <= receivers &&
				first.cables + second.cables <= cables &&
				first.width + second.width >= minimumWidthSum &&
				first.height + second.height >= minimumHeightSum
			)
				return false
		}
	}
	return true
}

/**
 * Retain the exact sender count in a modular resource DP. A completed slice
 * composition check may also force exactly N tiles on every parallel slice;
 * integrating then fixes the sum of perpendicular sides. Combine that sum
 * with a periodic stripe, including all possible translations of each tile.
 */
function* fixedCountSliceInfeasible(
	shapeCosts: SenderShapeCost[],
	limits: GridLimits,
	senders: number,
	receivers: number,
	resource: 1 | 2,
	budget: number,
	context: SearchContext,
): Generator<CabinetProgress, boolean> {
	const maximumArea = Math.max(...shapeCosts.map((shape) => shape.width * shape.height))
	if (!Number.isSafeInteger(senders * maximumArea)) return false
	const area = limits.width * limits.height
	const deficit = senders * maximumArea - area
	if (deficit < 0 || deficit > 64 || senders > 64) return false
	const packing = yield* relaxedPackingBound(shapeCosts, area, senders, maximumArea, context)
	if (packing === null) return true
	if (!packing) return false
	let allowed = shapeCosts.filter((shape) => {
		const loss = maximumArea - shape.width * shape.height
		return (
			loss <= deficit && shape.cost[1] + packing.remainingReceivers[deficit - loss] <= receivers
		)
	})
	if (
		!allowed.length ||
		senders * Math.min(...allowed.map((shape) => shape.cost[resource])) > budget
	)
		return true
	const start = performance.now()
	const optionalBudget = resource === 1 ? 30 : 8
	const axes: { transpose: boolean; length: number; crossLength: number; count: number }[] = []
	for (let pass = 0; pass < 3; pass++) {
		const previousCount = allowed.length
		for (const transpose of [false, true]) {
			const length = transpose ? limits.width : limits.height
			if (length > 512) continue
			const dimensions = [
				...new Set(allowed.map((shape) => (transpose ? shape.width : shape.height))),
			]
			const reachable = Array<boolean>(length + 1).fill(false)
			reachable[0] = true
			for (let value = 1; value <= length; value++)
				for (const dimension of dimensions)
					if (dimension <= value && reachable[value - dimension]) reachable[value] = true
			// A rectangle on any slice needs a composition of the remaining length.
			allowed = allowed.filter(
				(shape) => reachable[length - (transpose ? shape.width : shape.height)],
			)
		}
		if (!allowed.length) return true
		const restricted = yield* relaxedPackingBound(allowed, area, senders, maximumArea, context)
		if (restricted === null || (restricted && restricted.receiverFirst[1] > receivers)) return true
		if (restricted)
			allowed = allowed.filter(
				(shape) =>
					shape.cost[1] +
						restricted.remainingReceivers[deficit - (maximumArea - shape.width * shape.height)] <=
					receivers,
			)
		allowed = pruneSliceProjections(allowed, limits, senders)
		allowed = yield* pruneExceptionalPairs(
			allowed,
			limits,
			senders,
			maximumArea,
			receivers,
			resource,
			budget,
			start + optionalBudget,
			context,
		)
		if (
			!allowed.length ||
			senders * Math.min(...allowed.map((shape) => shape.cost[resource])) > budget
		)
			return true
		if (allowed.length === previousCount) break
		if (performance.now() - start > optionalBudget) return false
	}
	if (
		allowed.length < shapeCosts.length &&
		coloringInfeasible(allowed, limits, senders, receivers, resource, budget)
	)
		return true
	for (const transpose of [false, true]) {
		const length = transpose ? limits.width : limits.height
		const crossLength = transpose ? limits.height : limits.width
		if (length > 512) continue
		const dimensions = [
			...new Set(allowed.map((shape) => (transpose ? shape.width : shape.height))),
		]
		const minimum = Array<number>(length + 1).fill(Infinity)
		const maximum = Array<number>(length + 1).fill(-Infinity)
		minimum[0] = maximum[0] = 0
		for (let value = 1; value <= length; value++)
			for (const dimension of dimensions) {
				if (dimension > value) continue
				minimum[value] = Math.min(minimum[value], minimum[value - dimension] + 1)
				maximum[value] = Math.max(maximum[value], maximum[value - dimension] + 1)
			}
		if (!Number.isFinite(minimum[length])) return true
		axes.push({
			transpose,
			length,
			crossLength,
			count: minimum[length] === maximum[length] ? minimum[length] : 0,
		})
	}
	const modulus = 31
	const mod = (value: number) => ((value % modulus) + modulus) % modulus
	for (const axis of axes)
		for (let period = 2; period <= 8; period++) {
			if (performance.now() - start > optionalBudget) return false
			const count = axis.count
			const targets = stripeWeights(axis.length, period).map(
				(value) => axis.crossLength * (value + count),
			)
			const choices = new Map<string, { loss: number; cost: number; colors: number[] }>()
			let safe = targets.every(Number.isSafeInteger)
			for (const shape of allowed) {
				const length = axis.transpose ? shape.width : shape.height
				const crossLength = axis.transpose ? shape.height : shape.width
				const colors = stripeWeights(length, period).map(
					(value) => crossLength * (value + (count ? 1 : 0)),
				)
				if (!colors.every(Number.isSafeInteger)) safe = false
				const loss = maximumArea - shape.width * shape.height
				const cost = shape.cost[resource]
				const residues = [...new Set(colors.map(mod))]
				const key = `${loss}/${cost}/${residues.join(',')}`
				choices.set(key, { loss, cost, colors: residues })
			}
			if (!safe || senders * (deficit + 1) * modulus * choices.size > 2000000) continue
			let costs = new Float64Array((deficit + 1) * modulus).fill(Infinity)
			costs[0] = 0
			for (let step = 0; step < senders; step++) {
				const next = new Float64Array(costs.length).fill(Infinity)
				for (let loss = 0; loss <= deficit; loss++)
					for (let color = 0; color < modulus; color++) {
						const cost = costs[loss * modulus + color]
						if (!Number.isFinite(cost)) continue
						for (const choice of choices.values()) {
							if (loss + choice.loss > deficit || cost + choice.cost > budget) continue
							for (const addition of choice.colors) {
								const index = (loss + choice.loss) * modulus + ((color + addition) % modulus)
								next[index] = Math.min(next[index], cost + choice.cost)
							}
						}
					}
				costs = next
				context.visitedStates++
				if (context.visitedStates % 256 === 0) yield* context.checkpoint()
				if (performance.now() - start > optionalBudget) return false
			}
			if (targets.some((target) => costs[deficit * modulus + mod(target)] > budget)) return true
		}
	return false
}

function createExactSender(
	limits: GridLimits,
	context: SearchContext,
	getSeed = (w: number, h: number) => seedCables(w, h, limits),
) {
	const exactCache = new Map<string, Tiling | null>()
	function* exactSender(
		w: number,
		h: number,
	): Generator<CabinetProgress, Omit<Tile, 'x' | 'y'> | null> {
		const key = `${w},${h}`
		if (!exactCache.has(key)) {
			const area = w * h
			const portArea = maximumRectangleArea(w, h, limits.portArea)
			if (area > limits.ports * portArea) {
				exactCache.set(key, null)
				return null
			}
			const local: GridLimits = {
				...limits,
				width: w,
				height: h,
				receiverWidth: Math.min(w, limits.receiverWidth),
				receiverHeight: Math.min(h, limits.receiverHeight),
				portArea,
				receiverArea: maximumRectangleArea(
					Math.min(w, limits.receiverWidth),
					Math.min(h, limits.receiverHeight),
					portArea,
				),
			}
			const initial = getSeed(w, h)
			const floor: CabinetCost = [
				0,
				Math.max(receiverCount(w, h, local), Math.ceil(area / local.receiverArea)),
				Math.ceil(area / portArea),
			]
			if (initial && compareCabinetCost(initial.cost, floor) === 0) {
				exactCache.set(key, initial)
				return {
					width: w,
					height: h,
					cost: [1, initial.cost[1], initial.cost[2]],
					children: initial.tiles,
				}
			}
			if (portArea <= 64 && limits.ports <= 16 && area <= 256) {
				const portShapes: SenderShapeCost[] = []
				for (let pw = 1; pw <= Math.min(w, portArea); pw++)
					for (let ph = 1; ph <= Math.min(h, Math.floor(portArea / pw)); ph++)
						portShapes.push({ width: pw, height: ph, cost: [0, receiverCount(pw, ph, local), 1] })
				let receiverFloor = Infinity
				let cableFloor = Infinity
				const maximumCables = Math.min(limits.ports, area, initial?.cost[1] ?? Infinity)
				for (let count = floor[2]; count <= maximumCables && count < receiverFloor; count++) {
					const packing = yield* relaxedPackingBound(portShapes, area, count, portArea, context)
					if (packing === null) continue
					// A skipped DP still contributes an admissible count/capacity bound.
					const receivers = Math.max(
						floor[1],
						count,
						capacityCount(area, count, portArea, local.receiverArea),
						packing?.receiverFirst[1] ?? 0,
					)
					if (receivers < receiverFloor) {
						receiverFloor = receivers
						cableFloor = count
					}
				}
				if (!Number.isFinite(receiverFloor)) {
					exactCache.set(key, null)
					return null
				}
				floor[1] = receiverFloor
				floor[2] = cableFloor
			}
			// A narrower skyline has fewer profiles. Rotate only the internal
			// exact search; transform every cable rectangle back before returning.
			const rotate = w > h
			const searchLimits = rotate
				? { ...local, receiverWidth: local.receiverHeight, receiverHeight: local.receiverWidth }
				: local
			const searchSeed =
				initial && rotate
					? { cost: initial.cost, tiles: initial.tiles.map(transposeTile) }
					: initial
			const inner = yield* searchTiling(
				rotate ? h : w,
				rotate ? w : h,
				searchLimits,
				false,
				searchSeed,
				context,
				function* (width, height) {
					return { width, height, cost: [0, receiverCount(width, height, searchLimits), 1] }
				},
				undefined,
				undefined,
				{ provedFloor: floor },
			)
			exactCache.set(
				key,
				inner && rotate ? { cost: inner.cost, tiles: inner.tiles.map(transposeTile) } : inner,
			)
		}
		const inner = exactCache.get(key)
		return inner
			? { width: w, height: h, cost: [1, inner.cost[1], inner.cost[2]], children: inner.tiles }
			: null
	}
	return exactSender
}

function materialize(
	c: CabinetConfiguration,
	tiling: Tiling,
	lowerBound: CabinetCost,
	isOptimal: boolean,
	context: SearchContext,
	start: number,
): CabinetSolution {
	let cableId = 0
	let receiverId = 0
	const senders = tiling.tiles.map((tile, senderIndex): CabinetSender => {
		const sender = senderIndex + 1
		const cables = (tile.children ?? []).map((child, portIndex): CabinetCable => {
			const id = ++cableId
			const port = portIndex + 1
			const x = tile.x + child.x
			const y = tile.y + child.y
			const receivers: CabinetReceiver[] = []
			let row = 0
			if (child.children) {
				for (const receiver of child.children)
					receivers.push({
						id: ++receiverId,
						sender,
						cable: id,
						port,
						order: 0,
						x: x + receiver.x,
						y: y + receiver.y,
						width: receiver.width,
						height: receiver.height,
					})
			}
			for (let ry = 0; !child.children && ry < child.height; ry += c.receiverRows, row++) {
				const rowReceivers: CabinetReceiver[] = []
				for (let rx = 0; rx < child.width; rx += c.receiverColumns) {
					rowReceivers.push({
						id: ++receiverId,
						sender,
						cable: id,
						port,
						order: 0,
						x: x + rx,
						y: y + ry,
						width: Math.min(c.receiverColumns, child.width - rx),
						height: Math.min(c.receiverRows, child.height - ry),
					})
				}
				if (row % 2) rowReceivers.reverse()
				receivers.push(...rowReceivers)
			}
			receivers.forEach((receiver, index) => {
				receiver.order = index + 1
			})
			return { id, sender, port, x, y, width: child.width, height: child.height, receivers }
		})
		return { id: sender, x: tile.x, y: tile.y, width: tile.width, height: tile.height, cables }
	})
	return {
		configuration: { ...c },
		senders,
		cost: tiling.cost.slice() as CabinetCost,
		lowerBound: lowerBound.slice() as CabinetCost,
		moduleCount:
			Math.floor(c.screenWidth / c.moduleWidth) * Math.floor(c.screenHeight / c.moduleHeight),
		realSenderLoad: Math.min(c.senderMaxLoad, c.senderPorts * c.portLoad),
		isOptimal,
		provedPrefix: isOptimal ? 3 : context.provedPrefix,
		visitedStates: context.visitedStates,
		elapsedMs: performance.now() - start,
	}
}

/**
 * Progressively yields feasible layouts, then a certified global optimum.
 * No timeout/size cutoff substitutes a heuristic for the exact answer.
 * Run in a Worker; worst-case complete search is exponential.
 */
function* optimizeRows(c: CabinetConfiguration): Generator<CabinetProgress, CabinetSolution> {
	const error = getCabinetConfigurationError(c)
	if (error) throw new RangeError(error)
	const start = performance.now()
	const limits = gridLimits(c)
	const lowerBound = remainingBound(
		Array<number>(limits.width).fill(0),
		limits.height,
		limits,
		true,
	)
	// This cable bound is conditional on equality at the receiver bound, which
	// is sufficient for a lexicographic floor even before that equality is proved.
	lowerBound[2] = Math.max(lowerBound[2], saturatedReceiverCableBound(limits, lowerBound[1]))
	let stage: CabinetProgress['stage'] = 'constructing'
	const context: SearchContext = {
		visitedStates: 0,
		provedPrefix: 0,
		*checkpoint() {
			yield { stage, visitedStates: context.visitedStates }
		},
	}
	const seedCache = new Map<string, Tiling | null>()
	const getSeed = (w: number, h: number) => {
		const key = `${w},${h}`
		if (!seedCache.has(key)) seedCache.set(key, seedCables(w, h, limits))
		return seedCache.get(key)!
	}
	let seed: Tiling | null = null
	// Inspect larger areas first so a useful layout arrives early.
	const senderShapes: { width: number; height: number }[] = []
	for (let width = 1; width <= Math.min(limits.senderWidth, limits.senderArea); width++) {
		for (
			let height = 1;
			height <= Math.min(limits.senderHeight, Math.floor(limits.senderArea / width));
			height++
		)
			senderShapes.push({ width, height })
	}
	senderShapes.sort((a, b) => b.width * b.height - a.width * a.height)
	let bestPublished: CabinetCost = [Infinity, Infinity, Infinity]
	for (let index = 0; index < senderShapes.length; index++) {
		const { width, height } = senderShapes[index]
		const count = Math.ceil(limits.width / width) * Math.ceil(limits.height / height)
		if (seed && count > seed.cost[0]) continue
		const widths = new Set([width, limits.width % width].filter(Boolean))
		const heights = new Set([height, limits.height % height].filter(Boolean))
		let cost: CabinetCost = [count, 0, 0]
		let isFeasible = true
		for (const w of widths) {
			for (const h of heights) {
				const inner = getSeed(w, h)
				if (!inner) {
					isFeasible = false
					break
				}
				const copies =
					(w === width ? Math.floor(limits.width / width) : 1) *
					(h === height ? Math.floor(limits.height / height) : 1)
				cost = addCost(cost, [0, inner.cost[1] * copies, inner.cost[2] * copies])
			}
		}
		if (isFeasible && (!seed || compareCabinetCost(cost, seed.cost) < 0)) {
			seed = regularTiling(limits.width, limits.height, width, height, (w, h) => {
				const inner = getSeed(w, h)!
				return {
					width: w,
					height: h,
					cost: [1, inner.cost[1], inner.cost[2]],
					children: inner.tiles,
				}
			})!
		}
		if (seed && compareCabinetCost(seed.cost, bestPublished) < 0) {
			bestPublished = seed.cost
			yield {
				stage,
				visitedStates: 0,
				solution: materialize(c, seed, lowerBound, false, context, start),
			}
		}
		if (seed && compareCabinetCost(seed.cost, lowerBound) === 0) break
		if (index % 64 === 0) yield* context.checkpoint()
	}
	// 1 × 1 is in the enumeration and must be feasible after configuration validation.
	if (!seed) throw new Error('无法构造模组分区。')
	if (compareCabinetCost(seed.cost, lowerBound) === 0) {
		const solution = materialize(c, seed, lowerBound, true, context, start)
		yield { stage: 'complete', visitedStates: context.visitedStates, solution }
		return solution
	}
	stage = 'searching'
	const exactSender = createExactSender(limits, context, getSeed)
	const handleImprovement = (tiling: Tiling): CabinetProgress => ({
		stage,
		visitedStates: context.visitedStates,
		solution: materialize(c, tiling, lowerBound, false, context, start),
	})
	const estimateSender = (width: number, height: number): CabinetCost => {
		const inner = getSeed(width, height)
		// Only ordering, never a feasibility/pruning decision.
		return inner ? [1, inner.cost[1], inner.cost[2]] : [1, Infinity, Infinity]
	}
	let packingBound: PackingBound | null | undefined
	let packingSenderCount = lowerBound[0]
	let exactShapeCosts: SenderShapeCost[] | null = null
	// A bounded accelerator; skipped spectra leave the full geometric search intact.
	if (limits.senderArea <= 96 && senderShapes.length <= 512) {
		exactShapeCosts = []
		for (const shape of senderShapes) {
			const tile = yield* exactSender(shape.width, shape.height)
			if (tile) exactShapeCosts.push({ width: shape.width, height: shape.height, cost: tile.cost })
		}
		limits.senderArea = Math.max(...exactShapeCosts.map((shape) => shape.width * shape.height))
		lowerBound[0] = Math.max(
			lowerBound[0],
			Math.ceil((limits.width * limits.height) / limits.senderArea),
		)
		while (lowerBound[0] <= seed.cost[0]) {
			packingBound = yield* relaxedPackingBound(
				exactShapeCosts,
				limits.width * limits.height,
				lowerBound[0],
				limits.senderArea,
				context,
			)
			if (
				packingBound !== null &&
				(lowerBound[0] === seed.cost[0] ||
					!coloringInfeasible(
						exactShapeCosts.map((shape) => ({ ...shape, cost: [1, 0, 0] })),
						limits,
						lowerBound[0],
						Infinity,
						1,
						0,
					))
			)
				break
			lowerBound[0]++
		}
		packingSenderCount = lowerBound[0]
		yield handleImprovement(seed)
	}
	let hasMixedSeed = false
	if (seed.cost[0] > lowerBound[0]) {
		const mixed = yield* improveByCuts(
			limits.width,
			limits.height,
			limits,
			context,
			exactSender,
			seed.cost,
		)
		hasMixedSeed = !!mixed
		if (mixed && compareCabinetCost(mixed.cost, seed.cost) < 0) {
			seed = mixed
			yield handleImprovement(seed)
		}
	}
	let best = (yield* searchTiling(
		limits.width,
		limits.height,
		limits,
		true,
		seed,
		context,
		function* (width, height) {
			const inner = getSeed(width, height)
			return inner
				? { width, height, cost: [1, inner.cost[1], inner.cost[2]], children: inner.tiles }
				: yield* exactSender(width, height)
		},
		handleImprovement,
		estimateSender,
		{ onlySenders: true, stopWhen: (tiling) => tiling.cost[0] === lowerBound[0] },
	))!
	{
		// Either reached the bound or exhausted the sender-only search. Both prove S.
		lowerBound[0] = best.cost[0]
		context.provedPrefix = 1
		const sliceCertificates: SliceCertificate[] = []
		const failedTrials = new Map<string, CabinetCost>()
		const [minimumWidth, minimumHeight] = minimumSenderSides(limits, best.cost[0])
		const previousShapeCount = exactShapeCosts?.length
		if (exactShapeCosts)
			exactShapeCosts = exactShapeCosts.filter(
				(shape) => shape.width >= minimumWidth && shape.height >= minimumHeight,
			)
		if (
			exactShapeCosts &&
			(packingSenderCount !== best.cost[0] || exactShapeCosts.length !== previousShapeCount)
		)
			packingBound = yield* relaxedPackingBound(
				exactShapeCosts,
				limits.width * limits.height,
				best.cost[0],
				limits.senderArea,
				context,
			)
		const conditional = remainingBound(
			Array<number>(limits.width).fill(0),
			limits.height,
			limits,
			true,
			best.cost[0],
		)
		lowerBound[1] = Math.max(conditional[1], packingBound?.receiverFirst[1] ?? 0)
		lowerBound[2] = Math.max(conditional[2], packingBound?.minimumCables ?? 0)
		if (exactShapeCosts && lowerBound[1] < best.cost[1])
			lowerBound[1] = Math.max(
				lowerBound[1],
				resourceColoringBound(exactShapeCosts, limits, best.cost[0], 1),
			)
		if (exactShapeCosts && lowerBound[1] < best.cost[1])
			lowerBound[1] = Math.max(
				lowerBound[1],
				sliceResourceBound(exactShapeCosts, limits, best.cost[0], 1, undefined, sliceCertificates),
			)
		if (exactShapeCosts && lowerBound[1] < best.cost[1])
			lowerBound[1] = Math.max(
				lowerBound[1],
				projectedDeficitBound(exactShapeCosts, limits, best.cost[0]),
			)
		if (
			exactShapeCosts &&
			best.cost[1] - lowerBound[1] >= 3 &&
			projectionIntervalInfeasible(exactShapeCosts, limits, best.cost[0], best.cost[1] - 1)
		)
			lowerBound[1] = best.cost[1]
		yield handleImprovement(best)
		if (!hasMixedSeed && best.cost[1] - lowerBound[1] >= 2) {
			const improved = yield* improveByCuts(
				limits.width,
				limits.height,
				limits,
				context,
				exactSender,
				best.cost,
			)
			if (improved && compareCabinetCost(improved.cost, best.cost) < 0) {
				best = improved
				yield handleImprovement(best)
			}
		}
		function* hasColoringObstruction(
			resource: 1 | 2,
			budget: number,
			receivers: number,
		): Generator<CabinetProgress, boolean> {
			if (senderShapes.length > 512) return false
			const shapeCosts: SenderShapeCost[] = []
			// With S senders, every rectangle must carry at least A − (S−1)C.
			// Smaller shapes cannot occur in any candidate at this proven count.
			const minimumArea = limits.width * limits.height - (best!.cost[0] - 1) * limits.senderArea
			const receiverArea = limits.receiverArea
			for (const shape of senderShapes) {
				const area = shape.width * shape.height
				if (area < minimumArea) continue
				const minimumReceivers = Math.max(
					receiverCount(shape.width, shape.height, limits),
					capacityCount(area, limits.ports, limits.portArea, receiverArea),
				)
				if (
					minimumReceivers +
						capacityCount(
							limits.width * limits.height - area,
							best!.cost[0] - 1,
							limits.senderArea,
							receiverArea,
						) >
					receivers
				)
					continue
				const tile = yield* exactSender(shape.width, shape.height)
				if (tile) shapeCosts.push({ width: shape.width, height: shape.height, cost: tile.cost })
			}
			if (
				sideSumPackingInfeasible(
					shapeCosts,
					limits,
					best!.cost[0],
					receivers,
					resource === 2 ? budget : Infinity,
				)
			)
				return true
			if (best!.cost[0] * limits.senderArea - limits.width * limits.height > 64) return false
			if (coloringInfeasible(shapeCosts, limits, best!.cost[0], receivers, resource, budget))
				return true
			return yield* fixedCountSliceInfeasible(
				shapeCosts,
				limits,
				best!.cost[0],
				receivers,
				resource,
				budget,
				context,
			)
		}
		// Try the proven floor first: many layouts attain it. Then test once
		// whether the incumbent can improve at all. Its completed failure proves
		// optimality directly, avoiding repeated proofs at intermediate budgets.
		// If it succeeds, bisect larger remaining gaps as before.
		let receiverFloorTried = false
		let receiverUpperTried = false
		while (lowerBound[1] < best.cost[1]) {
			const gap = best.cost[1] - lowerBound[1]
			const probeUpper = receiverFloorTried && !receiverUpperTried && gap > 2
			const receivers = probeUpper
				? best.cost[1] - 1
				: lowerBound[1] + (receiverFloorTried && gap > 2 ? Math.floor((gap - 1) / 2) : 0)
			receiverUpperTried ||= probeUpper
			receiverFloorTried = true
			if (yield* hasColoringObstruction(1, receivers, receivers)) {
				lowerBound[1] = receivers + 1
				yield handleImprovement(best)
				continue
			}
			const trial = yield* searchTiling(
				limits.width,
				limits.height,
				limits,
				true,
				best,
				context,
				exactSender,
				handleImprovement,
				estimateSender,
				{
					ceiling: [best.cost[0], receivers + 1, 0],
					provedFloor: lowerBound.slice() as CabinetCost,
					packingBound,
					shapeCosts: exactShapeCosts,
					sliceCertificates,
					failedTrials,
					stopWhen: () => true,
				},
			)
			if (trial) {
				best = trial
				continue
			}
			lowerBound[1] = receivers + 1
			yield handleImprovement(best)
		}
		lowerBound[1] = best.cost[1]
		context.provedPrefix = 2
		const receiverRestrictions = senderReceiverRestrictions(limits, best.cost[0], best.cost[1])
		for (const restriction of receiverRestrictions) {
			if (restriction.transpose)
				limits.senderWidth = Math.min(limits.senderWidth, restriction.maximumHeight)
			else limits.senderHeight = Math.min(limits.senderHeight, restriction.maximumHeight)
		}
		if (exactShapeCosts && receiverRestrictions.length) {
			const [minimumW, minimumH] = minimumSenderSides(limits, best.cost[0])
			exactShapeCosts = exactShapeCosts.filter(
				(shape) =>
					shape.width >= minimumW &&
					shape.height >= minimumH &&
					receiverRestrictions.every((restriction) =>
						matchesReceiverRestriction(shape, restriction),
					),
			)
			packingBound = yield* relaxedPackingBound(
				exactShapeCosts,
				limits.width * limits.height,
				best.cost[0],
				Math.max(...exactShapeCosts.map((shape) => shape.width * shape.height)),
				context,
			)
		}
		lowerBound[2] = Math.max(lowerBound[2], saturatedReceiverCableBound(limits, best.cost[1]))
		if (packingBound?.receiverFirst[1] === best.cost[1])
			lowerBound[2] = Math.max(lowerBound[2], packingBound.receiverFirst[2])
		if (exactShapeCosts && lowerBound[2] < best.cost[2])
			lowerBound[2] = Math.max(
				lowerBound[2],
				resourceColoringBound(exactShapeCosts, limits, best.cost[0], 2),
			)
		if (exactShapeCosts && lowerBound[2] < best.cost[2])
			lowerBound[2] = Math.max(
				lowerBound[2],
				sliceResourceBound(exactShapeCosts, limits, best.cost[0], 2),
			)
		if (exactShapeCosts)
			for (const price of [1, 2]) {
				if (lowerBound[2] >= best.cost[2]) break
				lowerBound[2] = Math.max(
					lowerBound[2],
					sliceResourceBound(exactShapeCosts, limits, best.cost[0], 2, {
						price,
						count: best.cost[1],
					}),
				)
			}
		lowerBound[2] = cableBoundForReceivers(
			limits.width * limits.height,
			best.cost[1],
			lowerBound[2],
			best.cost[2],
			limits,
		)
		yield handleImprovement(best)
		let cableFloorTried = false
		let cableUpperTried = false
		while (lowerBound[2] < best.cost[2]) {
			const gap = best.cost[2] - lowerBound[2]
			const probeUpper = cableFloorTried && !cableUpperTried && gap > 2
			const cables = probeUpper
				? best.cost[2] - 1
				: lowerBound[2] + (cableFloorTried && gap > 2 ? Math.floor((gap - 1) / 2) : 0)
			cableUpperTried ||= probeUpper
			cableFloorTried = true
			if (yield* hasColoringObstruction(2, cables, best.cost[1])) {
				lowerBound[2] = cables + 1
				yield handleImprovement(best)
				continue
			}
			const trial = yield* searchTiling(
				limits.width,
				limits.height,
				limits,
				true,
				best,
				context,
				exactSender,
				handleImprovement,
				estimateSender,
				{
					ceiling: [best.cost[0], best.cost[1], cables + 1],
					provedFloor: lowerBound.slice() as CabinetCost,
					packingBound,
					shapeCosts: exactShapeCosts,
					sliceCertificates,
					failedTrials,
					stopWhen: () => true,
				},
			)
			if (trial) {
				best = trial
				continue
			}
			lowerBound[2] = cables + 1
			yield handleImprovement(best)
		}
	}
	lowerBound.splice(0, 3, ...best.cost)
	const solution = materialize(c, best, lowerBound, true, context, start)
	yield { stage: 'complete', visitedStates: context.visitedStates, solution }
	return solution
}

function balancedSquareFloor(receivers: number, senders: number) {
	if (!senders) return receivers ? Infinity : 0
	if (receivers < senders) return Infinity
	const base = Math.floor(receivers / senders)
	const remainder = receivers % senders
	return (senders - remainder) * base * base + remainder * (base + 1) * (base + 1)
}

export function getCabinetReceiverBalance(solution: CabinetSolution): CabinetReceiverBalance {
	if (solution.compact && solution.receiverBalance) return solution.receiverBalance
	const counts = solution.senders.map((sender) =>
		sender.cables.reduce((total, cable) => total + cable.receivers.length, 0),
	)
	return {
		counts,
		sumSquares: counts.reduce((total, count) => total + count * count, 0),
		lowerBound: balancedSquareFloor(solution.cost[1], solution.cost[0]),
		isOptimal: solution.receiverBalance?.isOptimal ?? false,
	}
}

type LayoutScore = [senders: number, receivers: number, squares: number, cables: number]
const compareLayoutScore = (a: LayoutScore, b: LayoutScore) =>
	a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]

/** Counts stay a three-item public tuple; balance precedes cable count in the objective. */
export function compareCabinetSolutions(a: CabinetSolution, b: CabinetSolution) {
	return compareLayoutScore(
		[a.cost[0], a.cost[1], getCabinetReceiverBalance(a).sumSquares, a.cost[2]],
		[b.cost[0], b.cost[1], getCabinetReceiverBalance(b).sumSquares, b.cost[2]],
	)
}

function tilingFromSolution(solution: CabinetSolution): Tiling {
	return {
		cost: [...solution.cost],
		tiles: solution.senders.map((sender) => ({
			...sender,
			cost: [
				1,
				sender.cables.reduce((sum, cable) => sum + cable.receivers.length, 0),
				sender.cables.length,
			],
			children: sender.cables.map((cable) => ({
				...cable,
				x: cable.x - sender.x,
				y: cable.y - sender.y,
				cost: [0, cable.receivers.length, 1],
				children: cable.receivers.map((receiver) => ({
					...receiver,
					x: receiver.x - cable.x,
					y: receiver.y - cable.y,
					cost: [0, 1, 0],
				})),
			})),
		})),
	}
}

function freeGridLimits(c: CabinetConfiguration): GridLimits {
	const limits = gridLimits(c)
	// A free cable's load is the sum of its receivers, not its bounding rectangle.
	limits.portArea = Math.min(
		Math.floor(c.portLoad / limits.moduleArea),
		Math.floor(c.senderMaxLoad / limits.moduleArea),
	)
	limits.senderArea = maximumRectangleArea(
		limits.senderWidth,
		limits.senderHeight,
		Math.min(Math.floor(c.senderMaxLoad / limits.moduleArea), limits.ports * limits.portArea),
	)
	limits.receiverArea = maximumRectangleArea(
		Math.min(limits.receiverWidth, limits.senderWidth),
		Math.min(limits.receiverHeight, limits.senderHeight),
		limits.portArea,
	)
	return limits
}

/** Positive shared edge; touching corners and gaps do not permit a cable hop. */
export function areCabinetReceiversAdjacent(a: GridRectangle, b: GridRectangle) {
	return (
		((a.x + a.width === b.x || b.x + b.width === a.x) &&
			Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height)) ||
		((a.y + a.height === b.y || b.y + b.height === a.y) &&
			Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width))
	)
}

/** Continuous snakes split by actual load, independent of old rectangular cable groups. */
function receiverSnakePaths(rectangles: GridRectangle[], capacity: number): number[][] {
	const areas = rectangles.map((r) => r.width * r.height)
	let best: number[][] | undefined
	for (const transpose of [false, true]) {
		const major = (i: number) => (transpose ? rectangles[i].x : rectangles[i].y)
		const minor = (i: number) => (transpose ? rectangles[i].y : rectangles[i].x)
		const bands = [...new Set(rectangles.map((_, i) => major(i)))].sort((a, b) => a - b)
		const order = rectangles
			.map((_, i) => i)
			.sort(
				(a, b) =>
					major(a) - major(b) ||
					(bands.indexOf(major(a)) % 2 ? minor(b) - minor(a) : minor(a) - minor(b)),
			)
		const groups: number[][] = []
		let load = 0
		for (const i of order) {
			const last = groups[groups.length - 1]
			if (
				!last ||
				load + areas[i] > capacity ||
				!areCabinetReceiversAdjacent(rectangles[last[last.length - 1]], rectangles[i])
			) {
				groups.push([i])
				load = areas[i]
			} else {
				last.push(i)
				load += areas[i]
			}
		}
		if (!best || groups.length < best.length) best = groups
	}
	return best ?? []
}

/** Exact capacitated path cover of the receiver adjacency graph. */
function* packReceiverPorts(
	rectangles: GridRectangle[],
	capacity: number,
	maximumPorts: number,
	context: SearchContext,
): Generator<CabinetProgress, GridRectangle[][] | null> {
	const areas = rectangles.map((r) => r.width * r.height)
	const total = areas.reduce((sum, area) => sum + area, 0)
	const floor = Math.ceil(total / capacity)
	if (floor > maximumPorts || areas.some((area) => area > capacity)) return null
	const n = rectangles.length
	const adjacent = rectangles.map((a, i) =>
		rectangles.flatMap((b, j) => (i !== j && areCabinetReceiversAdjacent(a, b) ? [j] : [])),
	)
	const best = receiverSnakePaths(rectangles, capacity)
	const materializeGroups = (groups: number[][]) =>
		groups.map((group) => group.map((i) => rectangles[i]))
	if (best!.length === floor) return materializeGroups(best!)
	const bits = rectangles.map((_, i) => 1n << BigInt(i))
	const all = (1n << BigInt(n)) - 1n
	for (let count = floor; count <= Math.min(maximumPorts, best!.length - 1); count++) {
		const failed = new Set<string>()
		const groups: number[][] = []
		function* cover(
			remaining: bigint,
			left: number,
			area: number,
		): Generator<CabinetProgress, boolean> {
			context.visitedStates++
			if (context.visitedStates % 256 === 0) yield* context.checkpoint()
			if (!remaining) return true
			if (!left || area > left * capacity) return false
			const key = `${remaining}/${left}`
			if (failed.has(key)) return false
			// Every disconnected residual component needs its own set of ports.
			let unseen = remaining
			let componentFloor = 0
			while (unseen) {
				let first = 0
				while (!(unseen & bits[first])) first++
				const stack = [first]
				unseen &= ~bits[first]
				let componentArea = 0
				while (stack.length) {
					const i = stack.pop()!
					componentArea += areas[i]
					for (const j of adjacent[i])
						if (unseen & bits[j]) {
							unseen &= ~bits[j]
							stack.push(j)
						}
				}
				componentFloor += Math.ceil(componentArea / capacity)
			}
			if (componentFloor > left) {
				failed.add(key)
				return false
			}
			const anchor = bits.findIndex((bit) => !!(remaining & bit))
			const seenPaths = new Set<string>()
			const triedGroups = new Set<bigint>()
			// Grow BOTH ends: the canonical anchor may be inside a feasible path.
			function* path(
				chain: number[],
				used: bigint,
				load: number,
			): Generator<CabinetProgress, boolean> {
				context.visitedStates++
				if (context.visitedStates % 256 === 0) yield* context.checkpoint()
				const head = chain[0],
					tail = chain[chain.length - 1]
				const pathKey = `${used}/${Math.min(head, tail)},${Math.max(head, tail)}`
				if (seenPaths.has(pathKey)) return false
				seenPaths.add(pathKey)
				for (const prepend of [false, true]) {
					if (prepend && head === tail) continue
					for (const next of adjacent[prepend ? head : tail]) {
						if (!(remaining & bits[next]) || used & bits[next] || load + areas[next] > capacity)
							continue
						const extended = prepend ? [next, ...chain] : [...chain, next]
						if (yield* path(extended, used | bits[next], load + areas[next])) return true
					}
				}
				if (!triedGroups.has(used) && area - load <= (left - 1) * capacity) {
					triedGroups.add(used)
					groups.push(chain)
					if (yield* cover(remaining ^ used, left - 1, area - load)) return true
					groups.pop()
				}
				return false
			}
			if (yield* path([anchor], bits[anchor], areas[anchor])) return true
			failed.add(key)
			return false
		}
		if (yield* cover(all, count, total)) return materializeGroups(groups)
	}
	return best!.length <= maximumPorts ? materializeGroups(best!) : null
}

function cableTiles(groups: GridRectangle[][]): Tile[] {
	return groups.map((group) => {
		const x = Math.min(...group.map((r) => r.x))
		const y = Math.min(...group.map((r) => r.y))
		const width = Math.max(...group.map((r) => r.x + r.width)) - x
		const height = Math.max(...group.map((r) => r.y + r.height)) - y
		// Preserve the proven adjacent path; coordinate sorting can introduce jumps.
		const ordered = group
		return {
			x,
			y,
			width,
			height,
			cost: [0, group.length, 1],
			children: ordered.map((r) => ({ ...r, x: r.x - x, y: r.y - y, cost: [0, 1, 0] })),
		}
	})
}

/** All receiver rectangles and adjacent port paths inside one rectangular sender. */
function createFreeSender(limits: GridLimits, context: SearchContext) {
	const cache = new Map<string, Omit<Tile, 'x' | 'y'>>()
	return function* exactSender(
		width: number,
		height: number,
	): Generator<CabinetProgress, Omit<Tile, 'x' | 'y'>> {
		const key = `${width},${height}`
		const cached = cache.get(key)
		if (cached) return cached
		const area = width * height
		const floorReceivers = Math.max(
			receiverCount(width, height, limits),
			Math.ceil(area / limits.receiverArea),
		)
		const floorPorts = Math.ceil(area / limits.portArea)
		let best: Omit<Tile, 'x' | 'y'> | undefined
		const record = (rectangles: GridRectangle[], groups: GridRectangle[][]) => {
			const cost: CabinetCost = [1, rectangles.length, groups.length]
			if (!best || compareCabinetCost(cost, best.cost) < 0)
				best = { width, height, cost, children: cableTiles(groups) }
		}
		const perfect = () => best?.cost[1] === floorReceivers && best.cost[2] === floorPorts
		// Seed with regular receiver grids; the complete search below may shrink every receiver independently.
		const shapes: { width: number; height: number }[] = []
		for (let w = 1; w <= Math.min(width, limits.receiverWidth, limits.portArea); w++)
			for (
				let h = 1;
				h <= Math.min(height, limits.receiverHeight, Math.floor(limits.portArea / w));
				h++
			)
				shapes.push({ width: w, height: h })
		shapes.sort(
			(a, b) =>
				Math.ceil(width / a.width) * Math.ceil(height / a.height) -
					Math.ceil(width / b.width) * Math.ceil(height / b.height) ||
				b.width * b.height - a.width * a.height,
		)
		for (const shape of shapes) {
			const count = Math.ceil(width / shape.width) * Math.ceil(height / shape.height)
			if (best && count > best.cost[1]) continue
			const grid = regularTiling(width, height, shape.width, shape.height, (w, h) => ({
				width: w,
				height: h,
				cost: [0, 1, 0],
			}))!
			const groups = yield* packReceiverPorts(grid.tiles, limits.portArea, limits.ports, context)
			if (groups) record(grid.tiles, groups)
			if (perfect()) break
		}
		const heights = Array<number>(width).fill(0)
		const path: GridRectangle[] = []
		function* visit(left: number): Generator<CabinetProgress, void> {
			context.visitedStates++
			if (context.visitedStates % 256 === 0) yield* context.checkpoint()
			if (perfect()) return
			if (!left) {
				const groups = yield* packReceiverPorts(path, limits.portArea, limits.ports, context)
				if (groups) record(path, groups)
				return
			}
			const bound = Math.max(
				Math.ceil(left / limits.receiverArea),
				sampleBound(heights, height, limits.receiverWidth, limits.receiverHeight),
			)
			if (best && path.length + bound > best.cost[1]) return
			// Equal area multisets can have different adjacency graphs: retain full geometry.
			const y = Math.min(...heights)
			const x = heights.indexOf(y)
			let run = 1
			while (x + run < width && heights[x + run] === y) run++
			for (const shape of shapes) {
				if (shape.width > run || y + shape.height > height) continue
				for (let i = x; i < x + shape.width; i++) heights[i] += shape.height
				path.push({ x, y, ...shape })
				yield* visit(left - shape.width * shape.height)
				path.pop()
				for (let i = x; i < x + shape.width; i++) heights[i] -= shape.height
				if (perfect()) return
			}
		}
		if (!perfect()) yield* visit(area)
		if (!best) throw new Error('无法构造自由网口分区。')
		cache.set(key, best)
		return best
	}
}

/** Complete outer rectangle search with additive receiver variance objective. */
function* optimizeBalancedLayout(
	c: CabinetConfiguration,
	mode: CabinetMode,
	initial: CabinetSolution,
	start: number,
	shard?: CabinetSearchShard,
): Generator<CabinetProgress, CabinetSolution> {
	const limits = mode === 'free' ? freeGridLimits(c) : gridLimits(c)
	const fixedCounts = mode === 'regular'
	const stage = fixedCounts ? 'balancing' : 'searching'
	const context: SearchContext = {
		visitedStates: initial.visitedStates,
		provedPrefix: fixedCounts ? 2 : 0,
		*checkpoint() {
			yield { stage, visitedStates: context.visitedStates }
		},
	}
	const getSender =
		mode === 'free' ? createFreeSender(limits, context) : createExactSender(limits, context)
	let best = tilingFromSolution(initial)
	if (mode === 'free') {
		// Even a count-optimal regular seed must be allowed to cross its old cable
		// boundaries. A valid equal-cost continuous path is preferred in free mode.
		best.tiles = best.tiles.map((sender) => {
			const receivers = sender.children!.flatMap((cable) =>
				cable.children!.map((receiver) => ({
					x: cable.x + receiver.x,
					y: cable.y + receiver.y,
					width: receiver.width,
					height: receiver.height,
				})),
			)
			const paths = receiverSnakePaths(receivers, limits.portArea)
			if (paths.length > sender.cost[2]) return sender
			const groups = paths.map((path) => path.map((i) => receivers[i]))
			return {
				...sender,
				cost: [1, receivers.length, groups.length] as CabinetCost,
				children: cableTiles(groups),
			}
		})
		best.cost[2] = best.tiles.reduce((sum, sender) => sum + sender.cost[2], 0)
	}
	const score = (tiling: Tiling): LayoutScore => [
		tiling.cost[0],
		tiling.cost[1],
		tiling.tiles.reduce((sum, tile) => sum + tile.cost[1] ** 2, 0),
		tiling.cost[2],
	]
	let bestScore = score(best)
	const area = limits.width * limits.height
	const senderFloor = fixedCounts
		? initial.cost[0]
		: Math.max(
				Math.ceil(area / limits.senderArea),
				Math.ceil(limits.width / limits.senderWidth) *
					Math.ceil(limits.height / limits.senderHeight),
			)
	const receiverFloor = fixedCounts
		? initial.cost[1]
		: Math.max(
				senderFloor,
				receiverCount(limits.width, limits.height, limits),
				Math.ceil(area / limits.receiverArea),
			)
	const cableFloor = fixedCounts
		? initial.lowerBound[2]
		: Math.max(senderFloor, Math.ceil(area / limits.portArea))
	const globalFloor: LayoutScore = [
		senderFloor,
		receiverFloor,
		balancedSquareFloor(receiverFloor, senderFloor),
		cableFloor,
	]
	const snapshot = (complete: boolean): CabinetSolution => {
		context.provedPrefix = fixedCounts
			? 2
			: best.cost[0] === senderFloor
				? best.cost[1] === receiverFloor
					? 2
					: 1
				: 0
		const result = materialize(
			c,
			best,
			complete ? best.cost : [senderFloor, receiverFloor, cableFloor],
			complete,
			context,
			start,
		)
		result.mode = mode
		result.receiverBalance = { ...getCabinetReceiverBalance(result), isOptimal: complete }
		return result
	}
	const heights = Array<number>(limits.width).fill(0)
	const path: Tile[] = []
	const memo = new Map<string, LayoutScore>()
	const shapes: { width: number; height: number; area: number }[] = []
	for (let w = 1; w <= Math.min(limits.width, limits.senderWidth, limits.senderArea); w++)
		for (
			let h = 1;
			h <= Math.min(limits.height, limits.senderHeight, Math.floor(limits.senderArea / w));
			h++
		)
			shapes.push({ width: w, height: h, area: w * h })
	const targetArea = area / best.cost[0]
	shapes.sort((a, b) =>
		fixedCounts
			? Math.abs(a.area - targetArea) - Math.abs(b.area - targetArea) || b.area - a.area
			: b.area - a.area,
	)
	const perfect = () => compareLayoutScore(bestScore, globalFloor) === 0
	function* visit(prefix: LayoutScore, left: number): Generator<CabinetProgress, void> {
		context.visitedStates++
		if (context.visitedStates % 256 === 0) yield* context.checkpoint()
		if (perfect()) return
		if (!left) {
			if (fixedCounts && (prefix[0] !== senderFloor || prefix[1] !== receiverFloor)) return
			if (compareLayoutScore(prefix, bestScore) < 0) {
				bestScore = prefix
				best = { tiles: path.slice(), cost: [prefix[0], prefix[1], prefix[3]] }
				yield { stage, visitedStates: context.visitedStates, solution: snapshot(false) }
			}
			return
		}
		const senders = Math.max(
			Math.ceil(left / limits.senderArea),
			sampleBound(heights, limits.height, limits.senderWidth, limits.senderHeight),
		)
		const receivers = Math.max(
			Math.ceil(left / limits.receiverArea),
			sampleBound(heights, limits.height, limits.receiverWidth, limits.receiverHeight),
		)
		const minS = fixedCounts ? senderFloor : Math.max(senderFloor, prefix[0] + senders)
		const minR = Math.max(fixedCounts ? receiverFloor : 0, prefix[1] + receivers)
		if (prefix[0] + senders > bestScore[0] || minS > bestScore[0]) return
		if (minS === bestScore[0] && minR > bestScore[1]) return
		if (minS === bestScore[0] && minR === bestScore[1]) {
			const squareFloor =
				prefix[2] + balancedSquareFloor(bestScore[1] - prefix[1], bestScore[0] - prefix[0])
			const portFloor = prefix[3] + Math.max(senders, Math.ceil(left / limits.portArea))
			if (squareFloor > bestScore[2] || (squareFloor === bestScore[2] && portFloor >= bestScore[3]))
				return
		}
		const components = skylineComponents(heights, limits.height)
		const key = `${canonicalSkylineKey(heights, limits.height, components)}/${fixedCounts ? `${prefix[0]},${prefix[1]}` : ''}`
		const previous = memo.get(key)
		if (previous && compareLayoutScore(previous, prefix) <= 0) return
		// Eviction only removes pruning opportunities; it never changes feasibility.
		if (memo.size >= 50000) memo.clear()
		memo.set(key, prefix)
		const y = Math.min(...heights)
		const x = heights.indexOf(y)
		let run = 1
		while (x + run < limits.width && heights[x + run] === y) run++
		for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
			if (!path.length && shard && shapeIndex % shard.count !== shard.index) continue
			const shape = shapes[shapeIndex]
			if (shape.width > run || y + shape.height > limits.height) continue
			if (left - shape.area > (bestScore[0] - prefix[0] - 1) * limits.senderArea) continue
			const cheapReceivers = Math.max(
				receiverCount(shape.width, shape.height, limits),
				Math.ceil(shape.area / limits.receiverArea),
			)
			if (
				minS === bestScore[0] &&
				prefix[1] + cheapReceivers + Math.ceil((left - shape.area) / limits.receiverArea) >
					bestScore[1]
			)
				continue
			const tile = yield* getSender(shape.width, shape.height)
			if (!tile) continue
			for (let i = x; i < x + shape.width; i++) heights[i] += shape.height
			path.push({ ...tile, x, y })
			yield* visit(
				[
					prefix[0] + 1,
					prefix[1] + tile.cost[1],
					prefix[2] + tile.cost[1] ** 2,
					prefix[3] + tile.cost[2],
				],
				left - shape.area,
			)
			path.pop()
			for (let i = x; i < x + shape.width; i++) heights[i] -= shape.height
			if (perfect()) return
		}
	}
	yield { stage, visitedStates: context.visitedStates, solution: snapshot(false) }
	if (!perfect()) yield* visit([0, 0, 0, 0], area)
	const solution = snapshot(!shard || shard.count === 1 || perfect())
	yield { stage: 'complete', visitedStates: context.visitedStates, solution }
	return solution
}

function* optimizeModeRows(
	c: CabinetConfiguration,
	mode: CabinetMode,
	shard?: CabinetSearchShard,
): Generator<CabinetProgress, CabinetSolution> {
	const start = performance.now()
	const kernel = optimizeRows(c)
	let initial: CabinetSolution | undefined
	let incumbent: CabinetSolution | undefined
	for (const progress of kernel) {
		if (progress.solution) {
			initial = progress.solution
			if (!incumbent || compareCabinetSolutions(initial, incumbent) < 0) incumbent = initial
		}
		if (mode === 'free' && initial) break // A regular layout is a valid, prompt free-mode incumbent.
		if (progress.stage === 'complete') break
		const solution = progress.solution &&
			incumbent && {
				...incumbent,
				mode,
				lowerBound: initial!.lowerBound,
				provedPrefix: initial!.provedPrefix,
				receiverBalance: getCabinetReceiverBalance(incumbent),
			}
		yield { ...progress, solution }
	}
	if (!initial || !incumbent) throw new Error('无法构造初始方案。')
	return yield* optimizeBalancedLayout(
		c,
		mode,
		{ ...incumbent, lowerBound: initial.lowerBound },
		start,
		shard,
	)
}

export type CabinetDirection = 'row' | 'column'

export type CabinetProgressPair = Record<CabinetDirection, CabinetProgress | null>

/**
 * Row/column runs share one feasible set and objective; only their tie-breaking differs.
 * Once either run proves the global cost, an equal-cost peer layout inherits that proof.
 */
export function shareCabinetOptimality(progress: CabinetProgressPair): {
	progress: CabinetProgressPair
	promoted: CabinetDirection[]
} {
	const proven = progress.row?.solution?.isOptimal
		? progress.row.solution
		: progress.column?.solution?.isOptimal
			? progress.column.solution
			: undefined
	if (!proven) return { progress, promoted: [] }

	let next = progress
	const promoted: CabinetDirection[] = []
	for (const direction of ['row', 'column'] as const) {
		const entry = progress[direction]
		if (
			!entry?.solution ||
			entry.solution.isOptimal ||
			(entry.solution.mode ?? 'regular') !== (proven.mode ?? 'regular') ||
			Object.keys(proven.configuration).some(
				(key) =>
					entry.solution!.configuration[key as keyof CabinetConfiguration] !==
					proven.configuration[key as keyof CabinetConfiguration],
			) ||
			(proven.receiverBalance
				? compareCabinetSolutions(entry.solution, proven)
				: compareCabinetCost(entry.solution.cost, proven.cost))
		)
			continue
		if (next === progress) next = { ...progress }
		next[direction] = {
			...entry,
			stage: 'complete',
			solution: {
				...entry.solution,
				lowerBound: [...entry.solution.cost],
				isOptimal: true,
				provedPrefix: 3,
				receiverBalance: proven.receiverBalance
					? { ...getCabinetReceiverBalance(entry.solution), isOptimal: true }
					: undefined,
				elapsedMs: Math.max(entry.solution.elapsedMs, proven.elapsedMs),
			},
		}
		promoted.push(direction)
	}
	return { progress: next, promoted }
}

function transposeSolution(
	solution: CabinetSolution,
	configuration: CabinetConfiguration,
): CabinetSolution {
	const flip = (rectangle: GridRectangle): GridRectangle => ({
		x: rectangle.y,
		y: rectangle.x,
		width: rectangle.height,
		height: rectangle.width,
	})
	return {
		...solution,
		configuration: { ...configuration },
		senders: solution.senders.map((sender) => ({
			...sender,
			...flip(sender),
			cables: sender.cables.map((cable) => ({
				...cable,
				...flip(cable),
				receivers: cable.receivers.map((receiver) => ({ ...receiver, ...flip(receiver) })),
			})),
		})),
	}
}

/** Direction changes layout tie-breaking and the center-to-center snake orientation, never objective priority. */
function* optimizeInDirection(
	c: CabinetConfiguration,
	direction: CabinetDirection,
	run: (configuration: CabinetConfiguration) => Generator<CabinetProgress, CabinetSolution>,
): Generator<CabinetProgress, CabinetSolution> {
	if (direction === 'row') return yield* run(c)
	const flipped: CabinetConfiguration = {
		...c,
		screenWidth: c.screenHeight,
		screenHeight: c.screenWidth,
		moduleWidth: c.moduleHeight,
		moduleHeight: c.moduleWidth,
		receiverColumns: c.receiverRows,
		receiverRows: c.receiverColumns,
		senderMaxWidth: c.senderMaxHeight,
		senderMaxHeight: c.senderMaxWidth,
	}
	const generator = run(flipped)
	while (true) {
		const step = generator.next()
		if (step.done) return transposeSolution(step.value, c)
		yield {
			...step.value,
			solution: step.value.solution ? transposeSolution(step.value.solution, c) : undefined,
		}
	}
}

/** Existing three-count kernel, retained for count proofs and independent regression oracles. */
export function optimizeCabinetCounts(
	c: CabinetConfiguration,
	direction: CabinetDirection = 'row',
) {
	return optimizeInDirection(c, direction, optimizeRows)
}

export function optimizeCabinet(
	c: CabinetConfiguration,
	direction: CabinetDirection = 'row',
	mode: CabinetMode = 'regular',
	shard?: CabinetSearchShard,
) {
	if (mode !== 'regular' && mode !== 'free') throw new RangeError('未知接线模式。')
	if (
		shard &&
		(!Number.isSafeInteger(shard.count) ||
			shard.count < 1 ||
			!Number.isSafeInteger(shard.index) ||
			shard.index < 0 ||
			shard.index >= shard.count)
	)
		throw new RangeError('无效的搜索分片。')
	return optimizeInDirection(c, direction, (configuration) =>
		optimizeModeRows(configuration, mode, shard),
	)
}

/** A shard's complete stage proves only its own branches unless it attained a global bound. */
export function mergeCabinetShards(shards: (CabinetProgress | null)[]): CabinetProgress {
	const entries = shards.filter((entry): entry is CabinetProgress => !!entry)
	let best: CabinetSolution | undefined
	for (const entry of entries) {
		const candidate = entry.solution
		if (
			candidate &&
			(!best ||
				compareCabinetSolutions(candidate, best) < 0 ||
				(compareCabinetSolutions(candidate, best) === 0 && candidate.isOptimal))
		)
			best = candidate
	}
	const isComplete =
		!!best &&
		(best.isOptimal || (shards.length > 0 && shards.every((entry) => entry?.stage === 'complete')))
	const isRecommended = !!best?.compact && shards.every((entry) => entry?.stage === 'recommended')
	const visitedStates = entries.reduce((sum, entry) => sum + entry.visitedStates, 0)
	const solution =
		best && isComplete && !best.isOptimal
			? {
					...best,
					isOptimal: true,
					provedPrefix: 3,
					lowerBound: [...best.cost] as CabinetCost,
					receiverBalance: { ...getCabinetReceiverBalance(best), isOptimal: true },
					visitedStates,
				}
			: best
	return {
		stage: isComplete
			? 'complete'
			: isRecommended ? 'recommended' : best?.compact ? 'constructing'
			: (entries.find((entry) => entry.stage !== 'complete')?.stage ?? 'searching'),
		visitedStates,
		solution,
	}
}

/** Independent structural audit used by consumers and tests. Rectangles are in module units. */
export function validateCabinetSolution(solution: CabinetSolution): string[] {
	const errors: string[] = []
	const c = solution.configuration
	const configurationError = getCabinetConfigurationError(c)
	if (configurationError) return [configurationError]
	const limits = solution.mode === 'free' ? freeGridLimits(c) : gridLimits(c)
	const auditPartition = (parent: GridRectangle, children: GridRectangle[], label: string) => {
		let area = 0
		for (let index = 0; index < children.length; index++) {
			const child = children[index]
			if (
				![child.x, child.y, child.width, child.height].every(Number.isSafeInteger) ||
				child.width <= 0 ||
				child.height <= 0 ||
				child.x < parent.x ||
				child.y < parent.y ||
				child.x + child.width > parent.x + parent.width ||
				child.y + child.height > parent.y + parent.height
			)
				errors.push(`${label}: 越界或非整数尺寸`)
			area += child.width * child.height
			for (const other of children.slice(0, index))
				if (
					child.x < other.x + other.width &&
					other.x < child.x + child.width &&
					child.y < other.y + other.height &&
					other.y < child.y + child.height
				)
					errors.push(`${label}: 重叠`)
		}
		if (area !== parent.width * parent.height) errors.push(`${label}: 未完整覆盖`)
	}
	auditPartition(
		{ x: 0, y: 0, width: limits.width, height: limits.height },
		solution.senders,
		'显示屏',
	)
	let receivers = 0
	let cables = 0
	const receiverIds = new Set<number>()
	for (const [senderIndex, sender] of solution.senders.entries()) {
		if (sender.id !== senderIndex + 1) errors.push('发送卡编号不连续')
		if (
			sender.width > limits.senderWidth ||
			sender.height > limits.senderHeight ||
			sender.width * sender.height > limits.senderArea ||
			sender.cables.length > c.senderPorts
		)
			errors.push('发送卡超限')
		if (solution.mode === 'free')
			auditPartition(
				sender,
				sender.cables.flatMap((cable) => cable.receivers),
				'发送卡',
			)
		else auditPartition(sender, sender.cables, '发送卡')
		for (const [portIndex, cable] of sender.cables.entries()) {
			cables++
			const load =
				solution.mode === 'free'
					? cable.receivers.reduce((sum, receiver) => sum + receiver.width * receiver.height, 0)
					: cable.width * cable.height
			if (load > limits.portArea) errors.push('网口带载超限')
			if (cable.id !== cables || cable.sender !== sender.id || cable.port !== portIndex + 1)
				errors.push('网线编号错误')
			if (solution.mode !== 'free') auditPartition(cable, cable.receivers, '网线')
			else if (
				!cable.receivers.length ||
				cable.x !== Math.min(...cable.receivers.map((r) => r.x)) ||
				cable.y !== Math.min(...cable.receivers.map((r) => r.y)) ||
				cable.x + cable.width !== Math.max(...cable.receivers.map((r) => r.x + r.width)) ||
				cable.y + cable.height !== Math.max(...cable.receivers.map((r) => r.y + r.height))
			)
				errors.push('自由网线范围错误')
			for (const [index, receiver] of cable.receivers.entries()) {
				receivers++
				if (
					solution.mode === 'free' &&
					index > 0 &&
					!areCabinetReceiversAdjacent(cable.receivers[index - 1], receiver)
				)
					errors.push('自由网线必须连接共享边的相邻接收卡')
				if (receiver.width > c.receiverColumns || receiver.height > c.receiverRows)
					errors.push('接收卡尺寸超限')
				if (
					receiver.sender !== sender.id ||
					receiver.cable !== cable.id ||
					receiver.port !== cable.port ||
					receiver.order !== index + 1 ||
					receiverIds.has(receiver.id)
				)
					errors.push('接收卡编号错误')
				receiverIds.add(receiver.id)
			}
		}
	}
	if (compareCabinetCost(solution.cost, [solution.senders.length, receivers, cables]))
		errors.push('统计错误')
	if (
		solution.moduleCount !== limits.width * limits.height ||
		solution.realSenderLoad !== Math.min(c.senderMaxLoad, c.senderPorts * c.portLoad)
	)
		errors.push('模组或带载统计错误')
	if (
		!Number.isInteger(solution.provedPrefix) ||
		solution.provedPrefix < 0 ||
		solution.provedPrefix > 3 ||
		solution.isOptimal !== (solution.provedPrefix === 3) ||
		compareCabinetCost(solution.lowerBound, solution.cost) > 0 ||
		solution.lowerBound.some(
			(value, index) => index < solution.provedPrefix && value !== solution.cost[index],
		)
	)
		errors.push('最优证明状态错误')
	if (solution.receiverBalance) {
		const balance = getCabinetReceiverBalance(solution)
		if (
			balance.sumSquares !== solution.receiverBalance.sumSquares ||
			balance.lowerBound !== solution.receiverBalance.lowerBound ||
			balance.counts.join(',') !== solution.receiverBalance.counts.join(',') ||
			balance.isOptimal !== solution.isOptimal
		)
			errors.push('接收卡均衡统计或证明错误')
	}
	return errors
}
