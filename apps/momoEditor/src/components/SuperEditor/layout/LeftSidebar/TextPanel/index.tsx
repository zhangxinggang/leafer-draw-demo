import { Icon } from '@iconify/react';
import { generateCmp } from '@momo/leafer-draw/generator';
import { CmpType, TextCmp } from '@momo/leafer-draw/types/cmp';
import classNames from 'classnames';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import useCanvasStore from '../../../store/canvas';
import useModelStore from '../../../store/model';
import useToolbarStore, { ToolBarState } from '../../../store/toolbar';
import styles from './index.module.less';

interface TextStyle {
  name: string;
  type: 'basic' | 'gradient' | 'stroke' | 'shadow' | 'glow';
  preview: string;
  config?: any;
}

const textStyles: TextStyle[] = [
  {
    name: '基本文本',
    type: 'basic',
    preview: '文本',
  },
  {
    name: '渐变文字',
    type: 'gradient',
    preview: '渐变',
    config: {
      fill: {
        type: 'linear',
        colors: ['#FF6B6B', '#4ECDC4'],
        angle: 0,
      },
    },
  },
  {
    name: '描边文字',
    type: 'stroke',
    preview: '描边',
    config: {
      stroke: '#000000',
      strokeWidth: 2,
    },
  },
  {
    name: '阴影文字',
    type: 'shadow',
    preview: '阴影',
    config: {
      shadow: {
        blur: 4,
        offsetX: 2,
        offsetY: 2,
        color: 'rgba(0, 0, 0, 0.3)',
      },
    },
  },
  {
    name: '发光文字',
    type: 'glow',
    preview: '发光',
    config: {
      shadow: {
        blur: 8,
        color: '#00FFFF',
      },
    },
  },
];

export default function TextPanel() {
  const { addCmps } = useModelStore(
    useShallow((state) => ({
      addCmps: state.addCmps,
    })),
  );
  const { app } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
    })),
  );
  const { zoomLayer } = useModelStore(
    useShallow((state) => ({
      zoomLayer: state.zoomLayer,
    })),
  );
  const { state: toolbarState, setState } = useToolbarStore();

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
  const handleDoubleClick = (style: TextStyle) => {
    const center = getCanvasCenter();
    const startX = center.x - 100;
    const startY = center.y - 25;
    const endX = center.x + 100;
    const endY = center.y + 25;

    const cmp = generateCmp(CmpType.Text, {
      startX,
      startY,
      endX,
      endY,
      leaferAttr: {
        text: 'Text',
        fontSize: 16,
        fontFamily: 'Arial',
        ...style.config,
      },
    }) as TextCmp;

    if (cmp) {
      addCmps([cmp]);
    }
  };

  // 拖拽添加
  const handleDragStart = (e: React.DragEvent, style: TextStyle) => {
    e.dataTransfer.setData('textStyle', JSON.stringify(style));
  };

  // 点击文本样式，设置文本绘制模式
  const handleClick = () => {
    setState(ToolBarState.Text);
  };

  return (
    <div className={styles['text-panel']}>
      <div className={styles['panel-title']}>文本</div>
      <div className={styles['text-list']}>
        {textStyles.map((style, index) => (
          <div
            key={index}
            className={classNames(styles['text-item'], {
              [styles.selected]: toolbarState === ToolBarState.Text,
            })}
            onClick={handleClick}
            onDoubleClick={() => handleDoubleClick(style)}
            draggable
            onDragStart={(e) => handleDragStart(e, style)}>
            <div className={styles['text-icon']}>
              <Icon icon='mdi:format-size' />
            </div>
            <div className={styles['text-info']}>
              <div className={styles['text-name']}>{style.name}</div>
              <div className={styles['text-preview']}>{style.preview}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
