import {
  ArrowCmp,
  Cmp,
  CmpBackendData,
  CmpType,
  ImageCmp,
  PathCmp,
  PenCmp,
  TextCmp,
} from './types/cmp';
import { uuid } from './utils/utils';

// 默认主色，可以从外部配置
const DEFAULT_PRIMARY_COLOR = '#58B2DC';

export function generateCmp(
  cmpType: CmpType,
  datas: {
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    leaferAttr?: Partial<Cmp>;
    backendData?: CmpBackendData;
    primaryColor?: string;
  },
): Cmp | null {
  let {
    startX,
    startY,
    endX,
    endY,
    leaferAttr,
    backendData = {},
    primaryColor = DEFAULT_PRIMARY_COLOR,
  } = datas;

  const baseModel = {
    id: uuid(),
    backendData: {
      ...backendData,
      type: cmpType,
    },
  };

  if ([CmpType.Rect, CmpType.Ellipse, CmpType.RectLine, CmpType.rectGroup].includes(cmpType)) {
    let width = endX - startX;
    let height = endY - startY;
    let tempX, tempY;
    if (width < 0) {
      width = -width;
      tempX = startX;
      startX = endX;
      endX = tempX;
    }
    if (height < 0) {
      height = -height;
      tempY = startY;
      startY = endY;
      endY = tempY;
    }
    return {
      ...baseModel,
      x: startX,
      y: startY,
      width,
      height,
      fill: primaryColor,
      ...leaferAttr,
    } as Cmp;
  } else if (cmpType === CmpType.Line) {
    return {
      ...baseModel,
      path: `M${startX} ${startY} L${endX} ${endY}`,
      stroke: primaryColor,
      strokeWidth: 2,
      ...leaferAttr,
    } as PathCmp;
  } else if (cmpType === CmpType.Text) {
    return {
      ...baseModel,
      x: startX,
      y: startY,
      text: 'Text',
      fontSize: 20,
      fill: primaryColor,
      ...leaferAttr,
    } as TextCmp;
  } else if (cmpType === CmpType.Arrow) {
    return {
      ...baseModel,
      points: [startX, startY, endX, endY],
      stroke: primaryColor,
      strokeWidth: 2,
      ...leaferAttr,
    } as ArrowCmp;
  } else if (cmpType === CmpType.Image) {
    return {
      ...baseModel,
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY,
      ...leaferAttr,
    } as ImageCmp;
  } else if (cmpType === CmpType.Pen) {
    return {
      ...baseModel,
      stroke: primaryColor,
      strokeWidth: 3,
      ...leaferAttr,
    } as PenCmp;
  } else if (cmpType === CmpType.Connector) {
    return {
      ...baseModel,
      ...leaferAttr,
    } as Cmp;
  }

  return null;
}
