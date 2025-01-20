import useBusinessStore from '@momo-editor/components/SuperEditor/store/business';
import { Box, Rect, Text } from 'leafer-ui';
import { RenderParams, RenderType } from '../../types';
import { getApp } from '../../utils/leafer';
import { handleDelete, handleUpdate } from '../utils/renderHelper';

const TEXTPADDINGPERCENT = 0.3;
const TEXTWIDTHPERCENT = 0.1;
const MINFONTSIZE = 14;
/**
 * 更新 Box 内部的文本元素
 */
function updateTextElements(
  box: Box,
  textLines: string[],
  width: number,
  height: number,
  textFill?: string,
) {
  // 移除所有 Text 子元素（保留 Rect）
  const children = box.children || [];
  const textElements = children.filter((child) => child instanceof Text);
  textElements.forEach((text) => {
    box.remove(text);
    text.destroy();
  });

  // 更新背景 Rect 的尺寸
  const rect = children.find((child) => child instanceof Rect) as Rect;
  if (rect) {
    rect.width = width;
    rect.height = height;
  }

  // 如果有文本行，创建新的 Text 子元素
  if (textLines && textLines.length > 0) {
    const textHeight = height / textLines.length;
    textLines.forEach((text, index) => {
      const textElement = new Text({
        text: text || '',
        x: 0,
        y: index * textHeight,
        width: width,
        height: textHeight,
        resizeFontSize: true,
        fill: textFill || '#000000',
        padding: [0, 10],
        textWrap: 'none',
        textOverflow: '...',
        verticalAlign: 'middle',
        textAlign: 'left',
        editable: false,
      });
      box.add(textElement);
    });
  }
}

/**
 * 创建 RectLine 组件
 * 继承 Rect 的行为，支持在内部显示多行文本
 */
export default function component({ cmp, type = RenderType.ADD }: RenderParams) {
  const app = getApp();
  if (!app) return null;
  const storeCmp = cmp;

  if (type === RenderType.DELETE) {
    return handleDelete(storeCmp);
  }

  if (type === RenderType.UPDATE) {
    return handleUpdate(storeCmp);
  }

  const businessConf = useBusinessStore.getState().businessConf;
  const { width, height } = storeCmp;
  const { rectGroupName, rectWidth, rectHeight, unitWidth, unitHeight } = businessConf;
  const textLines = [
    rectGroupName,
    `宽：${rectWidth}`,
    `高：${rectHeight}`,
    `${rectWidth / unitWidth}宽${rectHeight / unitHeight}高`,
  ];
  const box = new Box(cmp);
  const canUseHeight = (1 - TEXTPADDINGPERCENT) * height;
  const canUseWidth = width * TEXTWIDTHPERCENT;
  const textHeight = ((1 - TEXTPADDINGPERCENT) * height) / textLines.length;
  textLines.forEach((text, index) => {
    const textElement = new Text({
      text: text || '',
      x: 0,
      y: index * textHeight + (height * TEXTPADDINGPERCENT) / 2,
      width: width,
      height: textHeight,
      fontSize: Math.min(canUseHeight, canUseWidth, MINFONTSIZE),
      resizeFontSize: true,
      fill: '#000000',
      padding: [0, 10],
      textWrap: 'none',
      textOverflow: '...',
      verticalAlign: 'middle',
      textAlign: 'left',
      lock: true,
    });
    box.add(textElement);
  });
  // ADD (default) 或 UPDATE 时找不到现有元素
  app.tree.add(box);
  return box;
}
