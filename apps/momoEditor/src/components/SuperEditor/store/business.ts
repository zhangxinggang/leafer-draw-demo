import { RenderType } from '@momo/leafer-draw';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { BUSINESSSTOREKEY } from '../utils/storage';

export enum BusinessColorKey {
  RectGroup = 'rectGroupColors',
  ConnGroup = 'connGroupColors',
}

export interface BusinessStore {
  businessConf: {
    unitWidth: number;
    unitHeight: number;
    rectWidth: number;
    rectHeight: number;
    rectGroupName: string;
    rectGroupLimitArea: number;
    rectGroupLimitWidth: number;
    rectGroupLimitHeight: number;
    connGroupLimit: number;
    connGroupLimitNum: number;
  };
  businessStyle: {
    tempReminderColor: string;
    rectGroupOption: {
      overloadColor: string;
      fill: string;
    };
    connGroupColors: string[];
    rectGroupColors: string[];
    rectBorderColor: string;
  };
  freeRouting: boolean;
  rectGroupIds: string[];
  updateRectGroupIds: (params: string[], type: RenderType) => void;
  updateBusinessConf: (conf: Partial<BusinessStore['businessConf']>) => void;
  updateBusinessStyle: (style: Partial<BusinessStore['businessStyle']>) => void;
}

// rectGroupColors, connGroupColors 两个数组长度必须相等
const useBusinessStore = create<BusinessStore>()(
  persist(
    (set, get) => ({
      businessConf: {
        unitWidth: 10, // 单元板宽度
        unitHeight: 10, // 单元板高度
        rectWidth: 100, // 接收卡宽度
        rectHeight: 100, // 接收卡高度
        rectGroupName: '未设置', // 矩形组名称
        rectGroupLimitArea: 2500000, // 分组限制面积
        rectGroupLimitWidth: 2000, // 分组限制宽度
        rectGroupLimitHeight: 2000, // 分组限制高度
        connGroupLimit: 65000, // 网线带载
        connGroupLimitNum: 4, // 网口数量
      },
      businessStyle: {
        tempReminderColor: '#f00', // 接收卡提醒颜色
        rectGroupOption: {
          overloadColor: 'rgba(250, 246, 19, 0.3)', // 发送卡超载颜色
          fill: 'rgba(177, 252, 143, 0.3)', // 发送卡框选颜色
        },
        rectGroupColors: [
          // 发送卡颜色组
          '#FFE6E6',
          '#E8FFEF',
          '#FFF0CC',
          '#E8FFFB',
          '#F9E8FF',
          '#FFF6F3',
          '#D2EFFF',
          '#FFD6F6',
          '#FFEEE9',
          '#E9E8FF',
        ],
        connGroupColors: [
          // 网线颜色组
          '#EB4037',
          '#2FC774',
          '#FF9412',
          '#04C0D8',
          '#9612FE',
          '#FF694D',
          '#165DFF',
          '#E01FD4',
          '#ECA336',
          '#6034DD',
        ],
        rectBorderColor: '#eee', // 接收卡边框颜色
      },
      freeRouting: false,
      rectGroupIds: [],
      updateRectGroupIds: (ids, type) => {
        set((state) => {
          let newIds: string[] = [];
          if (type === RenderType.ADD) {
            newIds = [...state.rectGroupIds, ...ids];
          } else if (type === RenderType.DELETE) {
            newIds = state.rectGroupIds.filter((id) => !ids.includes(id));
          }
          return { ...state, rectGroupIds: newIds };
        });
      },
      updateBusinessConf: (conf: Partial<BusinessStore['businessConf']>) => {
        set((state) => ({
          businessConf: { ...state.businessConf, ...conf },
        }));
      },
      updateBusinessStyle: (style: Partial<BusinessStore['businessStyle']>) => {
        set((state) => ({
          businessStyle: { ...state.businessStyle, ...style },
        }));
      },
    }),
    {
      name: BUSINESSSTOREKEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useBusinessStore;
