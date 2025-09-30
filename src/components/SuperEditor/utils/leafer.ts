export const elementChange = (e: any) => {
  const attrName = e?.attrName;
  if (['x', 'y', 'width', 'height', 'rotation'].includes(attrName)) {
    return true;
  }
  return false;
};
