import {
  Rect,
  Text,
  Line,
  Box,
  Path,
  Ellipse,
  Polygon,
  Group,
} from 'leafer-ui';

const createSdContent = ({ datas }: any) => {
  const allData: any = [];
  datas.forEach((item: any) => {
    const { options } = item;
    const { top, left, width, height, fill, stroke, strokeWidth } = options;
    const rect = new Rect({
      x: left,
      y: top,
      width,
      height,
      fill,
      stroke,
      strokeWidth,
      editable: false,
    });
    allData.push(rect);
  });
  return allData;
};

const createRcContent = ({ datas }: any) => {
  const allData: any = [];
  datas.forEach((item: any) => {
    const { options } = item;
    const {
      top,
      left,
      width,
      height,
      fill,
      stroke,
      strokeWidth,
      labels,
      labelFont,
      labelFill,
    } = options;
    const box = new Box({
      x: left,
      y: top,
      width,
      height,
      fill,
      stroke,
      strokeWidth,
      editable: false,
    });
    if (!labels) {
      console.log(item, 'lajksfdla');
      const rect = new Rect({
        x: left,
        y: top,
        width,
        height,
        fill,
        stroke,
        strokeWidth,
        editable: false,
      });
      box.add(rect);
    } else {
      const oneTextHeight = height / labels.length;
      labels.forEach((item1: any, index: number) => {
        const text = new Text({
          text: item1.text,
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
    }
    allData.push(box);
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
  const funcExec: any = {
    Rect: createSdContent,
    LabeledRect: createRcContent,
    Path: createNetConnArrow,
    Triangle: createNetConnTriangle,
    Line: createNetConnLine,
    LabeledCircle: createStartAndEnd,
  };
  const drawData: any = [];
  data.eleSort.forEach((one: any) => {
    Object.keys(one).forEach((key) => {
      if (funcExec[key]) {
        const eleData = funcExec[key]({
          datas: one[key],
          leaferInstance,
        });
        drawData.push(eleData);
      }
    });
  });
  const group = new Group({
    draggable: true,
    children: [...drawData],
  });
  leaferInstance.add(group);
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
