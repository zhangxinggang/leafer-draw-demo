import { CmpLeaferAttr } from '@momo/leafer-draw/types/cmp';

function fromPointGetWidthAndHeight(point: CmpLeaferAttr) {
  const width = point.endX - point.startX;
  const height = point.endY - point.startY;
  return { width, height };
}

function getPointDirection(rect: any, point: { x: number; y: number }): any {
  const { startX, startY } = rect;
  const { width, height } = fromPointGetWidthAndHeight(rect);
  const centerX = startX + width / 2;
  const centerY = startY + height / 2;

  const dx = point.x - centerX;
  const dy = point.y - centerY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'bottom' : 'top';
  }
}

function fromDirectionGetRect(rect: any, direction: string): any {
  const { startX, startY, endX, endY, width, height } = rect;

  switch (direction) {
    case 'top':
      return {
        startX: startX,
        endX: endX,
        startY: startY - height,
        endY: startY,
      };
    case 'bottom':
      return {
        startX: startX,
        endX: endX,
        startY: endY,
        endY: endY + height,
      };
    case 'left':
      return {
        startX: startX - width,
        endX: startX,
        startY: startY,
        endY: endY,
      };
    case 'right':
      return {
        startX: endX,
        endX: endX + width,
        startY: startY,
        endY: endY,
      };
  }
}

export { fromDirectionGetRect, fromPointGetWidthAndHeight, getPointDirection };
