/**
 * 根据起点（圆心）和终点，计算圆边缘上的新起点
 * @param startPoint 起点（圆心位置）
 * @param endPoint 终点
 * @param circleSize 圆的直径大小
 * @returns 圆边缘上的新起点
 */
const getStartPointFromPointsSubCircle = ({ startPoint, endPoint, circleSize }) => {
  // 计算从圆心到终点的向量
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  // 计算距离
  const distance = Math.sqrt(dx * dx + dy * dy);
  // 如果距离为0，说明起点和终点重合，返回起点
  if (distance === 0) {
    return { ...startPoint };
  }
  // 计算单位向量（归一化）
  const unitX = dx / distance;
  const unitY = dy / distance;
  // 圆的半径
  const radius = circleSize / 2;
  // 计算圆边缘上的点：圆心 + 单位向量 * 半径
  const newStartPoint = {
    x: startPoint.x + unitX * radius,
    y: startPoint.y + unitY * radius,
  };
  return newStartPoint;
};

export { getStartPointFromPointsSubCircle };
