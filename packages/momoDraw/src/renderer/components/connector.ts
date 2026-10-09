import type { App, Group, PropertyEvent } from 'leafer-ui';
import type { IBusinessStore, RenderParams } from '../../types';
import { RenderType } from '../../types';
import { onBusAddCmp } from '../../utils/business';
import { getApp } from '../../utils/leafer';
import { cableColor, wiringData } from '../utils/wiring';

type WiringGroup = Group & { refreshWiring?: () => void };
interface LeaferObj {
  Group: typeof Group;
  PropertyEvent: typeof PropertyEvent;
}

// Recompute endpoints and port numbers after a batch, including undo/delete.
export function refreshConnections(app: App, busData?: IBusinessStore) {
  const connections = app.tree.children.filter(
    (node) => (node as WiringGroup).refreshWiring,
  ) as WiringGroup[];
  const incoming = new Map<string, WiringGroup>();
  const outgoing = new Map<string, WiringGroup>();
  connections.forEach((node) => {
    incoming.set(node.data.targetConnId, node);
    outgoing.set(node.data.sourceConnId, node);
  });
  const groups = new Map<string, number>();
  app.tree.children.forEach((node) => {
    const groupIndex = busData?.rectGroupIds.indexOf(node.id || '') ?? -1;
    if (groupIndex >= 0)
      node.data?.rectGroupChildIds?.forEach((id: string) => groups.set(id, groupIndex + 1));
  });
  const ports = new Map<number, number>();
  const visited = new Set<WiringGroup>();
  const drawChain = (first: WiringGroup) => {
    const sender = groups.get(first.data.sourceConnId) || 1;
    const port = (ports.get(sender) || 0) + 1;
    ports.set(sender, port);
    let node: WiringGroup | undefined = first;
    while (node && !visited.has(node)) {
      visited.add(node);
      const { sourceConnId, targetConnId, wiring } = node.data;
      node.data.style = wiring || {
        color: cableColor(sender, port),
        badge: `${sender}-${port}`,
        start: !incoming.has(sourceConnId),
        end: !outgoing.has(targetConnId),
      };
      node.refreshWiring?.();
      node = outgoing.get(targetConnId);
    }
  };
  connections.filter((node) => !incoming.has(node.data.sourceConnId)).forEach(drawChain);
  connections.filter((node) => !visited.has(node)).forEach(drawChain);
}

export default function ({ Group, PropertyEvent }: LeaferObj) {
  return function component({
    cmp,
    type = RenderType.ADD,
    app: scopedApp,
    recordBusiness = true,
  }: RenderParams) {
    const app = scopedApp || getApp();
    if (!app) return null;
    const existing = app.tree.findId(cmp.id);
    if (type === RenderType.DELETE) {
      existing?.destroy();
      return null;
    }
    if (existing) existing.destroy();
    const { sourceConnId, targetConnId } = cmp.backendData || {};
    if (!sourceConnId || !targetConnId) return null;
    const source = app.tree.findId(sourceConnId);
    const target = app.tree.findId(targetConnId);
    if (!source || !target) return null;
    if (!scopedApp && recordBusiness) onBusAddCmp(cmp);
    const group = new Group({
      id: cmp.id,
      opacity: cmp.opacity ?? 1,
      zIndex: Math.max(source.zIndex || 0, target.zIndex || 0) + 1,
      data: { ...cmp.backendData },
      editable: false,
      hittable: false,
    }) as WiringGroup;
    group.refreshWiring = () => {
      const sourceBounds = source.getBounds('box', app.tree);
      const targetBounds = target.getBounds('box', app.tree);
      group.children.slice().forEach((child) => child.destroy());
      group.set({
        children: wiringData(
          sourceBounds,
          targetBounds,
          group.data.style || { color: cableColor(1, 1), badge: '1-1', start: true, end: true },
        ),
      });
    };
    const handleChange = (e: PropertyEvent) => {
      if (
        ['x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY', 'skewX', 'skewY'].includes(
          e.attrName,
        )
      )
        group.refreshWiring?.();
    };
    source.on(PropertyEvent.CHANGE, handleChange);
    target.on(PropertyEvent.CHANGE, handleChange);
    const destroy = group.destroy.bind(group);
    group.destroy = () => {
      source.off(PropertyEvent.CHANGE, handleChange);
      target.off(PropertyEvent.CHANGE, handleChange);
      group.refreshWiring = undefined;
      destroy();
    };
    app.tree.add(group);
    return group;
  };
}
