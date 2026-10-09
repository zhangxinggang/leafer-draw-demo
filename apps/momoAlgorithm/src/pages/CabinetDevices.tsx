import { cabinetColor, cabinetNumber } from '@momo/leafer-draw/renderer/cabinet'
import { getCompactSender } from '@momo/utils/compactCabinet'
import type { CabinetSolution } from '@momo/utils/extremeCabinet'
import { useState } from 'react'
import styles from './CabinetPage.module.less'

export default function CabinetDevices({
	solution,
	senderName,
	visitedStates,
}: {
	solution: CabinetSolution
	senderName: string
	visitedStates: number
}) {
	const [isOpen, setIsOpen] = useState(false)
	const [page, setPage] = useState(0)
	const pageSize = 50
	const pages = Math.ceil(solution.cost[0] / pageSize)
	const currentPage = Math.min(page, pages - 1)
	const c = solution.configuration
	const senders = isOpen
		? Array.from(
				{ length: Math.min(pageSize, solution.cost[0] - currentPage * pageSize) },
				(_, i) => {
					const index = currentPage * pageSize + i
					if (solution.compact) return getCompactSender(solution, index)
					const sender = solution.senders[index]
					return {
						...sender,
						cableCount: sender.cables.length,
						receiverCount: sender.cables.reduce((sum, cable) => sum + cable.receivers.length, 0),
						load: sender.width * sender.height * c.moduleWidth * c.moduleHeight,
					}
				},
			)
		: []
	return (
		<details
			className={styles.deviceDetails}
			onToggle={(event) => setIsOpen(event.currentTarget.open)}>
			<summary>
				发送卡带载与网口明细{' '}
				<span>
					{cabinetNumber(solution.elapsedMs)} ms · {cabinetNumber(visitedStates)} 个
					{solution.compact ? '推荐候选' : '搜索状态'}
				</span>
			</summary>
			{isOpen && (
				<>
					<div className={styles.receiverNavigation}>
						<button type='button' disabled={!currentPage} onClick={() => setPage(0)}>
							首页
						</button>
						<button type='button' disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>
							上一页
						</button>
						<span>
							第 {currentPage + 1} / {pages} 页 · 共 {cabinetNumber(solution.cost[0])} 张发送卡
						</span>
						<button
							type='button'
							disabled={currentPage === pages - 1}
							onClick={() => setPage(currentPage + 1)}>
							下一页
						</button>
						<button
							type='button'
							disabled={currentPage === pages - 1}
							onClick={() => setPage(pages - 1)}>
							末页
						</button>
					</div>
					<div className={styles.tableScroll}>
						<table>
							<thead>
								<tr>
									<th>发送卡</th>
									<th>尺寸 px</th>
									<th>带载 / 真实上限</th>
									<th>网口 / 上限</th>
									<th>接收卡</th>
								</tr>
							</thead>
							<tbody>
								{senders.map((sender) => (
									<tr key={sender.id}>
										<td>
											<i style={{ background: cabinetColor(sender.id) }} />
											{senderName}-{sender.id}
										</td>
										<td>
											{cabinetNumber(sender.width * c.moduleWidth)} ×{' '}
											{cabinetNumber(sender.height * c.moduleHeight)}
										</td>
										<td>
											{cabinetNumber(sender.load)} / {cabinetNumber(solution.realSenderLoad)}
										</td>
										<td>
											{sender.cableCount} / {c.senderPorts}
										</td>
										<td>{sender.receiverCount} 张</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
		</details>
	)
}
