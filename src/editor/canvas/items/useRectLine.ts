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
  const width = rect.endX - rect.startX
  const height = rect.endY - rect.startY
  const centerX = rect.x + width / 2;
  const centerY = rect.y + height / 2;

  const dx = point.x - centerX;
  const dy = point.y - centerY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'bottom' : 'top';
  }
}

function getAdjacentRect(rect: any, direction: any): any {
  const width = rect.endX - rect.startX
  const height = rect.endY - rect.startY
  switch (direction) {
    case 'top':
      return { ...rect, startY: rect.startY - height, endY: rect.endY - height };
    case 'bottom':
      return { ...rect, startY: rect.startY + height, endY: rect.endY + height };
    case 'left':
      return { ...rect, startX: rect.startX - width, endX: rect.endX - width };
    case 'right':
      return { ...rect, startX: rect.startX + width, endX: rect.endX + width };
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
    if (preRectLine.current.count > 1) {
      const nextRect = preRectLine.current.data
      const direction = getPointDirection(nextRect, point);
      rectData = getAdjacentRect(nextRect, direction);
      // const gDatas: any = generateCmp(CmpType.Arrow, {
      //   startX: adjacentRect.x,
      //   startY: adjacentRect.y,
      //   endX: adjacentRect.x + defaultRectWidth,
      //   endY: adjacentRect.y + defaultRectHeight,
      // })
      // addCmp({ ...gDatas });
      // setGenCmp(null);
    } else {
      rectData = {
        startX: x - halfWidth,
        startY: y - halfHeight,
        endX: x + halfWidth,
        endY: y + halfHeight,
      }
    }
    rectData.data = {
      type: ToolBarState.RectLine
    }
    rectData.stroke = '#000'
    const rectComp: any = generateCmp(CmpType.Rect, rectData)
    addCmp({ ...rectComp });
    refreshPreRectLine(rectData);
  }


  return { preRectLine, addRectLine }
}

export default useRectLine