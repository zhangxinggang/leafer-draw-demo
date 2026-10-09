import type {
	CabinetConfiguration,
	CabinetDirection,
	CabinetMode,
	CabinetReceiver,
	CabinetReceiverBalance,
	CabinetSearchShard,
	CabinetSolution,
	GridRectangle,
} from './index'

/** Rectangles are implicit Cartesian products of nested, clipped one-dimensional partitions. */
export interface CabinetCompactLayout {
	kind: 'repeated-rectangles'
	direction: CabinetDirection
	width: number
	height: number
	senderWidth: number
	senderHeight: number
	cableWidth: number
	cableHeight: number
	receiverWidth: number
	receiverHeight: number
}

export interface CabinetDeviceSummary extends GridRectangle {
	id: number
	receiverCount: number
	load: number
}

export interface CabinetCableSummary extends CabinetDeviceSummary {
	sender: number
	port: number
}

export interface CabinetSenderSummary extends CabinetDeviceSummary {
	cableCount: number
}

function pixelRect(c: CabinetConfiguration, rect: GridRectangle): GridRectangle {
	const position = (index: number, screen: number, module: number) => {
		const last = Math.floor(screen / module) - 1
		const start = last * module
		return c.isSmartCompletion && index > last ? start + (index - last) * (screen - start) : index * module
	}
	const x = (value: number) => position(value, c.screenWidth, c.moduleWidth)
	const y = (value: number) => position(value, c.screenHeight, c.moduleHeight)
	return { x: x(rect.x), y: y(rect.y), width: x(rect.x + rect.width) - x(rect.x), height: y(rect.y + rect.height) - y(rect.y) }
}

function receiverSize(c: CabinetConfiguration) {
	return {
		width: c.receiverWidth ?? c.receiverColumns * c.moduleWidth,
		height: c.receiverHeight ?? c.receiverRows * c.moduleHeight,
	}
}

export function cabinetAxisCount(length: number, spans: number[]): number {
	if (length <= 0) return 0
	if (!spans.length) return 1
	const [span, ...rest] = spans
	return (
		Math.floor(length / span) * cabinetAxisCount(span, rest) + cabinetAxisCount(length % span, rest)
	)
}

export function cabinetAxisCell(
	index: number,
	length: number,
	spans: number[],
): { start: number; size: number } {
	if (!spans.length) return { start: 0, size: length }
	const [span, ...rest] = spans
	const perBlock = cabinetAxisCount(span, rest)
	const block = Math.floor(index / perBlock)
	const start = block * span
	const child = cabinetAxisCell(index - block * perBlock, Math.min(span, length - start), rest)
	return { start: start + child.start, size: child.size }
}

export function cabinetAxisIndex(position: number, length: number, spans: number[]): number {
	if (!spans.length) return 0
	const [span, ...rest] = spans
	// All boundaries are integers; subtract one module to keep the right edge in the final cell.
	const block = Math.floor(Math.max(0, Math.min(length - 1, position)) / span)
	return (
		block * cabinetAxisCount(span, rest) +
		cabinetAxisIndex(position - block * span, Math.min(span, length - block * span), rest)
	)
}

export function cabinetAxisSizes(length: number, spans: number[]): Map<number, number> {
	if (!length) return new Map()
	if (!spans.length) return new Map([[length, 1]])
	const [span, ...rest] = spans
	const copies = Math.floor(length / span)
	const result = new Map<number, number>()
	if (copies)
		for (const [size, count] of cabinetAxisSizes(span, rest)) result.set(size, count * copies)
	for (const [size, count] of cabinetAxisSizes(length % span, rest))
		result.set(size, (result.get(size) ?? 0) + count)
	return result
}

/** Size classes include the enlarged final cell without expanding the repeated layout. */
export function cabinetAxisPixelSizes(length: number, spans: number[], module: number, screen: number, complete = false) {
	const result = new Map<number, number>()
	for (const [size, count] of cabinetAxisSizes(length, spans)) result.set(size * module, count)
	const remainder = complete ? screen - length * module : 0
	if (remainder) {
		const last = cabinetAxisCell(cabinetAxisCount(length, spans) - 1, length, spans).size * module
		const count = result.get(last)!
		if (count === 1) result.delete(last)
		else result.set(last, count - 1)
		result.set(last + remainder, (result.get(last + remainder) ?? 0) + 1)
	}
	return result
}

export function hasCabinetCompletion(c: CabinetConfiguration) {
	return !!c.isSmartCompletion && (c.screenWidth % c.moduleWidth !== 0 || c.screenHeight % c.moduleHeight !== 0)
}

function pixelSizeClasses(c: CabinetConfiguration, l: CabinetCompactLayout, level: 'sender' | 'cable' | 'receiver') {
	const axes = compactAxes(l, level)
	return {
		x: cabinetAxisPixelSizes(l.width, axes.x, c.moduleWidth, c.screenWidth, c.isSmartCompletion),
		y: cabinetAxisPixelSizes(l.height, axes.y, c.moduleHeight, c.screenHeight, c.isSmartCompletion),
	}
}

export function compactAxes(layout: CabinetCompactLayout, level: 'sender' | 'cable' | 'receiver') {
	const count = level === 'sender' ? 1 : level === 'cable' ? 2 : 3
	return {
		x: [layout.senderWidth, layout.cableWidth, layout.receiverWidth].slice(0, count),
		y: [layout.senderHeight, layout.cableHeight, layout.receiverHeight].slice(0, count),
	}
}

function compactRectangle(
	layout: CabinetCompactLayout,
	level: 'sender' | 'cable' | 'receiver',
	index: number,
) {
	const axes = compactAxes(layout, level)
	const columns = cabinetAxisCount(layout.width, axes.x)
	const x = cabinetAxisCell(index % columns, layout.width, axes.x)
	const y = cabinetAxisCell(Math.floor(index / columns), layout.height, axes.y)
	return { x: x.start, y: y.start, width: x.size, height: y.size }
}

function compactIndex(
	layout: CabinetCompactLayout,
	level: 'sender' | 'cable' | 'receiver',
	x: number,
	y: number,
) {
	const axes = compactAxes(layout, level)
	return (
		cabinetAxisIndex(y, layout.height, axes.y) * cabinetAxisCount(layout.width, axes.x) +
		cabinetAxisIndex(x, layout.width, axes.x)
	)
}

export function getCompactSender(solution: CabinetSolution, index: number): CabinetSenderSummary {
	const l = solution.compact!
	const rect = compactRectangle(l, 'sender', index)
	const pixels = pixelRect(solution.configuration, rect)
	return {
		...rect,
		id: index + 1,
		cableCount: Math.ceil(rect.width / l.cableWidth) * Math.ceil(rect.height / l.cableHeight),
		receiverCount:
			cabinetAxisCount(rect.width, [l.cableWidth, l.receiverWidth]) *
			cabinetAxisCount(rect.height, [l.cableHeight, l.receiverHeight]),
		load: pixels.width * pixels.height,
	}
}

export function getCompactCable(solution: CabinetSolution, index: number): CabinetCableSummary {
	const l = solution.compact!
	const rect = compactRectangle(l, 'cable', index)
	const pixels = pixelRect(solution.configuration, rect)
	const senderIndex = compactIndex(l, 'sender', rect.x, rect.y)
	const sender = compactRectangle(l, 'sender', senderIndex)
	return {
		...rect,
		id: index + 1,
		sender: senderIndex + 1,
		port:
			Math.floor((rect.y - sender.y) / l.cableHeight) * Math.ceil(sender.width / l.cableWidth) +
			Math.floor((rect.x - sender.x) / l.cableWidth) +
			1,
		receiverCount:
			Math.ceil(rect.width / l.receiverWidth) * Math.ceil(rect.height / l.receiverHeight),
		load: pixels.width * pixels.height,
	}
}

export function getCompactReceiver(solution: CabinetSolution, index: number): CabinetReceiver {
	const l = solution.compact!
	const rect = compactRectangle(l, 'receiver', index)
	const cable = getCompactCable(solution, compactIndex(l, 'cable', rect.x, rect.y))
	const col = Math.floor((rect.x - cable.x) / l.receiverWidth)
	const row = Math.floor((rect.y - cable.y) / l.receiverHeight)
	const cols = Math.ceil(cable.width / l.receiverWidth)
	const rows = Math.ceil(cable.height / l.receiverHeight)
	const order =
		l.direction === 'row'
			? row * cols + (row % 2 ? cols - col : col + 1)
			: col * rows + (col % 2 ? rows - row : row + 1)
	return { ...rect, id: index + 1, sender: cable.sender, cable: cable.id, port: cable.port, order }
}

export function findCompactReceiver(
	solution: CabinetSolution,
	x: number,
	y: number,
): CabinetReceiver | undefined {
	const l = solution.compact!
	if (x < 0 || y < 0 || x >= l.width || y >= l.height) return undefined
	return getCompactReceiver(solution, compactIndex(l, 'receiver', x, y))
}

export function compactReceiverAtOrder(
	solution: CabinetSolution,
	cable: CabinetCableSummary,
	order: number,
): CabinetReceiver | undefined {
	if (order < 1 || order > cable.receiverCount) return undefined
	const l = solution.compact!
	const cols = Math.ceil(cable.width / l.receiverWidth)
	const rows = Math.ceil(cable.height / l.receiverHeight)
	let col: number
	let row: number
	if (l.direction === 'row') {
		row = Math.floor((order - 1) / cols)
		col = row % 2 ? cols - 1 - ((order - 1) % cols) : (order - 1) % cols
	} else {
		col = Math.floor((order - 1) / rows)
		row = col % 2 ? rows - 1 - ((order - 1) % rows) : (order - 1) % rows
	}
	return findCompactReceiver(
		solution,
		cable.x + col * l.receiverWidth,
		cable.y + row * l.receiverHeight,
	)
}

export function getCompactReceiverTypes(layout: CabinetCompactLayout, configuration?: CabinetConfiguration) {
	if (configuration) {
		const axes = pixelSizeClasses(configuration, layout, 'receiver')
		const result: { width: number; height: number; count: number }[] = []
		for (const [width, cols] of axes.x)
			for (const [height, rows] of axes.y) result.push({ width, height, count: cols * rows })
		return result
	}
	const axes = compactAxes(layout, 'receiver')
	const result: { width: number; height: number; count: number }[] = []
	for (const [width, cols] of cabinetAxisSizes(layout.width, axes.x))
		for (const [height, rows] of cabinetAxisSizes(layout.height, axes.y))
			result.push({ width, height, count: cols * rows })
	return result
}

/** Each sample represents a contiguous interval of real cells, never a truncated dataset. */
export function sampleCabinetAxis(
	length: number,
	spans: number[],
	from: number,
	to: number,
	budget: number,
) {
	if (to < 0 || from >= length || to <= from) return []
	const count = cabinetAxisCount(length, spans)
	const first = Math.max(0, cabinetAxisIndex(Math.max(0, from), length, spans) - 1)
	const last = Math.min(count - 1, cabinetAxisIndex(Math.min(length, to), length, spans) + 1)
	const step = Math.max(1, Math.ceil((last - first + 1) / Math.max(1, budget)))
	const result: { start: number; size: number; index: number; count: number; cellSize: number }[] =
		[]
	for (let index = first; index <= last; index += step) {
		const cell = cabinetAxisCell(index, length, spans)
		const endIndex = Math.min(last, index + step - 1)
		const end = cabinetAxisCell(endIndex, length, spans)
		result.push({
			start: cell.start,
			size: end.start + end.size - cell.start,
			index,
			count: endIndex - index + 1,
			cellSize: cell.size,
		})
	}
	return result
}

function balance(
	layout: CabinetCompactLayout,
	receivers: number,
	senders: number,
): CabinetReceiverBalance {
	const distribution: { receivers: number; senders: number }[] = []
	for (const [width, cols] of cabinetAxisSizes(layout.width, [layout.senderWidth]))
		for (const [height, rows] of cabinetAxisSizes(layout.height, [layout.senderHeight])) {
			const count =
				cabinetAxisCount(width, [layout.cableWidth, layout.receiverWidth]) *
				cabinetAxisCount(height, [layout.cableHeight, layout.receiverHeight])
			distribution.push({ receivers: count, senders: cols * rows })
		}
	const base = Math.floor(receivers / senders)
	const remainder = receivers % senders
	return {
		counts: [],
		distribution,
		sumSquares: distribution.reduce((sum, item) => sum + item.receivers ** 2 * item.senders, 0),
		lowerBound: (senders - remainder) * base ** 2 + remainder * (base + 1) ** 2,
		isOptimal: false,
	}
}

export function createCompactSolution(
	c: CabinetConfiguration,
	layout: CabinetCompactLayout,
	mode: CabinetMode = 'regular',
): CabinetSolution {
	const total = (level: 'sender' | 'cable' | 'receiver') => {
		const axes = compactAxes(layout, level)
		return cabinetAxisCount(layout.width, axes.x) * cabinetAxisCount(layout.height, axes.y)
	}
	const senders = total('sender')
	const receivers = total('receiver')
	return {
		configuration: { ...c },
		compact: layout,
		mode,
		senders: [],
		cost: [senders, receivers, total('cable')],
		moduleCount: layout.width * layout.height,
		receiverBalance: balance(layout, receivers, senders),
		realSenderLoad: Math.min(c.senderMaxLoad, c.senderPorts * c.portLoad),
		lowerBound: [1, 1, 1],
		isOptimal: false,
		provedPrefix: 0,
		visitedStates: 0,
		elapsedMs: 0,
	}
}

/** A strategy switch, never an input/renderer limit. Geometry stays in real module units. */
export function usesCompactCabinet(c: CabinetConfiguration) {
	const width = Math.floor(c.screenWidth / c.moduleWidth)
	const height = Math.floor(c.screenHeight / c.moduleHeight)
	return hasCabinetCompletion(c) || width * height > 4096 || Math.max(width, height) > 256
}

function choices(maximum: number): number[] {
	const result = new Set([1, maximum])
	for (let i = 2; i <= 12; i++) {
		result.add(Math.floor(maximum / i))
		result.add(Math.min(maximum, i))
	}
	for (let value = 16; value < maximum; value *= 2) result.add(value)
	return [...result].filter((value) => value >= 1).sort((a, b) => b - a)
}

/** Fixed-size candidate descriptions; no allocation grows with the number of receivers. */
export function recommendCompactCabinet(
	c: CabinetConfiguration,
	direction: CabinetDirection,
	mode: CabinetMode,
	_shard: CabinetSearchShard,
): CabinetSolution {
	const start = performance.now()
	const flip = direction === 'column'
	const width = Math.floor(
		(flip ? c.screenHeight : c.screenWidth) / (flip ? c.moduleHeight : c.moduleWidth),
	)
	const height = Math.floor(
		(flip ? c.screenWidth : c.screenHeight) / (flip ? c.moduleWidth : c.moduleHeight),
	)
	let best: CabinetSolution | undefined
	let evaluated = 0
	// Compare real edge variants first; conservative cell bounds ensure a feasible fallback.
	for (const conservative of hasCabinetCompletion(c) ? [false, true] : [false]) {
	const mw = c.moduleWidth + (conservative ? c.screenWidth % c.moduleWidth : 0)
	const mh = c.moduleHeight + (conservative ? c.screenHeight % c.moduleHeight : 0)
		const receiver = receiverSize(c)
	const receiverColumns = Math.floor(receiver.width / mw)
	const receiverRows = Math.floor(receiver.height / mh)
	const maxW = Math.min(
		width,
		Math.floor(
			(flip ? c.senderMaxHeight : c.senderMaxWidth) / (flip ? mh : mw),
		),
	)
	const maxH = Math.min(
		height,
		Math.floor(
			(flip ? c.senderMaxWidth : c.senderMaxHeight) / (flip ? mw : mh),
		),
	)
	const moduleArea = mw * mh
	const senderArea = Math.floor(c.senderMaxLoad / moduleArea)
	const portArea = Math.min(senderArea, Math.floor(c.portLoad / moduleArea))
	const score = (s: CabinetSolution) => [
		s.cost[0],
		s.cost[1],
		s.receiverBalance!.sumSquares,
		s.cost[2],
	]
	for (const rw of choices(Math.min(maxW, flip ? receiverRows : receiverColumns, portArea))) {
		const rh = Math.min(maxH, flip ? receiverColumns : receiverRows, Math.floor(portArea / rw))
		for (const cableCols of choices(
			Math.min(Math.floor(maxW / rw), Math.floor(portArea / (rw * rh))),
		)) {
			const cw = cableCols * rw
			const ch = rh * Math.min(Math.floor(maxH / rh), Math.floor(portArea / (cw * rh)))
			for (const senderCols of choices(
				Math.min(Math.floor(maxW / cw), c.senderPorts, Math.floor(senderArea / (cw * ch))),
			)) {
				const senderRows = Math.min(
					Math.floor(maxH / ch),
					Math.floor(c.senderPorts / senderCols),
					Math.floor(senderArea / (cw * ch * senderCols)),
				)
				evaluated++
				const sw = cw * senderCols
				const sh = ch * senderRows
				const layout: CabinetCompactLayout = {
					kind: 'repeated-rectangles',
					direction,
					width: flip ? height : width,
					height: flip ? width : height,
					senderWidth: flip ? sh : sw,
					senderHeight: flip ? sw : sh,
					cableWidth: flip ? ch : cw,
					cableHeight: flip ? cw : ch,
					receiverWidth: flip ? rh : rw,
					receiverHeight: flip ? rw : rh,
				}
				const candidate = createCompactSolution(c, layout, mode)
				if (validateCompactCabinet(candidate).length) continue
				let comparison = 0
				if (best) {
					const candidateScore = score(candidate),
						bestScore = score(best)
					for (let i = 0; i < candidateScore.length && !comparison; i++)
						comparison = candidateScore[i] - bestScore[i]
				}
				if (!best || comparison < 0) best = candidate
			}
		}
	}
	}
	if (!best) throw new Error('无法构造有效方案，请检查接收卡尺寸及发送卡、网口带载。')
	best.elapsedMs = performance.now() - start
	best.visitedStates = evaluated
	return best
}

/** Constant-size audit of every repeated region and its clipped edge variants. */
export function validateCompactCabinet(solution: CabinetSolution): string[] {
	const l = solution.compact!
	const c = solution.configuration
	const errors: string[] = []
	if (!l || l.kind !== 'repeated-rectangles' || !['row', 'column'].includes(l.direction))
		return ['布局类型无效']
	if (
		![
			l.width,
			l.height,
			l.senderWidth,
			l.senderHeight,
			l.cableWidth,
			l.cableHeight,
			l.receiverWidth,
			l.receiverHeight,
		].every((v) => Number.isSafeInteger(v) && v > 0)
	)
		return ['布局尺寸无效']
	if (
		l.width !== Math.floor(c.screenWidth / c.moduleWidth) ||
		l.height !== Math.floor(c.screenHeight / c.moduleHeight)
	)
		errors.push('显示屏覆盖尺寸错误')
	const receiver = receiverSize(c)
	const receiverSizes = pixelSizeClasses(c, l, 'receiver')
	if (Math.max(...receiverSizes.x.keys()) > receiver.width || Math.max(...receiverSizes.y.keys()) > receiver.height)
		errors.push('接收卡尺寸超限')
	if (solution.realSenderLoad !== Math.min(c.senderMaxLoad, c.senderPorts * c.portLoad))
		errors.push('发送卡带载统计错误')
	if (solution.isOptimal || solution.provedPrefix !== 0 || solution.receiverBalance?.isOptimal)
		errors.push('推荐方案不能标记为全局最优')
	for (const [width] of cabinetAxisSizes(l.width, [l.senderWidth]))
		for (const [height] of cabinetAxisSizes(l.height, [l.senderHeight])) {
			if (Math.ceil(width / l.cableWidth) * Math.ceil(height / l.cableHeight) > c.senderPorts)
				errors.push('发送卡网口数量超限')
		}
	const senderSizes = pixelSizeClasses(c, l, 'sender')
	for (const [width] of senderSizes.x)
		for (const [height] of senderSizes.y)
			if (width > c.senderMaxWidth || height > c.senderMaxHeight || width * height > solution.realSenderLoad)
				errors.push('发送卡尺寸或带载超限')
	const cableSizes = pixelSizeClasses(c, l, 'cable')
	for (const [width] of cableSizes.x)
		for (const [height] of cableSizes.y)
			if (width * height > c.portLoad) errors.push('网口带载超限')
	const rebuilt = createCompactSolution(c, l, solution.mode)
	if (
		rebuilt.cost.some((v, i) => v !== solution.cost[i]) ||
		rebuilt.moduleCount !== solution.moduleCount ||
		rebuilt.receiverBalance!.sumSquares !== solution.receiverBalance?.sumSquares
	)
		errors.push('数量统计错误')
	return errors
}
