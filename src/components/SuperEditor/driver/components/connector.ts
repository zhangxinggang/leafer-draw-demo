import { PropsWithChildren } from 'react';
import { PropertyEvent } from 'leafer-ui';
import { IConnectorOption, LeaferXQnConnector } from 'leafer-x-connector';
import useLeaferPropsUpdate from '../hooks/useLeaferPropsUpdate';
import useLeaferComponent from '../hooks/useLeaferComponent';
import useLeaferApp from '../hooks/useLeaferApp';
import { elementChange } from '../../utils/leafer';

export type ConnectorProps = Omit<any, 'children'> & {
  onChange?: (e: PropertyEvent) => void;
};

interface Point {
  x: number;
  y: number;
}

function generateArrowPath(start: Point, end: Point, arrowSize = 8) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return '';
  const unitX = dx / length;
  const unitY = dy / length;
  const arrowTipX = end.x - unitX * 2;
  const arrowTipY = end.y - unitY * 2;
  const perpX = -unitY;
  const perpY = unitX;
  const arrowLeft = {
    x: arrowTipX - unitX * arrowSize + perpX * arrowSize * 0.5,
    y: arrowTipY - unitY * arrowSize + perpY * arrowSize * 0.5,
  };
  const arrowRight = {
    x: arrowTipX - unitX * arrowSize - perpX * arrowSize * 0.5,
    y: arrowTipY - unitY * arrowSize - perpY * arrowSize * 0.5,
  };
  return `M ${start.x} ${start.y} L ${arrowTipX} ${arrowTipY} M ${arrowLeft.x} ${arrowLeft.y} L ${end.x} ${end.y} L ${arrowRight.x} ${arrowRight.y}`;
}

export default function Connector(props: PropsWithChildren<ConnectorProps>) {
  const leaferApp = useLeaferApp();
  const [leaferConn] = useLeaferComponent(() => {
    const { children, onChange, data } = props;
    const { sourceId, targetId } = data || {};
    if (!sourceId || !targetId) return null;
    const source: any = leaferApp.findOne(`#${sourceId}`);
    const target: any = leaferApp.findOne(`#${targetId}`);
    if (!source || !target) return null;
    const zIndex = Math.max(source.zIndex, target.zIndex);
    const opt: IConnectorOption = {
      padding: 0,
      onDraw: (param) => {
        const startPoint = {
          x: source.x + source.width / 2,
          y: source.y + source.height / 2,
        };
        const endPoint = {
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
        };
        const path = generateArrowPath(startPoint, endPoint);
        // 根据需求可自定义path即可
        return path;
      },
    };
    const leaferConn = new LeaferXQnConnector(source, target, opt);
    for (const key in props) {
      leaferConn[key] = props[key];
    }
    leaferConn.zIndex = zIndex + 1;
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
    leaferConn.on(PropertyEvent.CHANGE, onChange);
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
    return leaferConn;
  });
  useLeaferPropsUpdate<any>(leaferConn, props);

  return null;
}
