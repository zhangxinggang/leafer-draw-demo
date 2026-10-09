import App from '@momo/leafer-draw/renderer/app'
import {
	cabinetLayerColors,
	cabinetNumber,
	getCabinetReceiverTypes,
	renderCabinetStructure,
} from '@momo/leafer-draw/renderer/cabinet'
import type { CabinetSolution } from '@momo/utils/extremeCabinet'
import type { App as LeaferApp } from 'leafer-ui'
import { memo, useEffect, useId, useState } from 'react'
import styles from './CabinetPage.module.less'
import CabinetViewport from './CabinetViewport'

function CabinetStructure({ solution }: { solution?: CabinetSolution }) {
	const renderId = `cabinet-structure-${useId().replace(/:/g, '')}`
	const [app, setApp] = useState<LeaferApp>()
	const usesViewport = !!solution && (!!solution.compact || solution.cost[1] > 512)
	useEffect(() => {
		if (!app || usesViewport) return
		if (!solution) {
			app.tree.children.slice().forEach((child) => child.destroy())
			return
		}
		const bounds = renderCabinetStructure(app, solution)
		const fit = () => {
			if (!app.width || !app.height) return
			const scale = Math.min(app.width / bounds.width, app.height / bounds.height)
			if (!scale) return
			app.tree.zoomLayer.set({
				scaleX: scale,
				scaleY: scale,
				x: (app.width - bounds.width * scale) / 2,
				y: (app.height - bounds.height * scale) / 2,
			})
		}
		let frame = 0
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(fit)
		})
		observer.observe(document.getElementById(renderId)!)
		fit()
		return () => {
			observer.disconnect()
			cancelAnimationFrame(frame)
		}
	}, [app, solution, renderId, usesViewport])
	const c = solution?.configuration
	const types = solution ? getCabinetReceiverTypes(solution) : []
	return (
		<section className={styles.structure} aria-label='模块叠加结构'>
			<div className={styles.structureDrawing}>
				<div className={styles.structureHeading}>
					<h2>从显示屏到发送卡</h2>
					<span>正视图 · 显示屏 / 单元板 / 接收卡 / 发送卡</span>
				</div>
				{usesViewport && solution ? (
					<CabinetViewport solution={solution} structure />
				) : (
					<>
						<div
							id={renderId}
							className={styles.structureCanvas}
							role='img'
							aria-label='正视模块图，显示屏为底层，白色网格为单元板，接收卡按带载着色，发送卡显示边框'
						/>
						<App
							renderId={renderId}
							registerGlobal={false}
							editorVisible={false}
							rulerVisible={false}
							onAppChange={setApp}
						/>
					</>
				)}
				{!solution && <p className={styles.structurePending}>计算后展示实际分层布局及带载数值</p>}
			</div>
			<aside className={styles.structureLegend} aria-label='模块颜色图例'>
				<h3>
					颜色图例 <span>当前方案</span>
				</h3>
				{c && solution && (
					<>
						<dl>
							<div>
								<dt>
									<i style={{ background: cabinetLayerColors.screen }} />
									显示屏
								</dt>
								<dd>
									{cabinetNumber(c.screenWidth)} × {cabinetNumber(c.screenHeight)} px
								</dd>
							</div>
							<div>
								<dt>
									<i style={{ background: cabinetLayerColors.module }} />
									单元板
								</dt>
								<dd>
									{cabinetNumber(c.moduleWidth)} × {cabinetNumber(c.moduleHeight)} px
									<small>
										{solution.moduleCount} 块 · {Math.floor(c.screenWidth / c.moduleWidth)} 列 ×{' '}
										{Math.floor(c.screenHeight / c.moduleHeight)} 行
									</small>
								</dd>
							</div>
							<div>
								<dt>
									<i style={{ background: cabinetLayerColors.receiver }} />
									接收卡
								</dt>
								<dd>
									{solution.cost[1]} 张
									<small>
										每张上限 {c.receiverColumns} × {c.receiverRows} 块单元板，宽高可缩小
									</small>
								</dd>
							</div>
							<div>
								<dt>
									<i style={{ background: cabinetLayerColors.sender }} />
									发送卡
								</dt>
								<dd>
									{solution.cost[0]} 张
									<small>
										每张上限 {cabinetNumber(c.senderMaxWidth)} × {cabinetNumber(c.senderMaxHeight)}{' '}
										px
										<br />
										实际带载上限 {cabinetNumber(solution.realSenderLoad)} px²
									</small>
								</dd>
							</div>
						</dl>
						<div className={styles.receiverTypes} aria-label='接收卡带载颜色'>
							<h4>接收卡实际带载</h4>
							{types.map((type) => (
								<div key={`${type.width}-${type.height}`}>
									<i style={{ background: type.fill, borderColor: type.color }} />
									<span>
										<b>
											{type.width} × {type.height} 块
										</b>
										<small>
											{cabinetNumber(type.width * c.moduleWidth)} ×{' '}
											{cabinetNumber(type.height * c.moduleHeight)} px ·{' '}
											{cabinetNumber(type.width * type.height * c.moduleWidth * c.moduleHeight)} px²
										</small>
									</span>
									<em>{type.count} 张</em>
								</div>
							))}
						</div>
					</>
				)}
			</aside>
		</section>
	)
}

export default memo(CabinetStructure)
