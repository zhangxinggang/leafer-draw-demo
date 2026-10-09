import { useEffect, useState } from 'react'
import { ALGORITHM_LIST } from './algorithms'
import styles from './App.module.less'
import Icon from './components/Icon'
import CabinetPage from './pages/CabinetPage'
import EscapePage from './pages/EscapePage'

function CabinetIllustration() {
	return (
		<svg viewBox='0 0 400 220' className={styles.illustration} aria-hidden='true'>
			<defs>
				<pattern id='cabinet-card-grid' width='26' height='26' patternUnits='userSpaceOnUse'>
					<rect width='26' height='26' fill='#dce3e9' stroke='#fff' />
				</pattern>
				<marker
					id='cabinet-card-arrow'
					viewBox='0 0 10 10'
					refX='8'
					refY='5'
					markerWidth='5'
					markerHeight='5'
					orient='auto'
				>
					<path d='M0 0L10 5L0 10z' fill='#087f8c' />
				</marker>
			</defs>
			<rect x='44' y='32' width='312' height='156' fill='url(#cabinet-card-grid)' />
			{Array.from({ length: 18 }, (_, index) => (
				<rect
					key={index}
					x={44 + (index % 6) * 52}
					y={32 + Math.floor(index / 6) * 52}
					width='52'
					height='52'
					fill='none'
					stroke='#8097a8'
					strokeWidth='1.5'
				/>
			))}
			{[0, 1, 2].map((index) => (
				<path
					key={index}
					d={`M${70 + index * 104} 58h52v52h-52v52h52`}
					fill='none'
					stroke={['#087f8c', '#427cd1', '#b46542'][index]}
					strokeWidth='2'
					markerEnd='url(#cabinet-card-arrow)'
				/>
			))}
			<rect x='44' y='32' width='208' height='156' fill='none' stroke='#087f8c' strokeWidth='3' />
			<rect x='252' y='32' width='104' height='156' fill='none' stroke='#b46542' strokeWidth='3' />
		</svg>
	)
}

function RectangleIllustration() {
	return (
		<svg viewBox='0 0 400 220' className={styles.illustration} aria-hidden='true'>
			<defs>
				<pattern id='card-grid' width='20' height='20' patternUnits='userSpaceOnUse'>
					<circle cx='1' cy='1' r='1' fill='#c9dce4' />
				</pattern>
			</defs>
			<rect width='400' height='220' fill='url(#card-grid)' />
			<rect
				x='70'
				y='46'
				width='260'
				height='140'
				rx='1'
				fill='#087f8c'
				fillOpacity='.04'
				stroke='#087f8c'
				strokeWidth='2'
			/>
			<rect
				x='70'
				y='46'
				width='105'
				height='78'
				rx='3'
				fill='#e8bd67'
				fillOpacity='.3'
				stroke='#ca922e'
				strokeWidth='2'
			/>
			<rect
				x='198'
				y='88'
				width='132'
				height='98'
				rx='3'
				fill='#427cd1'
				fillOpacity='.17'
				stroke='#427cd1'
				strokeWidth='2'
			/>
			<rect
				x='110'
				y='138'
				width='64'
				height='48'
				rx='3'
				fill='#c26586'
				fillOpacity='.18'
				stroke='#c26586'
				strokeWidth='2'
			/>
			<path d='M70 28h260M70 22v12m260-12v12M348 46v140m-6-140h12m-12 140h12' stroke='#8097a8' />
			<text x='200' y='20' textAnchor='middle' fill='#4e697c' fontSize='12' fontFamily='monospace'>
				W ≤ maxWidth
			</text>
			<path d='m249 119 10 7-6 2-1 7z' fill='#203649' stroke='#fff' strokeWidth='1.5' />
		</svg>
	)
}

export default function App() {
	const [route, setRoute] = useState(() => window.location.hash)
	useEffect(() => {
		const handleHashChange = () => setRoute(window.location.hash)
		window.addEventListener('hashchange', handleHashChange)
		return () => window.removeEventListener('hashchange', handleHashChange)
	}, [])
	const isEscape = route === '#/algorithms/rectangle-escape'
	const isCabinet = route === '#/algorithms/extreme-cabinet'
	useEffect(() => {
		document.title = `${isEscape ? '防逃逸' : isCabinet ? '极限箱体' : '算法实验室'} · Momo Algorithm`
	}, [isEscape, isCabinet])
	return (
		<div className={styles.app}>
			<header className={styles.header}>
				<a href='#/' className={styles.brand} aria-label='Momo Algorithm 算法首页'>
					<span className={styles.brandMark}>
						<Icon name='grid' size={23} />
					</span>
					<span>
						momo<span className={styles.brandSuffix}>algorithm</span>
					</span>
				</a>
				<div className={styles.headerLabel}>
					交互算法实验室
					<span className={styles.headerDot} />
				</div>
			</header>
			{isEscape ? (
				<EscapePage />
			) : isCabinet ? (
				<CabinetPage />
			) : (
				<main className={styles.catalog}>
					<div className={styles.catalogIntro}>
						<span className={styles.eyebrow}>ALGORITHM PLAYGROUND</span>
						<h1>让算法，看得见。</h1>
						<p>选择一个实验，在画布上操作，理解每一次变化背后的规则。</p>
					</div>
					<div className={styles.catalogHeading}>
						<h2>算法目录</h2>
						<span>
							{ALGORITHM_LIST.filter((algorithm) => algorithm.isAvailable).length} 个实验可用
						</span>
					</div>
					<div className={styles.cardGrid}>
						{ALGORITHM_LIST.map((algorithm) => (
							<article
								key={algorithm.id}
								className={`${styles.card} ${algorithm.isAvailable ? styles.activeCard : styles.comingCard}`}
							>
								{algorithm.isAvailable ? (
									algorithm.id === 'extreme-cabinet' ? (
										<CabinetIllustration />
									) : (
										<RectangleIllustration />
									)
								) : (
									<div className={styles.placeholderArt}>
										<Icon name='grid' size={44} />
										<span>实验筹备中</span>
									</div>
								)}
								<div className={styles.cardContent}>
									<span className={styles.category}>{algorithm.category}</span>
									<h3>{algorithm.name}</h3>
									<p>{algorithm.description}</p>
									<div className={styles.tagList}>
										{algorithm.tags.map((tag) => (
											<span key={tag}>{tag}</span>
										))}
									</div>
									{algorithm.isAvailable ? (
										<a href={`#/algorithms/${algorithm.id}`} className={styles.cardLink}>
											进入实验
											<Icon name='arrow' />
										</a>
									) : (
										<span className={styles.comingLabel}>待开放</span>
									)}
								</div>
							</article>
						))}
					</div>
					<footer className={styles.catalogFooter}>
						从移动一个矩形开始，探索几何约束。<span>momo / geometry lab</span>
					</footer>
				</main>
			)}
		</div>
	)
}
