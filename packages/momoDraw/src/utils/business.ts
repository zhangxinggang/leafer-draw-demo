import { getConnStartCircleId } from '../renderer/utils/conn';
import { Cmp, CmpType } from '../types';
import { getCmpByIds, updateMaps } from './cmp';
import { getApp } from './leafer';
import { getBoundingMaxMinTotal } from './utils';

const getExtraRemoveIds = (ids: string[]) => {
  if (!window.spuEditorCmpRenderMap) return ids;
  const lineIds: string[] = [];
  ids.forEach((id) => {
    const ele = window.spuEditorCmpRenderMap.get(id);
    const isRectLine = ele?.backendData.type === CmpType.RectLine;
    const connectorId = ele?.backendData.connectorId;
    if (isRectLine && connectorId) {
      lineIds.push(connectorId);
    }
  });
  return Array.from(new Set([...ids, ...lineIds]));
};

const onBusAddCmp = (cmp: Cmp) => {
  const { type, sourceConnId, targetConnId, rectGroupChildIds } = cmp.backendData || {};
  const connectorId = cmp.id;
  if (sourceConnId && targetConnId && type === CmpType.Connector) {
    // 为了通过矩形点击更快的找到连线id
    updateMaps([
      {
        id: sourceConnId,
        backendData: {
          connectorId,
          targetConnId,
        },
      },
      {
        id: targetConnId,
        backendData: {
          connectorId,
          sourceConnId,
        },
      },
    ]);
  }
  if (type === CmpType.rectGroup && rectGroupChildIds?.length) {
    const upData = rectGroupChildIds.map((key) => {
      return {
        id: key,
        backendData: {
          rectGroupId: cmp.id,
        },
      };
    });
    updateMaps([...upData]);
  }
};

const onBusDeleteCmp = (cmp: Cmp) => {
  const app = getApp();
  const id = cmp.id;
  const { sourceConnId, targetConnId, type } = cmp.backendData || {};
  if (type === CmpType.Connector) {
    const backendData = {
      connectorId: undefined,
      sourceConnId: undefined,
      targetConnId: undefined,
    };
    updateMaps([
      { id: sourceConnId, backendData: { ...backendData } },
      { id: targetConnId, backendData: { ...backendData } },
    ]);
    if (app) {
      const connStartCircleId = getConnStartCircleId(id);
      const connElement = app.tree.findId(connStartCircleId);
      connElement?.remove();
    }
  }
};

const checkIsOverMaxArea = ({ cmps, maxArea = 650000 }: { cmps: Cmp[]; maxArea?: number }) => {
  let total = 0;
  cmps.forEach((item) => {
    const cmpItem = getCmpByIds([item.id])[0];
    if (!cmpItem) return;
    total += cmpItem.width * cmpItem.height;
  });
  return total > maxArea;
};

const fromIdGetEntireRectLines = (id: string) => {
  const tData = getCmpByIds([id])[0];
  const finalRects = [tData];
  const haveFinded = { [id]: true };
  const getSourceAndTarget = (tid) => {
    const currentData = getCmpByIds([tid])[0];
    const { sourceConnId, targetConnId } = currentData.backendData || {};
    return { sourceConnId, targetConnId };
  };
  const getPreRect = (tid: string) => {
    const { sourceConnId } = getSourceAndTarget(tid);
    const sourceData = getCmpByIds([sourceConnId])?.[0];
    if (!sourceData || haveFinded[sourceConnId]) return;
    haveFinded[sourceConnId] = true;
    finalRects.unshift(sourceData);
    getPreRect(sourceData.id);
  };
  const getNextRect = (tid: string) => {
    const { targetConnId } = getSourceAndTarget(tid);
    const targetData = getCmpByIds([targetConnId])?.[0];
    if (!targetData || haveFinded[targetConnId]) return;
    haveFinded[targetConnId] = true;
    finalRects.push(targetData);
    getNextRect(targetData.id);
  };
  getPreRect(id);
  getNextRect(id);
  return finalRects;
};

const checkIsContinuous = (cmps: Cmp[]) => {
  let firstRect: Cmp | null = null;
  let lastRect: Cmp | null = null;
  const objs = cmps.reduce((current, item) => {
    const sourceConnId = item.backendData?.sourceConnId;
    const targetConnId = item.backendData?.targetConnId;
    // 第一个矩形：sourceConnId为空或不存在
    if (!sourceConnId && !firstRect) {
      firstRect = item;
    }
    // 最后一个矩形：targetConnId为空或不存在
    if (!targetConnId && !lastRect) {
      lastRect = item;
    }
    return { ...current, [item.id]: item };
  }, {});
  if (!firstRect || !lastRect) return false;
  // 存在对角，然后第一个与最后一个坐标相同
  const check = (rect: Cmp) => {
    const targetConnId = rect.backendData?.targetConnId;
    if (!targetConnId) return true;
    const target = objs[targetConnId] || {};
    if (rect.x !== target.x && rect.y !== target.x) {
      return false;
    } else {
      return check(target);
    }
  };
  const continuous = check(firstRect);
  if (!continuous) return false;
  // 检测一个与最后一个矩形
  const haveXSome = lastRect.x === firstRect.x;
  const haveYSome = lastRect.y === firstRect.y;
  // 存在同行同列
  return haveXSome || haveYSome;
};

/**
 * 检测连接是否形成完整的矩形
 * @param rects 连接的矩形节点数组
 * @param options 业务配置，包含限制参数
 * @returns 如果形成完整矩形且未超出限制返回空数组,否则返回rects
 */
const checkConnIsSquare = (
  rects: Cmp[],
  options: {
    connGroupLimit: number;
    rectGroupLimitWidth: number;
    rectGroupLimitHeight: number;
  },
): Cmp[] => {
  const cmpItems = getCmpByIds(rects.map((item) => item.id));
  const isContinuous = checkIsContinuous(cmpItems);
  if (!isContinuous) return rects;
  const { minX, minY, maxX, maxY, total } = getBoundingMaxMinTotal(rects);

  const boundingWidth = maxX - minX;
  const boundingHeight = maxY - minY;

  // 检查限制条件
  const { connGroupLimit, rectGroupLimitWidth, rectGroupLimitHeight } = options || {};
  const minLimit = Math.min(connGroupLimit, rectGroupLimitWidth, rectGroupLimitHeight);
  if (boundingWidth > minLimit || boundingHeight > minLimit || total > connGroupLimit) {
    return rects;
  }
  // 形成完整矩形且未超出限制，返回空数组
  return [];
};

export {
  checkConnIsSquare,
  checkIsOverMaxArea,
  fromIdGetEntireRectLines,
  getExtraRemoveIds,
  onBusAddCmp,
  onBusDeleteCmp,
};
