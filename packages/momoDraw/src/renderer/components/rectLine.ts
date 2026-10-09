import type { Box, PropertyEvent, Text } from 'leafer-ui';
import type { RenderParams } from '../../types';
import { RenderType } from '../../types';
import { getApp } from '../../utils/leafer';
import { textWidth } from '../utils/wiring';

interface LeaferObj {
  Box: typeof Box;
  Text: typeof Text;
  PropertyEvent: typeof PropertyEvent;
}
type RectLineBox = Box & { updateLabels?: () => void };

export default function ({ Box, Text, PropertyEvent }: LeaferObj) {
  return function component({ cmp, type = RenderType.ADD, busData, app: scopedApp }: RenderParams) {
    const app = scopedApp || getApp();
    if (!app) return null;
    const existing = app.tree.findId(cmp.id) as RectLineBox;
    if (type === RenderType.DELETE) {
      existing?.destroy();
      return null;
    }
    const conf = busData?.businessConf;
    const textLines =
      cmp.textLines ??
      (conf
        ? [
            conf.rectGroupName,
            `宽：${conf.rectWidth}`,
            `高：${conf.rectHeight}`,
            `${conf.rectWidth / conf.unitWidth}宽${conf.rectHeight / conf.unitHeight}高`,
          ]
        : []);
    const { backendData, textLines: _labels, textFill, ...attrs } = cmp;
    const box = existing || new Box();
    box.set({
      ...attrs,
      hitFill: 'all',
      hitChildren: false,
      data: { ...cmp.data, textLines, textFill },
    });
    const updateLabels = () => {
      box.children.slice().forEach((child) => child.destroy());
      const labels = box.data.textLines as string[];
      const { width = 0, height = 0 } = box;
      const lineHeight = (height * 0.8) / Math.max(labels.length, 1);
      labels.forEach((text, index) => {
        box.add(
          new Text({
            text,
            x: width * 0.075,
            y: height * 0.08 + index * lineHeight,
            width: width * 0.85,
            height: lineHeight,
            fontSize: Math.min(height * 0.05, (width * 0.85) / Math.max(textWidth(text), 1)),
            fill: box.data.textFill || '#354b44',
            verticalAlign: 'middle',
            textWrap: 'none',
            textOverflow: '...',
            hittable: false,
            editable: false,
          }),
        );
      });
    };
    if (!existing) {
      box.on(PropertyEvent.CHANGE, (e: PropertyEvent) => {
        if (['width', 'height'].includes(e.attrName)) updateLabels();
      });
      app.tree.add(box);
    }
    updateLabels();
    return box;
  };
}
