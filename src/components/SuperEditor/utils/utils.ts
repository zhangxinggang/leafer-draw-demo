let beginIndex = 0;
export function swap<T>(array: T[], index: number, swapIdx: number) {
  const temp = array[index];
  array[index] = array[swapIdx];
  array[swapIdx] = temp;
}
export function uuid(flag = 'id') {
  beginIndex++;
  return `${flag}-${new Date().getTime()}-${beginIndex}`;
}
