import { IPointData, PointerEvent } from "leafer-ui"
import { useEffect, useRef } from "react"
import { ToolBarState } from "~/store/toolbar"
import { generateCmp } from "../generator"
import { CmpType } from "~/interface/cmp"
import useCanvasStore from "~/store/canvas"
import { useShallow } from "zustand/shallow"
import useModelStore from "~/store/model"

interface IAddRectLineProps {
    event: PointerEvent
}
const useLineRect = () => {
    const preLineRect = useRef<{ startPoint: IPointData, targets: any[], data?: any } | null>(null) // 矩形中心店
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

    const addLineRect = ({ event }: IAddRectLineProps) => {
        const cNode: any = appRef.current?.tree.pick(event)
        const target = cNode?.target
        const data = target?.data
        if (!preLineRect.current || data?.type !== ToolBarState.RectLine) return;
        if (preLineRect.current.targets.includes(target)) return;
        const { x: startX, y: startY } = preLineRect.current.startPoint;
        const arrowData = {
            startX,
            startY,
            endX: target.x + target.width / 2,
            endY: target.y + target.height / 2,
            leaferAttr: {
                data: {
                    type: ToolBarState.LineRect
                },
                stroke: '#494747',
                zIndex: 10
            }
        }
        const oneArrow = generateCmp(CmpType.Arrow, arrowData)
        preLineRect.current.targets.push(target)
        preLineRect.current.startPoint = { x: arrowData.endX, y: arrowData.endY }
        addCmp({ ...oneArrow });
    }

    return { preLineRect, addLineRect }
}

export default useLineRect