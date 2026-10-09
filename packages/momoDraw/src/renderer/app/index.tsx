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
import type { IEditorConfig } from 'leafer-ui';
import { App as LeaferApp, MoveEvent, PointerEvent, ZoomEvent } from 'leafer-ui';
import { Snap } from 'leafer-x-easy-snap';
import { PathEditorEvent } from 'leafer-x-path-editor';
import type { PropsWithChildren } from 'react';
import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { setApp } from '../../utils/leafer';
import { LeaferAppContext } from '../context';
import { useRuler } from '../hooks/useRuler';

export interface IZoomLayer {
  x?: number;
  y?: number;
  scale?: number;
}

export interface AppProps {
  renderId: string;
  panEnabled?: boolean;
  editorVisible?: boolean;
  registerGlobal?: boolean;
  onAppChange?: (app: LeaferApp) => void;
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
  select: (targets: Parameters<Editor['select']>[0]) => void;
  hover: (target: unknown) => void;
  cancel: () => void;
  getApp: () => LeaferApp;
}

const App = forwardRef<AppRef, PropsWithChildren<AppProps>>((props, ref) => {
  const {
    renderId,
    children,
    selectCmpIds = [],
    zoomLayer,
    canvasBackgroundColor = '#ffffff',
    rulerVisible = true,
    darkMode = false,
    editorConf = {},
    panEnabled = false,
    editorVisible = true,
    registerGlobal = true,
  } = props;
  // The app lives for the mounted canvas; handlers must see current React state.
  const propsRef = useRef(props);
  propsRef.current = props;
  const [leaferApp, setLeaferApp] = useState<LeaferApp>();
  const moveStateRef = useRef(null);
  const scaleStateRef = useRef(null);
  const rotateStateRef = useRef(null);
  const editorConfRef = useRef(editorConf);
  editorConfRef.current = editorConf;
  const editorConfSignature = JSON.stringify(editorConf);
  const zoomX = zoomLayer?.x;
  const zoomY = zoomLayer?.y;
  const zoomScale = zoomLayer?.scale;
  const { initRuler } = useRuler({ rulerVisible, darkMode });
  const initRulerRef = useRef(initRuler);
  initRulerRef.current = initRuler;

  // Portals (e.g. the expanded cabinet dialog) attach their DOM after layout effects.
  useEffect(() => {
    const handlePointUp = () => {
      if (rotateStateRef.current) {
        propsRef.current.onRotateEnd?.(rotateStateRef.current);
        rotateStateRef.current = null;
      }
      if (moveStateRef.current) {
        propsRef.current.onMoveEnd?.(moveStateRef.current);
        moveStateRef.current = null;
      }

      if (scaleStateRef.current) {
        propsRef.current.onScaleEnd?.(scaleStateRef.current);
        scaleStateRef.current = null;
      }
    };

    const app = new LeaferApp({
      view: document.getElementById(renderId) || renderId,
      fill: propsRef.current.canvasBackgroundColor || '#ffffff',
      tree: { type: 'design' },
      move: { drag: propsRef.current.panEnabled ?? false, dragEmpty: false },
    });
    app.sky = app.addLeafer();
    app.sky.add((app.editor = new Editor(editorConfRef.current)));
    app.editor.visible = propsRef.current.editorVisible ?? true;

    app.editor.on(EditorScaleEvent.SCALE, (e) => {
      scaleStateRef.current = e;
      propsRef.current.onScale?.(e);
    });

    app.editor.on(EditorMoveEvent.MOVE, (e) => {
      moveStateRef.current = e;
      propsRef.current.onMove?.(e);
    });

    app.editor.on(EditorRotateEvent.ROTATE, (e) => {
      rotateStateRef.current = e;
      propsRef.current.onRotate?.(e);
    });

    app.editor.on(EditorEvent.SELECT, (e) => propsRef.current.onSelect?.(e));

    app.editor.on(PathEditorEvent.CHANGE, (e) => propsRef.current.onPathChange?.(e));

    app.tree.on(MoveEvent.MOVE, (e) => propsRef.current.onViewMove?.(e));

    app.tree.on(ZoomEvent.ZOOM, (e) => propsRef.current.onViewZoom?.(e));

    app.on(PointerEvent.DOWN, (e) => propsRef.current.onPointDown?.(e));

    app.on(PointerEvent.UP, (e) => propsRef.current.onPointUp?.(e));

    app.on(PointerEvent.UP, handlePointUp);

    app.on(PointerEvent.TAP, (e) => propsRef.current.onTap?.(e));

    app.on(PointerEvent.MOVE, (e) => propsRef.current.onPointMove?.(e));

    const snap = new Snap(app);
    // 启用
    snap.enable(true);
    // 初始化标尺
    const ruler = initRulerRef.current(app);
    // 设置全局 app 引用
    if (registerGlobal) setApp(app);
    setLeaferApp(app);
    propsRef.current.onAppChange?.(app);
    return () => {
      snap.destroy();
      ruler.dispose();
      app.destroy();
      if (globalThis.spuEditorApp === app) setApp(null);
    };
  }, [renderId, registerGlobal]);

  useEffect(() => {
    if (!leaferApp) return;
    leaferApp.editor.config = { ...leaferApp.editor.config, ...editorConfRef.current };
    leaferApp.editor.update();
  }, [editorConfSignature, leaferApp]);

  useLayoutEffect(() => {
    if (!leaferApp) return;
    leaferApp.editor.visible = editorVisible;
    // 2.x can pan empty space independently of move.drag.
    Object.assign(leaferApp.config.move, { drag: panEnabled, dragEmpty: false });
  }, [leaferApp, panEnabled, editorVisible]);

  useEffect(() => {
    if (!leaferApp) return;
    // 更新画布背景色
    leaferApp.fill = canvasBackgroundColor;
  }, [leaferApp, canvasBackgroundColor]);

  useEffect(() => {
    if (!leaferApp) return;
    if (zoomX !== undefined) {
      leaferApp.tree.zoomLayer.x = zoomX;
    }
    if (zoomY !== undefined) {
      leaferApp.tree.zoomLayer.y = zoomY;
    }
  }, [leaferApp, zoomX, zoomY]);

  useEffect(() => {
    if (!leaferApp) return;
    if (zoomScale !== undefined) {
      leaferApp.tree.zoomLayer.scaleX = leaferApp.tree.zoomLayer.scaleY = zoomScale;
    }
  }, [leaferApp, zoomScale]);

  useEffect(() => {
    if (!leaferApp) return;

    const selectedUI = selectCmpIds.map((id) => leaferApp.tree.findId(id)).filter((o) => !!o);
    const current = leaferApp.editor.list;
    if (current.length === selectedUI.length && current.every((node) => selectedUI.includes(node)))
      return;
    leaferApp.editor.select(selectedUI as Parameters<Editor['select']>[0]);
  }, [selectCmpIds, leaferApp]);

  // 暴露 ref 方法
  React.useImperativeHandle(ref, () => ({
    select: (targets: Parameters<Editor['select']>[0]) => {
      if (leaferApp) {
        leaferApp.editor.select(targets);
      }
    },
    hover: () => {
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
    <LeaferAppContext.Provider value={leaferApp}>{leaferApp && children}</LeaferAppContext.Provider>
  );
});

export default App;
