import { AlignType, Cmp } from '../types';

let beginIndex = 0;
function swap<T>(array: T[], index: number, swapIdx: number) {
  const temp = array[index];
  array[index] = array[swapIdx];
  array[swapIdx] = temp;
}
function uuid(flag = 'id') {
  beginIndex++;
  return `${flag}-${new Date().getTime()}-${beginIndex}`;
}

const checkIsIrregularElement = (element: Cmp) => {
  const { text, fontSize, path, points } = element;
  if (text || fontSize || path || points) return true;
  return false;
};
const getIrregularElementMinAndMax = (element: Cmp, keepOrigin?: boolean) => {
  const { x = 0, y = 0, text, fontSize, path, points } = element;
  let minX = x || 0;
  let minY = y || 0;
  let maxX = x || 0;
  let maxY = y || 0;
  const resetMinXY = (pis: number[]) => {
    minX = (keepOrigin ? 0 : x) + Math.min(pis[0], pis[2]);
    minY = (keepOrigin ? 0 : y) + Math.min(pis[1], pis[3]);
    maxX = (keepOrigin ? 0 : x) + Math.max(pis[0], pis[2]);
    maxY = (keepOrigin ? 0 : y) + Math.max(pis[1], pis[3]);
  };
  if (typeof text !== 'undefined' && typeof fontSize !== 'undefined') {
    maxX = minX + (element.width || fontSize * text.length);
    maxY = minY + (element.height || fontSize * text.length);
  }
  if (typeof path === 'string' && path.includes('M') && path.includes('L')) {
    const pathList = path
      .slice(1)
      .split(' L')
      .map((item) => item.split(' '));
    const pis = [
      Number(pathList[0][0]),
      Number(pathList[0][1]),
      Number(pathList[1][0]),
      Number(pathList[1][1]),
    ];
    resetMinXY(pis as number[]);
  }
  if (Array.isArray(points) && points.length === 4) {
    resetMinXY(points as number[]);
  }
  if (Array.isArray(path) && path.includes(1) && path.includes(2) && path.length > 4) {
    const newPath = path.filter((item, index) => index % 3);
    const xList = newPath.filter((item, index) => !(index % 2));
    const yList = newPath.filter((item, index) => index % 2);
    const minX2 = Math.min(...xList);
    const minY2 = Math.min(...yList);
    const maxX2 = Math.max(...xList);
    const maxY2 = Math.max(...yList);
    const pis = [minX2, minY2, maxX2, maxY2];
    resetMinXY(pis);
  }
  return { minX, minY, maxX, maxY };
};
const getBoundingMaxMinTotal = (rects: Cmp[]) => {
  // 计算所有节点的边界框（bounding box）
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let total = 0;

  rects.forEach((rect) => {
    if (checkIsIrregularElement(rect)) {
      const { minX: mix, minY: miy, maxX: max, maxY: may } = getIrregularElementMinAndMax(rect);
      minX = Math.min(minX, mix);
      minY = Math.min(minY, miy);
      maxX = Math.max(maxX, max);
      maxY = Math.max(maxY, may);
    } else {
      const x = rect.x || 0;
      const y = rect.y || 0;
      const width = rect.width || 0;
      const height = rect.height || 0;
      total += width * height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }
  });
  return { minX, minY, maxX, maxY, total };
};

const alignElements = (cmp: Cmp[], alignType: AlignType) => {
  const { minX, minY, maxX, maxY } = getBoundingMaxMinTotal(cmp);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const newMaps = cmp.map((item) => {
    let width = item.width || 0;
    let height = item.height || 0;
    let newX = item.x || 0;
    let newY = item.y || 0;
    let subX = 0;
    let subY = 0;
    if (checkIsIrregularElement(item)) {
      const {
        minX: mix,
        minY: miy,
        maxX: max,
        maxY: may,
      } = getIrregularElementMinAndMax(item, true);
      subX = mix;
      subY = miy;
      width = max - mix;
      height = may - miy;
    }
    switch (alignType) {
      case AlignType.LEFT:
        newX = minX - subX;
        break;
      case AlignType.RIGHT:
        newX = maxX - subX - width;
        break;
      case AlignType.TOP:
        newY = minY - subY;
        break;
      case AlignType.BOTTOM:
        newY = maxY - subY - height;
        break;
      case AlignType.CENTER_X:
        newX = centerX - subX - width / 2;
        break;
      case AlignType.CENTER_Y:
        newY = centerY - subY - height / 2;
        break;
    }
    return { ...item, x: newX, y: newY };
  });
  return newMaps;
};

export { alignElements, getBoundingMaxMinTotal, swap, uuid };
