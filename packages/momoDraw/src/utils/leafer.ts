import { App } from 'leafer-ui';

export const elementChange = (e: any) => {
  const attrName = e?.attrName;
  if (['x', 'y', 'width', 'height', 'rotation'].includes(attrName)) {
    return true;
  }
  return false;
};

/**
 * 设置全局 app 引用
 */
export function setApp(app: App | null) {
  window.spuEditorApp = app;
}
/**
 * 获取全局 app 实例
 */
export function getApp(): App | null {
  return window.spuEditorApp || null;
}
