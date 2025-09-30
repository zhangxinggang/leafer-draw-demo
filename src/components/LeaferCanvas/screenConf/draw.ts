import { Rect, Text, Line, Box, Path, Ellipse, Polygon, Group } from 'leafer-ui';

const createSdContent = ({ key, fill, value }: any) => {
  const box = new Box({
    id: key,
    x: value.x,
    y: value.y,
    width: value.w,
    height: value.h,
    fill: fill,
    stroke: '#ccc',
    strokeWidth: 1,
    editable: false,
    children: createRcContent({
      sdName: value.name,
      datas: [...value.portMap].map((item) => item[1].receiveInfoMap),
    }),
  });
  return box;
};

const createRcContent = ({ sdName, datas }: any) => {
  const allData: any = [];
  datas.forEach((one) => {
    one.forEach((item: any) => {
      const {
        y,
        x,
        w: width,
        h: height,
        stroke = '#abc',
        strokeWidth = 2,
        labelFont = '12px',
        labelFill = '#000',
      } = item;
      console.log(item, 'asldjfalks');
      const labels = [sdName, `宽：${width}`, `高：${height}`];
      const box = new Box({
        x: x,
        y: y,
        width,
        height,
        stroke,
        strokeWidth,
        editable: false,
      });
      const oneTextHeight = height / labels.length;
      labels.forEach((item1: any, index: number) => {
        const text = new Text({
          text: item1,
          x: 0,
          y: height - (labels.length - index) * oneTextHeight,
          width: width,
          height: oneTextHeight,
          resizeFontSize: true,
          fontSize: parseInt(labelFont),
          fill: labelFill,
          padding: [0, 10],
          textWrap: 'none',
          textOverflow: '...',
          verticalAlign: 'middle',
          textAlign: 'left',
        });
        box.add(text);
      });
      allData.push(box);
    });
  });

  return allData;
};

const createNetConnArrow = ({ datas }: any) => {
  const allData: any = [];
  datas.forEach((item: any) => {
    const { options, value } = item;
    const { top, left, fill, stroke, strokeWidth } = options;
    const path: any = new Path({
      path: value,
      x: left,
      y: top,
      fill,
      stroke,
      strokeWidth,
      editable: false,
    });
    path.y = path.y + path.height / 2;
    allData.push(path);
  });
  return allData;
};

const createNetConnTriangle = ({ datas }: any) => {
  const allData: any = [];
  datas.forEach((item: any) => {
    const { options } = item;
    const { top, left, fill, width, height, angle } = options;
    const triangle = new Polygon({
      x: left,
      y: top,
      fill,
      width,
      height,
      rotation: angle,
      editable: false,
    });
    allData.push(triangle);
  });
  return allData;
};

const createNetConnLine = ({ datas }: any) => {
  const allData: any = [];
  datas.forEach((item: any) => {
    const { options, value } = item;
    const { stroke, strokeWidth } = options;
    const resetPoints = () => {
      const newData = [...value];
      const sameX = value[0] === value[2];
      const sameY = value[1] === value[3];
      const extraWidth = strokeWidth / 2;
      if (sameX) {
        newData[1] -= extraWidth;
        newData[3] -= extraWidth;
      }
      if (sameY) {
        newData[0] -= extraWidth;
        newData[2] -= extraWidth;
      }
      return newData.map((item1: number) => item1 + extraWidth);
    };
    const line = new Line({
      points: resetPoints(),
      stroke,
      strokeWidth,
      editable: false,
    });
    allData.push(line);
  });
  return allData;
};

const createStartAndEnd = ({ datas }: any) => {
  const allData: any = [];
  datas.forEach((item: any) => {
    const { options } = item;
    const { top, left, radius, fill, label, labelFont, labelFill } = options;
    const width = radius * 2;
    const box = new Box({
      x: left,
      y: top,
      width: width,
      height: width,
      editable: false,
    });
    const ellipse = new Ellipse({
      x: 0,
      y: 0,
      width: width,
      height: width,
      fill,
      zIndex: 1,
    });
    box.add(ellipse);
    const text = new Text({
      text: label.text,
      x: 0,
      y: 0,
      width: width,
      height: width,
      resizeFontSize: true,
      font: labelFont,
      fill: labelFill,
      verticalAlign: 'middle',
      textAlign: 'center',
      zIndex: 2,
    });
    box.add(text);
    allData.push(box);
  });
  return allData;
};

const schemeDraw = ({ data, leaferInstance }: any) => {
  data.forEach((item) => {
    const sdData = createSdContent(item);
    const group = new Group({
      draggable: true,
      children: [sdData],
    });
    leaferInstance.add(group);
  });
};

export {
  createSdContent,
  createRcContent,
  createNetConnArrow,
  createNetConnLine,
  createStartAndEnd,
  createNetConnTriangle,
  schemeDraw,
};
