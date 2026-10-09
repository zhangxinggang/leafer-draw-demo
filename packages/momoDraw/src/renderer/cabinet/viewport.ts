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
import { cabinetAxisCoordinate, cabinetAxisPosition, getCabinetPixelRectangle, getCabinetReceiverText } from '@momo/utils/extremeCabinet';
import { cabinetColor, cableColor, wiringGeometry } from '../utils/wiring';
import { getCabinetModuleAxisTypes, getCabinetModuleTypes, receiverLoadColor } from './structure';

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

function visibleGridIndices(screen: number, module: number, from: number, to: number) {
  const count = Math.floor(screen / module);
  return [
    Math.max(0, Math.floor(from / module) - 1),
    Math.min(count, Math.ceil(to / module) + 1),
  ] as const;
}

/** Viewport-sized Canvas2D backend. Compact plans never expand into an object per receiver. */
export class CabinetViewportRenderer {
  private canvas: HTMLCanvasElement;
  readonly solution: CabinetSolution;
  private context: CanvasRenderingContext2D;
  private receivers: CabinetReceiver[];
  private cables = new Map<number, CabinetCableSummary>();
  private next = new Map<number, CabinetReceiver>();
  private ledMask?: { radiusRatio: number; pattern: CanvasPattern };
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
    const left = cabinetAxisCoordinate(-view.x / view.scale, c.screenWidth, c.moduleWidth, c.isSmartCompletion);
    const top = cabinetAxisCoordinate(-view.y / view.scale, c.screenHeight, c.moduleHeight, c.isSmartCompletion);
    const right = cabinetAxisCoordinate((view.width - view.x) / view.scale, c.screenWidth, c.moduleWidth, c.isSmartCompletion);
    const bottom = cabinetAxisCoordinate((view.height - view.y) / view.scale, c.screenHeight, c.moduleHeight, c.isSmartCompletion);
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
      showStructureModules?: boolean;
      screenBackground?: HTMLImageElement;
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
    const project = (r: GridRectangle) => {
      const pixels = getCabinetPixelRectangle(c, r);
      return {
        x: view.x + pixels.x * view.scale,
        y: view.y + pixels.y * view.scale,
        width: pixels.width * view.scale,
        height: pixels.height * view.scale,
      };
    };
    const sx = c.moduleWidth * view.scale;
    const sy = c.moduleHeight * view.scale;
    const screenWidth = c.screenWidth * view.scale;
    const screenHeight = c.screenHeight * view.scale;
    if (!options.structure) {
      ctx.fillStyle = '#cbd5df';
      ctx.fillRect(view.x, view.y, screenWidth, screenHeight);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(view.x, view.y, screenWidth, screenHeight);
    }
    if (options.structure) {
      const moduleTypes = new Map(
        getCabinetModuleTypes(this.solution).map((item) => [`${item.width}x${item.height}`, item]),
      );

      const boardColumns = c.isSmartCompletion ? c.screenWidth : Math.floor(c.screenWidth / c.moduleWidth) * c.moduleWidth;
      const boardRows = c.isSmartCompletion ? c.screenHeight : Math.floor(c.screenHeight / c.moduleHeight) * c.moduleHeight;
      const boardWidth = boardColumns;
      const boardHeight = boardRows;
      const background = options.screenBackground;
      const drawBackground = (opacity = 1) => {
        if (!background?.naturalWidth || !background.naturalHeight) return;
        const backgroundScale = Math.max(
          screenWidth / background.naturalWidth,
          screenHeight / background.naturalHeight,
        );
        const backgroundWidth = background.naturalWidth * backgroundScale;
        const backgroundHeight = background.naturalHeight * backgroundScale;
        ctx.globalAlpha = opacity;
        ctx.drawImage(
          background,
          view.x + (screenWidth - backgroundWidth) / 2,
          view.y + (screenHeight - backgroundHeight) / 2,
          backgroundWidth,
          backgroundHeight,
        );
      };
      const configuredPointPitch = Number.isFinite(c.pointRatio) && (c.pointRatio ?? 1) >= 0
        ? c.pointRatio ?? 1
        : 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x, view.y, screenWidth, screenHeight);
      ctx.clip();
      if (configuredPointPitch === 0) {
        drawBackground();
      } else {
        // Keep lattice indices within safe integer precision for unusual imported pitch values.
        const pointPitch = Math.max(
          configuredPointPitch,
          Math.max(boardWidth, boardHeight) / Number.MAX_SAFE_INTEGER,
        );
        const beadPitch = pointPitch * view.scale;
        // CSS-pixel spacing approximates angular resolution: DPR must not change viewing distance.
        // Resolve the black gaps gradually from 1.5px to 12px, without stride-sized fake LEDs.
        const resolution = Math.max(0, Math.min(1, (beadPitch - 1.5) / 10.5));
        const detail = resolution * resolution * (3 - 2 * resolution);
        const radiusRatio = Math.min(0.72, 0.48 / pointPitch);
        ctx.beginPath();
        ctx.rect(view.x, view.y, boardWidth * view.scale, boardHeight * view.scale);
        ctx.clip();
        if (detail === 0 || radiusRatio >= Math.SQRT1_2) {
          drawBackground();
        } else if (beadPitch <= 128) {
          // One reusable tile preserves the real lattice with constant work for dense screens.
          if (this.ledMask?.radiusRatio !== radiusRatio) {
            const tile = this.canvas.ownerDocument.createElement('canvas');
            tile.width = tile.height = 256;
            const mask = tile.getContext('2d')!;
            mask.fillStyle = '#000';
            mask.fillRect(0, 0, 256, 256);
            mask.globalCompositeOperation = 'destination-out';
            for (let y = -1; y <= 1; y++)
              for (let x = -1; x <= 1; x++) {
                mask.beginPath();
                mask.arc((x + 0.5) * 256, (y + 0.5) * 256, radiusRatio * 256, 0, Math.PI * 2);
                mask.fill();
              }
            const pattern = ctx.createPattern(tile, 'repeat');
            if (pattern) this.ledMask = { radiusRatio, pattern };
          }
          drawBackground();
          if (this.ledMask) {
            this.ledMask.pattern.setTransform({
              a: beadPitch / 256, d: beadPitch / 256, e: view.x, f: view.y,
            });
            ctx.fillStyle = this.ledMask.pattern;
            ctx.globalAlpha = detail;
            ctx.fillRect(0, 0, view.width, view.height);
          }
        } else {
          // Very large cells use exact paths so tiny emitters do not disappear in a texture tile.
          const radius = beadPitch * radiusRatio;
          drawBackground(1 - detail);
          const latticeColumns = Math.ceil(boardWidth / pointPitch);
          const latticeRows = Math.ceil(boardHeight / pointPitch);
          const firstX = Math.max(0, Math.ceil((-view.x - radius) / beadPitch - 0.5));
          const lastX = Math.min(
            latticeColumns - 1,
            Math.floor((view.width - view.x + radius) / beadPitch - 0.5),
          );
          const firstY = Math.max(0, Math.ceil((-view.y - radius) / beadPitch - 0.5));
          const lastY = Math.min(
            latticeRows - 1,
            Math.floor((view.height - view.y + radius) / beadPitch - 0.5),
          );
          if (firstX <= lastX && firstY <= lastY) {
            ctx.beginPath();
            for (let y = firstY; y <= lastY; y++)
              for (let x = firstX; x <= lastX; x++) {
                const cx = view.x + (x + 0.5) * pointPitch * view.scale;
                const cy = view.y + (y + 0.5) * pointPitch * view.scale;
                ctx.moveTo(cx + radius, cy);
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
              }
            ctx.clip();
            drawBackground();
          }
        }
      }
      ctx.restore();

      if (options.showStructureModules !== false && Math.min(sx, sy) >= 5) {
        const left = -view.x / view.scale;
        const right = (view.width - view.x) / view.scale;
        const top = -view.y / view.scale;
        const bottom = (view.height - view.y) / view.scale;
        const [firstColumn, lastColumn] = visibleGridIndices(c.screenWidth, c.moduleWidth, left, right);
        const [firstRow, lastRow] = visibleGridIndices(c.screenHeight, c.moduleHeight, top, bottom);
        const rectanglesByType = new Map<
          string,
          { stroke: string; rectangles: Array<[number, number, number, number]> }
        >();
        for (let y = firstRow; y < lastRow; y++) {
          const top = cabinetAxisPosition(y, c.screenHeight, c.moduleHeight, c.isSmartCompletion);
          const bottom = cabinetAxisPosition(y + 1, c.screenHeight, c.moduleHeight, c.isSmartCompletion);
          for (let x = firstColumn; x < lastColumn; x++) {
            const left = cabinetAxisPosition(x, c.screenWidth, c.moduleWidth, c.isSmartCompletion);
            const right = cabinetAxisPosition(x + 1, c.screenWidth, c.moduleWidth, c.isSmartCompletion);
            const type = moduleTypes.get(`${right - left}x${bottom - top}`);
            if (!type) continue;
            const rectangles = rectanglesByType.get(type.fill) ?? {
              stroke: type.stroke,
              rectangles: [],
            };
            rectangles.rectangles.push([
              view.x + left * view.scale + 0.5,
              view.y + top * view.scale + 0.5,
              (right - left) * view.scale - 1,
              (bottom - top) * view.scale - 1,
            ]);
            rectanglesByType.set(type.fill, rectangles);
          }
        }
        for (const { stroke, rectangles } of rectanglesByType.values()) {
          ctx.beginPath();
          for (const rectangle of rectangles) ctx.rect(...rectangle);
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      ctx.strokeStyle = '#81909b';
      ctx.lineWidth = 1;
      ctx.strokeRect(view.x, view.y, screenWidth, screenHeight);
      return {
        totalReceivers: 0,
        representedReceivers: 0,
        detailedReceivers: 0,
        drawnGroups: moduleTypes.size,
        renderMs: performance.now() - start,
      };
    }
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
      const [firstColumn, lastColumn] = visibleGridIndices(
        c.screenWidth,
        c.moduleWidth,
        -view.x / view.scale,
        (view.width - view.x) / view.scale,
      );
      const [firstRow, lastRow] = visibleGridIndices(
        c.screenHeight,
        c.moduleHeight,
        -view.y / view.scale,
        (view.height - view.y) / view.scale,
      );
      for (let x = firstColumn; x <= lastColumn; x++) {
        const position = cabinetAxisPosition(x, c.screenWidth, c.moduleWidth, c.isSmartCompletion);
        ctx.moveTo(view.x + position * view.scale, Math.max(0, view.y));
        ctx.lineTo(view.x + position * view.scale, Math.min(view.height, view.y + c.screenHeight * view.scale));
      }
      for (let y = firstRow; y <= lastRow; y++) {
        const position = cabinetAxisPosition(y, c.screenHeight, c.moduleHeight, c.isSmartCompletion);
        ctx.moveTo(Math.max(0, view.x), view.y + position * view.scale);
        ctx.lineTo(Math.min(view.width, view.x + c.screenWidth * view.scale), view.y + position * view.scale);
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
            const x = view.x + cabinetAxisPosition(point.x, c.screenWidth, c.moduleWidth, c.isSmartCompletion) * view.scale,
              y = view.y + cabinetAxisPosition(point.y, c.screenHeight, c.moduleHeight, c.isSmartCompletion) * view.scale;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          });
          ctx.stroke();
          const angle = (geometry.rotation * Math.PI) / 180;
          const length = Math.min(4, Math.min(rect.width, rect.height) * 0.1);
          const ax = view.x + cabinetAxisPosition(geometry.arrowX, c.screenWidth, c.moduleWidth, c.isSmartCompletion) * view.scale,
            ay = view.y + cabinetAxisPosition(geometry.arrowY, c.screenHeight, c.moduleHeight, c.isSmartCompletion) * view.scale;
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
          const texts = getCabinetReceiverText(c, receiver, options.senderName);
          const textY = texts.length === 3 ? [13, 25, rect.height - 8] : [13, 25, rect.height - 20, rect.height - 8];
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
    this.ledMask = undefined;
    this.receivers = [];
    this.cables.clear();
    this.next.clear();
    this.canvas.width = this.canvas.height = 1;
  }
}
