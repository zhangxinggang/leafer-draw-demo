// 导出所有 SVG 图标作为 React 组件
import HandSvg from './hand.svg';
import ChooseSvg from './choose.svg';
import CircleSvg from './circle.svg';

export { HandSvg, ChooseSvg, CircleSvg };

// 也可以创建一个图标映射对象，方便动态使用
export const icons = {
  hand: HandSvg,
  choose: ChooseSvg,
  circle: CircleSvg,
} as const;

export type IconName = keyof typeof icons;
