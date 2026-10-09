import { cabinetNumber } from '@momo/leafer-draw/renderer/cabinet'
import type {
	CabinetRenderStats,
	CabinetViewport as Viewport,
} from '@momo/leafer-draw/renderer/cabinet/viewport'
import { CabinetViewportRenderer } from '@momo/leafer-draw/renderer/cabinet/viewport'
import { getCompactReceiver } from '@momo/utils/compactCabinet'
import type { CabinetReceiver, CabinetSolution } from '@momo/utils/extremeCabinet'
import { cabinetAxisCoordinate, getCabinetPixelRectangle, getCabinetReceiverText } from '@momo/utils/extremeCabinet'
import { Modal } from 'antd'
import { useEffect, useRef, useState } from 'react'
import styles from './CabinetPage.module.less'

export default function CabinetViewport({
	solution,
	senderName = '发送卡',
	direction = 'row',
	expanded = false,
	structure = false,
	showStructureModules = true,
}: {
	solution: CabinetSolution
	senderName?: string
	direction?: 'row' | 'column'
	expanded?: boolean
	structure?: boolean
	showStructureModules?: boolean
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
	const [screenBackground, setScreenBackground] = useState<HTMLImageElement>()
	const options = useRef({
		senderName,
		modules,
		labels,
		selectedCable: selection?.cable,
		structure,
	showStructureModules,
		screenBackground,
	})
	options.current = { senderName, modules, labels, selectedCable: selection?.cable, structure, showStructureModules, screenBackground }
	useEffect(() => {
		if (!structure) {
			setScreenBackground(undefined)
			return
		}
		let active = true
		const image = new Image()
		void import('../assets/screenbg').then(({ default: source }) => {
			if (!active) return
			image.onload = () => {
				if (active) setScreenBackground(image)
			}
			image.src = source
		})
		return () => {
			active = false
			image.onload = null
		}
	}, [structure])
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
		const screenWidth = c.screenWidth
		const screenHeight = c.screenHeight
		const draw = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => {
				if (isDisposed) return
				const renderStats = scene.render(view, options.current)
				if (!structure) {
					setStats(renderStats)
					setZoom(view.scale / fitScale)
				}
			})
		}
		const fit = () => {
			view.width = Math.max(1, container.clientWidth)
			view.height = Math.max(1, container.clientHeight)
			fitScale = Math.max(
				Number.MIN_VALUE,
				Math.min(
					Math.max(1, view.width - 32) / screenWidth,
					Math.max(1, view.height - 32) / screenHeight,
				),
			)
			view.scale = fitScale
			view.x = (view.width - screenWidth * fitScale) / 2
			view.y = (view.height - screenHeight * fitScale) / 2
			draw()
		}
		const keepScreenVisible = () => {
			const contentWidth = screenWidth * view.scale
			const contentHeight = screenHeight * view.scale
			view.x = Math.max(32 - contentWidth, Math.min(view.width - 32, view.x))
			view.y = Math.max(32 - contentHeight, Math.min(view.height - 32, view.y))
		}
		const zoomAt = (factor: number, x = view.width / 2, y = view.height / 2) => {
			const modulePitch = Math.min(c.moduleWidth, c.moduleHeight)
			// Allow even a large LED pitch to reach the distant, visually merged range.
			const pointPitch = Number.isFinite(c.pointRatio) ? Math.max(1, c.pointRatio ?? 1) : 1
			const minScale = structure ? Math.min(fitScale / 4, 1 / pointPitch) : fitScale / 4
			const scale = Math.max(
				minScale,
				Math.min(
					Math.max(fitScale * 32, 160 / modulePitch),
					view.scale * factor,
				),
			)
			const ratio = scale / view.scale
			view.x = x - (x - view.x) * ratio
			view.y = y - (y - view.y) * ratio
			view.scale = scale
			keepScreenVisible()
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
				const rect = getCabinetPixelRectangle(c, receiver)
				view.scale = Math.max(
				fitScale,
				Math.min(
						view.width / 3 / rect.width,
						view.height / 3 / rect.height,
				),
			)
				view.x = view.width / 2 - (rect.x + rect.width / 2) * view.scale
				view.y = view.height / 2 - (rect.y + rect.height / 2) * view.scale
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
			keepScreenVisible()
			draw()
		}
		const up = (event: PointerEvent) => {
			if (!structure && drag && !drag.moved) {
				const bounds = element.getBoundingClientRect()
				const receiver = scene.findReceiver(
					cabinetAxisCoordinate((event.clientX - bounds.left - view.x) / view.scale, c.screenWidth, c.moduleWidth, c.isSmartCompletion),
					cabinetAxisCoordinate((event.clientY - bounds.top - view.y) / view.scale, c.screenHeight, c.moduleHeight, c.isSmartCompletion),
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
		element.addEventListener('pointerdown', down)
		element.addEventListener('pointermove', move)
		element.addEventListener('pointerup', up)
		element.addEventListener('pointercancel', cancel)
		element.addEventListener('wheel', wheel, { passive: false })
		element.addEventListener('keydown', key)
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
	}, [senderName, modules, labels, selection, screenBackground, showStructureModules])
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
						tabIndex={0}
						role='img'
						aria-label={structure ? '屏幕信息：显示屏、单元板和 LED 灯珠；滚轮缩放、拖动平移、Home 键复位' : `${title}，${solution.cost[1]} 张接收卡`}
					/>
				</div>
				{!structure && <output
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
				</output>}
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
										<span>{getCabinetReceiverText(solution.configuration, selection, senderName).join(' · ')}</span>
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
