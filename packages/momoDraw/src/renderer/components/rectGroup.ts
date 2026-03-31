import type { UI } from 'leafer-ui';
import { Cmp, IBusinessStore, RenderParams, RenderType } from '../../types';
import { getRandomColor } from '../../utils';
import { onBusAddCmp } from '../../utils/business';
import { getCmpByIds } from '../../utils/cmp';
import { getApp } from '../../utils/leafer';
import { connCircleSize, getConnStartCircleId, getConnStartCircleSIds } from '../utils/conn';
import { handleTypeRender } from '../utils/renderHelper';

type IFunc = new (props: any) => UI;
interface LeaferObj {
  Ellipse: IFunc;
  Rect: IFunc;
  Text: IFunc;
}
interface AddStartCircleProps {
  id: string;
  sourceConnId: string;
  groupIndex: number;
  busData: IBusinessStore;
  leaferObj;
}

const getGroupIndex = (id: string, busData: IBusinessStore) => {
  const { rectGroupIds } = busData;
  const groupIndex = rectGroupIds.indexOf(id);
  return groupIndex;
};

const getGroupFillColor = (key: string, busData: IBusinessStore) => {
  const { businessStyle } = busData;
  const groupIndex = getGroupIndex(key, busData);
  const color = getRandomColor({
    colors: businessStyle.rectGroupColors,
    index: groupIndex,
  });
  return color;
};

const getGroupLineFillColor = (groupIndex: number, busData: IBusinessStore) => {
  const { businessStyle } = busData;
  const color = getRandomColor({
    colors: businessStyle.connGroupColors,
    index: groupIndex,
  });
  return color;
};

const addStartCircle = ({
  id,
  sourceConnId,
  groupIndex,
  busData,
  leaferObj,
}: AddStartCircleProps) => {
  const app = getApp();
  if (!app) return null;
  const storeCmp = getCmpByIds([sourceConnId])[0];
  const { width, height } = storeCmp;
  const box = app.tree.findId(sourceConnId);
  if (!box) return;
  const startX = (width - connCircleSize) / 2;
  const startY = (height - connCircleSize) / 2;
  const fill = getGroupLineFillColor(groupIndex, busData);
  const ellipse = new leaferObj.Ellipse({
    id: getConnStartCircleId(id),
    width: connCircleSize,
    height: connCircleSize,
    fill,
    x: startX,
    y: startY,
  });
  const text = `${groupIndex + 1}-1`;
  const fontSize = connCircleSize / text.length;
  const textElement = new leaferObj.Text({
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

const drawStartCircles = (cmp: Cmp, busData: IBusinessStore, leaferObj: LeaferObj) => {
  const { rectGroupChildIds } = cmp.backendData;
  const ids = getConnStartCircleSIds(rectGroupChildIds);
  if (ids.length) {
    const groupIndex = getGroupIndex(cmp.id, busData);
    ids.forEach((id) => {
      addStartCircle({ id, sourceConnId: id, busData, groupIndex, leaferObj });
    });
  }
};

export default function (props: LeaferObj) {
  const { Rect } = props;
  return function component({ cmp, type = RenderType.ADD, busData }: RenderParams) {
    const app = getApp();
    if (!app) return null;
    const isRender = handleTypeRender({ type, cmp });
    if (isRender) {
      return null;
    }
    drawStartCircles(cmp, busData, props);
    onBusAddCmp(cmp);
    const element = new Rect({ ...cmp, fill: getGroupFillColor(cmp.id, busData) });
    app.tree.add(element);
    return element;
  };
}
