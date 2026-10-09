import type { UI } from 'leafer-ui';
import type { RenderParams } from '../../types';
import { RenderType } from '../../types';
import { onBusAddCmp } from '../../utils/business';
import { getApp } from '../../utils/leafer';
import { cabinetColor } from '../utils/wiring';

export default function ({ Rect }: { Rect: new (props: any) => UI; Ellipse?: any; Text?: any }) {
  return function component({ cmp, type = RenderType.ADD, busData }: RenderParams) {
    const app = getApp();
    if (!app) return null;
    const existing = app.tree.findId(cmp.id);
    if (type === RenderType.DELETE) {
      existing?.destroy();
      return null;
    }
    onBusAddCmp(cmp);
    const index = Math.max(0, busData?.rectGroupIds.indexOf(cmp.id) ?? 0) + 1;
    const attrs = {
      ...cmp,
      fill: undefined,
      stroke: cabinetColor(index),
      strokeWidth: 3,
      strokeWidthFixed: true,
      zIndex: 4,
      data: { rectGroupChildIds: cmp.backendData?.rectGroupChildIds },
    };
    if (existing) {
      existing.set(attrs);
      return existing;
    }
    const element = new Rect(attrs);
    app.tree.add(element);
    return element;
  };
}
