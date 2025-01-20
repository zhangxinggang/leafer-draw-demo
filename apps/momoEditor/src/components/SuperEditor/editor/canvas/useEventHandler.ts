/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  EditorEvent,
  EditorMoveEvent,
  EditorRotateEvent,
  EditorScaleEvent,
} from '@leafer-in/editor';
import { generateCmp } from '@momo/leafer-draw/generator';
import { Cmp, CmpType, PathCmp } from '@momo/leafer-draw/types/cmp';
import { PathEditorEvent } from '@momo/leafer-xpath-editor';
import { IPointData, IUI, MoveEvent, PointerEvent, UI, ZoomEvent } from 'leafer-ui';
import { debounce } from 'lodash-es';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useCanvasStore from '../../store/canvas';
import useModelStore from '../../store/model';
import useToolbarStore, { ToolBarState } from '../../store/toolbar';
import useLineRect from './items/useLineRect';
import useRectLine from './items/useRectLine';

export default function useEventHandler() {
  const pointDownRef = useRef<IPointData>();
  const { preRectLine, addRectLine } = useRectLine();
  const { beforeAddLineRect, addLineRect, endAddLineRect } = useLineRect();
  const { app, setGenCmp, setShowSetting, removeTempReminderCmps } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
      setGenCmp: state.setGenCmp,
      setShowSetting: state.setShowSetting,
      removeTempReminderCmps: state.removeTempReminderCmps,
    })),
  );

  const appRef = useRef(app);

  const pointPositions = useRef<number[]>([]);

  useEffect(() => {
    appRef.current = app;
  }, [app]);

  const { addCmps, updateZoomLayer, updateSelectCmpIds, updateCmps } = useModelStore(
    useShallow((state) => ({
      addCmps: state.addCmps,
      updateZoomLayer: state.updateZoomLayer,
      updateSelectCmpIds: state.updateSelectCmpIds,
      updateCmps: state.updateCmps,
    })),
  );

  const debounceUpdateCmps = debounce(updateCmps, 100);

  const setState = useToolbarStore((state) => state.setState);

  const onPointDown = (e: PointerEvent) => {
    // 使用getLocalPoint获取相对于画布的坐标，而不是页面坐标
    const point = e.getPagePoint();
    const toolbarState = useToolbarStore.getState().state;
    if (toolbarState === ToolBarState.rectGroup) {
      return;
    }
    if (toolbarState === ToolBarState.RectLine) {
      preRectLine.current = [];
      return;
    }
    if (toolbarState === ToolBarState.LineRect) {
      beforeAddLineRect({ event: e });
    } else if (toolbarState === ToolBarState.Text) {
      setGenCmp(
        generateCmp(CmpType.Text, {
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        }),
      );
    } else if (toolbarState === ToolBarState.Pen) {
      pointPositions.current.push(1, point.x, point.y);
    }
    pointDownRef.current = point;
    if (appRef.current?.editor.selector) {
      //@ts-ignore
      appRef.current.editor.selector.hoverStroker.visible = false;
    }
  };
  const onPointMove = (e: PointerEvent) => {
    // 使用getLocalPoint获取相对于画布的坐标，而不是页面坐标
    const point = e.getPagePoint();
    const toolbarState = useToolbarStore.getState().state;
    const noMoveEvent = [
      ToolBarState.Dragger,
      ToolBarState.Select,
      ToolBarState.rectGroup,
    ].includes(toolbarState);
    if (noMoveEvent) return;
    if (appRef.current) appRef.current.editor.visible = false;
    const { x, y } = point;
    if (toolbarState === ToolBarState.RectLine) {
      addRectLine({ point, event: e, maxArea: 650000 });
      return;
    }
    if (toolbarState === ToolBarState.LineRect) {
      addLineRect({ event: e });
      return;
    }
    if (!pointDownRef.current) return;
    const { x: startX, y: startY } = pointDownRef.current;

    let cmpType: CmpType = CmpType.Rect;

    switch (toolbarState) {
      case ToolBarState.Rect:
        cmpType = CmpType.Rect;
        break;
      case ToolBarState.Ellipse:
        cmpType = CmpType.Ellipse;
        break;
      case ToolBarState.Text:
        cmpType = CmpType.Text;
        break;
      case ToolBarState.Line:
        cmpType = CmpType.Line;
        break;
      case ToolBarState.Arrow:
        cmpType = CmpType.Arrow;
        break;
      case ToolBarState.Image:
        cmpType = CmpType.Image;
        break;
      case ToolBarState.Pen:
        cmpType = CmpType.Pen;
        break;
      default:
    }
    const genCmp = useCanvasStore.getState().genCmp;
    const leaferAttr: Partial<Cmp> = {};
    if (genCmp?.id) {
      leaferAttr.id = genCmp.id;
    }
    if (cmpType === CmpType.Pen) {
      pointPositions.current.push(2, x, y);
      setGenCmp({
        ...generateCmp(cmpType, {
          startX,
          startY,
          endX: x,
          endY: y,
          leaferAttr,
        }),
        path: [...pointPositions.current],
      } as Cmp);
    } else {
      setGenCmp(
        generateCmp(cmpType, {
          startX,
          startY,
          endX: x,
          endY: y,
          leaferAttr,
        }) as Cmp,
      );
    }
  };
  const onPointUp = () => {
    pointDownRef.current = undefined;
    pointPositions.current = [];

    // 当 freeRouting 为 false 时，检测连接是否形成完整矩形
    endAddLineRect();
    preRectLine.current = null;

    // 清理临时提醒组件
    removeTempReminderCmps();

    const genCmp = useCanvasStore.getState().genCmp;
    if (genCmp) {
      addCmps([{ ...genCmp }], true);
      setGenCmp(null);
      setState(ToolBarState.Select);
    }

    if (appRef.current) {
      appRef.current.editor.visible = true;
    }

    if (appRef.current?.editor.selector) {
      //@ts-ignore
      appRef.current.editor.selector.hoverStroker.visible = true;
    }
  };

  const onSelect = (evt: EditorEvent) => {
    if (!evt.value) {
      updateSelectCmpIds([]);
      return;
    }
    if (Array.isArray(evt.value) && evt.value.length === 0) return;
    const toolbarState = useToolbarStore.getState().state;
    const selectEl = evt.value;
    if (selectEl) {
      let selectEls: IUI[] = [];
      if (!Array.isArray(selectEl)) {
        selectEls = [selectEl];
      } else {
        selectEls = selectEl;
      }
      updateSelectCmpIds(selectEls.map((el) => el.id as string));
    }
    const noChange = [ToolBarState.rectGroup].includes(toolbarState);
    if (noChange) return;
    setState(ToolBarState.Select);
  };

  const onViewMove = debounce((evt: MoveEvent) => {
    const { x, y } = evt.target.zoomLayer || {};
    updateZoomLayer({ x, y });
  }, 500);

  const onViewZoom = debounce((evt: ZoomEvent) => {
    if (!evt.target.zoomLayer) return;
    updateZoomLayer({ scale: evt.target.zoomLayer.scaleX });
  }, 500);

  const onMoveEnd = (evt: EditorMoveEvent) => {
    let target = (evt.current as any).leafList.list as UI[];

    if (!Array.isArray(target)) {
      target = [target];
    }
    const cmps = target.map((cmp) => ({ id: cmp.id, x: cmp.x, y: cmp.y }));
    debounceUpdateCmps(cmps);
  };

  const onScaleEnd = (evt: EditorScaleEvent) => {
    let target = (evt.current as any).leafList.list as UI[];

    if (!Array.isArray(target)) {
      target = [target];
    }
    const cmps = target.map((cmp) => ({
      id: cmp.id,
      x: cmp.x,
      y: cmp.y,
      width: cmp.width,
      height: cmp.height,
    }));
    debounceUpdateCmps(cmps);
  };

  const onRotateEnd = (evt: EditorRotateEvent) => {
    let target = (evt.current as any).leafList.list as UI[];

    if (!Array.isArray(target)) {
      target = [target];
    }
    const cmps = target.map((cmp) => ({
      id: cmp.id,
      rotation: cmp.rotation,
    }));
    debounceUpdateCmps(cmps);
  };

  const onPathChange = (evt: PathEditorEvent) => {
    const { value } = evt;

    if (value) {
      const { visible, path, id } = value;
      if (visible && id) {
        updateCmps([{ id, path } as PathCmp]);
      }
    }
  };

  const onTap = (evt: PointerEvent) => {
    if (appRef.current === evt.target) {
      setShowSetting(false);
      return;
    }

    setShowSetting(true);
  };

  return {
    onPointDown,
    onPointMove,
    onPointUp,
    onSelect,
    onMoveEnd,
    onScaleEnd,
    onRotateEnd,
    onPathChange,
    onTap,
    onViewMove,
    onViewZoom,
  };
}
