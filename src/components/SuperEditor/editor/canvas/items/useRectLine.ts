import { IPointData, PointerEvent } from 'leafer-ui';
import { useEffect, useRef } from 'react';
import { generateCmp } from '../generator';
import { Cmp, CmpLeaferAttr, CmpType } from '../../../interface/cmp';
import useCanvasStore from '../../../store/canvas';
import { useShallow } from 'zustand/shallow';
import useModelStore from '../../../store/model';
import {
  fromPointGetWidthAndHeight,
  getPointDirection,
  fromDirectionGetRect,
} from '../../../utils/draw';

const defaultRectWidth = 50;
const defaultRectHeight = 50;

interface IAddRectLineProps {
  point: IPointData;
  event: PointerEvent;
  width?: number;
  height?: number;
  maxArea?: number;
}
const useRectLine = () => {
  const preRectLine = useRef<CmpLeaferAttr[][] | null>(null); // 矩形中心店
  const { app } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
    })),
  );
  const { addCmps, removeCmpById } = useModelStore(
    useShallow((state) => ({
      addCmps: state.addCmps,
      removeCmpById: state.removeCmpById,
    })),
  );
  const appRef = useRef(app);

  useEffect(() => {
    appRef.current = app;
  }, [app]);

  // helper: store a sequence of created rects and their data
  const refreshPreRectLine = (datas: CmpLeaferAttr[]) => {
    const preRef = preRectLine.current;
    if (!preRef) {
      preRectLine.current = [];
    }
    preRectLine.current.push(datas);
  };
  const popLastRect = () => {
    const preRef = preRectLine.current;
    if (!preRef) return null;
    const lastData = preRef.pop();
    return { ids: lastData.map((item) => item.id), data: lastData };
  };

  const rectEquals = (a: any, b: any) => {
    if (!a || !b) return false;
    return a.startX === b.startX && a.startY === b.startY && a.endX === b.endX && a.endY === b.endY;
  };
  const addRectLine = ({ point, event, width, height, maxArea = Infinity }: IAddRectLineProps) => {
    const preRef = preRectLine.current;
    if (!preRef) return;
    const currentWidth = width || defaultRectWidth;
    const currentHeight = height || defaultRectHeight;
    const halfWidth = currentWidth / 2;
    const halfHeight = currentHeight / 2;
    const { x, y } = point;
    const rectData: any = {
      startX: x - halfWidth,
      startY: y - halfHeight,
      endX: x + halfWidth,
      endY: y + halfHeight,
    };
    rectData.leaferAttr = {
      className: CmpType[CmpType.RectLine],
      zIndex: 1,
      stroke: '#505057',
      strokeWidth: 1,
      fill: 'rgba(255, 255, 255, 0.66)',
    };
    const rectComp: any = generateCmp(CmpType.RectLine, rectData);
    const lastItem = preRef[preRef.length - 1] || [];
    const lastData = lastItem[0] || rectData;
    const lastId = lastData.id;
    const direction = getPointDirection(lastData, point);
    const candidate = lastId
      ? fromDirectionGetRect({ ...lastData, width: currentWidth, height: currentHeight }, direction)
      : lastData;
    if (preRef.length >= 2) {
      // 删除上一个
      const secondLast = preRef[preRef.length - 2][0];
      if (
        x >= secondLast.startX &&
        x <= secondLast.endX &&
        y >= secondLast.startY &&
        y <= secondLast.endY
      ) {
        const popped = popLastRect();
        if (popped?.ids) {
          removeCmpById(popped.ids);
        }
        return;
      }
    }
    const areas = preRef.reduce((cur, next) => {
      const { width, height } = fromPointGetWidthAndHeight(next[0]);
      return cur + width * height;
    }, currentWidth * currentHeight);
    const alreadyExists = preRef.some((d: any) => rectEquals(d[0], candidate));
    if (alreadyExists || areas > maxArea) return;
    const hasEnteredCandidate =
      x >= candidate.startX && x <= candidate.endX && y >= candidate.startY && y <= candidate.endY;
    if (!hasEnteredCandidate && lastId) return;
    const compData = { ...rectComp, x: candidate.startX, y: candidate.startY };
    if (lastId) {
      const connComp: Cmp = generateCmp(CmpType.Connector, {
        leaferAttr: {
          stroke: '#adc',
          data: {
            sourceId: lastId,
            targetId: rectComp.id,
          },
        },
      });
      addCmps([compData, connComp]);
      refreshPreRectLine([{ ...candidate, id: rectComp.id }, connComp]);
    } else {
      console.log(compData, 'compData');
      addCmps([compData]);
      refreshPreRectLine([{ ...candidate, id: rectComp.id }]);
    }
  };

  return { preRectLine, addRectLine };
};

export default useRectLine;
