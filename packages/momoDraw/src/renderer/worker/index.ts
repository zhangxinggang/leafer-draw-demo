import { richWorker } from '@momo/utils';
import { App } from 'leafer-ui';
import { CmpRenderParams } from '../../types';

const url = new URL('./render.ts', import.meta.url);

let workerInstance = null;
export const initWorker = () => {
  richWorker
    .open({
      src: url,
      data: {},
      workerOptions: {
        type: 'module',
      },
      beforeWorker: (worker: Worker) => {
        workerInstance = worker;
      },
    })
    .then((res) => {
      console.log(res, 'worker response');
    });
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
