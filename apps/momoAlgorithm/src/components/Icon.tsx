interface IconProps {
	name: 'arrow' | 'back' | 'plus' | 'close' | 'trash' | 'fit' | 'move' | 'grid' | 'reset'
	size?: number
}

const PATHS: Record<IconProps['name'], string> = {
	arrow: 'M5 12h14m-6-6 6 6-6 6',
	back: 'M19 12H5m6-6-6 6 6 6',
	plus: 'M12 5v14M5 12h14',
	close: 'm6 6 12 12M6 18 18 6',
	trash: 'M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7m4-7v7',
	fit: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5M9 9h6v6H9z',
	move: 'M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
	grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
	reset: 'M4 10a8 8 0 1 1 1 7M4 4v6h6',
}

export default function Icon({ name, size = 18 }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='1.7'
			strokeLinecap='round'
			strokeLinejoin='round'
			aria-hidden='true'
		>
			<path d={PATHS[name]} />
		</svg>
	)
}
