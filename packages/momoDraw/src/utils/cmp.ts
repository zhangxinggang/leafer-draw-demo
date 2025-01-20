import { AnyObj } from '../types';
import { Cmp, CmpNeedId, UndoRedoState } from '../types/cmp';
import { onBusDeleteCmp } from './business';

const zIndexObj = {
  max: 0,
  min: 0,
};

const pureObj = (obj: AnyObj) => {
  const newObj = { ...obj };
  for (let key in newObj) {
    if (typeof newObj[key] === 'undefined' || newObj[key] === null) {
      delete newObj[key];
    }
  }
  return newObj;
};

const initCmpRenderMap = () => {
  if (!window.spuEditorCmpRenderMap) {
    window.spuEditorCmpRenderMap = new Map();
  }
};

const getCmpMaps = () => {
  return window.spuEditorCmpRenderMap;
};

const getCmps = () => {
  return Array.from(window.spuEditorCmpRenderMap.values());
};

const setZindexObj = (zIndex: number = 0) => {
  zIndexObj.max = Math.max(zIndexObj.max, zIndex);
  zIndexObj.min = Math.min(zIndexObj.min, zIndex);
};

const getZindexObj = () => {
  return zIndexObj;
};

const setMaps = (cmps: Cmp[]) => {
  initCmpRenderMap();
  cmps.forEach((cmp) => {
    window.spuEditorCmpRenderMap.set(cmp.id, cmp);
    setZindexObj(cmp.zIndex);
  });
};

const getCmpByIds = (ids: string[]) => {
  return ids.map((id) => window.spuEditorCmpRenderMap.get(id));
};

const updateMaps = (cmps: CmpNeedId[]) => {
  initCmpRenderMap();
  cmps.forEach((cmp) => {
    const oldCmp = window.spuEditorCmpRenderMap.get(cmp.id) || ({} as Cmp);
    const oldBackendData = oldCmp.backendData || {};
    const newBackendData = cmp.backendData || {};
    const newOptions = pureObj({ ...oldCmp, ...cmp });
    window.spuEditorCmpRenderMap.set(cmp.id, {
      ...newOptions,
      backendData: pureObj({ ...oldBackendData, ...newBackendData }),
    } as Cmp);
    setZindexObj(cmp.zIndex);
  });
};

const deleteMapsByIds = (ids: string[]) => {
  if (!window.spuEditorCmpRenderMap) return;
  ids.forEach((id) => {
    const deleteCmp = window.spuEditorCmpRenderMap.get(id);
    onBusDeleteCmp(deleteCmp);
    window.spuEditorCmpRenderMap.delete(id);
  });
};

const getUndoRedoState = ({
  pastStates,
  futureStates,
  cmps,
  isUndo = false,
}: {
  pastStates: UndoRedoState[];
  futureStates: UndoRedoState[];
  cmps?: Cmp[];
  isUndo?: boolean;
}) => {
  let allNewCmps = cmps;
  if (!allNewCmps) {
    allNewCmps = getCmps();
  }
  let newPastStates = pastStates;
  let newFutureStates = futureStates;
  if (isUndo) {
    const lastOperation = pastStates[pastStates.length - 1];
    newPastStates = pastStates.slice(0, -1);
    newFutureStates = [...futureStates, lastOperation];
  } else {
    const lastOperation = futureStates[futureStates.length - 1];
    newFutureStates = futureStates.slice(0, -1);
    newPastStates = [...pastStates, lastOperation];
  }
  return {
    cmps: allNewCmps,
    pastStates: newPastStates,
    futureStates: newFutureStates,
  };
};

export {
  deleteMapsByIds,
  getCmpByIds,
  getCmpMaps,
  getCmps,
  getUndoRedoState,
  getZindexObj,
  setMaps,
  updateMaps,
};
