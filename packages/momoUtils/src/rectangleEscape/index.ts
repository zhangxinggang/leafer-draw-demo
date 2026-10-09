export interface EscapeRectangle {
	id: string
	x: number
	y: number
	width: number
	height: number
}

export interface RectangleBounds {
	x: number
	y: number
	width: number
	height: number
}

export interface EscapeLimits {
	width: number
	height: number
	maxWidth: number
	maxHeight: number
}

export type EscapeConstraint = 'width' | 'height' | 'area' | 'invalid'

export interface ConstrainedMove {
	rectangle: EscapeRectangle
	bounds: RectangleBounds
	isLimited: boolean
	constraint: EscapeConstraint | null
}

const isPositiveFinite = (value: number) => Number.isFinite(value) && value > 0

export function isValidEscapeLimits(limits: EscapeLimits): boolean {
	return (
		Object.values(limits).every(isPositiveFinite) &&
		Number.isFinite(limits.width * limits.height) &&
		limits.width <= limits.maxWidth &&
		limits.height <= limits.maxHeight
	)
}

export function getRectangleBounds(rectangles: readonly RectangleBounds[]): RectangleBounds | null {
	if (!rectangles.length) return null
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity
	for (const rectangle of rectangles) {
		const { x, y, width, height } = rectangle
		if (
			![x, y, x + width, y + height].every(Number.isFinite) ||
			!isPositiveFinite(width) ||
			!isPositiveFinite(height)
		) {
			throw new RangeError('Rectangle coordinates must be finite and dimensions must be positive')
		}
		minX = Math.min(minX, x)
		minY = Math.min(minY, y)
		maxX = Math.max(maxX, x + width)
		maxY = Math.max(maxY, y + height)
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function getEscapeViolation(
	bounds: RectangleBounds,
	limits: EscapeLimits,
): EscapeConstraint | null {
	if (
		!isValidEscapeLimits(limits) ||
		!isPositiveFinite(bounds.width) ||
		!isPositiveFinite(bounds.height) ||
		![bounds.x, bounds.y].every(Number.isFinite)
	)
		return 'invalid'
	if (bounds.width > limits.maxWidth) return 'width'
	if (bounds.height > limits.maxHeight) return 'height'
	if (bounds.width * bounds.height > limits.width * limits.height) return 'area'
	return null
}

function hasRectangleOverlap(rectangle: RectangleBounds, other: RectangleBounds): boolean {
	return (
		rectangle.x < other.x + other.width &&
		rectangle.x + rectangle.width > other.x &&
		rectangle.y < other.y + other.height &&
		rectangle.y + rectangle.height > other.y
	)
}

/** Prefer a non-overlapping position; overlap is allowed by the bounding constraints. */
export function findRectanglePlacement(
	rectangles: readonly EscapeRectangle[],
	size: { width: number; height: number },
	limits: EscapeLimits,
	id: string,
): { rectangle: EscapeRectangle; hasOverlap: boolean } | null {
	if (
		!isValidEscapeLimits(limits) ||
		!isPositiveFinite(size.width) ||
		!isPositiveFinite(size.height) ||
		rectangles.some((rectangle) => rectangle.id === id)
	)
		return null
	const bounds = getRectangleBounds(rectangles)
	const candidateList = bounds
		? [
				{ x: bounds.x + bounds.width, y: bounds.y },
				{ x: bounds.x, y: bounds.y + bounds.height },
				{ x: bounds.x - size.width, y: bounds.y },
				{ x: bounds.x, y: bounds.y - size.height },
				...rectangles.flatMap((rectangle) => [
					{ x: rectangle.x + rectangle.width, y: rectangle.y },
					{ x: rectangle.x, y: rectangle.y + rectangle.height },
					{ x: rectangle.x - size.width, y: rectangle.y },
					{ x: rectangle.x, y: rectangle.y - size.height },
				]),
				{ x: bounds.x, y: bounds.y },
			]
		: [{ x: (limits.width - size.width) / 2, y: (limits.height - size.height) / 2 }]
	let fallback: EscapeRectangle | null = null
	for (const position of candidateList) {
		const rectangle = { id, ...position, ...size }
		const nextBounds = getRectangleBounds([...rectangles, rectangle])!
		if (getEscapeViolation(nextBounds, limits)) continue
		const hasOverlap = rectangles.some((other) => hasRectangleOverlap(rectangle, other))
		if (!hasOverlap) return { rectangle, hasOverlap: false }
		fallback = rectangle
	}
	return fallback ? { rectangle: fallback, hasOverlap: true } : null
}

/**
 * Stop at the first forbidden point along the movement, including invalid area
 * between two legal endpoints. Within each edge-switch interval, width and
 * height are linear; their product can have an interior maximum.
 */
export function constrainRectangleMove(
	rectangles: readonly EscapeRectangle[],
	id: string,
	target: { x: number; y: number },
	limits: EscapeLimits,
): ConstrainedMove {
	const rectangle = rectangles.find((item) => item.id === id)
	if (!rectangle) throw new RangeError(`Unknown rectangle: ${id}`)
	const initialBounds = getRectangleBounds(rectangles)!
	if (getEscapeViolation(initialBounds, limits))
		throw new RangeError('The initial scene exceeds its limits')
	const stationaryBounds = getRectangleBounds(rectangles.filter((item) => item.id !== id))
	const deltaX = target.x - rectangle.x
	const deltaY = target.y - rectangle.y
	if (![target.x, target.y, deltaX, deltaY].every(Number.isFinite)) {
		return {
			rectangle: { ...rectangle },
			bounds: initialBounds,
			isLimited: true,
			constraint: 'invalid',
		}
	}
	const at = (progress: number) => ({
		...rectangle,
		x: rectangle.x + deltaX * progress,
		y: rectangle.y + deltaY * progress,
	})
	const boundsAt = (progress: number) =>
		getRectangleBounds(stationaryBounds ? [stationaryBounds, at(progress)] : [at(progress)])!
	const breakpointList = [0, 1]
	const addBreakpoint = (edge: number, origin: number, delta: number) => {
		if (delta === 0) return
		const progress = (edge - origin) / delta
		if (progress > 0 && progress < 1) breakpointList.push(progress)
	}
	if (stationaryBounds) {
		addBreakpoint(stationaryBounds.x, rectangle.x, deltaX)
		addBreakpoint(
			stationaryBounds.x + stationaryBounds.width - rectangle.width,
			rectangle.x,
			deltaX,
		)
		addBreakpoint(stationaryBounds.y, rectangle.y, deltaY)
		addBreakpoint(
			stationaryBounds.y + stationaryBounds.height - rectangle.height,
			rectangle.y,
			deltaY,
		)
	}
	breakpointList.sort((a, b) => a - b)
	for (let index = 1; index < breakpointList.length; index++) {
		const start = breakpointList[index - 1]
		const end = breakpointList[index]
		const startBounds = boundsAt(start)
		const endBounds = boundsAt(end)
		const widthChange = endBounds.width - startBounds.width
		const heightChange = endBounds.height - startBounds.height
		const quadratic = widthChange * heightChange
		const linear = startBounds.width * heightChange + startBounds.height * widthChange
		const peak = quadratic < 0 ? -linear / (2 * quadratic) : -1
		const probeList = peak > 0 && peak < 1 ? [start + (end - start) * peak, end] : [end]
		for (const probe of probeList) {
			const constraint = getEscapeViolation(boundsAt(probe), limits)
			if (!constraint) continue
			let low = start
			let high = probe
			for (let iteration = 0; iteration < 52; iteration++) {
				const middle = (low + high) / 2
				if (getEscapeViolation(boundsAt(middle), limits)) high = middle
				else low = middle
			}
			return {
				rectangle: at(low),
				bounds: boundsAt(low),
				isLimited: true,
				constraint: getEscapeViolation(boundsAt(high), limits),
			}
		}
	}
	return { rectangle: at(1), bounds: boundsAt(1), isLimited: false, constraint: null }
}
