import { MAX_CABINET_JSON_LENGTH, parseCabinetConfigurationJson } from '@momo/utils/cabinetImport'
import type {
	CabinetConfiguration,
	CabinetDirection,
	CabinetMode,
	CabinetProgress,
	CabinetProgressPair,
} from '@momo/utils/extremeCabinet'
import {
	compareCabinetSolutions,
	getCabinetConfigurationError,
	getCabinetReceiverBalance,
} from '@momo/utils/extremeCabinet'
import { Alert, Button, Input, InputNumber } from 'antd'
import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'
import { startCabinetCalculation } from './cabinetCalculation'
import CabinetCanvas, { cabinetNumber } from './CabinetCanvas'
import styles from './CabinetPage.module.less'
import CabinetStructure from './CabinetStructure'
import CabinetDevices from './CabinetDevices'

const DEFAULT_CONFIGURATION: CabinetConfiguration = {
	screenWidth: 1920,
	screenHeight: 1080,
	moduleWidth: 160,
	moduleHeight: 90,
	receiverColumns: 2,
	receiverRows: 2,
	senderMaxWidth: 3840,
	senderMaxHeight: 2160,
	senderMaxLoad: 2600000,
	senderPorts: 4,
	portLoad: 650000,
}
const FIELD_GROUPS: {
	title: string
	hint: string
	fields: { key: keyof CabinetConfiguration; label: string }[]
}[] = [
	{
		title: '显示屏',
		hint: 'px',
		fields: [
			{ key: 'screenWidth', label: '显示屏宽' },
			{ key: 'screenHeight', label: '显示屏高' },
		],
	},
	{
		title: '模组',
		hint: 'px',
		fields: [
			{ key: 'moduleWidth', label: '模组宽' },
			{ key: 'moduleHeight', label: '模组高' },
		],
	},
	{
		title: '接收卡',
		hint: '可缩小的上限',
		fields: [
			{ key: 'receiverColumns', label: '模组宽数量' },
			{ key: 'receiverRows', label: '模组高数量' },
		],
	},
	{
		title: '发送卡',
		hint: '硬性限制',
		fields: [
			{ key: 'senderMaxWidth', label: '极限宽' },
			{ key: 'senderMaxHeight', label: '极限高' },
			{ key: 'senderMaxLoad', label: '极限带载' },
			{ key: 'senderPorts', label: '网口数量' },
		],
	},
	{ title: '网口', hint: 'px² / 口', fields: [{ key: 'portLoad', label: '网口带载' }] },
]
type ConfigurationDraft = Record<keyof CabinetConfiguration, number | null>

function SolutionPanel({
	direction,
	progress,
	isRunning,
	senderName,
}: {
	direction: CabinetDirection
	progress: CabinetProgress | null
	isRunning: boolean
	senderName: string
}) {
	const solution = progress?.solution
	const balance = solution ? getCabinetReceiverBalance(solution) : null
	const balanceCounts =
		balance?.distribution?.map((item) => item.receivers) ?? balance?.counts ?? []
	const proofProgress =
		progress?.stage === 'balancing'
			? '设备数已最少 · 正在均衡接收卡'
			: [
					'正在证明发送卡最少',
					'发送卡已最少 · 正在优化接收卡',
					'接收卡已最少 · 正在均衡与优化网线',
				][solution?.provedPrefix ?? 0]
	return (
		<section
			className={styles.solutionPanel}
			aria-label={`${direction === 'row' ? '行' : '列'}优先方案`}>
			<header className={styles.solutionHeading}>
				<div>
					<span className={styles.directionIcon}>{direction === 'row' ? '↔' : '↕'}</span>
					<h2>{direction === 'row' ? '行优先' : '列优先'}</h2>
				</div>
				<span className={solution?.isOptimal ? styles.optimalBadge : styles.searchBadge}>
					{solution?.isOptimal
						? '已证明全局最优'
						: isRunning
							? solution?.compact
								? '正在比较大屏推荐方案'
								: proofProgress
							: solution
								? solution.compact
									? '推荐方案 · 未证明全局最优'
									: '可行方案 · 已停止'
								: '等待计算'}
				</span>
			</header>
			<div className={styles.counts} aria-label='设备数量'>
				{['模组', '接收卡', '发送卡', '网线'].map((label, index) => (
					<div key={label}>
						<span>{label}</span>
						<strong data-testid={`${direction}-count-${index}`}>
							{solution
								? cabinetNumber(
										[solution.moduleCount, solution.cost[1], solution.cost[0], solution.cost[2]][
											index
										],
									)
								: '—'}
						</strong>
						<small>{index === 0 ? '块' : index === 3 ? '根' : '张'}</small>
					</div>
				))}
			</div>
			{balance && (
				<div className={styles.balanceSummary} aria-label='发送卡接收卡分配'>
					<strong>
						每张发送卡 {Math.min(...balanceCounts)}
						{Math.max(...balanceCounts) !== Math.min(...balanceCounts)
							? `–${Math.max(...balanceCounts)}`
							: ''}{' '}
						张接收卡
					</strong>
					<span>
						平均{' '}
						{(solution!.cost[1] / solution!.cost[0]).toLocaleString('zh-CN', {
							maximumFractionDigits: 2,
						})}{' '}
						张 ·{' '}
						{balance.isOptimal
							? balance.sumSquares === balance.lowerBound
								? '已均分，数量差不超过 1'
								: '约束内最均衡'
							: isRunning
								? '均衡搜索中'
								: '均衡尚未证明'}
					</span>
				</div>
			)}
			{solution ? (
				<CabinetCanvas solution={solution} direction={direction} senderName={senderName} />
			) : (
				<div className={styles.emptyDiagram}>
					<Icon name='grid' size={36} />
					<span>{isRunning ? '正在计算矩形分区…' : '输入参数，生成接线图。'}</span>
				</div>
			)}
			{solution && (
				<CabinetDevices
					solution={solution}
					senderName={senderName}
					visitedStates={progress?.visitedStates ?? 0}
				/>
			)}
		</section>
	)
}

export default function CabinetPage() {
	const [mode, setMode] = useState<CabinetMode>('regular')
	const [senderName, setSenderName] = useState('V6')
	const displaySenderName = senderName.trim() || '发送卡'
	const [draft, setDraft] = useState<ConfigurationDraft>(DEFAULT_CONFIGURATION)
	const [configuration, setConfiguration] = useState(DEFAULT_CONFIGURATION)
	const [progress, setProgress] = useState<CabinetProgressPair>({ row: null, column: null })
	const [running, setRunning] = useState({ row: false, column: false })
	const [error, setError] = useState('')
	const [jsonInput, setJsonInput] = useState('')
	const [importMessage, setImportMessage] = useState<{ error: boolean; text: string } | null>(null)
	const workers = useRef<(() => void) | null>(null)
	const runId = useRef(0)
	const hasChanges = Object.keys(configuration).some(
		(key) =>
			draft[key as keyof CabinetConfiguration] !== configuration[key as keyof CabinetConfiguration],
	)
	const isRunning = running.row || running.column
	const areBothOptimal =
		progress.row?.solution?.isOptimal &&
		progress.column?.solution?.isOptimal &&
		compareCabinetSolutions(progress.row.solution, progress.column.solution) === 0
	const maximumReceiverWidth = (draft.receiverColumns ?? 0) * (draft.moduleWidth ?? 0)
	const maximumReceiverHeight = (draft.receiverRows ?? 0) * (draft.moduleHeight ?? 0)
	const moduleColumns = Math.floor((draft.screenWidth ?? 0) / Math.max(1, draft.moduleWidth ?? 0))
	const moduleRows = Math.floor((draft.screenHeight ?? 0) / Math.max(1, draft.moduleHeight ?? 0))
	const moduleGridWidth = moduleColumns * (draft.moduleWidth ?? 0)
	const moduleGridHeight = moduleRows * (draft.moduleHeight ?? 0)
	const realSenderLoad = Math.min(
		draft.senderMaxLoad ?? 0,
		(draft.senderPorts ?? 0) * (draft.portLoad ?? 0),
	)

	const stopWorkers = useCallback(() => {
		runId.current++
		workers.current?.()
		workers.current = null
	}, [])
	const startCalculation = useCallback(
		(next: CabinetConfiguration, nextMode: CabinetMode) => {
			stopWorkers()
			const message = getCabinetConfigurationError(next)
			if (message) {
				setError(message)
				setRunning({ row: false, column: false })
				return
			}
			const currentRun = runId.current
			setProgress({ row: null, column: null })
			setRunning({ row: true, column: true })
			setConfiguration({ ...next })
			setError('')
			workers.current = startCabinetCalculation({
				configuration: next,
				mode: nextMode,
				createWorker: () =>
					new Worker(new URL('./cabinet.worker.ts', import.meta.url), { type: 'module' }),
				onProgress: (update) => {
					if (runId.current === currentRun) startTransition(() => setProgress(update))
				},
				onDirectionStopped: (direction) => {
					if (runId.current === currentRun)
						startTransition(() => setRunning((current) => ({ ...current, [direction]: false })))
				},
				onError: (calculationError) => {
					if (runId.current === currentRun) setError(calculationError)
				},
			})
		},
		[stopWorkers],
	)
	useEffect(() => {
		startCalculation(DEFAULT_CONFIGURATION, 'regular')
		return stopWorkers
	}, [startCalculation, stopWorkers])
	useEffect(() => {
		if (!jsonInput.trim()) {
			return
		}
		const timer = setTimeout(() => {
			try {
				const imported = parseCabinetConfigurationJson(jsonInput)
				setDraft(imported.configuration)
				setSenderName(imported.senderName)
				setError('')
				setImportMessage({ error: false, text: '已识别全部参数，请点击“应用参数并计算”。' })
			} catch (importError) {
				setImportMessage({
					error: true,
					text: importError instanceof Error ? importError.message : 'JSON 识别失败。',
				})
			}
		}, 300)
		return () => clearTimeout(timer)
	}, [jsonInput])
	const handleCalculate = () => {
		const next = draft as CabinetConfiguration
		const message = getCabinetConfigurationError(next)
		if (message) {
			setError(message)
			return
		}
		startCalculation(next, mode)
	}
	const handleModeChange = (nextMode: CabinetMode) => {
		if (nextMode === mode) return
		setMode(nextMode)
		const next = draft as CabinetConfiguration
		const message = getCabinetConfigurationError(next)
		if (message) {
			stopWorkers()
			setRunning({ row: false, column: false })
			setProgress({ row: null, column: null })
			setError(message)
			return
		}
		startCalculation(next, nextMode)
	}
	const handleMillionExample = () => {
		const next: CabinetConfiguration = {
			screenWidth: 480000,
			screenHeight: 270000,
			moduleWidth: 480,
			moduleHeight: 270,
			receiverColumns: 1,
			receiverRows: 1,
			senderMaxWidth: 10240,
			senderMaxHeight: 10240,
			senderMaxLoad: 10485760,
			senderPorts: 16,
			portLoad: 650000,
		}
		setDraft(next)
		setSenderName('H16')
		setJsonInput('')
		setImportMessage(null)
		startCalculation(next, mode)
	}
	const handleCancel = () => {
		stopWorkers()
		setRunning({ row: false, column: false })
	}
	return (
		<main className={styles.page}>
			<div className={styles.heading}>
				<div>
					<a href='#/' className={styles.backLink}>
						<Icon name='back' size={16} />
						算法目录
					</a>
					<h1>
						极限箱体 <span>带载优化</span>
					</h1>
					<p>按完整单元板规划带载，优化设备数量与接收卡分配。</p>
				</div>
				<div className={styles.priority}>
					<span>优化顺序</span>
					<strong>
						发送卡 <b>→</b> 接收卡 <b>→</b> 均衡 <b>→</b> 网线
					</strong>
					<small>前一项最少后，再优化后一项</small>
				</div>
			</div>
			<div className={styles.workspace}>
				<aside className={styles.sidebar}>
					<section className={`${styles.parameterGroup} ${styles.jsonImport}`}>
						<div className={styles.groupHeading}>
							<h2>导入 JSON 识别参数</h2>
						</div>
						<Input.TextArea
							value={jsonInput}
							aria-label='导入 JSON 识别参数'
							placeholder='粘贴完整方案 JSON，自动填入下方参数'
							rows={4}
							onChange={(event) => {
								const value = event.target.value
								setImportMessage(null)
								if (value.length > MAX_CABINET_JSON_LENGTH) {
									setJsonInput('')
									setImportMessage({
										error: true,
										text: 'JSON 过大，请仅导入 1 MB 以内的方案参数。',
									})
									return
								}
								setJsonInput(value)
							}}
						/>
						{importMessage && (
							<Alert
								type={importMessage.error ? 'error' : 'success'}
								message={importMessage.text}
								showIcon
							/>
						)}
					</section>
					{FIELD_GROUPS.map((group) => (
						<section className={styles.parameterGroup} key={group.title}>
							<div className={styles.groupHeading}>
								<h2>{group.title}</h2>
								<span>{group.hint}</span>
							</div>
							<div className={styles.inputGrid}>
								{group.title === '发送卡' && (
									<label className={styles.nameField}>
										<span>发送卡名称</span>
										<Input
											value={senderName}
											aria-label='发送卡名称'
											placeholder='例如 V6'
											maxLength={120}
											onChange={(event) => setSenderName(event.target.value)}
										/>
									</label>
								)}
								{group.fields.map(({ key, label }) => (
									<label key={key}>
										<span>{label}</span>
										<InputNumber
											min={1}
											precision={0}
											step={1}
											controls={false}
											value={draft[key]}
											aria-label={label}
											onChange={(value) => {
												setDraft((current) => ({ ...current, [key]: value }))
												setError('')
											}}
										/>
									</label>
								))}
							</div>
							{group.title === '接收卡' && (
								<div className={styles.calculated}>
									最大尺寸{' '}
									<strong>
										{cabinetNumber(maximumReceiverWidth)} × {cabinetNumber(maximumReceiverHeight)}{' '}
										px
									</strong>
								</div>
							)}
							{group.title === '模组' && (
								<div className={styles.calculated}>
									自动向下取整{' '}
									<strong>
										{cabinetNumber(moduleColumns)} 列 × {cabinetNumber(moduleRows)} 行
									</strong>
									<small>
										有效模组区 {cabinetNumber(moduleGridWidth)} × {cabinetNumber(moduleGridHeight)}{' '}
										px
									</small>
								</div>
							)}
							{group.title === '发送卡' && (
								<div className={styles.calculated}>
									真实极限带载 <strong>{cabinetNumber(realSenderLoad)} px²</strong>
									<small>min(极限带载, 网口数量 × 网口带载)</small>
								</div>
							)}
						</section>
					))}
					<div className={styles.calculateActions}>
						<Button block onClick={handleMillionExample}>
							加载 100 万接收卡示例
						</Button>
						<Button type='primary' block onClick={handleCalculate}>
							{hasChanges ? '应用参数并计算' : '重新计算'}
						</Button>
						{isRunning && (
							<Button block onClick={handleCancel}>
								停止搜索，保留当前方案
							</Button>
						)}
						{error && <Alert type='error' message={error} showIcon />}
					</div>
					<div className={styles.rules}>
						<h2>图层与接线</h2>
						<p>
							<i className={styles.screenLegend} />
							灰色底层是显示屏，白色网格是完整模组；右侧、底部不足一块的余量保留为灰色。
						</p>
						<p>
							<i className={styles.receiverLegend} />
							接收卡按完整模组组合，可在上限内缩小。
						</p>
						<p>
							<i className={styles.senderLegend} />
							{mode === 'regular'
								? '彩色外框是发送卡，虚线框是一根网线的矩形范围。'
								: '发送卡仍为矩形覆盖；同一网口只连接共享边的相邻接收卡，可连续转弯。'}
						</p>
						<p>卡内显示发送卡名称与序号、实际宽高、模组数量及网线编号。</p>
						<p>圆形起点内为“发送卡序号-本卡网口序号”，三角箭头表示方向，方块为终点。</p>
					</div>
				</aside>
				<div className={styles.results}>
					<CabinetStructure solution={progress.row?.solution ?? progress.column?.solution} />
					<div className={styles.modeTabs} role='tablist' aria-label='接线模式'>
						{(['regular', 'free'] as const).map((item) => (
							<button
								key={item}
								id={`cabinet-mode-${item}`}
								type='button'
								role='tab'
								aria-selected={mode === item}
								aria-controls='cabinet-mode-results'
								tabIndex={mode === item ? 0 : -1}
								onClick={() => handleModeChange(item)}
								onKeyDown={(event) => {
									if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
										event.preventDefault()
										const nextMode = mode === 'regular' ? 'free' : 'regular'
										handleModeChange(nextMode)
										document.getElementById(`cabinet-mode-${nextMode}`)?.focus()
									}
								}}>
								{item === 'regular' ? '常规' : '自由'}
								<span>{item === 'regular' ? '网线覆盖矩形' : '接收卡逐个连接'}</span>
							</button>
						))}
					</div>
					<div id='cabinet-mode-results' role='tabpanel' aria-labelledby={`cabinet-mode-${mode}`}>
						<div className={styles.status} role='status' aria-live='polite'>
							<i className={areBothOptimal ? styles.statusComplete : ''} />
							<span>
								{hasChanges
									? progress.row?.solution || progress.column?.solution
										? '参数已修改；下方仍为上一次计算结果。'
										: '参数已修改；请填写有效参数后计算。'
									: areBothOptimal
										? '行、列方案均达到同一全局最优，显示两份接线图。'
										: isRunning
											? '4 线程分片计算中，正在比较可行方案…'
											: progress.row?.stage === 'recommended' &&
												  progress.column?.stage === 'recommended'
												? '大屏方案推荐完成，全部接收卡均可绘制；推荐结果未证明全局最优。'
												: '搜索已停止；未证明最优的方案仍为当前可行结果。'}
							</span>
							{isRunning && (
								<button type='button' className={styles.stopSearch} onClick={handleCancel}>
									停止搜索
								</button>
							)}
						</div>
						<div className={styles.solutionGrid}>
							<SolutionPanel
								direction='row'
								progress={progress.row}
								isRunning={running.row}
								senderName={displaySenderName}
							/>
							<SolutionPanel
								direction='column'
								progress={progress.column}
								isRunning={running.column}
								senderName={displaySenderName}
							/>
						</div>
						<div className={styles.proofNote}>
							<p>
								{mode === 'regular'
									? '网线与发送卡均为矩形分区。'
									: '网线沿共享边相邻的接收卡连续连接，允许不规则覆盖；发送卡仍为矩形分区。'}
								接收卡不重叠、不越界，每个网口按实际接收卡带载独立校验。
							</p>
							<p>
								大屏自动采用紧凑布局推荐；总览按比例显示全部区域，放大后查看接收卡、文字及接线细节。可按序号定位任意接收卡。
							</p>
						</div>
					</div>
				</div>
			</div>
		</main>
	)
}
