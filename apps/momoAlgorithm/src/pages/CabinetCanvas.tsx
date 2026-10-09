import App from '@momo/leafer-draw/renderer/app'
import {
	cabinetNumber,
	cableColor,
	renderCabinet,
	setCabinetLayers,
} from '@momo/leafer-draw/renderer/cabinet'
import type { CabinetDirection, CabinetSolution } from '@momo/utils/extremeCabinet'
import { Modal } from 'antd'
import type { IBoundsData, App as LeaferApp, PointerEvent } from 'leafer-ui'
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import styles from './CabinetPage.module.less'
import CabinetViewport from './CabinetViewport'

export { cabinetColor, cabinetNumber } from '@momo/leafer-draw/renderer/cabinet'

function CabinetNativeCanvas({
	solution,
	direction,
	senderName,
	expanded = false,
}: {
	solution: CabinetSolution
	direction: CabinetDirection
	senderName: string
	expanded?: boolean
}) {
	const renderId = `cabinet-${useId().replace(/:/g, '')}`
	const [app, setApp] = useState<LeaferApp>()
	const [zoom, setZoom] = useState(1)
	const fitScale = useRef(1)
	const bounds = useRef<IBoundsData>()
	const previousScene = useRef<{ app: LeaferApp; solution: CabinetSolution }>()
	const [selectedId, setSelectedId] = useState<number | null>(null)
	const [isShowingModules, setIsShowingModules] = useState(true)
	const [isShowingLabels, setIsShowingLabels] = useState(true)
	const [isExpanded, setIsExpanded] = useState(false)
	const c = solution.configuration
	const selection = solution.senders
		.flatMap((sender) => sender.cables)
		.find((cable) => cable.id === selectedId)
	const handleFit = useCallback(() => {
		if (!app || !bounds.current || !app.width || !app.height) return
		const area = bounds.current
		const scale = Math.min(app.width / area.width, app.height / area.height)
		app.tree.zoomLayer.set({
			scaleX: scale,
			scaleY: scale,
			x: (app.width - area.width * scale) / 2 - area.x * scale,
			y: (app.height - area.height * scale) / 2 - area.y * scale,
		})
		fitScale.current = scale
		setZoom(1)
	}, [app])

	useEffect(() => {
		if (!app) return
		bounds.current = renderCabinet(app, solution, senderName)
		if (previousScene.current?.app !== app || previousScene.current?.solution !== solution) {
			setSelectedId(null)
			handleFit()
		}
		previousScene.current = { app, solution }
	}, [app, solution, senderName, handleFit])
	useEffect(() => {
		if (app) setCabinetLayers(app, isShowingModules, isShowingLabels, selectedId)
	}, [app, solution, senderName, isShowingModules, isShowingLabels, selectedId])
	useEffect(() => {
		if (!app) return
		const view = document.getElementById(renderId)
		if (!view) return
		let frame = 0
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(handleFit)
		})
		observer.observe(view)
		return () => {
			observer.disconnect()
			cancelAnimationFrame(frame)
		}
	}, [app, renderId, handleFit])

	const handleZoom = (factor: number) => {
		if (!app || !app.width || !app.height) return
		const layer = app.tree.zoomLayer
		const scale = Math.max(
			fitScale.current,
			Math.min(fitScale.current * 32, (layer.scaleX ?? 1) * factor),
		)
		const ratio = scale / (layer.scaleX ?? 1)
		layer.set({
			scaleX: scale,
			scaleY: scale,
			x: app.width / 2 - (app.width / 2 - (layer.x ?? 0)) * ratio,
			y: app.height / 2 - (app.height / 2 - (layer.y ?? 0)) * ratio,
		})
		setZoom(scale / fitScale.current)
	}
	const handleTap = (event: PointerEvent) => {
		// Pan mode uses the root event path; explicitly hit-test the tree on taps.
		const hit = app?.tree.pick(event)
		const cableId = hit?.target?.data?.cableId
		if (typeof cableId === 'number') setSelectedId(cableId)
	}
	return (
		<>
			<div className={expanded ? styles.expandedDiagram : styles.diagram}>
				<div className={styles.toolbar}>
					<div className={styles.layerControls}>
						<label>
							<input
								type='checkbox'
								checked={isShowingModules}
								onChange={(event) => setIsShowingModules(event.target.checked)}
							/>
							模组
						</label>
						<label>
							<input
								type='checkbox'
								checked={isShowingLabels}
								onChange={(event) => setIsShowingLabels(event.target.checked)}
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
						<button type='button' aria-label='缩小接线图' onClick={() => handleZoom(1 / 1.4)}>
							−
						</button>
						<span>{Math.round(zoom * 100)}%</span>
						<button type='button' aria-label='放大接线图' onClick={() => handleZoom(1.4)}>
							+
						</button>
						<button type='button' onClick={handleFit}>
							适应
						</button>
					</div>
				</div>
				<div
					id={renderId}
					className={styles.canvas}
					role='img'
					aria-label={`${direction === 'row' ? '行' : '列'}优先接线图，${solution.cost[0]} 张发送卡，${solution.cost[1]} 张接收卡，${solution.cost[2]} 根网线`}
				/>
				<App
					renderId={renderId}
					panEnabled
					editorVisible={false}
					registerGlobal={false}
					rulerVisible={false}
					onAppChange={setApp}
					onTap={handleTap}
					onViewZoom={() => {
						if (app) setZoom((app.tree.zoomLayer.scaleX ?? 1) / fitScale.current)
					}}
				/>
				<div className={styles.diagramFooter}>
					<span>拖动平移 · 点击接收卡查看网线</span>
					{selection && (
						<button type='button' onClick={() => setSelectedId(null)}>
							取消高亮
						</button>
					)}
				</div>
				{selection && (
					<div className={styles.selectionDetail} role='status'>
						<strong style={{ color: cableColor(selection.sender, selection.port) }}>
							网线 {selection.id}
						</strong>
						<span>
							{senderName}-{selection.sender} · 第 {selection.port} 个网口 ·{' '}
							{selection.receivers.length} 张接收卡
						</span>
						<span>
							带载{' '}
							{cabinetNumber(
								selection.receivers.reduce(
									(sum, receiver) => sum + receiver.width * receiver.height,
									0,
								) *
									c.moduleWidth *
									c.moduleHeight,
							)}{' '}
							/ {cabinetNumber(c.portLoad)}
						</span>
					</div>
				)}
			</div>
			{!expanded && isExpanded && (
				<Modal
					open
					title={
						<span
							className={
								styles.expandedTitle
							}>{`${direction === 'row' ? '行' : '列'}优先接线图 · ${solution.cost[0]} 张发送卡 / ${solution.cost[1]} 张接收卡 / ${solution.cost[2]} 根网线`}</span>
					}
					width='calc(100vw - 48px)'
					style={{ top: 24, maxWidth: 1800 }}
					footer={null}
					onCancel={() => setIsExpanded(false)}>
					<CabinetCanvas
						solution={solution}
						direction={direction}
						senderName={senderName}
						expanded
					/>
				</Modal>
			)}
		</>
	)
}

function CabinetCanvas(props: {
	solution: CabinetSolution
	direction: CabinetDirection
	senderName: string
	expanded?: boolean
}) {
	return props.solution.compact || props.solution.cost[1] > 512 ? (
		<CabinetViewport {...props} />
	) : (
		<CabinetNativeCanvas {...props} />
	)
}

export default memo(CabinetCanvas)
