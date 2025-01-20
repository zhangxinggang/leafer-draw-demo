import { generateCmp } from '@momo/leafer-draw/generator';
import { CmpType, ImageCmp, TextCmp } from '@momo/leafer-draw/types/cmp';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Canvas from '../../editor/canvas';
import useCanvasStore from '../../store/canvas';
import useModelStore from '../../store/model';
import styles from './index.module.less';

export default function CanvasArea() {
  const [isInit, setIsInit] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { app } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
    })),
  );
  const { addCmps, zoomLayer } = useModelStore(
    useShallow((state) => ({
      addCmps: state.addCmps,
      zoomLayer: state.zoomLayer,
    })),
  );

  // 处理拖拽添加元素
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !app) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!app) return;

      const elementType = e.dataTransfer?.getData('elementType');
      const defaultWidth = e.dataTransfer?.getData('defaultWidth');
      const defaultHeight = e.dataTransfer?.getData('defaultHeight');
      const textStyle = e.dataTransfer?.getData('textStyle');
      const imageSrc = e.dataTransfer?.getData('imageSrc');

      // 计算画布坐标
      const rect = container.getBoundingClientRect();
      const { x: viewX = 0, y: viewY = 0, scale = 1 } = zoomLayer || {};
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      // 转换为画布坐标
      const canvasX = (clientX - viewX) / scale;
      const canvasY = (clientY - viewY) / scale;

      if (elementType) {
        // 添加元素
        const type = parseInt(elementType) as CmpType;
        const width = parseInt(defaultWidth || '100');
        const height = parseInt(defaultHeight || '100');

        const cmp = generateCmp(type, {
          startX: canvasX - width / 2,
          startY: canvasY - height / 2,
          endX: canvasX + width / 2,
          endY: canvasY + height / 2,
        });

        if (cmp) {
          addCmps([cmp]);
        }
      } else if (textStyle) {
        // 添加文本
        const style = JSON.parse(textStyle);

        const cmp = generateCmp(CmpType.Text, {
          startX: canvasX - 100,
          startY: canvasY - 25,
          endX: canvasX + 100,
          endY: canvasY + 25,
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
      } else if (imageSrc) {
        // 添加图片
        const cmp = generateCmp(CmpType.Image, {
          startX: canvasX - 100,
          startY: canvasY - 100,
          endX: canvasX + 100,
          endY: canvasY + 100,
        }) as ImageCmp;
        if (cmp) {
          cmp.url = imageSrc;
        }

        if (cmp) {
          addCmps([cmp]);
        }
      }
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, [app, addCmps, zoomLayer]);

  useEffect(() => {
    setIsInit(true);
  }, []);

  const renderId = 'super-editor-canvas-area';
  return (
    <div ref={containerRef} id={renderId} className={styles['canvas-area']}>
      {isInit && <Canvas renderId={renderId} />}
    </div>
  );
}
