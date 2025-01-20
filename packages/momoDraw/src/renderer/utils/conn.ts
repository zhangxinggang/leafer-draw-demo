import { getCmpByIds } from '../../utils/cmp';

const connCircleSize = 20;

const getConnStartCircleId = (id: string) => {
  return `${id}_startCircle`;
};

const checkIsStartConn = (id: string) => {
  const storeCmp = getCmpByIds([id])[0];
  const { backendData = {} } = storeCmp;
  const { sourceConnId, targetConnId } = backendData;
  const isStartCircle = !sourceConnId && targetConnId;
  return isStartCircle;
};

const getConnStartCircleSIds = (ids: string[]) => {
  const storeCmps = getCmpByIds(ids);
  let startCircleIds = [];
  storeCmps.forEach((cmp) => {
    const { backendData = {} } = cmp;
    const { sourceConnId, targetConnId } = backendData;
    const isStartCircle = !sourceConnId && targetConnId;
    if (isStartCircle) {
      startCircleIds.push(cmp.id);
    }
  });
  return startCircleIds;
};

export { checkIsStartConn, connCircleSize, getConnStartCircleId, getConnStartCircleSIds };
