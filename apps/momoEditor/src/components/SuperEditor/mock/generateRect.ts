import { CmpType, generateCmp } from '@momo/leafer-draw';
import type { LargeRectGridScene } from '@momo/leafer-draw/types/largeScene';
import {
  LARGE_SCENE_THRESHOLD,
  createLargeRectGridScene,
} from '@momo/leafer-draw/types/largeScene';

interface Props {
  xCount: number;
  yCount: number;
  width?: number;
  height?: number;
  textLines?: string[];
}

export type RectGenerationResult =
  | { mode: 'elements'; cmps: any[] }
  | { mode: 'large'; scene: LargeRectGridScene };

const generateRect = ({
  xCount,
  yCount,
  width = 100,
  height = 100,
  textLines = [],
}: Props): RectGenerationResult => {
  const totalCount = xCount * yCount;
  if (totalCount >= LARGE_SCENE_THRESHOLD) {
    return {
      mode: 'large',
      scene: createLargeRectGridScene({
        columns: xCount,
        rows: yCount,
        cellWidth: width,
        cellHeight: height,
        textLines,
      }),
    };
  }

  const rectComps: any[] = [];
  for (let i = 0; i < xCount; i++) {
    for (let j = 0; j < yCount; j++) {
      const x = i * width;
      const y = j * height;
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const rectData: any = {
        startX: x - halfWidth,
        startY: y - halfHeight,
        endX: x + halfWidth,
        endY: y + halfHeight,
      };
      rectData.leaferAttr = {
        zIndex: 1,
        stroke: '#505057',
        strokeWidth: 1,
        fill: 'rgba(255, 255, 255, 0.66)',
      };
      const rectComp: any = generateCmp(CmpType.RectLine, rectData);
      rectComps.push(rectComp);
    }
  }
  return { mode: 'elements', cmps: rectComps };
};

export default generateRect;
