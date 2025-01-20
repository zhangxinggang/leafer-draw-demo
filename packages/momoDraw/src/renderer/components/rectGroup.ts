import { Ellipse, Rect, Text } from 'leafer-ui';
import { AnyObj, Cmp, RenderParams, RenderType } from '../../types';
import { getRandomColor } from '../../utils';
import { onBusAddCmp } from '../../utils/business';
import { getCmpByIds } from '../../utils/cmp';
import { getApp } from '../../utils/leafer';
import { connCircleSize, getConnStartCircleId, getConnStartCircleSIds } from '../utils/conn';
import { handleDelete, handleUpdate } from '../utils/renderHelper';

interface AddStartCircleProps {
  id: string;
  sourceConnId: string;
  groupIndex: number;
  busData: AnyObj;
}

const getGroupIndex = (id: string, busData: AnyObj) => {
  const { rectGroupIds } = busData;
  const groupIndex = rectGroupIds.indexOf(id);
  return groupIndex;
};

const getGroupFillColor = (key: string, busData: AnyObj) => {
  const { businessStyle } = busData;
  const groupIndex = getGroupIndex(key, busData);
  const color = getRandomColor({
    colors: businessStyle.rectGroupColors,
    index: groupIndex,
  });
  return color;
};

const getGroupLineFillColor = (groupIndex: number, busData: AnyObj) => {
  const { businessStyle } = busData;
  const color = getRandomColor({
    colors: businessStyle.connGroupColors,
    index: groupIndex,
  });
  return color;
};

const addStartCircle = ({ id, sourceConnId, groupIndex, busData }: AddStartCircleProps) => {
  const app = getApp();
  if (!app) return null;
  const storeCmp = getCmpByIds([sourceConnId])[0];
  const { width, height } = storeCmp;
  const box = app.tree.findId(sourceConnId);
  if (!box) return;
  const startX = (width - connCircleSize) / 2;
  const startY = (height - connCircleSize) / 2;
  const fill = getGroupLineFillColor(groupIndex, busData);
  const ellipse = new Ellipse({
    id: getConnStartCircleId(id),
    width: connCircleSize,
    height: connCircleSize,
    fill,
    x: startX,
    y: startY,
  });
  const text = `${groupIndex + 1}-1`;
  const fontSize = connCircleSize / text.length;
  const textElement = new Text({
    text,
    x: startX + connCircleSize / 4 - 1,
    y: startY + connCircleSize / 2,
    fontSize,
    resizeFontSize: true,
    fill: '#fff',
    textWrap: 'none',
    textOverflow: '...',
    verticalAlign: 'middle',
    textAlign: 'left',
    editable: false,
  });
  box.add(ellipse);
  box.add(textElement);
};

const drawStartCircles = (cmp: Cmp, busData: AnyObj) => {
  const { rectGroupChildIds } = cmp.backendData;
  const ids = getConnStartCircleSIds(rectGroupChildIds);
  if (ids.length) {
    const groupIndex = getGroupIndex(cmp.id, busData);
    ids.forEach((id) => {
      addStartCircle({ id, sourceConnId: id, busData, groupIndex });
    });
  }
};

export default function component({ cmp, type = RenderType.ADD, busData }: RenderParams) {
  const app = getApp();
  if (!app) return null;
  const storeCmp = getCmpByIds([cmp.id])?.[0] || cmp;

  if (type === RenderType.DELETE) {
    return handleDelete(storeCmp);
  }

  if (type === RenderType.UPDATE) {
    return handleUpdate(storeCmp);
  }
  drawStartCircles(storeCmp, busData);
  onBusAddCmp(storeCmp);
  const element = new Rect({ ...cmp, fill: getGroupFillColor(cmp.id, busData) });
  app.tree.add(element);
  return element;
}
