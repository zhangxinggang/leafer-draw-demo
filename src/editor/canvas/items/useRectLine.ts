import { IPointData, PointerEvent } from "leafer-ui"
import { useEffect, useRef } from "react"
import { ToolBarState } from "~/store/toolbar"
import { generateCmp } from "../generator"
import { CmpType } from "~/interface/cmp"
import useCanvasStore from "~/store/canvas"
import { useShallow } from "zustand/shallow"
import useModelStore from "~/store/model"

const defaultRectWidth = 50
const defaultRectHeight = 50

function getPointDirection(rect: any, point: any): any {
  const { width, height } = rect
  const centerX = rect.startX + width / 2;  // 修正：使用 startX 而不是 x
  const centerY = rect.startY + height / 2; // 修正：使用 startY 而不是 y

  const dx = point.x - centerX;
  const dy = point.y - centerY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'bottom' : 'top';
  }
}

function getAdjacentRect(rect: any, direction: any): any {
  const { width, height } = rect

  switch (direction) {
    case 'top':
      return {
        startX: rect.startX,
        endX: rect.endX,
        startY: rect.startY - height,
        endY: rect.startY
      };
    case 'bottom':
      return {
        startX: rect.startX,
        endX: rect.endX,
        startY: rect.endY,
        endY: rect.endY + height
      };
    case 'left':
      return {
        startX: rect.startX - width,
        endX: rect.startX,
        startY: rect.startY,
        endY: rect.endY
      };
    case 'right':
      return {
        startX: rect.endX,
        endX: rect.endX + width,
        startY: rect.startY,
        endY: rect.endY
      };
  }
}


interface IAddRectLineProps {
  point: IPointData, event: PointerEvent
}
const useRectLine = () => {
  const preRectLine = useRef<{ count: number, data?: any } | null>(null) // 矩形中心店
  const { app, setGenCmp } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
      setGenCmp: state.setGenCmp,
    }))
  );
  const {
    addCmp,
  } = useModelStore(
    useShallow((state) => ({
      addCmp: state.addCmp,
    }))
  );
  const appRef = useRef(app);

  useEffect(() => {
    appRef.current = app;
  }, [app]);

  const refreshPreRectLine = (data: any) => {
    if (!preRectLine.current) return;
    preRectLine.current.count++;
    preRectLine.current.data = data
  }
  const addRectLine = ({ point, event }: IAddRectLineProps) => {
    const cNode: any = appRef.current?.tree.pick(event)
    const data = cNode?.target?.data
    if (!preRectLine.current || data?.type === ToolBarState.RectLine) return;
    const halfWidth = defaultRectWidth / 2
    const halfHeight = defaultRectHeight / 2
    const { x, y } = point;
    let rectData: any = null
    const addDatas = []
    if (preRectLine.current.count > 1) {
      const preRect = preRectLine.current.data
      const originWidth = preRect.endX - preRect.startX
      const originHeight = preRect.endY - preRect.startY
      const calcRect = {
        ...preRect,
        width: originWidth,
        height: originHeight
      }
      const direction = getPointDirection(calcRect, point);
      rectData = getAdjacentRect(calcRect, direction);
      const nowWidth = rectData.endX - rectData.startX
      const nowHeight = rectData.endY - rectData.startY
      const gDatas: any = generateCmp(CmpType.Arrow, {
        startX: preRect.startX + originWidth / 2,
        startY: preRect.startY + originHeight / 2,
        endX: rectData.startX + nowWidth / 2,
        endY: rectData.startY + nowHeight / 2,
        leaferAttr: {
          data: {
            type: ToolBarState.RectLine
          },
          stroke: '#494747',
          zIndex: 10
        }
      })
      addDatas.push({ ...gDatas })
    } else {
      rectData = {
        startX: x - halfWidth,
        startY: y - halfHeight,
        endX: x + halfWidth,
        endY: y + halfHeight,
      }
    }
    rectData.leaferAttr = {
      data: {
        type: ToolBarState.RectLine
      },
      zIndex: 1,
      stroke: '#505057',
      strokeWidth: 1,
      fill: 'rgba(255, 255, 255, 0.66)',
    }
    const rectComp: any = generateCmp(CmpType.Rect, rectData)
    addDatas.push({ ...rectComp })
    addDatas.forEach(addCmp)
    refreshPreRectLine(rectData);
  }


  return { preRectLine, addRectLine }
}

export default useRectLine