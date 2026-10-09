import type {
	EscapeConstraint,
	EscapeLimits,
	EscapeRectangle,
	RectangleBounds,
} from '@momo/utils/rectangleEscape'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'
import styles from './EscapePage.module.less'

export const RECTANGLE_COLORS = ['#427cd1', '#ca922e', '#c26586', '#5a9b72', '#8271b9', '#d47752']
export const getRectangleColor = (id: string) =>
	RECTANGLE_COLORS[(Number(id) - 1) % RECTANGLE_COLORS.length]
export const formatNumber = (value: number) =>
	new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)

interface RectangleCanvasProps {
	rectangles: EscapeRectangle[]
	bounds: RectangleBounds
	limits: EscapeLimits
	selectedId: string | null
	constraint: EscapeConstraint | null
	onSelect: (id: string | null) => void
	onMove: (id: string, position: { x: number; y: number }) => void
	onAdd: () => void
}

type Gesture =
	| { type: 'rectangle'; id: string; pointerId: number; offsetX: number; offsetY: number }
	| { type: 'pan'; pointerId: number; clientX: number; clientY: number; x: number; y: number }

export default function RectangleCanvas({
	rectangles,
	bounds,
	limits,
	selectedId,
	constraint,
	onSelect,
	onMove,
	onAdd,
}: RectangleCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const svgRef = useRef<SVGSVGElement>(null)
	const gestureRef = useRef<Gesture | null>(null)
	const [size, setSize] = useState({ width: 1000, height: 700 })
	const [camera, setCamera] = useState({ x: limits.width / 2, y: limits.height / 2, zoom: 1 })
	const [isPanning, setIsPanning] = useState(false)
	const baseScale = Math.max(
		0.001,
		Math.min((size.width - 128) / limits.maxWidth, (size.height - 128) / limits.maxHeight),
	)
	const scale = baseScale * camera.zoom
	const labelSize = 12 / scale
	const tickSize = 5 / scale
	const dimensionOffset = 25 / scale

	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const observer = new ResizeObserver(([entry]) => {
			if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
				setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
			}
		})
		observer.observe(container)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const handleWheel = (event: WheelEvent) => {
			event.preventDefault()
			if (gestureRef.current) return
			const frame = container.getBoundingClientRect()
			const offsetX = event.clientX - frame.left - size.width / 2
			const offsetY = event.clientY - frame.top - size.height / 2
			setCamera((current) => {
				const zoom = Math.max(0.15, Math.min(5, current.zoom * Math.exp(-event.deltaY * 0.0015)))
				return {
					x: current.x + offsetX / (baseScale * current.zoom) - offsetX / (baseScale * zoom),
					y: current.y + offsetY / (baseScale * current.zoom) - offsetY / (baseScale * zoom),
					zoom,
				}
			})
		}
		container.addEventListener('wheel', handleWheel, { passive: false })
		return () => container.removeEventListener('wheel', handleWheel)
	}, [baseScale, size])

	const getWorldPoint = (clientX: number, clientY: number) => {
		const frame = svgRef.current!.getBoundingClientRect()
		return {
			x: camera.x + (clientX - frame.left - size.width / 2) / scale,
			y: camera.y + (clientY - frame.top - size.height / 2) / scale,
		}
	}
	const handleRectanglePointerDown = (
		event: PointerEvent<SVGGElement>,
		rectangle: EscapeRectangle,
	) => {
		if (event.button !== 0 || gestureRef.current) return
		event.stopPropagation()
		event.preventDefault()
		event.currentTarget.focus()
		onSelect(rectangle.id)
		const point = getWorldPoint(event.clientX, event.clientY)
		gestureRef.current = {
			type: 'rectangle',
			id: rectangle.id,
			pointerId: event.pointerId,
			offsetX: point.x - rectangle.x,
			offsetY: point.y - rectangle.y,
		}
		svgRef.current!.setPointerCapture(event.pointerId)
	}
	const handleBackgroundPointerDown = (event: PointerEvent<SVGSVGElement>) => {
		if (event.button !== 0 || gestureRef.current) return
		onSelect(null)
		gestureRef.current = {
			type: 'pan',
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			x: camera.x,
			y: camera.y,
		}
		setIsPanning(true)
		event.currentTarget.setPointerCapture(event.pointerId)
	}
	const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
		const gesture = gestureRef.current
		if (!gesture || gesture.pointerId !== event.pointerId) return
		if (gesture.type === 'pan') {
			setCamera((current) => ({
				...current,
				x: gesture.x - (event.clientX - gesture.clientX) / scale,
				y: gesture.y - (event.clientY - gesture.clientY) / scale,
			}))
		} else {
			const point = getWorldPoint(event.clientX, event.clientY)
			onMove(gesture.id, { x: point.x - gesture.offsetX, y: point.y - gesture.offsetY })
		}
	}
	const handlePointerEnd = (event: PointerEvent<SVGSVGElement>) => {
		if (gestureRef.current?.pointerId !== event.pointerId) return
		gestureRef.current = null
		setIsPanning(false)
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId)
	}
	const handleRectangleKeyDown = (
		event: KeyboardEvent<SVGGElement>,
		rectangle: EscapeRectangle,
	) => {
		const directionMap: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1],
		}
		const direction = directionMap[event.key]
		if (!direction) return
		event.preventDefault()
		const step = event.shiftKey ? 10 : 1
		onSelect(rectangle.id)
		onMove(rectangle.id, {
			x: rectangle.x + direction[0] * step,
			y: rectangle.y + direction[1] * step,
		})
	}
	const handleFit = () => {
		const fittedScale = Math.min(
			(size.width - 144) / bounds.width,
			(size.height - 144) / bounds.height,
		)
		setCamera({
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height / 2,
			zoom: Math.max(0.15, Math.min(5, fittedScale / baseScale)),
		})
	}
	const handleZoom = (factor: number) =>
		setCamera((current) => ({
			...current,
			zoom: Math.max(0.15, Math.min(5, current.zoom * factor)),
		}))
	const gridSize = Math.max(12, 40 * scale)
	const boundsColor = constraint ? '#ca922e' : '#087f8c'

	return (
		<section
			className={styles.canvasPanel}
			aria-label='矩形操作画布'
		>
			<div className={styles.canvasToolbar}>
				<div className={styles.canvasTitle}>
					<span className={styles.liveDot} />
					<strong>交互画布</strong>
					<span>拖动矩形，探索边界</span>
				</div>
				<div className={styles.canvasActions}>
					<button
						type='button'
						onClick={() => handleZoom(0.8)}
						aria-label='缩小画布'
						title='缩小'
					>
						−
					</button>
					<span>{Math.round(scale * 100)}%</span>
					<button
						type='button'
						onClick={() => handleZoom(1.25)}
						aria-label='放大画布'
						title='放大'
					>
						+
					</button>
					<i />
					<button
						type='button'
						onClick={handleFit}
						aria-label='居中适应矩形'
						title='居中适应'
					>
						<Icon name='fit' />
					</button>
				</div>
			</div>
			<div
				ref={containerRef}
				className={styles.canvasSurface}
			>
				<svg
					ref={svgRef}
					className={`${styles.canvasSvg} ${isPanning ? styles.panning : ''}`}
					width='100%'
					height='100%'
					role='group'
					aria-label='拖动小矩形；拖动空白平移；滚轮缩放；选中矩形后使用方向键移动'
					onPointerDown={handleBackgroundPointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerEnd}
					onPointerCancel={handlePointerEnd}
					onLostPointerCapture={handlePointerEnd}
				>
					<defs>
						<pattern
							id='canvas-grid'
							width={gridSize}
							height={gridSize}
							x={size.width / 2 - camera.x * scale}
							y={size.height / 2 - camera.y * scale}
							patternUnits='userSpaceOnUse'
						>
							<path
								d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
								fill='none'
								stroke='#dce7ee'
								strokeWidth='.7'
							/>
						</pattern>
					</defs>
					<rect
						width='100%'
						height='100%'
						fill='url(#canvas-grid)'
					/>
					<g
						transform={`translate(${size.width / 2} ${size.height / 2}) scale(${scale}) translate(${-camera.x} ${-camera.y})`}
					>
						<rect
							data-testid='bounding-rectangle'
							x={bounds.x}
							y={bounds.y}
							width={bounds.width}
							height={bounds.height}
							fill={boundsColor}
							fillOpacity='.035'
							stroke={boundsColor}
							strokeWidth='2'
							vectorEffect='non-scaling-stroke'
							pointerEvents='none'
						/>
						<g
							fill='#6d8394'
							fontFamily='Consolas, monospace'
							fontSize={labelSize}
							pointerEvents='none'
						>
							<path
								d={`M ${bounds.x} ${bounds.y - dimensionOffset} h ${bounds.width} M ${bounds.x} ${bounds.y - dimensionOffset - tickSize} v ${tickSize * 2} M ${bounds.x + bounds.width} ${bounds.y - dimensionOffset - tickSize} v ${tickSize * 2} M ${bounds.x - dimensionOffset} ${bounds.y} v ${bounds.height} M ${bounds.x - dimensionOffset - tickSize} ${bounds.y} h ${tickSize * 2} M ${bounds.x - dimensionOffset - tickSize} ${bounds.y + bounds.height} h ${tickSize * 2}`}
								fill='none'
								stroke='#89a0af'
								strokeWidth='1'
								vectorEffect='non-scaling-stroke'
							/>
							<text
								x={bounds.x + bounds.width / 2}
								y={bounds.y - dimensionOffset - 8 / scale}
								textAnchor='middle'
							>
								{formatNumber(bounds.width)} px
							</text>
							<text
								transform={`translate(${bounds.x - dimensionOffset - 10 / scale} ${bounds.y + bounds.height / 2}) rotate(-90)`}
								textAnchor='middle'
							>
								{formatNumber(bounds.height)} px
							</text>
						</g>
						{rectangles.map((rectangle) => {
							const color = getRectangleColor(rectangle.id)
							const isSelected = rectangle.id === selectedId
							return (
								<g
									key={rectangle.id}
									className={styles.smallRectangle}
									transform={`translate(${rectangle.x} ${rectangle.y})`}
									tabIndex={0}
									role='button'
									aria-label={`小矩形 ${rectangle.id}，宽 ${rectangle.width}，高 ${rectangle.height}，使用方向键移动`}
									aria-pressed={isSelected}
									onFocus={() => onSelect(rectangle.id)}
									onPointerDown={(event) => handleRectanglePointerDown(event, rectangle)}
									onKeyDown={(event) => handleRectangleKeyDown(event, rectangle)}
								>
									<rect
										width={rectangle.width}
										height={rectangle.height}
										fill={color}
										fillOpacity={isSelected ? '.22' : '.12'}
										stroke={color}
										strokeWidth={isSelected ? '2.5' : '1.5'}
										vectorEffect='non-scaling-stroke'
									/>
									{rectangle.width * scale > 48 && rectangle.height * scale > 32 && (
										<text
											x={rectangle.width / 2}
											y={rectangle.height / 2}
											textAnchor='middle'
											dominantBaseline='middle'
											fontSize={12 / scale}
											fontFamily='Consolas, monospace'
											fill={color}
											pointerEvents='none'
										>
											R{rectangle.id}
										</text>
									)}
									{isSelected &&
										[
											[0, 0],
											[rectangle.width, 0],
											[0, rectangle.height],
											[rectangle.width, rectangle.height],
										].map(([x, y]) => (
											<rect
												key={`${x}:${y}`}
												x={x - 3 / scale}
												y={y - 3 / scale}
												width={6 / scale}
												height={6 / scale}
												fill='#fff'
												stroke={color}
												strokeWidth='1.5'
												vectorEffect='non-scaling-stroke'
												pointerEvents='none'
											/>
										))}
								</g>
							)
						})}
					</g>
				</svg>
				{!rectangles.length && (
					<div className={styles.emptyCanvas}>
						<div className={styles.emptyIcon}>
							<Icon
								name='plus'
								size={24}
							/>
						</div>
						<strong>从一个小矩形开始</strong>
						<p>添加后，大矩形会紧贴所有小矩形的边缘。</p>
						<button
							type='button'
							onClick={onAdd}
						>
							新增小矩形
							<Icon
								name='arrow'
								size={16}
							/>
						</button>
					</div>
				)}
			</div>
			<div className={styles.canvasFooter}>
				<span>
					<Icon
						name='move'
						size={14}
					/>{' '}
					空白拖动平移 · 滚轮缩放
				</span>
				<span>方向键微调 · Shift × 10</span>
			</div>
		</section>
	)
}
