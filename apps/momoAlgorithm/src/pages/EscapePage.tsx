import type { EscapeConstraint, EscapeLimits, EscapeRectangle } from '@momo/utils/rectangleEscape'
import {
	constrainRectangleMove,
	findRectanglePlacement,
	getEscapeViolation,
	getRectangleBounds,
	isValidEscapeLimits,
} from '@momo/utils/rectangleEscape'
import { Alert, Button, InputNumber, Modal } from 'antd'
import { useRef, useState } from 'react'
import Icon from '../components/Icon'
import styles from './EscapePage.module.less'
import RectangleCanvas, { formatNumber, getRectangleColor } from './RectangleCanvas'

const DEFAULT_LIMITS: EscapeLimits = { width: 800, height: 600, maxWidth: 1000, maxHeight: 800 }
const LIMIT_FIELDS: { key: keyof EscapeLimits; label: string }[] = [
	{ key: 'width', label: '大矩形宽' },
	{ key: 'height', label: '大矩形高' },
	{ key: 'maxWidth', label: '大矩形极限宽' },
	{ key: 'maxHeight', label: '大矩形极限高' },
]
const CONSTRAINT_LABELS: Record<EscapeConstraint, string> = {
	width: '极限宽',
	height: '极限高',
	area: '面积上限',
	invalid: '有效数值范围',
}
type LimitDraft = Record<keyof EscapeLimits, number | null>

function UsageMeter({
	label,
	value,
	maximum,
	unit,
}: {
	label: string
	value: number
	maximum: number
	unit: string
}) {
	const percent = (value / maximum) * 100
	return (
		<div className={styles.usageMeter}>
			<div>
				<span>{label}</span>
				<span>
					{formatNumber(value)}{' '}
					<small>
						/ {formatNumber(maximum)} {unit}
					</small>
				</span>
			</div>
			<div className={styles.meterTrack}>
				<div
					style={{
						width: `${Math.min(100, percent)}%`,
						background: percent > 99.5 ? '#ca922e' : '#087f8c',
					}}
				/>
			</div>
		</div>
	)
}

export default function EscapePage() {
	const [limits, setLimits] = useState<EscapeLimits>(DEFAULT_LIMITS)
	const [draft, setDraft] = useState<LimitDraft>(DEFAULT_LIMITS)
	const [rectangles, setRectangles] = useState<EscapeRectangle[]>([])
	const rectanglesRef = useRef(rectangles)
	const nextIdRef = useRef(1)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [constraint, setConstraint] = useState<EscapeConstraint | null>(null)
	const [configurationError, setConfigurationError] = useState('')
	const [notice, setNotice] = useState('')
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [newSize, setNewSize] = useState<{ width: number | null; height: number | null }>({
		width: 160,
		height: 120,
	})
	const [additionError, setAdditionError] = useState('')
	const bounds = getRectangleBounds(rectangles) ?? {
		x: 0,
		y: 0,
		width: limits.width,
		height: limits.height,
	}
	const area = bounds.width * bounds.height
	const maximumArea = limits.width * limits.height
	const selectedRectangle = rectangles.find((rectangle) => rectangle.id === selectedId)
	const hasDraftChanges = LIMIT_FIELDS.some(({ key }) => draft[key] !== limits[key])

	const updateRectangles = (nextRectangles: EscapeRectangle[]) => {
		rectanglesRef.current = nextRectangles
		setRectangles(nextRectangles)
	}
	const handleApplyLimits = () => {
		if (LIMIT_FIELDS.some(({ key }) => draft[key] === null)) {
			setConfigurationError('请填写全部参数，数值必须大于 0。')
			return
		}
		const nextLimits = draft as EscapeLimits
		if (!isValidEscapeLimits(nextLimits)) {
			setConfigurationError('请输入大于 0 的有限数值，极限宽和极限高不能小于初始宽高。')
			return
		}
		const currentBounds = getRectangleBounds(rectanglesRef.current)
		const violation = currentBounds && getEscapeViolation(currentBounds, nextLimits)
		if (violation) {
			setConfigurationError(
				`当前包围框超过新设置的${CONSTRAINT_LABELS[violation]}，请先移动或删除小矩形。`,
			)
			return
		}
		setLimits({ ...nextLimits })
		setConfigurationError('')
		setConstraint(null)
		setNotice('参数已应用。')
	}
	const handleOpenAddition = () => {
		setAdditionError('')
		setIsModalOpen(true)
	}
	const handleAddRectangle = () => {
		const { width, height } = newSize
		if (
			width === null ||
			height === null ||
			!Number.isFinite(width) ||
			!Number.isFinite(height) ||
			width <= 0 ||
			height <= 0
		) {
			setAdditionError('请输入大于 0 的有效宽度和高度。')
			return
		}
		const sizeViolation = getEscapeViolation({ x: 0, y: 0, width, height }, limits)
		if (sizeViolation) {
			setAdditionError(`小矩形超过${CONSTRAINT_LABELS[sizeViolation]}，请减小尺寸。`)
			return
		}
		const placement = findRectanglePlacement(
			rectanglesRef.current,
			{ width, height },
			limits,
			String(nextIdRef.current),
		)
		if (!placement) {
			setAdditionError('新增后的包围框无法同时满足面积和极限宽高，请减小尺寸或调整参数。')
			return
		}
		nextIdRef.current++
		updateRectangles([...rectanglesRef.current, placement.rectangle])
		setSelectedId(placement.rectangle.id)
		setConstraint(null)
		setNotice(
			placement.hasOverlap
				? '已新增小矩形。当前空间有限，允许重叠，可拖动调整位置。'
				: '已新增小矩形，可在画布中拖动。',
		)
		setIsModalOpen(false)
	}
	const handleMoveRectangle = (id: string, position: { x: number; y: number }) => {
		const result = constrainRectangleMove(rectanglesRef.current, id, position, limits)
		updateRectangles(
			rectanglesRef.current.map((rectangle) =>
				rectangle.id === id ? result.rectangle : rectangle,
			),
		)
		setConstraint(result.constraint)
		setNotice('')
	}
	const handleDeleteRectangle = (id: string) => {
		updateRectangles(rectanglesRef.current.filter((rectangle) => rectangle.id !== id))
		if (selectedId === id) setSelectedId(null)
		setConstraint(null)
		setNotice('已删除小矩形，包围框已更新。')
	}
	const handleClear = () => {
		updateRectangles([])
		setSelectedId(null)
		setConstraint(null)
		setNotice('画布已清空，显示初始大矩形。')
	}

	return (
		<main className={styles.page}>
			<div className={styles.pageHeading}>
				<div>
					<a
						href='#/'
						className={styles.backLink}
					>
						<Icon
							name='back'
							size={16}
						/>
						算法目录
					</a>
					<div className={styles.titleLine}>
						<h1>防逃逸</h1>
						<span>几何约束</span>
					</div>
					<p>外框紧贴小矩形，面积与边长始终保持在限制内。</p>
				</div>
				<div className={styles.headingFormula}>
					<span>BOUNDING AREA</span>
					<strong>W × H ≤ {formatNumber(maximumArea)}</strong>
				</div>
			</div>
			<div className={styles.workspace}>
				<aside className={styles.sidebar}>
					<section className={styles.controlSection}>
						<div className={styles.sectionHeading}>
							<h2>边界设置</h2>
							<span>单位 px</span>
						</div>
						<div className={styles.parameterHint}>宽 × 高定义面积上限，极限宽高约束边长。</div>
						<div className={styles.inputGrid}>
							{LIMIT_FIELDS.map(({ key, label }, index) => (
								<label
									key={key}
									className={`${styles.numberField} ${index > 1 ? styles.limitField : ''}`}
								>
									<span>{label}</span>
									<InputNumber
										min={0.01}
										step={1}
										value={draft[key]}
										onChange={(value) => {
											setDraft((current) => ({ ...current, [key]: value }))
											setConfigurationError('')
										}}
										aria-label={label}
										controls={false}
									/>
								</label>
							))}
						</div>
						<div className={styles.actualArea}>
							<span>
								真实面积 <small>px²</small>
							</span>
							<strong data-testid='actual-area'>{formatNumber(area)}</strong>
						</div>
						{configurationError && (
							<Alert
								type='error'
								message={configurationError}
								showIcon
								className={styles.alert}
							/>
						)}
						<Button
							block
							onClick={handleApplyLimits}
							disabled={!hasDraftChanges}
							className={styles.applyButton}
						>
							应用参数{hasDraftChanges && <span className={styles.pendingDot} />}
						</Button>
					</section>
					<section className={styles.controlSection}>
						<div className={styles.sectionHeading}>
							<h2>小矩形</h2>
							<span>{rectangles.length} 个</span>
						</div>
						<Button
							type='primary'
							block
							icon={<Icon name='plus' />}
							onClick={handleOpenAddition}
							className={styles.addButton}
						>
							新增小矩形
						</Button>
						{rectangles.length ? (
							<div className={styles.rectangleList}>
								{rectangles.map((rectangle) => (
									<div
										key={rectangle.id}
										className={`${styles.rectangleRow} ${rectangle.id === selectedId ? styles.selectedRow : ''}`}
									>
										<button
											type='button'
											className={styles.rectangleSelect}
											onClick={() => setSelectedId(rectangle.id)}
											aria-pressed={rectangle.id === selectedId}
										>
											<span
												className={styles.rectangleSwatch}
												style={{ background: getRectangleColor(rectangle.id) }}
											/>
											<strong>R{rectangle.id}</strong>
											<span>
												{formatNumber(rectangle.width)} × {formatNumber(rectangle.height)}
											</span>
										</button>
										<button
											type='button'
											className={styles.deleteButton}
											onClick={() => handleDeleteRectangle(rectangle.id)}
											aria-label={`删除小矩形 ${rectangle.id}`}
											title='删除'
										>
											<Icon
												name='trash'
												size={15}
											/>
										</button>
									</div>
								))}
							</div>
						) : (
							<p className={styles.listHint}>输入宽高，添加第一个小矩形。</p>
						)}
						{selectedRectangle && (
							<div className={styles.coordinates}>
								选中 R{selectedRectangle.id}
								<span>
									x {formatNumber(selectedRectangle.x)} · y {formatNumber(selectedRectangle.y)}
								</span>
							</div>
						)}
						{rectangles.length > 0 && (
							<button
								type='button'
								className={styles.clearButton}
								onClick={handleClear}
							>
								<Icon
									name='reset'
									size={14}
								/>
								清空画布
							</button>
						)}
					</section>
					<section className={styles.ruleSection}>
						<h2>如何约束</h2>
						<p>
							<span className={styles.legendLine} />
							青色边框是所有小矩形的最小包围框。
						</p>
						<p>拖动到达面积或边长上限时，矩形会停在边界。向内拖动即可继续。</p>
						<p>小矩形允许重叠，包围框不额外留白。</p>
					</section>
				</aside>
				<div className={styles.mainPanel}>
					<div
						className={`${styles.statusBar} ${constraint ? styles.limitedStatus : ''}`}
						role='status'
						aria-live='polite'
					>
						<span className={styles.statusDot} />
						<span>
							{constraint
								? `已到达${CONSTRAINT_LABELS[constraint]}，向内拖动可继续。`
								: notice ||
									(rectangles.length
										? '所有矩形均在约束范围内。'
										: '等待添加小矩形 · 当前显示初始宽高。')}
						</span>
					</div>
					<RectangleCanvas
						rectangles={rectangles}
						bounds={bounds}
						limits={limits}
						selectedId={selectedId}
						constraint={constraint}
						onSelect={setSelectedId}
						onMove={handleMoveRectangle}
						onAdd={handleOpenAddition}
					/>
					<section
						className={styles.metrics}
						aria-label='实时约束指标'
					>
						<div className={styles.boundsMetric}>
							<span>实时包围框</span>
							<strong>
								{formatNumber(bounds.width)} <small>×</small> {formatNumber(bounds.height)}
							</strong>
							<p>
								左上角 ({formatNumber(bounds.x)}, {formatNumber(bounds.y)})
							</p>
						</div>
						<UsageMeter
							label='面积占用'
							value={area}
							maximum={maximumArea}
							unit='px²'
						/>
						<UsageMeter
							label='宽度占用'
							value={bounds.width}
							maximum={limits.maxWidth}
							unit='px'
						/>
						<UsageMeter
							label='高度占用'
							value={bounds.height}
							maximum={limits.maxHeight}
							unit='px'
						/>
					</section>
				</div>
			</div>
			<Modal
				title='新增小矩形'
				open={isModalOpen}
				onCancel={() => setIsModalOpen(false)}
				onOk={handleAddRectangle}
				okText='确认添加'
				cancelText='取消'
				width={420}
			>
				<p className={styles.modalHint}>设置小矩形尺寸，添加后可直接在画布中拖动。</p>
				<div className={styles.inputGrid}>
					<label className={styles.numberField}>
						<span>小矩形宽（px）</span>
						<InputNumber
							autoFocus
							min={0.01}
							value={newSize.width}
							onChange={(value) => {
								setNewSize((current) => ({ ...current, width: value }))
								setAdditionError('')
							}}
							aria-label='小矩形宽'
							onPressEnter={handleAddRectangle}
						/>
					</label>
					<label className={styles.numberField}>
						<span>小矩形高（px）</span>
						<InputNumber
							min={0.01}
							value={newSize.height}
							onChange={(value) => {
								setNewSize((current) => ({ ...current, height: value }))
								setAdditionError('')
							}}
							aria-label='小矩形高'
							onPressEnter={handleAddRectangle}
						/>
					</label>
				</div>
				<div className={styles.modalArea}>
					小矩形面积<span>{formatNumber((newSize.width ?? 0) * (newSize.height ?? 0))} px²</span>
				</div>
				{additionError && (
					<Alert
						type='error'
						message={additionError}
						showIcon
					/>
				)}
			</Modal>
		</main>
	)
}
