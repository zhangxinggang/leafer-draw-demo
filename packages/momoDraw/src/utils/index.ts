const isNotUndefined = (vr: any) => {
  return typeof vr !== 'undefined';
};

const getRandomColor = ({ colors, index }: { colors: string[]; index: number }) => {
  index = index || 0;
  index = index % colors.length;
  let color = colors[index];
  return color;
};

export { getRandomColor, isNotUndefined };
