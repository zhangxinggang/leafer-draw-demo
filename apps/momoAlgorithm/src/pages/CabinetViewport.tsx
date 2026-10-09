import { cabinetNumber } from '@momo/leafer-draw/renderer/cabinet'
import type {
	CabinetRenderStats,
	CabinetViewport as Viewport,
} from '@momo/leafer-draw/renderer/cabinet/viewport'
import { CabinetViewportRenderer } from '@momo/leafer-draw/renderer/cabinet/viewport'
import { getCompactReceiver } from '@momo/utils/compactCabinet'
import type { CabinetReceiver, CabinetSolution } from '@momo/utils/extremeCabinet'
import { Modal } from 'antd'
import { useEffect, useRef, useState } from 'react'
import styles from './CabinetPage.module.less'

export default function CabinetViewport({
	solution,
	senderName = '发送卡',
	direction = 'row',
	expanded = false,
	structure = false,
}: {
	solution: CabinetSolution
	senderName?: string
	direction?: 'row' | 'column'
	expanded?: boolean
	structure?: boolean
}) {
	const canvas = useRef<HTMLCanvasElement>(null)
	const host = useRef<HTMLDivElement>(null)
	const renderer = useRef<CabinetViewportRenderer>()
	const controls = useRef<{
		fit: () => void
		zoom: (factor: number) => void
		locate: (id: number) => void
		redraw: () => void
	}>()
	const [zoom, setZoom] = useState(1)
	const [modules, setModules] = useState(true)
	const [labels, setLabels] = useState(true)
	const [isExpanded, setIsExpanded] = useState(false)
	const [receiverId, setReceiverId] = useState('1')
	const [selection, setSelection] = useState<CabinetReceiver>()
	const [stats, setStats] = useState<CabinetRenderStats>()
	const options = useRef({
		senderName,
		modules,
		labels,
		selectedCable: selection?.cable,
		structure,
	})
	options.current = { senderName, modules, labels, selectedCable: selection?.cable, structure }
	useEffect(() => {
		const element = canvas.current!
		const container = host.current!
		const scene = new CabinetViewportRenderer(element, solution)
		renderer.current = scene
		let frame = 0
		let fitScale = 1
		let isDisposed = false
		const view: Viewport = {
			x: 0,
			y: 0,
			scale: 1,
			width: 1,
			height: 1,
			pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
		}
		const c = solution.configuration
		const draw = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => {
				if (isDisposed) return
				setStats(scene.render(view, options.current))
				setZoom(view.scale / fitScale)
			})
		}
		const fit = () => {
			view.width = Math.max(1, container.clientWidth)
			view.height = Math.max(1, container.clientHeight)
			fitScale = Math.max(
				Number.MIN_VALUE,
				Math.min(
					Math.max(1, view.width - 32) / c.screenWidth,
					Math.max(1, view.height - 32) / c.screenHeight,
				),
			)
			view.scale = fitScale
			view.x = (view.width - c.screenWidth * fitScale) / 2
			view.y = (view.height - c.screenHeight * fitScale) / 2
			draw()
		}
		const zoomAt = (factor: number, x = view.width / 2, y = view.height / 2) => {
			const scale = Math.max(
				fitScale / 4,
				Math.min(
					Math.max(fitScale * 32, 160 / Math.min(c.moduleWidth, c.moduleHeight)),
					view.scale * factor,
				),
			)
			const ratio = scale / view.scale
			view.x = x - (x - view.x) * ratio
			view.y = y - (y - view.y) * ratio
			view.scale = scale
			draw()
		}
		const locate = (id: number) => {
			if (!Number.isSafeInteger(id) || id < 1 || id > solution.cost[1]) return
			const receiver = solution.compact
				? getCompactReceiver(solution, id - 1)
				: solution.senders
						.flatMap((sender) => sender.cables.flatMap((cable) => cable.receivers))
						.find((item) => item.id === id)
			if (!receiver) return
			view.scale = Math.max(
				fitScale,
				Math.min(
					view.width / 3 / (receiver.width * c.moduleWidth),
					view.height / 3 / (receiver.height * c.moduleHeight),
				),
			)
			view.x = view.width / 2 - (receiver.x + receiver.width / 2) * c.moduleWidth * view.scale
			view.y = view.height / 2 - (receiver.y + receiver.height / 2) * c.moduleHeight * view.scale
			setSelection(receiver)
			draw()
		}
		let drag: { x: number; y: number; panX: number; panY: number; moved: boolean } | undefined
		const down = (event: PointerEvent) => {
			if (event.button !== 0) return
			element.setPointerCapture(event.pointerId)
			drag = { x: event.clientX, y: event.clientY, panX: view.x, panY: view.y, moved: false }
		}
		const move = (event: PointerEvent) => {
			if (!drag) return
			const dx = event.clientX - drag.x,
				dy = event.clientY - drag.y
			drag.moved ||= Math.abs(dx) + Math.abs(dy) > 3
			view.x = drag.panX + dx
			view.y = drag.panY + dy
			draw()
		}
		const up = (event: PointerEvent) => {
			if (drag && !drag.moved) {
				const bounds = element.getBoundingClientRect()
				const receiver = scene.findReceiver(
					(event.clientX - bounds.left - view.x) / view.scale / c.moduleWidth,
					(event.clientY - bounds.top - view.y) / view.scale / c.moduleHeight,
				)
				setSelection(receiver)
				if (receiver) setReceiverId(String(receiver.id))
				draw()
			}
			drag = undefined
			if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
		}
		const cancel = () => {
			drag = undefined
		}
		const wheel = (event: WheelEvent) => {
			event.preventDefault()
			const bounds = element.getBoundingClientRect()
			zoomAt(
				Math.exp(-Math.sign(event.deltaY) * 0.25),
				event.clientX - bounds.left,
				event.clientY - bounds.top,
			)
		}
		const key = (event: KeyboardEvent) => {
			if (event.key === 'Home') {
				event.preventDefault()
				fit()
				return
			}
			if (event.key === '+' || event.key === '=' || event.key === '-') {
				event.preventDefault()
				zoomAt(event.key === '-' ? 0.5 : 2)
				return
			}
			const shift = 80
			if (event.key === 'ArrowLeft') view.x += shift
			else if (event.key === 'ArrowRight') view.x -= shift
			else if (event.key === 'ArrowUp') view.y += shift
			else if (event.key === 'ArrowDown') view.y -= shift
			else return
			event.preventDefault()
			draw()
		}
		controls.current = { fit, zoom: zoomAt, locate, redraw: draw }
		const observer = new ResizeObserver(fit)
		observer.observe(container)
		if (!structure) {
			element.addEventListener('pointerdown', down)
			element.addEventListener('pointermove', move)
			element.addEventListener('pointerup', up)
			element.addEventListener('pointercancel', cancel)
			element.addEventListener('wheel', wheel, { passive: false })
			element.addEventListener('keydown', key)
		}
		setSelection(undefined)
		fit()
		return () => {
			isDisposed = true
			observer.disconnect()
			cancelAnimationFrame(frame)
			element.removeEventListener('pointerdown', down)
			element.removeEventListener('pointermove', move)
			element.removeEventListener('pointerup', up)
			element.removeEventListener('pointercancel', cancel)
			element.removeEventListener('wheel', wheel)
			element.removeEventListener('keydown', key)
			scene.destroy()
			renderer.current = undefined
			controls.current = undefined
		}
	}, [solution, structure])
	useEffect(() => {
		controls.current?.redraw()
	}, [senderName, modules, labels, selection])
	const cable = selection ? renderer.current?.getCable(selection.cable) : undefined
	const title = `${direction === 'row' ? '行' : '列'}优先接线图`
	return (
		<>
			<div className={expanded ? styles.expandedDiagram : styles.diagram}>
				{!structure && (
					<div className={styles.toolbar}>
						<div className={styles.layerControls}>
							<label>
								<input
									type='checkbox'
									checked={modules}
									onChange={(event) => setModules(event.target.checked)}
								/>
								模组
							</label>
							<label>
								<input
									type='checkbox'
									checked={labels}
									onChange={(event) => setLabels(event.target.checked)}
								/>
								文案
							</label>
						</div>
						<div className={styles.zoomControls}>
							{!expanded && (
								<button type='button' onClick={() => setIsExpanded(true)}>
									展开
								</button>
							)}
							<button
								type='button'
								aria-label='缩小接线图'
								onClick={() => controls.current?.zoom(0.5)}>
								−
							</button>
							<span>{cabinetNumber(zoom * 100)}%</span>
							<button
								type='button'
								aria-label='放大接线图'
								onClick={() => controls.current?.zoom(2)}>
								+
							</button>
							<button type='button' onClick={() => controls.current?.fit()}>
								适应
							</button>
						</div>
					</div>
				)}
				<div
					ref={host}
					className={`${structure ? styles.structureCanvas : styles.canvas} ${styles.viewportHost}`}>
					<canvas
						ref={canvas}
						tabIndex={structure ? -1 : 0}
						role='img'
						aria-label={`${structure ? '模块叠加结构总览' : title}，${solution.cost[1]} 张接收卡`}
					/>
				</div>
				<output
					className={styles.renderStats}
					data-testid={structure ? 'structure-render-stats' : `${direction}-render-stats`}
					data-total-receivers={stats?.totalReceivers}
					data-visible-receivers={stats?.representedReceivers}
					data-detail-receivers={stats?.detailedReceivers}
					data-drawn-groups={stats?.drawnGroups}
					data-render-ms={stats?.renderMs.toFixed(2)}>
					{cabinetNumber(solution.cost[1])} 张接收卡 ·{' '}
					{stats?.detailedReceivers
						? `视口内 ${cabinetNumber(stats.detailedReceivers)} 张接线细节`
						: '全屏总览，放大查看接线'}
				</output>
				{!structure && (
					<div className={styles.receiverNavigation}>
						<label>
							接收卡序号{' '}
							<input
								aria-label='接收卡序号'
								type='number'
								min={1}
								max={solution.cost[1]}
								value={receiverId}
								onChange={(event) => setReceiverId(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') controls.current?.locate(Number(receiverId))
								}}
							/>
						</label>
						<button type='button' onClick={() => controls.current?.locate(Number(receiverId))}>
							定位并查看接线
						</button>
						<span>滚轮缩放 · 拖动平移 · 点击接收卡</span>
					</div>
				)}
				{!structure && selection && cable && (
					<div className={styles.selectionDetail} role='status'>
						<strong>
							接收卡 {selection.id} · {senderName}-{selection.sender}
						</strong>
						<span>
							{selection.width * solution.configuration.moduleWidth} ×{' '}
							{selection.height * solution.configuration.moduleHeight} px · {selection.width}宽
							{selection.height}高
						</span>
						<span>
							网线 {cable.id} · 第 {cable.port} 个网口 · {cable.receiverCount} 张接收卡 · 带载{' '}
							{cabinetNumber(cable.load)} / {cabinetNumber(solution.configuration.portLoad)}
						</span>
					</div>
				)}
			</div>
			{isExpanded && !expanded && (
				<Modal
					open
					title={title}
					width='calc(100vw - 48px)'
					style={{ top: 24, maxWidth: 1800 }}
					footer={null}
					onCancel={() => setIsExpanded(false)}>
					<CabinetViewport
						solution={solution}
						senderName={senderName}
						direction={direction}
						expanded
					/>
				</Modal>
			)}
		</>
	)
}
