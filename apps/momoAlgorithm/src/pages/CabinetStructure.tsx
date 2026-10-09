import { getCabinetModuleTypes } from '@momo/leafer-draw/renderer/cabinet'
import type { CabinetSolution } from '@momo/utils/extremeCabinet'
import { memo, useState } from 'react'
import styles from './CabinetPage.module.less'
import CabinetViewport from './CabinetViewport'

function CabinetStructure({ solution }: { solution?: CabinetSolution }) {
	const [showModules, setShowModules] = useState(true)
	const c = solution?.configuration
	const moduleTypes = solution ? getCabinetModuleTypes(solution) : []
	const moduleColumns = c
		? c.isSmartCompletion
			? Math.ceil(c.screenWidth / c.moduleWidth)
			: Math.floor(c.screenWidth / c.moduleWidth)
		: 0
	const moduleRows = c
		? c.isSmartCompletion
			? Math.ceil(c.screenHeight / c.moduleHeight)
			: Math.floor(c.screenHeight / c.moduleHeight)
		: 0

	return (
		<section className={styles.structure} aria-label='屏幕信息'>
			<div className={styles.structureDrawing}>
				<div className={styles.structureHeading}>
					<h2>屏幕信息</h2>
					<span>正视图 · 显示屏 / 单元板 · 滚轮缩放 · 拖动平移</span>
				</div>
				{solution ? (
					<CabinetViewport solution={solution} structure showStructureModules={showModules} />
				) : (
					<p className={styles.structurePending}>计算后展示显示屏与单元板布局</p>
				)}
			</div>
			<aside className={styles.structureLegend} aria-label='屏幕和单元板颜色图例'>
				<h3>
					颜色图例 <span>当前方案</span>
				</h3>
				{c && solution && (
					<>
						<dl>
							<div>
								<dt>显示屏</dt>
								<dd>
									{c.screenWidth.toLocaleString('zh-CN')} × {c.screenHeight.toLocaleString('zh-CN')} px
									<small>点间距 {c.pointRatio ?? 1} px</small>
								</dd>
							</div>
							<div>
								<dt>单元板</dt>
								<dd>
									{solution.moduleCount.toLocaleString('zh-CN')} 块
									<small>
										{moduleColumns.toLocaleString('zh-CN')} 列 × {moduleRows.toLocaleString('zh-CN')} 行
									</small>
								</dd>
							</div>
						</dl>
						<div className={styles.receiverTypes} aria-label='单元板规格'>
							<div className={styles.moduleTypesHeading}>
								<h4>单元板规格</h4>
								<label>
									<span>显示</span>
									<input
										type='checkbox'
										role='switch'
										aria-label='显示单元板'
										checked={showModules}
										onChange={(event) => setShowModules(event.target.checked)}
									/>
								</label>
							</div>
							{moduleTypes.map((type) => (
								<div key={`${type.width}-${type.height}`}>
									<i style={{ background: type.fill, borderColor: '#8a9aa6' }} />
									<span>
										<b>
											{type.width.toLocaleString('zh-CN')} × {type.height.toLocaleString('zh-CN')} 灯珠
										</b>
									</span>
									<em>{type.count.toLocaleString('zh-CN')} 块</em>
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
