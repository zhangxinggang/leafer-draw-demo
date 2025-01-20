import { Icon } from '@iconify/react';
import { generateCmp } from '@momo/leafer-draw/generator';
import { CmpType } from '@momo/leafer-draw/types/cmp';
import classNames from 'classnames';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import SvgIconComponent from '../../../../SvgIcon';
import useCanvasStore from '../../../store/canvas';
import useModelStore from '../../../store/model';
import useToolbarStore, { ToolBarState } from '../../../store/toolbar';
import styles from './index.module.less';

interface ElementItem {
  type: CmpType;
  icon: React.ReactNode;
  name: string;
  defaultWidth: number;
  defaultHeight: number;
}

const elements: ElementItem[] = [
  {
    type: CmpType.Rect,
    icon: <Icon icon='mdi:square-outline' width={24} />,
    name: '矩形',
    defaultWidth: 100,
    defaultHeight: 100,
  },
  {
    type: CmpType.Ellipse,
    icon: <SvgIconComponent name='circle' style={{ width: 24 }} />,
    name: '圆形',
    defaultWidth: 200,
    defaultHeight: 200,
  },
  {
    type: CmpType.Line,
    icon: <Icon icon='mdi:minus' width={24} />,
    name: '线条',
    defaultWidth: 100,
    defaultHeight: 0,
  },
  {
    type: CmpType.Arrow,
    icon: <Icon icon='mdi:arrow-right' width={24} />,
    name: '箭头',
    defaultWidth: 100,
    defaultHeight: 0,
  },
];

export default function ElementPanel() {
  const { addCmps } = useModelStore(
    useShallow((state) => ({
      addCmps: state.addCmps,
    })),
  );
  const { app, secondaryMenuWidth } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
      secondaryMenuWidth: state.secondaryMenuWidth,
    })),
  );
  const { zoomLayer } = useModelStore(
    useShallow((state) => ({
      zoomLayer: state.zoomLayer,
    })),
  );
  const { state: toolbarState, setState } = useToolbarStore();

  // 根据二级菜单宽度计算列数
  const getColumnsClass = () => {
    if (secondaryMenuWidth < 210) {
      return 'columns-1';
    } else if (secondaryMenuWidth < 315) {
      return 'columns-2';
    }
    return '';
  };

  // 计算画布中心点
  const getCanvasCenter = () => {
    if (!app) return { x: 400, y: 300 };
    const { x = 0, y = 0, scale = 1 } = zoomLayer || {};
    const appWidth = app.canvas.width;
    const appHeight = app.canvas.height;
    const centerX = ((appWidth - x) * scale) / 2;
    const centerY = ((appHeight - y) * scale) / 2;
    return { x: centerX, y: centerY };
  };

  // 双击添加到画布中心
  const handleDoubleClick = (element: ElementItem) => {
    const center = getCanvasCenter();
    const { defaultWidth, defaultHeight } = element;
    const startX = center.x - defaultWidth / 2;
    const startY = center.y - defaultHeight / 2;
    const endX = center.x + defaultWidth / 2;
    const endY = center.y + defaultHeight / 2;

    const cmp = generateCmp(element.type, {
      startX,
      startY,
      endX,
      endY,
    });

    if (cmp) {
      addCmps([cmp]);
    }
  };

  // 拖拽添加
  const handleDragStart = (e: React.DragEvent, element: ElementItem) => {
    e.dataTransfer.setData('elementType', element.type.toString());
    e.dataTransfer.setData('defaultWidth', element.defaultWidth.toString());
    e.dataTransfer.setData('defaultHeight', element.defaultHeight.toString());
  };

  // 点击元素，设置绘制模式
  const handleClick = (element: ElementItem) => {
    // 根据元素类型设置对应的toolbar state
    let toolbarState: ToolBarState;
    switch (element.type) {
      case CmpType.Rect:
        toolbarState = ToolBarState.Rect;
        break;
      case CmpType.Ellipse:
        toolbarState = ToolBarState.Ellipse;
        break;
      case CmpType.Line:
        toolbarState = ToolBarState.Line;
        break;
      case CmpType.Arrow:
        toolbarState = ToolBarState.Arrow;
        break;
      default:
        toolbarState = ToolBarState.Rect;
    }
    setState(toolbarState);
  };

  // 点击画笔，设置绘制模式
  const handlePenClick = () => {
    setState(ToolBarState.Pen);
  };

  return (
    <div className={styles['element-panel']}>
      <div className={styles['panel-title']}>元素</div>
      <div className={classNames(styles['element-list'], styles[getColumnsClass()])}>
        {elements.map((element) => {
          let isSelected = false;
          switch (element.type) {
            case CmpType.Rect:
              isSelected = toolbarState === ToolBarState.Rect;
              break;
            case CmpType.Ellipse:
              isSelected = toolbarState === ToolBarState.Ellipse;
              break;
            case CmpType.Line:
              isSelected = toolbarState === ToolBarState.Line;
              break;
            case CmpType.Arrow:
              isSelected = toolbarState === ToolBarState.Arrow;
              break;
          }
          return (
            <div
              key={element.type}
              className={classNames(styles['element-item'], {
                [styles.selected]: isSelected,
              })}
              onClick={() => handleClick(element)}
              onDoubleClick={() => handleDoubleClick(element)}
              draggable
              onDragStart={(e) => handleDragStart(e, element)}>
              <div className={styles['element-icon']}>{element.icon}</div>
              <div className={styles['element-name']}>{element.name}</div>
            </div>
          );
        })}
      </div>
      <div className={styles['panel-title']} style={{ marginTop: 16 }}>
        其他
      </div>
      <div className={styles['element-list']}>
        <div
          className={classNames(styles['element-item'], {
            [styles.selected]: toolbarState === ToolBarState.Pen,
          })}
          onClick={handlePenClick}>
          <div className={styles['element-icon']}>✎</div>
          <div className={styles['element-name']}>画笔</div>
        </div>
      </div>
    </div>
  );
}
