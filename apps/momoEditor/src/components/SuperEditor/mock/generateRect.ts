import { CmpType, generateCmp } from '@momo/leafer-draw';
import { getStorage } from '../store/engine';
import { MODELSTOREKEY } from '../utils/storage';

interface Props {
  xCount: number;
  yCount: number;
  width?: number;
  height?: number;
}

const generateRect = ({ xCount, yCount, width = 50, height = 50 }: Props) => {
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
  const storage = getStorage(MODELSTOREKEY);
  storage?.setItem(
    MODELSTOREKEY,
    JSON.stringify({ state: { cmps: rectComps, selectCmpIds: [], zoomLayer: {} }, version: 0 }),
  );
  return rectComps;
};

export default generateRect;
