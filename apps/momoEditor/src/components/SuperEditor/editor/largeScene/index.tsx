import { LargeRectGridRenderer } from '@momo/leafer-draw/renderer/largeScene';
import { getLargeSceneBounds, getLargeSceneCount } from '@momo/leafer-draw/types/largeScene';
import { Rect } from 'leafer-ui';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useCanvasStore from '../../store/canvas';
import useModelStore from '../../store/model';
import useToolbarStore, { ToolBarState } from '../../store/toolbar';
import styles from './index.module.less';

const LARGE_SCENE_BOUNDS_ID = '__large-scene-bounds__';

export default function LargeSceneLayer({ container }: { container: HTMLDivElement | null }) {
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const detailCanvasRef = useRef<HTMLCanvasElement>(null);
  const invalidateRevisionRef = useRef(0);
  const [statsLabel, setStatsLabel] = useState('');
  const largeScene = useModelStore((state) => state.largeScene);
  const { app, canvasBackgroundColor } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
      canvasBackgroundColor: state.canvasBackgroundColor,
    })),
  );

  useEffect(() => {
    if (!app?.tree) return;
    const previousMinScale = app.tree.config.zoom?.min;
    if (app.tree.config.zoom) app.tree.config.zoom.min = 0.0001;
    const previousBounds = app.tree.findId(LARGE_SCENE_BOUNDS_ID);
    if (previousBounds) app.tree.remove(previousBounds);
    if (!largeScene) return;

    const bounds = getLargeSceneBounds(largeScene);
    const boundsElement = new Rect({
      id: LARGE_SCENE_BOUNDS_ID,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      fill: 'rgba(0, 0, 0, 0)',
      strokeWidth: 0,
      hittable: false,
      editable: false,
      selectable: false,
    });
    app.tree.add(boundsElement);

    let fitFrame = 0;
    if (useModelStore.getState().zoomLayer.scale === undefined) {
      fitFrame = requestAnimationFrame(() => {
        app.tree.zoom(bounds, 30);
        useModelStore.getState().updateZoomLayer({ scale: app.tree.zoomLayer.scaleX });
      });
    }

    return () => {
      if (fitFrame) cancelAnimationFrame(fitFrame);
      const currentBounds = app.tree.findId(LARGE_SCENE_BOUNDS_ID);
      if (currentBounds) app.tree.remove(currentBounds);
      if (app.tree.config.zoom && previousMinScale !== undefined) {
        app.tree.config.zoom.min = previousMinScale;
      }
    };
  }, [app, largeScene]);

  useEffect(() => {
    if (!app?.tree || !container || !largeScene) return;

    let activePointerId: number | null = null;
    let startClientX = 0;
    let startClientY = 0;
    let startViewX = 0;
    let startViewY = 0;

    const stopLeaferPointerEvent = (event: globalThis.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (event.button !== 0 || useToolbarStore.getState().state !== ToolBarState.Dragger) return;
      activePointerId = event.pointerId;
      startClientX = event.clientX;
      startClientY = event.clientY;
      startViewX = Number(app.tree.zoomLayer.x || 0);
      startViewY = Number(app.tree.zoomLayer.y || 0);
      container.setPointerCapture(event.pointerId);
      container.style.cursor = 'grabbing';
      stopLeaferPointerEvent(event);
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      app.tree.x = startViewX + event.clientX - startClientX;
      app.tree.y = startViewY + event.clientY - startClientY;
      stopLeaferPointerEvent(event);
    };

    const finishPointerMove = (event: globalThis.PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      activePointerId = null;
      if (container.hasPointerCapture(event.pointerId))
        container.releasePointerCapture(event.pointerId);
      container.style.cursor = '';
      useModelStore.getState().updateZoomLayer({
        x: Number(app.tree.zoomLayer.x || 0),
        y: Number(app.tree.zoomLayer.y || 0),
      });
      stopLeaferPointerEvent(event);
    };

    container.addEventListener('pointerdown', handlePointerDown, true);
    container.addEventListener('pointermove', handlePointerMove, true);
    container.addEventListener('pointerup', finishPointerMove, true);
    container.addEventListener('pointercancel', finishPointerMove, true);

    return () => {
      container.style.cursor = '';
      container.removeEventListener('pointerdown', handlePointerDown, true);
      container.removeEventListener('pointermove', handlePointerMove, true);
      container.removeEventListener('pointerup', finishPointerMove, true);
      container.removeEventListener('pointercancel', finishPointerMove, true);
    };
  }, [app, container, largeScene]);

  useEffect(() => {
    const gridCanvas = gridCanvasRef.current;
    const detailCanvas = detailCanvasRef.current;
    if (!container || !gridCanvas || !detailCanvas || !largeScene) {
      setStatsLabel('');
      return;
    }

    const renderer = new LargeRectGridRenderer(gridCanvas, detailCanvas, () => {
      invalidateRevisionRef.current += 1;
    });
    let animationFrame = 0;
    let lastSignature = '';
    let lastTransformSignature = '';
    let lastStatsUpdate = 0;
    let persistTransformTimer = 0;
    let resizeRevision = 0;
    const resizeObserver = new ResizeObserver(() => {
      resizeRevision += 1;
    });
    resizeObserver.observe(container);

    const renderFrame = (time: number) => {
      const rect = container.getBoundingClientRect();
      const transform = app?.tree?.zoomLayer;
      const persistedZoom = useModelStore.getState().zoomLayer;
      const x = Number(transform?.x ?? persistedZoom.x ?? 0);
      const y = Number(transform?.y ?? persistedZoom.y ?? 0);
      const scale = Math.max(0.000001, Number(transform?.scaleX ?? persistedZoom.scale ?? 1));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const transformSignature = `${x}|${y}|${scale}`;
      if (transformSignature !== lastTransformSignature) {
        lastTransformSignature = transformSignature;
        if (persistTransformTimer) window.clearTimeout(persistTransformTimer);
        persistTransformTimer = window.setTimeout(() => {
          const current = useModelStore.getState().zoomLayer;
          if (current.x !== x || current.y !== y || current.scale !== scale) {
            useModelStore.getState().updateZoomLayer({ x, y, scale });
          }
        }, 300);
      }
      const signature = [
        largeScene.id,
        rect.width,
        rect.height,
        pixelRatio,
        x,
        y,
        scale,
        canvasBackgroundColor,
        resizeRevision,
        invalidateRevisionRef.current,
      ].join('|');

      if (signature !== lastSignature && rect.width > 0 && rect.height > 0) {
        lastSignature = signature;
        const stats = renderer.render(
          largeScene,
          { x, y, scale, width: rect.width, height: rect.height, pixelRatio },
          canvasBackgroundColor,
        );
        if (time - lastStatsUpdate > 250) {
          lastStatsUpdate = time;
          const detail =
            stats.detailLevel === 'detail' ? ` · 细节 ${stats.visibleDetailCount}` : ' · 总览';
          setStatsLabel(
            `${stats.backend.toUpperCase()} · ${getLargeSceneCount(largeScene)} 个箱体${detail}`,
          );
        }
      }
      animationFrame = requestAnimationFrame(renderFrame);
    };

    animationFrame = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animationFrame);
      if (persistTransformTimer) window.clearTimeout(persistTransformTimer);
      resizeObserver.disconnect();
      renderer.destroy();
    };
  }, [app, canvasBackgroundColor, container, largeScene]);

  if (!largeScene) return null;

  return (
    <div className={styles['large-scene-layer']} aria-label='百万级画布渲染层'>
      <canvas
        ref={gridCanvasRef}
        id='large-scene-grid-canvas'
        className={styles['large-scene-canvas']}
      />
      <canvas
        ref={detailCanvasRef}
        id='large-scene-detail-canvas'
        className={styles['large-scene-canvas']}
      />
      <div className={styles['large-scene-stats']}>{statsLabel}</div>
    </div>
  );
}
