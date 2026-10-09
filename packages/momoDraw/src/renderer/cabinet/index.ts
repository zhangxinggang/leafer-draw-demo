import type { CabinetSolution, GridRectangle } from '@momo/utils/extremeCabinet';
import type { App, Group } from 'leafer-ui';
import { Path, Rect, Text } from 'leafer-ui';
import { CmpType } from '../../types/cmp';
import { cmpRenderMap } from '../components';
import { refreshConnections } from '../components/connector';
import { cabinetColor, cableColor } from '../utils/wiring';
import { receiverLoadColor } from './structure';

export { cabinetColor, cableColor } from '../utils/wiring';
export {
  cabinetLayerColors,
  getCabinetReceiverTypes,
  receiverLoadColor,
  renderCabinetStructure,
} from './structure';
export const cabinetNumber = (value: number) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });

/** Uses the same RectLine/Connector renderers as momoEditor, scoped to this canvas. */
export function renderCabinet(app: App, solution: CabinetSolution, senderName: string) {
  app.tree.children.slice().forEach((child) => child.destroy());
  const c = solution.configuration;
  // Keep native text/connection geometry bounded even for enormous pixel dimensions.
  const scale = Math.min(1, 4096 / Math.max(c.screenWidth, c.screenHeight));
  const screenWidth = c.screenWidth * scale;
  const screenHeight = c.screenHeight * scale;
  const margin = Math.max(screenWidth, screenHeight) * 0.06;
  const pixelRect = (rect: GridRectangle) => ({
    x: rect.x * c.moduleWidth * scale,
    y: rect.y * c.moduleHeight * scale,
    width: rect.width * c.moduleWidth * scale,
    height: rect.height * c.moduleHeight * scale,
  });
  app.tree.add(
    new Rect({ width: screenWidth, height: screenHeight, fill: '#cbd5df', hittable: false }),
  );
  app.tree.add(
    new Text({
      text: `显示屏 ${cabinetNumber(c.screenWidth)} × ${cabinetNumber(c.screenHeight)} px`,
      x: 0,
      y: -margin * 0.65,
      width: screenWidth,
      height: margin * 0.5,
      textAlign: 'center',
      fill: '#617f91',
      fontSize: Math.min(screenWidth, screenHeight) * 0.022,
      hittable: false,
    }),
  );

  for (const sender of solution.senders) {
    for (const cable of sender.cables) {
      for (const receiver of cable.receivers) {
        const rect = pixelRect(receiver);
        cmpRenderMap[CmpType.RectLine]({
          app,
          cmp: {
            id: `receiver-${receiver.id}`,
            ...rect,
            editable: false,
            zIndex: 1,
            fill: receiverLoadColor(receiver.width, receiver.height, true),
            stroke: receiverLoadColor(receiver.width, receiver.height),
            strokeWidth: 1,
            strokeWidthFixed: true,
            data: { cableId: cable.id },
            textLines: [
              `${senderName}-${sender.id}`,
              `宽：${cabinetNumber(receiver.width * c.moduleWidth)}`,
              `高：${cabinetNumber(receiver.height * c.moduleHeight)}`,
              `${receiver.width}宽${receiver.height}高`,
              `网线${cable.id} · 网口${cable.port}`,
            ],
            backendData: { type: CmpType.RectLine },
          },
        });
      }
      const receivers = cable.receivers;
      // A self-connector gives a single receiver both endpoint marks, without a line.
      const links = receivers.length === 1 ? receivers : receivers.slice(1);
      links.forEach((receiver, index) => {
        const previous = receivers[index];
        cmpRenderMap[CmpType.Connector]({
          app,
          cmp: {
            id: `cable-${cable.id}-${index}`,
            backendData: {
              type: CmpType.Connector,
              sourceConnId: `receiver-${previous.id}`,
              targetConnId: `receiver-${receiver.id}`,
              wiring: {
                color: cableColor(sender.id, cable.port),
                badge: `${sender.id}-${cable.port}`,
                start: index === 0,
                end: index === links.length - 1,
                single: receivers.length === 1,
                adjacent: solution.mode === 'free',
              },
            },
          },
        });
        const connection = app.tree.findId(`cable-${cable.id}-${index}`);
        if (connection?.data) connection.data.cableId = cable.id;
      });
      if (solution.mode !== 'free')
        app.tree.add(
          new Rect({
            ...pixelRect(cable),
            fill: undefined,
            stroke: cableColor(sender.id, cable.port),
            strokeWidth: 1,
            strokeWidthFixed: true,
            opacity: 0.3,
            dashPattern: [4, 3],
            zIndex: 3,
            hittable: false,
            data: { cableId: cable.id, baseOpacity: 0.3 },
          }),
        );
    }
    app.tree.add(
      new Rect({
        ...pixelRect(sender),
        fill: undefined,
        stroke: cabinetColor(sender.id),
        strokeWidth: 3,
        strokeWidthFixed: true,
        zIndex: 4,
        hittable: false,
      }),
    );
  }
  const columns = Math.floor(c.screenWidth / c.moduleWidth);
  const rows = Math.floor(c.screenHeight / c.moduleHeight);
  const grid: string[] = [];
  for (let x = 0; x <= columns; x++)
    grid.push(`M${x * c.moduleWidth * scale} 0 L${x * c.moduleWidth * scale} ${rows * c.moduleHeight * scale}`);
  for (let y = 0; y <= rows; y++)
    grid.push(`M0 ${y * c.moduleHeight * scale} L${columns * c.moduleWidth * scale} ${y * c.moduleHeight * scale}`);
  app.tree.add(
    new Path({
      id: 'module-grid',
      path: grid.join(' '),
      stroke: '#fff',
      strokeWidth: 1,
      strokeWidthFixed: true,
      hittable: false,
      zIndex: 1.5,
      opacity: 0.55,
    }),
  );
  refreshConnections(app);
  return {
    x: -margin,
    y: -margin,
    width: screenWidth + margin * 2,
    height: screenHeight + margin * 2,
  };
}

export function setCabinetLayers(
  app: App,
  modules: boolean,
  labels: boolean,
  selectedId: number | null,
) {
  app.tree.children.forEach((node) => {
    if (node.id === 'module-grid') node.visible = modules;
    if (node.data?.textLines)
      (node as Group).children.forEach((child) => {
        child.visible = labels;
      });
    if (node.data?.cableId !== undefined)
      node.opacity =
        (node.data.baseOpacity ?? 1) *
        (selectedId !== null && selectedId !== node.data.cableId ? 0.25 : 1);
  });
}
