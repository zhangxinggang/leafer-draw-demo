import type { App } from 'leafer-ui';
import type { CmpRenderParams } from '../../types';

let workerInstance: Worker | null = null;
export const initWorker = () => {
  if (workerInstance) return;

  // Keep this construction inline so Vite can bundle render.ts as a module worker.
  workerInstance = new Worker(new URL('./render.ts', import.meta.url), { type: 'module' });
};

export const workerRender = (data: CmpRenderParams & { app: App }) => {
  if (!workerInstance) return;
  const effectCanvasKeys = [
    'padding',
    'x',
    'y',
    'width',
    'height',
    'zoomLayer',
    'opacity',
    'visible',
    'locked',
    'scaleX',
    'scaleY',
    'rotation',
    'skewX',
    'skewY',
    'offsetX',
    'offsetY',
    'scrollX',
    'scrollY',
    'widthRange',
    'heightRange',
    'fill',
    'stroke',
    'strokeAlign',
    'strokeWidth',
    'strokeWidthFixed',
    'strokeCap',
    'strokeJoin',
    'dashPattern',
    'dashOffset',
    'miterLimit',
    'cornerRadius',
    'cornerSmoothing',
    'shadow',
    'innerShadow',
    'blur',
    'backgroundBlur',
    'grayscale',
    'filter',
    'placeholderColor',
    'placeholderDelay',
  ];
  const app: any = {};
  for (const key in data.app.tree) {
    if (effectCanvasKeys.includes(key)) {
      app[key] = data.app.tree[key];
    }
  }
  workerInstance.postMessage(JSON.stringify({ ...data, app: app }));
};
