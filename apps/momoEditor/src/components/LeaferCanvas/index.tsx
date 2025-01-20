import styled from '@emotion/styled';
import '@leafer-in/editor'; // 导入图形编辑器插件
import '@leafer-in/resize';
import '@leafer-in/text-editor'; // 导入文本编辑插件
import '@leafer-in/view';
import '@leafer-in/viewport'; // 导入视口插件 (可选)
import { App, Platform, Rect, ResizeEvent } from 'leafer-ui';
import React, { useEffect, useRef } from 'react';
import { schemeDraw } from './schemeConfTool/draw';
import schemeMockData from './schemeConfTool/mockData';
import normalSvg from './svg/normal';

const CanvasContainer = styled.div`
  width: 100vw;
  height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
`;

const CanvasWrapper = styled.div`
  flex: 1;
  width: 100%;
  height: 100%;
`;

interface LeaferCanvasProps {
  gridVisible?: boolean;
}

const normalSvgData = Platform.toURL(normalSvg, 'svg');
Rect.changeAttr('editable', true);
const LeaferCanvas: React.FC<LeaferCanvasProps> = ({ gridVisible = true }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const leaferRef = useRef<any>(null);
  const fitView = () => {
    leaferRef.current.zoom('fit');
  };
  const allEvents = () => {
    leaferRef.current.on(ResizeEvent.RESIZE, function (e: ResizeEvent) {
      fitView();
    });
  };
  useEffect(() => {
    if (!canvasRef.current) return;
    // 创建 Leafer 应用
    const app = new App({
      view: canvasRef.current,
      wheel: {
        zoomMode: true, // 启用缩放模式
      },
      editor: {}, // 会自动创建 editor实例、tree层、sky层
    });
    app.editor.config.boxSelect = false; // 移动时禁止框选
    leaferRef.current = app.tree;
    schemeDraw({ data: schemeMockData, leaferInstance: leaferRef.current });
    allEvents();
    fitView();
    return () => {
      app.destroy();
    };
  }, []);

  return (
    <CanvasContainer>
      <CanvasWrapper ref={canvasRef} />
    </CanvasContainer>
  );
};

export default LeaferCanvas;
