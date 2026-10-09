import type { CabinetSolution, GridRectangle } from '@momo/utils/extremeCabinet';
import { getCompactReceiverTypes } from '@momo/utils/compactCabinet';
import type { App } from 'leafer-ui';
import { Group, Path, Rect, Text } from 'leafer-ui';

export const cabinetLayerColors = {
  screen: '#94a3b8',
  module: '#3385b8',
  receiver: '#9564c6',
  sender: '#d6812b',
};

export function receiverLoadColor(width: number, height: number, pale = false) {
  const code = ((width + height) * (width + height + 1)) / 2 + height;
  const hue = (code * 137.508 + 35) % 360;
  return `hsl(${hue}, ${pale ? 65 : 58}%, ${pale ? 91 : 44}%)`;
}

export function getCabinetReceiverTypes(solution: CabinetSolution) {
  if (solution.compact)
    return getCompactReceiverTypes(solution.compact).map((item) => ({
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
        const key = `${receiver.width}x${receiver.height}`;
        const entry = types.get(key) || {
          width: receiver.width,
          height: receiver.height,
          count: 0,
          color: receiverLoadColor(receiver.width, receiver.height),
          fill: receiverLoadColor(receiver.width, receiver.height, true),
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
  const pixelRect = (rect: GridRectangle) => ({
    x: rect.x * c.moduleWidth * scale,
    y: rect.y * c.moduleHeight * scale,
    width: rect.width * c.moduleWidth * scale,
    height: rect.height * c.moduleHeight * scale,
  });
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
  for (let x = 0; x <= columns; x++)
    grid.push(
      `M${x * c.moduleWidth * scale} 0 L${x * c.moduleWidth * scale} ${rows * c.moduleHeight * scale}`,
    );
  for (let y = 0; y <= rows; y++)
    grid.push(
      `M0 ${y * c.moduleHeight * scale} L${columns * c.moduleWidth * scale} ${y * c.moduleHeight * scale}`,
    );
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
