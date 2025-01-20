import { generateCmp } from '../generator';
import { Cmp, CmpType } from '../types';
import { getCmpByIds } from './cmp';
import { getBoundingMaxMinTotal } from './utils';

interface beforeAddRectGroupResponse {
  noCmps?: boolean;
  overMaxArea?: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
  rectGroupChildIds: string[];
}
/**
 * 新增发送卡前的验证函数
 * @param ids 组件ID数组
 * @param options 业务配置，包含限制参数
 * @returns 验证通过返回 true，否则返回 false
 */
const beforeAddRectGroupCheck = (
  ids: string[],
  options: {
    rectGroupLimitArea: number;
    rectGroupLimitWidth: number;
    rectGroupLimitHeight: number;
  },
): beforeAddRectGroupResponse => {
  const response: beforeAddRectGroupResponse = {
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    rectGroupChildIds: [],
  };
  // 获取选中的组件
  const selectedCmps = getCmpByIds(ids).filter(
    (cmp) => cmp.backendData?.type === CmpType.RectLine,
  ) as Cmp[];
  if (selectedCmps.length === 0) {
    response.noCmps = true;
    return response;
  }
  // 计算框选矩形的边界框
  const { minX, minY, maxX, maxY, total } = getBoundingMaxMinTotal(selectedCmps);
  const boundingWidth = maxX - minX;
  const boundingHeight = maxY - minY;
  // 验证面积、宽度、高度是否超过限制
  const { rectGroupLimitArea, rectGroupLimitWidth, rectGroupLimitHeight } = options;
  if (
    total > rectGroupLimitArea ||
    boundingWidth > rectGroupLimitWidth ||
    boundingHeight > rectGroupLimitHeight
  ) {
    response.overMaxArea = true;
    return response;
  }
  response.width = boundingWidth;
  response.height = boundingHeight;
  response.x = minX;
  response.y = minY;
  response.rectGroupChildIds = selectedCmps.map((item) => item.id);
  return response;
};

interface addRectGroupProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rectGroupChildIds: string[];
}

const getNewRectGroupCmp = ({ x, y, width, height, rectGroupChildIds }: addRectGroupProps) => {
  const cmp = generateCmp(CmpType.rectGroup, {
    startX: x,
    startY: y,
    endX: x + width,
    endY: y + height,
    backendData: {
      type: CmpType.rectGroup,
      rectGroupChildIds,
    },
  });
  return cmp;
};

export { beforeAddRectGroupCheck, getNewRectGroupCmp };
