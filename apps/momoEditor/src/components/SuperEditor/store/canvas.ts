import { Cmp } from '@momo/leafer-draw';
import { App, IEditorConfig } from 'leafer-ui';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CANVASSTOREKEY } from '../utils/storage';

export interface CanvasStore {
  app: App | null;
  genCmp: Cmp | null;
  tempReminderCmps: Cmp[];
  showSetting?: boolean;
  // 画布属性
  canvasName: string;
  canvasBackgroundColor: string;
  // 标尺设置
  rulerVisible: boolean;
  // 菜单宽度
  leftMenuWidth: number; // 左侧一级菜单宽度，默认60px
  secondaryMenuWidth: number; // 二级菜单宽度，默认310px
  // 暗色主题
  darkMode: boolean;
  editorConfig?: IEditorConfig;
  setGenCmp: (cmp: Cmp | null) => void;
  addTempReminderCmps: (cmps: Cmp[]) => void;
  removeTempReminderCmps: () => void;
  setApp: (leaferApp: App) => void;
  setShowSetting: (showSetting: boolean) => void;
  setCanvasName: (name: string) => void;
  setCanvasBackgroundColor: (color: string) => void;
  setRulerVisible: (visible: boolean) => void;
  setLeftMenuWidth: (width: number) => void;
  setSecondaryMenuWidth: (width: number) => void;
  setDarkMode: (darkMode: boolean) => void;
}

const useCanvasStore = create<CanvasStore>()(
  persist(
    (set) => ({
      app: null,
      genCmp: null,
      tempReminderCmps: [],
      showSetting: false,
      canvasName: '未命名画布',
      canvasBackgroundColor: '#ffffff',
      rulerVisible: true,
      leftMenuWidth: 60,
      secondaryMenuWidth: 360,
      darkMode: false,
      editorConfig: {
        rect: {
          fill: 'rgba(0, 120, 255, 0.1)', // 背景色
          stroke: '#0078FF', // 边框色
          strokeWidth: 1, // 边框宽度
        },
      },
      setApp: (app: App) => set({ app }),
      setShowSetting: (showSetting: boolean) => set((state) => ({ ...state, showSetting })),
      setGenCmp: (cmp: Cmp | null) => set((state) => ({ ...state, genCmp: cmp })),
      addTempReminderCmps: (cmps: Cmp[]) =>
        set((state) => ({ ...state, tempReminderCmps: [...state.tempReminderCmps, ...cmps] })),
      removeTempReminderCmps: () => set((state) => ({ ...state, tempReminderCmps: [] })),
      setCanvasName: (name: string) => set({ canvasName: name }),
      setCanvasBackgroundColor: (color: string) => set({ canvasBackgroundColor: color }),
      setRulerVisible: (visible: boolean) => set({ rulerVisible: visible }),
      setLeftMenuWidth: (width: number) =>
        set({ leftMenuWidth: Math.max(60, Math.min(500, width)) }),
      setSecondaryMenuWidth: (width: number) => {
        // 最小105px，最大360px
        set({ secondaryMenuWidth: Math.max(105, Math.min(360, width)) });
      },
      setDarkMode: (darkMode: boolean) => set({ darkMode }),
    }),
    {
      name: CANVASSTOREKEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        canvasName: state.canvasName,
        canvasBackgroundColor: state.canvasBackgroundColor,
        darkMode: state.darkMode,
      }),
    },
  ),
);

export default useCanvasStore;
