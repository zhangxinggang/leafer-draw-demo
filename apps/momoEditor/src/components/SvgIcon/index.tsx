import React from 'react';
import { icons } from '../../assets/svg';

interface SvgIconProps {
  name: string;
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SvgIcon: React.FC<SvgIconProps> = ({ name, size = 18, color, className, style }) => {
  // 处理 SVG 字符串，添加样式属性
  const processedSvg = icons[name]
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`)
    .replace(/fill="[^"]*"/, color ? `fill="${color}"` : 'fill="currentColor"')
    .replace(/class="[^"]*"/, className ? `class="${className}"` : '');
  return (
    <img
      src={processedSvg}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        padding: 8,
        ...style,
      }}
    />
  );
};

export default SvgIcon;
