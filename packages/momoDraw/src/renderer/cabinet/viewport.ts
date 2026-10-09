import type { CabinetCableSummary } from '@momo/utils/compactCabinet';
import {
  cabinetAxisCount,
  compactAxes,
  compactReceiverAtOrder,
  findCompactReceiver,
  getCompactCable,
  getCompactReceiver,
  sampleCabinetAxis,
} from '@momo/utils/compactCabinet';
import type { CabinetReceiver, CabinetSolution, GridRectangle } from '@momo/utils/extremeCabinet';
import { cabinetColor, cableColor, wiringGeometry } from '../utils/wiring';
import { receiverLoadColor } from './structure';

export interface CabinetViewport {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  pixelRatio: number;
}

export interface CabinetRenderStats {
  totalReceivers: number;
  representedReceivers: number;
  detailedReceivers: number;
  drawnGroups: number;
  renderMs: number;
}

interface VisibleCell extends GridRectangle {
  count: number;
  receiver?: CabinetReceiver;
  cellWidth: number;
  cellHeight: number;
}

/** Viewport-sized Canvas2D backend. Compact plans never expand into an object per receiver. */
export class CabinetViewportRenderer {
  private canvas: HTMLCanvasElement;
  readonly solution: CabinetSolution;
  private context: CanvasRenderingContext2D;
  private receivers: CabinetReceiver[];
  private cables = new Map<number, CabinetCableSummary>();
  private next = new Map<number, CabinetReceiver>();
  constructor(canvas: HTMLCanvasElement, solution: CabinetSolution) {
    this.canvas = canvas;
    this.solution = solution;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建接线图画布。');
    this.context = context;
    this.receivers = solution.compact
      ? []
      : solution.senders.flatMap((sender) =>
          sender.cables.flatMap((cable) => {
            this.cables.set(cable.id, {
              ...cable,
              receiverCount: cable.receivers.length,
              load:
                cable.receivers.reduce(
                  (sum, receiver) => sum + receiver.width * receiver.height,
                  0,
                ) *
                solution.configuration.moduleWidth *
                solution.configuration.moduleHeight,
            });
            cable.receivers.forEach((receiver, index) => {
              if (index + 1 < cable.receivers.length)
                this.next.set(receiver.id, cable.receivers[index + 1]);
            });
            return cable.receivers;
          }),
        );
  }

  findReceiver(x: number, y: number) {
    return this.solution.compact
      ? findCompactReceiver(this.solution, x, y)
      : this.receivers.find(
          (receiver) =>
            x >= receiver.x &&
            y >= receiver.y &&
            x < receiver.x + receiver.width &&
            y < receiver.y + receiver.height,
        );
  }

  getCable(id: number) {
    return this.solution.compact ? getCompactCable(this.solution, id - 1) : this.cables.get(id);
  }

  private visible(view: CabinetViewport): VisibleCell[] {
    const c = this.solution.configuration;
    const sx = view.scale * c.moduleWidth;
    const sy = view.scale * c.moduleHeight;
    const left = -view.x / sx;
    const top = -view.y / sy;
    const right = (view.width - view.x) / sx;
    const bottom = (view.height - view.y) / sy;
    const l = this.solution.compact;
    if (!l)
      return this.receivers
        .filter(
          (r) => r.x + r.width >= left && r.y + r.height >= top && r.x <= right && r.y <= bottom,
        )
        .map((r) => ({ ...r, receiver: r, count: 1, cellWidth: r.width, cellHeight: r.height }));
    const axes = compactAxes(l, 'receiver');
    const xs = sampleCabinetAxis(l.width, axes.x, left, right, Math.ceil(view.width / 7));
    const ys = sampleCabinetAxis(l.height, axes.y, top, bottom, Math.ceil(view.height / 7));
    const columns = cabinetAxisCount(l.width, axes.x);
    const result: VisibleCell[] = [];
    for (const y of ys)
      for (const x of xs) {
        const count = x.count * y.count;
        result.push({
          x: x.start,
          y: y.start,
          width: x.size,
          height: y.size,
          count,
          cellWidth: x.cellSize,
          cellHeight: y.cellSize,
          receiver:
            count === 1
              ? getCompactReceiver(this.solution, y.index * columns + x.index)
              : undefined,
        });
      }
    return result;
  }

  render(
    view: CabinetViewport,
    options: {
      senderName: string;
      modules: boolean;
      labels: boolean;
      selectedCable?: number;
      structure?: boolean;
    },
  ): CabinetRenderStats {
    const start = performance.now();
    const ctx = this.context;
    const c = this.solution.configuration;
    const width = Math.max(1, Math.round(view.width * view.pixelRatio));
    const height = Math.max(1, Math.round(view.height * view.pixelRatio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    ctx.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, view.width, view.height);
    const sx = c.moduleWidth * view.scale;
    const sy = c.moduleHeight * view.scale;
    const project = (r: GridRectangle) => ({
      x: view.x + r.x * sx,
      y: view.y + r.y * sy,
      width: r.width * sx,
      height: r.height * sy,
    });
    ctx.fillStyle = '#cbd5df';
    ctx.fillRect(view.x, view.y, c.screenWidth * view.scale, c.screenHeight * view.scale);
    const cells = this.visible(view);
    for (const cell of cells) {
      const rect = project(cell);
      ctx.fillStyle = receiverLoadColor(cell.cellWidth, cell.cellHeight, true);
      ctx.fillRect(rect.x, rect.y, rect.width + 0.2, rect.height + 0.2);
      if (cell.count === 1 && Math.min(rect.width, rect.height) >= 3) {
        ctx.strokeStyle = receiverLoadColor(cell.cellWidth, cell.cellHeight);
        ctx.lineWidth = 0.7;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      }
    }
    if (options.modules && Math.min(sx, sy) >= 7) {
      ctx.beginPath();
      for (
        let x = Math.max(0, Math.ceil(-view.x / sx));
        x <=
        Math.min(Math.floor(c.screenWidth / c.moduleWidth), Math.ceil((view.width - view.x) / sx));
        x++
      ) {
        ctx.moveTo(view.x + x * sx, Math.max(0, view.y));
        ctx.lineTo(
          view.x + x * sx,
          Math.min(view.height, view.y + Math.floor(c.screenHeight / c.moduleHeight) * sy),
        );
      }
      for (
        let y = Math.max(0, Math.ceil(-view.y / sy));
        y <=
        Math.min(
          Math.floor(c.screenHeight / c.moduleHeight),
          Math.ceil((view.height - view.y) / sy),
        );
        y++
      ) {
        ctx.moveTo(Math.max(0, view.x), view.y + y * sy);
        ctx.lineTo(
          Math.min(view.width, view.x + Math.floor(c.screenWidth / c.moduleWidth) * sx),
          view.y + y * sy,
        );
      }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    if (!options.structure && this.solution.mode === 'regular') {
      const visibleCables = new Set(
        cells
          .filter((cell) => cell.receiver && cell.width * sx >= 9 && cell.height * sy >= 9)
          .map((cell) => cell.receiver!.cable),
      );
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 1;
      for (const id of visibleCables) {
        const cable = this.getCable(id)!;
        const rect = project(cable);
        ctx.strokeStyle = cableColor(cable.sender, cable.port);
        ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
      }
      ctx.setLineDash([]);
    }
    if (!options.structure)
      for (const cell of cells) {
        const receiver = cell.receiver;
        const rect = project(cell);
        if (!receiver || Math.min(rect.width, rect.height) < 9) continue;
        const cable = this.getCable(receiver.cable)!;
        const next = this.solution.compact
          ? compactReceiverAtOrder(this.solution, cable, receiver.order + 1)
          : this.next.get(receiver.id);
        ctx.globalAlpha = options.selectedCable && options.selectedCable !== cable.id ? 0.2 : 1;
        const color = cableColor(receiver.sender, receiver.port);
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.lineWidth = options.selectedCable === cable.id ? 2.5 : 1.3;
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        if (next) {
          const geometry = wiringGeometry(receiver, next, true);
          ctx.beginPath();
          geometry.points.forEach((point, i) => {
            const x = view.x + point.x * sx,
              y = view.y + point.y * sy;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          });
          ctx.stroke();
          const angle = (geometry.rotation * Math.PI) / 180;
          const length = Math.min(4, Math.min(rect.width, rect.height) * 0.1);
          const ax = view.x + geometry.arrowX * sx,
            ay = view.y + geometry.arrowY * sy;
          ctx.beginPath();
          ctx.moveTo(ax + Math.cos(angle) * length, ay + Math.sin(angle) * length);
          ctx.lineTo(ax + Math.cos(angle + 2.5) * length, ay + Math.sin(angle + 2.5) * length);
          ctx.lineTo(ax + Math.cos(angle - 2.5) * length, ay + Math.sin(angle - 2.5) * length);
          ctx.closePath();
          ctx.fill();
        } else ctx.fillRect(cx - 3, cy - 3, 6, 6);
        if (receiver.order === 1) {
          const radius = Math.min(12, Math.min(rect.width, rect.height) * 0.16);
          if (cable.receiverCount === 1) {
            ctx.strokeRect(cx - radius * 1.3, cy - radius * 1.3, radius * 2.6, radius * 2.6);
          }
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          if (radius >= 8) {
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '8px sans-serif';
            ctx.fillText(`${receiver.sender}-${receiver.port}`, cx, cy + 3, radius * 1.8);
          }
        }
        if (options.labels && rect.width >= 70 && rect.height >= 65) {
          ctx.fillStyle = '#344959';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'left';
          const texts = [
            `${options.senderName}-${receiver.sender}`,
            `接收卡 ${receiver.id} · ${receiver.width}宽${receiver.height}高`,
            `${receiver.width * c.moduleWidth} × ${receiver.height * c.moduleHeight} px`,
            `网线 ${receiver.cable} · 网口 ${receiver.port}`,
          ];
          const textY = [13, 25, rect.height - 20, rect.height - 8];
          texts.forEach((text, i) =>
            ctx.fillText(text, rect.x + 4, rect.y + textY[i], rect.width - 8),
          );
        }
        ctx.globalAlpha = 1;
      }
    const l = this.solution.compact;
    let senders: (GridRectangle & { id: number })[];
    if (l) {
      const xs = sampleCabinetAxis(
        l.width,
        [l.senderWidth],
        -view.x / sx,
        (view.width - view.x) / sx,
        Math.ceil(view.width / 14),
      );
      const ys = sampleCabinetAxis(
        l.height,
        [l.senderHeight],
        -view.y / sy,
        (view.height - view.y) / sy,
        Math.ceil(view.height / 14),
      );
      const cols = Math.ceil(l.width / l.senderWidth);
      senders = ys.flatMap((y) =>
        xs.map((x) => ({
          x: x.start,
          y: y.start,
          width: x.size,
          height: y.size,
          id: y.index * cols + x.index + 1,
        })),
      );
    } else senders = this.solution.senders;
    for (const sender of senders) {
      const rect = project(sender);
      if (
        rect.x > view.width ||
        rect.y > view.height ||
        rect.x + rect.width < 0 ||
        rect.y + rect.height < 0
      )
        continue;
      ctx.strokeStyle = options.structure ? '#d6812b' : cabinetColor(sender.id);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    return {
      totalReceivers: this.solution.cost[1],
      representedReceivers: cells.reduce((sum, cell) => sum + cell.count, 0),
      detailedReceivers: cells.filter(
        (cell) => cell.receiver && cell.width * sx >= 9 && cell.height * sy >= 9,
      ).length,
      drawnGroups: cells.length,
      renderMs: performance.now() - start,
    };
  }

  destroy() {
    this.receivers = [];
    this.cables.clear();
    this.next.clear();
    this.canvas.width = this.canvas.height = 1;
  }
}
