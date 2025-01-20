import { PropertyEvent } from 'leafer-ui';
import { IConnectorOption, LeaferXQnConnector } from 'leafer-x-connector';
import { RenderParams, RenderType } from '../../types';
import { onBusAddCmp } from '../../utils/business';
import { getCmpByIds } from '../../utils/cmp';
import { elementChange, getApp } from '../../utils/leafer';
import { getStartPointFromPointsSubCircle } from '../../utils/math';
import { generateArrowPath } from '../../utils/path';
import { checkIsStartConn, connCircleSize } from '../utils/conn';
import { handleDelete, handleUpdate } from '../utils/renderHelper';

const setConnectorProps = (leaferConn: any, extraProps: any = {}) => {
  leaferConn.editable = false;
  leaferConn.hittable = false;
  leaferConn.draggable = false;
  Object.assign(leaferConn, extraProps);
  leaferConn.on?.(PropertyEvent.CHANGE, (e) => {
    // 存在x,y属性时，多元素移动时，会发生绘制错乱
    if (e.type === 'property.change' && ['x', 'y'].includes(e.attrName)) {
      leaferConn.x = undefined;
      leaferConn.y = undefined;
    }
  });
};

export default function component({ cmp, type = RenderType.ADD }: RenderParams) {
  const app = getApp();
  if (!app) return null;
  const storeCmp = getCmpByIds([cmp.id])?.[0] || cmp;

  if (type === RenderType.DELETE) {
    return handleDelete(storeCmp);
  }

  if (type === RenderType.UPDATE) {
    return handleUpdate(storeCmp);
  }

  const { backendData } = storeCmp;
  const { sourceConnId, targetConnId } = backendData || {};
  if (!sourceConnId || !targetConnId) return null;
  const source: any = app.findOne(`#${sourceConnId}`);
  const target: any = app.findOne(`#${targetConnId}`);
  if (!source || !target) return null;
  onBusAddCmp(storeCmp);
  const zIndex = Math.max(source.zIndex, target.zIndex);
  const isStartCircle = checkIsStartConn(sourceConnId);
  const opt: IConnectorOption = {
    padding: 0,
    onDraw: (param) => {
      let startPoint = {
        x: source.x + source.width / 2,
        y: source.y + source.height / 2,
      };
      const endPoint = {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
      };
      if (isStartCircle) {
        startPoint = getStartPointFromPointsSubCircle({
          startPoint,
          endPoint,
          circleSize: connCircleSize,
        });
      }
      const path = generateArrowPath(startPoint, endPoint);
      // 根据需求可自定义path即可
      return path;
    },
  };
  const leaferConn = new LeaferXQnConnector(source, target, opt);
  for (const key in storeCmp) {
    leaferConn[key] = storeCmp[key];
  }
  leaferConn.zIndex = zIndex + 1;
  setConnectorProps(leaferConn, {
    zIndex: zIndex + 1,
  });
  const connChange = (e: any) => {
    const isChange = elementChange(e);
    if (isChange) {
      leaferConn._draw();
    }
  };
  const onSourceChange = (e: any) => {
    connChange(e);
  };
  const onTargetChange = (e: any) => {
    connChange(e);
  };
  source.on?.(PropertyEvent.CHANGE, onSourceChange);
  target.on?.(PropertyEvent.CHANGE, onTargetChange);
  // 确保在连接器被销毁时移除该监听：我们在 destroy 上做一个小的包装
  const originalDestroy = (leaferConn as any).destroy?.bind(leaferConn);
  (leaferConn as any).destroy = function () {
    try {
      source.off?.(PropertyEvent.CHANGE, onSourceChange);
      target.off?.(PropertyEvent.CHANGE, onTargetChange);
    } catch (e) {
      // ignore
    }
    originalDestroy && originalDestroy();
  };
  app?.tree.add(leaferConn);
  return leaferConn;
}
