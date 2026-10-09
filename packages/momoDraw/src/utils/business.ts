import { getConnStartCircleId } from '../renderer/utils/conn';
import type { Cmp } from '../types';
import { CmpType } from '../types';
import { getCmpByIds, updateMaps } from './cmp';
import { getApp } from './leafer';
import { getBoundingMaxMinTotal } from './utils';

const getExtraRemoveIds = (ids: string[]) => {
  if (!globalThis.spuEditorCmpRenderMap) return ids;
  const removed = new Set(ids);
  const lineIds: string[] = [];
  globalThis.spuEditorCmpRenderMap.forEach((cmp: Cmp) => {
    const data = cmp.backendData;
    if (
      data?.type === CmpType.Connector &&
      (removed.has(data.sourceConnId || '') || removed.has(data.targetConnId || ''))
    )
      lineIds.push(cmp.id);
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
  if (!cmp) return;
  const app = getApp();
  const id = cmp.id;
  const { sourceConnId, targetConnId, type } = cmp.backendData || {};
  if (type === CmpType.Connector) {
    if (sourceConnId && getCmpByIds([sourceConnId])[0])
      updateMaps([
        { id: sourceConnId, backendData: { connectorId: undefined, targetConnId: undefined } },
      ]);
    if (targetConnId && getCmpByIds([targetConnId])[0])
      updateMaps([
        { id: targetConnId, backendData: { connectorId: undefined, sourceConnId: undefined } },
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
  if (!cmps.length || cmps.some((cmp) => !cmp)) return false;
  const nodes = new Map(cmps.map((cmp) => [cmp.id, cmp]));
  let current = cmps.find((cmp) => !cmp.backendData?.sourceConnId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const nextId = current.backendData?.targetConnId;
    if (!nextId) break;
    const next = nodes.get(nextId);
    if (!next || (current.x !== next.x && current.y !== next.y)) return false;
    current = next;
  }
  return visited.size === cmps.length && !current?.backendData?.targetConnId;
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
  if (!rects?.length) return [];
  const cmpItems = getCmpByIds(rects.map((item) => item.id));
  const isContinuous = checkIsContinuous(cmpItems);
  if (!isContinuous) return rects;
  const { minX, minY, maxX, maxY, total } = getBoundingMaxMinTotal(rects);

  const boundingWidth = maxX - minX;
  const boundingHeight = maxY - minY;

  // 检查限制条件
  const { connGroupLimit, rectGroupLimitWidth, rectGroupLimitHeight } = options || {};
  const bounds = rects.map(({ x = 0, y = 0, width = 0, height = 0 }) => ({ x, y, width, height }));
  const hasOverlap = bounds.some((a, index) =>
    bounds
      .slice(index + 1)
      .some(
        (b) =>
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height,
      ),
  );
  if (
    boundingWidth > rectGroupLimitWidth ||
    boundingHeight > rectGroupLimitHeight ||
    total > connGroupLimit ||
    total !== boundingWidth * boundingHeight ||
    hasOverlap
  ) {
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
