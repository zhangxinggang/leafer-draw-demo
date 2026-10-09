import type { IUIInputData } from 'leafer-ui';

export interface WiringRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const senderHue = (index: number) => ((index - 1) * 137.508 + 145) % 360;
export const cabinetColor = (index: number) => `hsl(${senderHue(index)}, 70%, 45%)`;
export const cableColor = (sender: number, port: number) =>
  `hsl(${(senderHue(sender) + (((port - 1) * 0.618033988749895) % 1) * 24) % 360}, 70%, ${[45, 37, 51, 41, 33, 48][(port - 1) % 6]}%)`;
export const textWidth = (text: string) =>
  Array.from(text).reduce(
    (width, character) => width + (/[^\x00-\xff]/.test(character) ? 1 : 0.56),
    0,
  );

/** Shared line and arrow geometry for native Leafer and viewport renderers. */
export function wiringGeometry(source: WiringRect, target: WiringRect, adjacent = false) {
  const from = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const to = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const boundary = Math.min(
    dx === 0 ? Infinity : source.width / (2 * Math.abs(dx)),
    dy === 0 ? Infinity : source.height / (2 * Math.abs(dy)),
    1,
  );
  let points = [from, to];
  let arrowX = from.x + dx * boundary;
  let arrowY = from.y + dy * boundary;
  let rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (adjacent) {
    const top = Math.max(source.y, target.y);
    const bottom = Math.min(source.y + source.height, target.y + target.height);
    const left = Math.max(source.x, target.x);
    const right = Math.min(source.x + source.width, target.x + target.width);
    if (
      top < bottom &&
      (source.x + source.width === target.x || target.x + target.width === source.x)
    ) {
      arrowX = source.x + source.width === target.x ? target.x : source.x;
      arrowY = (top + bottom) / 2;
      rotation = dx > 0 ? 0 : 180;
      points = [from, { x: from.x, y: arrowY }, { x: to.x, y: arrowY }, to];
    } else if (
      left < right &&
      (source.y + source.height === target.y || target.y + target.height === source.y)
    ) {
      arrowX = (left + right) / 2;
      arrowY = source.y + source.height === target.y ? target.y : source.y;
      rotation = dy > 0 ? 90 : -90;
      points = [from, { x: arrowX, y: from.y }, { x: arrowX, y: to.y }, to];
    }
  }
  return { points, arrowX, arrowY, rotation };
}

/** Native Leafer children shared by editor connectors and cabinet diagrams. */
export function wiringData(
  source: WiringRect,
  target: WiringRect,
  {
    color,
    badge,
    start = false,
    end = false,
    single = false,
    adjacent = false,
  }: {
    color: string;
    badge: string;
    start?: boolean;
    end?: boolean;
    single?: boolean;
    adjacent?: boolean;
  },
): IUIInputData[] {
  const from = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const to = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const data: IUIInputData[] = [];
  if (!single) {
    const { points, arrowX, arrowY, rotation } = wiringGeometry(source, target, adjacent);
    const arrow = Math.min(source.width, source.height, target.width * 2, target.height * 2) * 0.07;
    const path = points
      .filter((point, i) => !i || point.x !== points[i - 1].x || point.y !== points[i - 1].y)
      .map((point, i) => `${i ? 'L' : 'M'}${point.x} ${point.y}`)
      .join(' ');
    data.push(
      {
        tag: 'Path',
        path,
        stroke: color,
        strokeWidth: 2,
        strokeWidthFixed: true,
      },
      {
        tag: 'Path',
        name: 'wiring-arrow',
        x: arrowX,
        y: arrowY,
        rotation,
        path: `M${-arrow / 2} ${-arrow / 2} L${arrow / 2} 0 L${-arrow / 2} ${arrow / 2} Z`,
        fill: color,
      },
    );
  }
  const radius = Math.min(source.width, source.height) * 0.13;
  if (end) {
    const size = single ? radius * 2.6 : Math.min(target.width, target.height) * 0.07;
    data.push({
      tag: 'Rect',
      name: 'wiring-end',
      x: to.x - size / 2,
      y: to.y - size / 2,
      width: size,
      height: size,
      fill: single ? undefined : color,
      stroke: color,
      strokeWidth: 1.5,
      strokeWidthFixed: true,
    });
  }
  if (start) {
    data.push(
      {
        tag: 'Ellipse',
        name: 'wiring-start',
        x: from.x - radius,
        y: from.y - radius,
        width: radius * 2,
        height: radius * 2,
        fill: color,
      },
      {
        tag: 'Text',
        name: 'wiring-badge',
        x: from.x - radius,
        y: from.y - radius,
        width: radius * 2,
        height: radius * 2,
        text: badge,
        fill: '#fff',
        fontWeight: 700,
        textAlign: 'center',
        verticalAlign: 'middle',
        fontSize: Math.min(radius * 0.72, (radius * 1.6) / textWidth(badge)),
        textWrap: 'none',
      },
    );
  }
  return data.map((child) => ({ ...child, hittable: false, editable: false }));
}
