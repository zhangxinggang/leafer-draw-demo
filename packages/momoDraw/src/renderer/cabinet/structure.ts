import type { CabinetSolution, GridRectangle } from '@momo/utils/extremeCabinet';
import { cabinetAxisPosition, getCabinetPixelRectangle } from '@momo/utils/extremeCabinet';
import { getCompactReceiverTypes } from '@momo/utils/compactCabinet';
import type { App } from 'leafer-ui';
import { Group, Path, Rect, Text } from 'leafer-ui';

export const cabinetLayerColors = {
  screen: '#94a3b8',
  module: '#3385b8',
  receiver: '#9564c6',
  sender: '#d6812b',
};

const MODULE_COLORS = ['#b9d9f4', '#f7d59a', '#b9e3cc', '#edc3dc', '#d3c6f2', '#f2c4b8'];
const MODULE_BORDER_COLORS = ['#2878ad', '#b87508', '#388558', '#aa4b7d', '#7259a4', '#ad5343'];

export function cabinetModuleColor(index: number) {
  return MODULE_COLORS[index % MODULE_COLORS.length];
}

export interface CabinetModuleAxisType {
  start: number;
  size: number;
  count: number;
}

export function getCabinetModuleAxisTypes(screen: number, module: number, complete = false): CabinetModuleAxisType[] {
  const fullCount = Math.floor(screen / module);
  if (!fullCount) return [];
  const remainder = screen - fullCount * module;
  const hasEdge = complete && remainder > 0;
  const result: CabinetModuleAxisType[] = [];
  const regularCount = fullCount - (hasEdge ? 1 : 0);
  if (regularCount > 0) result.push({ start: 0, size: module, count: regularCount });
  if (hasEdge)
    result.push({ start: (fullCount - 1) * module, size: module + remainder, count: 1 });
  return result;
}

export function getCabinetModuleTypes(solution: CabinetSolution) {
  const c = solution.configuration;
  const x = getCabinetModuleAxisTypes(c.screenWidth, c.moduleWidth, c.isSmartCompletion);
  const y = getCabinetModuleAxisTypes(c.screenHeight, c.moduleHeight, c.isSmartCompletion);
  const types = new Map<string, { width: number; height: number; count: number }>();
  for (const xType of x)
    for (const yType of y) {
      const key = `${xType.size}x${yType.size}`;
      const item = types.get(key) ?? { width: xType.size, height: yType.size, count: 0 };
      item.count += xType.count * yType.count;
      types.set(key, item);
    }
  return [...types.values()]
    .sort((a, b) => a.height - b.height || a.width - b.width)
    .map((item, index) => ({
      ...item,
      fill: cabinetModuleColor(index),
      stroke: MODULE_BORDER_COLORS[index % MODULE_BORDER_COLORS.length],
    }));
}

export function receiverLoadColor(width: number, height: number, pale = false) {
  const code = ((width + height) * (width + height + 1)) / 2 + height;
  const hue = (code * 137.508 + 35) % 360;
  return `hsl(${hue}, ${pale ? 65 : 58}%, ${pale ? 91 : 44}%)`;
}

export function getCabinetReceiverTypes(solution: CabinetSolution) {
  if (solution.compact)
    return getCompactReceiverTypes(solution.compact, solution.configuration).map((item) => ({
      ...item,
      color: receiverLoadColor(item.width, item.height),
      fill: receiverLoadColor(item.width, item.height, true),
    }));
  const types = new Map<
    string,
    { width: number; height: number; count: number; color: string; fill: string }
  >();
  for (const sender of solution.senders)
    for (const cable of sender.cables)
      for (const receiver of cable.receivers) {
        const pixel = getCabinetPixelRectangle(solution.configuration, receiver);
        const key = `${pixel.width}x${pixel.height}`;
        const entry = types.get(key) || {
          width: pixel.width,
          height: pixel.height,
          count: 0,
          color: receiverLoadColor(pixel.width, pixel.height),
          fill: receiverLoadColor(pixel.width, pixel.height, true),
        };
        entry.count++;
        types.set(key, entry);
      }
  return [...types.values()].sort(
    (a, b) => b.width * b.height - a.width * a.height || b.width - a.width,
  );
}

/** Front elevation: all four native Leafer layers share the same coordinates. */
export function renderCabinetStructure(app: App, solution: CabinetSolution) {
  app.tree.children.slice().forEach((child) => child.destroy());
  const c = solution.configuration;
  const scale = Math.min(600 / c.screenWidth, 340 / c.screenHeight);
  const width = c.screenWidth * scale;
  const height = c.screenHeight * scale;
  const pixelRect = (rect: GridRectangle) => {
    const pixels = getCabinetPixelRectangle(c, rect);
    return {
      x: pixels.x * scale,
      y: pixels.y * scale,
      width: pixels.width * scale,
      height: pixels.height * scale,
    };
  };
  const plane = new Group({ x: 10, y: 50, hittable: false });
  app.tree.add(plane);
  plane.add(new Rect({ width, height, fill: '#cbd5df' }));
  for (const sender of solution.senders)
    for (const cable of sender.cables)
      for (const receiver of cable.receivers)
        plane.add(
          new Rect({
            ...pixelRect(receiver),
            fill: receiverLoadColor(receiver.width, receiver.height, true),
            stroke: receiverLoadColor(receiver.width, receiver.height),
            strokeWidth: 1,
            strokeWidthFixed: true,
          }),
        );

  const columns = Math.floor(c.screenWidth / c.moduleWidth);
  const rows = Math.floor(c.screenHeight / c.moduleHeight);
  const grid: string[] = [];
  for (let x = 0; x <= columns; x++) {
    const position = cabinetAxisPosition(x, c.screenWidth, c.moduleWidth, c.isSmartCompletion) * scale;
    grid.push(`M${position} 0 L${position} ${height}`);
  }
  for (let y = 0; y <= rows; y++) {
    const position = cabinetAxisPosition(y, c.screenHeight, c.moduleHeight, c.isSmartCompletion) * scale;
    grid.push(`M0 ${position} L${width} ${position}`);
  }
  plane.add(
    new Path({ path: grid.join(' '), stroke: '#fff', strokeWidth: 1, strokeWidthFixed: true }),
  );
  for (const sender of solution.senders) {
    const rect = pixelRect(sender);
    plane.add(
      new Rect({
        ...rect,
        fill: undefined,
        stroke: cabinetLayerColors.sender,
        strokeWidth: 2,
        strokeWidthFixed: true,
      }),
    );
    if (rect.width >= 32 && rect.height >= 22)
      plane.add(
        new Text({
          x: rect.x + 5,
          y: rect.y + 4,
          text: `S${sender.id}`,
          fontSize: 11,
          fill: '#905317',
        }),
      );
  }
  const label = (value: number) => value.toLocaleString('zh-CN');
  app.tree.add(
    new Path({
      path: `M10 22 L${width + 10} 22 M10 18 L10 26 M${width + 10} 18 L${width + 10} 26 M${width + 28} 50 L${width + 28} ${height + 50} M${width + 24} 50 L${width + 32} 50 M${width + 24} ${height + 50} L${width + 32} ${height + 50}`,
      stroke: '#a4b1bd',
      strokeWidth: 1,
      strokeWidthFixed: true,
      hittable: false,
    }),
  );
  app.tree.add(
    new Text({
      x: 10,
      y: 0,
      width,
      textAlign: 'center',
      text: `${label(c.screenWidth)} px · ${columns} 列`,
      fontSize: 12,
      fill: '#456578',
      hittable: false,
    }),
  );
  app.tree.add(
    new Text({
      x: width + 38,
      y: height / 2 + 34,
      text: `${label(c.screenHeight)} px\n${rows} 行`,
      fontSize: 11,
      fill: '#456578',
      hittable: false,
    }),
  );
  return { x: 0, y: 0, width: width + 116, height: height + 70 };
}
