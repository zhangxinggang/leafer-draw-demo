interface Point {
  x: number;
  y: number;
}

function generateArrowPath(start: Point, end: Point, arrowSize = 8) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return '';
  const unitX = dx / length;
  const unitY = dy / length;
  const arrowTipX = end.x - unitX * 2;
  const arrowTipY = end.y - unitY * 2;
  const perpX = -unitY;
  const perpY = unitX;
  const arrowLeft = {
    x: arrowTipX - unitX * arrowSize + perpX * arrowSize * 0.5,
    y: arrowTipY - unitY * arrowSize + perpY * arrowSize * 0.5,
  };
  const arrowRight = {
    x: arrowTipX - unitX * arrowSize - perpX * arrowSize * 0.5,
    y: arrowTipY - unitY * arrowSize - perpY * arrowSize * 0.5,
  };
  return `M ${start.x} ${start.y} L ${arrowTipX} ${arrowTipY} M ${arrowLeft.x} ${arrowLeft.y} L ${end.x} ${end.y} L ${arrowRight.x} ${arrowRight.y}`;
}

export { generateArrowPath };
