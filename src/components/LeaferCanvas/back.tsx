import React, { useRef, useEffect } from 'react';
import { App, Platform, Rect, Text, Box, Group } from 'leafer-ui';
import styled from '@emotion/styled';
import '@leafer-in/editor'; // 导入图形编辑器插件
import '@leafer-in/viewport'; // 导入视口插件 (可选)
import '@leafer-in/text-editor'; // 导入文本编辑插件
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
  const totalNum = 1; // 100万个， 可设置个数
  const canvasRef = useRef<HTMLDivElement>(null);
  const leaferRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 创建 Leafer 应用
    const app = new App({
      view: canvasRef.current,
      editor: {}, // 会自动创建 editor实例、tree层、sky层
    });

    leaferRef.current = app.tree;

    // 创建网格和矩形
    createGridAndRectangles();

    return () => {
      app.destroy();
    };
  }, []);

  const createGridAndRectangles = () => {
    if (!leaferRef.current) return;

    const leafer = leaferRef.current;
    const rectGroups: Group[] = [];

    const space = 10 * 100 * 1.5;
    const column = totalNum > 25 ? 10 : 5;
    let group;
    for (var k = 0; k < totalNum; k++) {
      group = new Group();
      group.x = space * (k % column);
      group.y = space * Math.floor(k / column);
      leafer.add(group);
      rectGroups.push(group);
      let startX = 0;
      let startY = 0;
      let y, box;
      for (var i = 0; i < 100; i++) {
        if (i % 10 === 0) startX += 10;
        y = startY;
        for (var j = 0; j < 100; j++) {
          if (j % 10 === 0) y += 10;
          const index = k * 10000 + i * j;
          const width = 10;
          const height = 10;
          const textHeight = height / 5;
          const text = new Text({
            text: `正常${index}`,
            x: 0, // 相对于 Box 的位置
            y: height - textHeight,
            width: width,
            height: height / 5,
            resizeFontSize: true,
            fontSize: textHeight / 2,
            fill: '#333333',
            textAlign: 'center',
          });
          box = new Box(null);
          box.x = startX;
          box.y = y;
          box.height = height;
          box.width = width;
          box.draggable = true;
          box.fill = {
            type: 'image',
            url: normalSvgData,
            mode: 'stretch',
          };
          box.add(text);
          group.add(box);
          y += 12;
        }
        startX += 12;
      }
    }
  };

  return (
    <CanvasContainer>
      <CanvasWrapper ref={canvasRef} />
    </CanvasContainer>
  );
};

export default LeaferCanvas;
