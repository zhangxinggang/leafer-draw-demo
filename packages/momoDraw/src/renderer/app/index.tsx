import {
  Editor,
  EditorEvent,
  EditorMoveEvent,
  EditorRotateEvent,
  EditorScaleEvent,
} from '@leafer-in/editor';
import '@leafer-in/export';
import '@leafer-in/find';
import '@leafer-in/text-editor';
import '@leafer-in/view';
import '@leafer-in/viewport';
import { IEditorConfig, App as LeaferApp, MoveEvent, PointerEvent, UI, ZoomEvent } from 'leafer-ui';
import { Snap } from 'leafer-x-easy-snap';
import { PathEditorEvent } from 'leafer-x-path-editor';
import React, { PropsWithChildren, forwardRef, useEffect, useRef } from 'react';
import { usePrevious } from 'react-use';
import { setApp } from '../../utils/leafer';
import { LeaferAppContext } from '../context';
import useLeaferComponent from '../hooks/useLeaferComponent';
import { useRuler } from '../hooks/useRuler';

export interface IZoomLayer {
  x?: number;
  y?: number;
  scale?: number;
}

export interface AppProps {
  renderId: string;
  zoomLayer?: IZoomLayer;
  selectCmpIds?: string[];
  canvasBackgroundColor?: string;
  rulerVisible?: boolean;
  darkMode?: boolean;
  onPointDown?: (e: PointerEvent) => void;
  onPointUp?: (e: PointerEvent) => void;
  onPointMove?: (e: PointerEvent) => void;
  onMove?: (e: EditorMoveEvent) => void;
  onMoveEnd?: (e: EditorMoveEvent) => void;
  onScale?: (e: EditorScaleEvent) => void;
  onScaleEnd?: (e: EditorScaleEvent) => void;
  onRotate?: (e: EditorRotateEvent) => void;
  onRotateEnd?: (e: EditorRotateEvent) => void;
  onSelect?: (e: EditorEvent) => void;
  onTap?: (e: PointerEvent) => void;
  onViewMove?: (e: MoveEvent) => void;
  onViewZoom?: (e: ZoomEvent) => void;
  onPathChange?: (e: PathEditorEvent) => void;
  editorConf?: IEditorConfig;
}

export interface AppRef {
  select: (targets: UI[]) => void;
  hover: (target: UI) => void;
  cancel: () => void;
  getApp: () => LeaferApp;
}

const App = forwardRef<AppRef, PropsWithChildren<AppProps>>((props, ref) => {
  const {
    renderId,
    children,
    onPointUp,
    onPointDown,
    onMove,
    onRotate,
    onScale,
    onPointMove,
    onSelect,
    onTap,
    onViewZoom,
    onViewMove,
    onMoveEnd,
    onRotateEnd,
    onScaleEnd,
    onPathChange,
    selectCmpIds = [],
    zoomLayer,
    canvasBackgroundColor = '#ffffff',
    rulerVisible = true,
    darkMode = false,
    editorConf = {},
    onAppChange,
  } = props;
  const moveStateRef = useRef(null);
  const scaleStateRef = useRef(null);
  const rotateStateRef = useRef(null);
  const preSelectCmpIds = usePrevious(selectCmpIds);
  const { initRuler } = useRuler({ rulerVisible, darkMode });

  const [leaferApp, isInit] = useLeaferComponent(() => {
    const handlePointUp = () => {
      if (rotateStateRef.current) {
        onRotateEnd?.(rotateStateRef.current);
        rotateStateRef.current = null;
      }
      if (moveStateRef.current) {
        onMoveEnd?.(moveStateRef.current);
        moveStateRef.current = null;
      }

      if (scaleStateRef.current) {
        onScaleEnd?.(scaleStateRef.current);
        scaleStateRef.current = null;
      }
    };

    const app = new LeaferApp({
      view: document.getElementById(renderId),
      fill: canvasBackgroundColor,
      tree: { type: 'design' },
      // editor: {
      //   bright: true,
      //   dimOthers: true,
      // },
      // move: {
      //   dragAnimate: true,
      // },
    });
    app.sky = app.addLeafer();
    app.sky.add((app.editor = new Editor({ moveable: false })));

    app.editor.on(EditorScaleEvent.SCALE, (e) => {
      scaleStateRef.current = e;
      onScale?.(e);
    });

    app.editor.on(EditorMoveEvent.MOVE, (e) => {
      moveStateRef.current = e;
      onMove?.(e);
    });

    app.editor.on(EditorRotateEvent.ROTATE, (e) => {
      rotateStateRef.current = e;
      onRotate?.(e);
    });

    app.editor.on(EditorEvent.SELECT, onSelect);

    app.editor.on(PathEditorEvent.CHANGE, onPathChange);

    app.tree.on(MoveEvent.MOVE, onViewMove);

    app.tree.on(ZoomEvent.ZOOM, onViewZoom);

    app.on(PointerEvent.DOWN, onPointDown);

    app.on(PointerEvent.UP, onPointUp);

    app.on(PointerEvent.UP, handlePointUp);

    app.on(PointerEvent.TAP, onTap);

    app.on(PointerEvent.MOVE, onPointMove);

    const snap = new Snap(app);
    // 启用
    snap.enable(true);
    // 初始化标尺
    initRuler(app);
    // 设置全局 app 引用
    setApp(app);
    onAppChange?.(app);
    return app;
  });

  useEffect(() => {
    if (!leaferApp) return;
    leaferApp.editor.config = { ...leaferApp.editor.config, ...editorConf };
    leaferApp.editor.update();
    if (leaferApp.config.move) leaferApp.config.move.drag = !leaferApp.editor['visible'];
  }, [JSON.stringify(editorConf), leaferApp]);

  useEffect(() => {
    if (!leaferApp) return;
    // 更新画布背景色
    leaferApp.fill = canvasBackgroundColor;
  }, [leaferApp, canvasBackgroundColor]);

  useEffect(() => {
    return () => {
      leaferApp?.destroy();
      // 清理全局 app 引用
      if (globalThis.spuEditorApp === leaferApp) {
        globalThis.spuEditorApp = null;
      }
    };
  }, [leaferApp]);

  useEffect(() => {
    if (!leaferApp) return;
    const { x, y } = zoomLayer || {};

    if (x !== undefined) {
      leaferApp.tree.x = x;
    }
    if (y !== undefined) {
      leaferApp.tree.y = y;
    }
  }, [leaferApp, zoomLayer?.x, zoomLayer?.y]);

  useEffect(() => {
    if (!leaferApp) return;
    const { scale } = zoomLayer || {};
    if (scale !== undefined) {
      leaferApp.tree.zoomLayer.scaleX = leaferApp.tree.zoomLayer.scaleY = scale;
    }
  }, [leaferApp, zoomLayer?.scale]);

  useEffect(() => {
    if (!leaferApp) return;

    if (preSelectCmpIds?.length === selectCmpIds.length) {
      if (preSelectCmpIds?.every((id) => selectCmpIds.includes(id))) {
        return;
      }
    }

    const selectedUI = selectCmpIds.map((id) => leaferApp.tree.findId(id)).filter((o) => !!o);

    leaferApp.editor.select(selectedUI);
  }, [selectCmpIds, leaferApp]);

  // 暴露 ref 方法
  React.useImperativeHandle(ref, () => ({
    select: (targets: UI[]) => {
      if (leaferApp) {
        leaferApp.editor.select(targets);
      }
    },
    hover: (target: UI) => {
      // hover 方法可能不存在，暂时注释
      // if (leaferApp && leaferApp.editor.hover) {
      //   leaferApp.editor.hover(target);
      // }
    },
    cancel: () => {
      if (leaferApp && leaferApp.editor.cancel) {
        leaferApp.editor.cancel();
      }
    },
    getApp: () => leaferApp!,
  }));

  return (
    <LeaferAppContext.Provider value={leaferApp}>{isInit && children}</LeaferAppContext.Provider>
  );
});

export default App;
