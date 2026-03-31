import { AlignType, AnyObj } from '@momo/leafer-draw';
import { IZoomLayer } from '@momo/leafer-draw/renderer/app';
import { Cmp, CmpNeedId, RenderType, UndoRedoState } from '@momo/leafer-draw/types/cmp';
import { getExtraRemoveIds } from '@momo/leafer-draw/utils/business';
import {
  getCmpByIds,
  getCmpMaps,
  getCmps,
  getUndoRedoState,
  setMaps,
} from '@momo/leafer-draw/utils/cmp';
import { alignElements, uuid } from '@momo/leafer-draw/utils/utils';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { renderView } from '../editor/canvas/draw';
import { MODELSTOREKEY } from '../utils/storage';
import useBusinessStore from './business';
import { getStorage } from './engine';

type SetModelStateData = {
  [key in keyof Partial<ModelStore>]: Partial<ModelStore>[key];
};

export interface ModelStore {
  initialized: boolean;
  cmps: Cmp[];
  selectCmpIds: string[];
  zoomLayer: IZoomLayer;
  // 撤销/重做相关
  pastStates: UndoRedoState[];
  futureStates: UndoRedoState[];
  setModelState: (data: SetModelStateData) => void;
  addCmps: (cmps: Cmp[], noRender?: boolean) => void;
  copyCmpByIds: (ids: string[]) => void;
  updateCmps: (cmp: CmpNeedId[]) => void;
  addAndUpdateCmps: (params: {
    addCmps: Cmp[];
    addNoRender?: boolean;
    updateCmps: CmpNeedId[];
    updateNoRender?: boolean;
  }) => void;
  removeCmpByIds: (ids: string[]) => void;
  updateSelectCmpIds: (ids: string[]) => void;
  updateZoomLayer: (zoomLayer: IZoomLayer) => void;
  // 对齐方法（支持撤销/重做）
  alignCmps: (ids: string[], alignType: AlignType) => void;
  // 撤销/重做方法
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY_LENGTH = 50;
let isUndoRedoInProgress = false;

/**
 * 记录操作到历史记录并返回更新后的状态
 * @param state 当前状态
 * @param operation 要记录的操作
 * @param stateUpdates 其他需要更新的状态字段
 * @returns 更新后的状态
 */
function recordOperationToHistory(
  state: ModelStore,
  operation: UndoRedoState,
): Partial<ModelStore> {
  const newPastStates = [...state.pastStates, operation];
  // 限制历史记录最大长度
  if (newPastStates.length > MAX_HISTORY_LENGTH) {
    newPastStates.shift();
  }
  return {
    ...state,
    pastStates: newPastStates,
    futureStates: [], // 执行新操作时清空重做栈
  };
}

const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      initialized: false,
      cmps: [],
      selectCmpIds: [],
      zoomLayer: {},
      pastStates: [],
      futureStates: [],
      setModelState: (data: SetModelStateData) => {
        return set((state) => {
          return { ...state, ...(data as Partial<ModelStore>) };
        });
      },
      addCmps: (cmps: Cmp[], noRender: boolean) => {
        return set((state) => {
          const renderType = RenderType.ADD;
          const newCmps = [...state.cmps, ...cmps];
          if (!noRender) {
            renderView({ cmps, type: renderType });
          }
          // 记录 ADD 操作
          if (!isUndoRedoInProgress) {
            return {
              ...recordOperationToHistory(
                { ...state, cmps: newCmps },
                {
                  type: renderType,
                  addCmps: cmps,
                },
              ),
            };
          }
          return { ...state, cmps: newCmps };
        });
      },
      updateCmps: (upcmps: CmpNeedId[]) => {
        const renderType = RenderType.UPDATE;
        const cmpMaps = getCmpMaps();
        return set((state) => {
          let isUpdate = false;
          const oldCmps: Cmp[] = [];
          // 保存更新前的数据
          const newCmps: Cmp[] = upcmps.map((cmp) => {
            const oldCmp = cmpMaps.get(cmp.id);
            const isCmpUpdate = Object.keys(cmp).some(
              (key) => oldCmp[key] !== (cmp as AnyObj)[key],
            );
            if (isCmpUpdate) {
              isUpdate = isCmpUpdate;
            }
            oldCmps.push({ ...oldCmp });
            return { ...oldCmp, ...cmp };
          });
          if (!isUpdate) return state;
          renderView({ cmps: upcmps, type: renderType });
          const allNewCmps = getCmps();
          // 记录 UPDATE 操作（保存更新前和更新后的数据）
          if (!isUndoRedoInProgress) {
            return {
              ...recordOperationToHistory(
                { ...state, cmps: allNewCmps },
                {
                  type: renderType,
                  updateOldCmps: oldCmps,
                  updateNewCmps: newCmps,
                },
              ),
            };
          }
          return { ...state, cmps: allNewCmps };
        });
      },
      addAndUpdateCmps: ({ addCmps, updateCmps, addNoRender, updateNoRender }) => {
        return set((state) => {
          const cmpMaps = getCmpMaps();
          const oldCmps: Cmp[] = [];
          let currentCmps = state.cmps;
          if (!addCmps.length && !updateCmps.length) {
            return state;
          }
          if (addCmps.length) {
            currentCmps = [...currentCmps, ...addCmps];
            !addNoRender && renderView({ cmps: addCmps, type: RenderType.ADD });
          }
          if (updateCmps.length) {
            updateCmps.forEach((cmp) => {
              const existingCmp = cmpMaps.get(cmp.id);
              oldCmps.push(existingCmp as Cmp);
            });
            !updateNoRender && renderView({ cmps: updateCmps, type: RenderType.UPDATE });
          }
          const allNewCmps = getCmps();
          // 如果同时有新增和更新，合并为一个混合操作记录
          if (!isUndoRedoInProgress) {
            return {
              ...state,
              ...recordOperationToHistory(
                { ...state, cmps: allNewCmps },
                {
                  type: RenderType.MIXED, // 混合操作
                  addCmps: addCmps,
                  updateOldCmps: oldCmps,
                  updateNewCmps: updateCmps,
                },
              ),
            } as ModelStore;
          }

          return { ...state, cmps: allNewCmps };
        });
      },
      removeCmpByIds: (ids: string[]) =>
        set((state) => {
          const renderType = RenderType.DELETE;
          const cmpMaps = getCmpMaps();
          const deleteIds = getExtraRemoveIds(ids);
          // 在删除前保存被删除元素的完整数据
          const deletedCmps = deleteIds.map((id) => cmpMaps.get(id));
          renderView({ cmps: deletedCmps, type: renderType });
          const allNewCmps = getCmps();
          // 记录 DELETE 操作
          if (!isUndoRedoInProgress && deleteIds.length > 0) {
            return {
              ...recordOperationToHistory(
                { ...state, selectCmpIds: [], cmps: allNewCmps },
                {
                  type: renderType,
                  deleteCmps: deletedCmps,
                },
              ),
            };
          }
          return { ...state, selectCmpIds: [], cmps: allNewCmps };
        }),
      copyCmpByIds: (ids: string[]) => {
        return set((state) => {
          const renderType = RenderType.ADD;
          const cmpMaps = getCmpMaps();
          const copyCmps: Cmp[] = [];
          const copyOriginCmps = ids.map((id) => cmpMaps.get(id));
          copyOriginCmps.forEach((cmp) => {
            if (cmp) {
              const copiedCmp = {
                ...cmp,
                id: uuid(),
                x: (cmp.x || 0) + 20,
                y: (cmp.y || 0) + 20,
              };
              copyCmps.push({ ...copiedCmp });
            }
          });
          renderView({ cmps: copyCmps, type: renderType });
          const newCmps = [...state.cmps, ...copyCmps];
          if (!isUndoRedoInProgress) {
            return {
              ...recordOperationToHistory(
                { ...state, cmps: newCmps },
                {
                  type: renderType,
                  addCmps: copyCmps,
                },
              ),
            };
          }
          return { ...state, cmps: newCmps };
        });
      },
      updateZoomLayer(zoomLayer: IZoomLayer) {
        return set((state) => {
          return {
            ...state,
            zoomLayer: { ...state.zoomLayer, ...zoomLayer },
          };
        });
      },
      // 撤销操作
      undo: () => {
        const state = get();
        if (state.pastStates.length === 0) return;
        isUndoRedoInProgress = true;
        const lastOperation = state.pastStates[state.pastStates.length - 1];
        set((currentState) => {
          const { addCmps, updateOldCmps, deleteCmps } = lastOperation;
          // 恢复更新的元素到更新前的状态
          if (updateOldCmps?.length) {
            renderView({
              cmps: updateOldCmps,
              type: RenderType.UPDATE,
              updateEditBox: Boolean(state.selectCmpIds.length),
            });
          }
          // 删除新增的元素
          if (addCmps?.length) {
            renderView({ cmps: addCmps, type: RenderType.DELETE });
          }
          // 删除删除的元素
          if (deleteCmps?.length) {
            renderView({ cmps: deleteCmps, type: RenderType.ADD });
          }
          const undoRedoState = getUndoRedoState({
            pastStates: state.pastStates,
            futureStates: state.futureStates,
            isUndo: true,
          });
          return { ...currentState, ...undoRedoState };
        });
        isUndoRedoInProgress = false;
      },
      // 重做操作
      redo: () => {
        const state = get();
        if (state.futureStates.length === 0) return;
        isUndoRedoInProgress = true;
        const lastOperation = state.futureStates[state.futureStates.length - 1];
        const busData = useBusinessStore.getState();
        set((currentState) => {
          const { addCmps, updateNewCmps, deleteCmps } = lastOperation;
          if (addCmps?.length) {
            renderView({ cmps: addCmps, type: RenderType.ADD });
          }
          if (updateNewCmps?.length) {
            renderView({
              cmps: updateNewCmps,
              type: RenderType.UPDATE,
              updateEditBox: Boolean(state.selectCmpIds.length),
            });
          }
          if (deleteCmps?.length) {
            renderView({ cmps: deleteCmps, type: RenderType.DELETE });
          }
          const undoRedoState = getUndoRedoState({
            pastStates: state.pastStates,
            futureStates: state.futureStates,
          });
          return { ...currentState, ...undoRedoState };
        });
        isUndoRedoInProgress = false;
      },
      updateSelectCmpIds: (ids: string[]) =>
        set((state) => {
          if (state.selectCmpIds.length === ids.length) {
            if (state.selectCmpIds.every((id) => ids.includes(id))) return state;
          }
          return { ...state, selectCmpIds: ids };
        }),
      // 对齐方法（支持撤销/重做）
      alignCmps: (ids: string[], alignType: AlignType) => {
        return set((state) => {
          if (ids.length < 2) return state;
          const selectedCmps = getCmpByIds(ids);
          const defaultPosition = { x: undefined, y: undefined }; // 撤回更新。每个值必须更新上
          // 保存更新前的数据
          const oldCmps = selectedCmps.map((cmp) => ({ ...defaultPosition, ...cmp }));
          const newCmps = alignElements(selectedCmps, alignType);
          renderView({ cmps: newCmps, type: RenderType.UPDATE, updateEditBox: true });
          // 记录 UPDATE 操作（保存更新前和更新后的数据）
          if (!isUndoRedoInProgress && oldCmps.length > 0) {
            return {
              ...recordOperationToHistory(
                { ...state, cmps: newCmps },
                {
                  type: RenderType.UPDATE,
                  updateOldCmps: oldCmps,
                  updateNewCmps: newCmps,
                },
              ),
            };
          }
          return { ...state, cmps: newCmps };
        });
      },
    }),
    {
      storage: createJSONStorage(() => {
        return {
          getItem: (key: string) => {
            return getStorage(MODELSTOREKEY)?.getItem(key);
          },
          setItem: (key: string, value: any) => {
            return getStorage(MODELSTOREKEY)?.setItem(key, value);
          },
          removeItem: (key: string) => {
            return getStorage(MODELSTOREKEY)?.removeItem(key);
          },
        };
      }),
      name: MODELSTOREKEY,
      onRehydrateStorage: () => {
        return (state, error) => {
          if (!error && state) {
            // 从本地store获取数据成功后，设置initialized为true
            state.setModelState({ initialized: true, pastStates: [], futureStates: [] });
            setMaps(state.cmps);
          }
        };
      },
    },
  ),
);

export default useModelStore;
