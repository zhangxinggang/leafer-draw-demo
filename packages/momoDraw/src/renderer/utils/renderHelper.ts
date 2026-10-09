import type { App, UI } from 'leafer-ui';
import type { Cmp, RenderParams } from '../../types';
import { RenderType } from '../../types';
import { getApp } from '../../utils/leafer';

/**
 * 处理 DELETE 操作
 */
export function handleDelete(cmp: Partial<Cmp>, app = getApp()): null {
  if (!app || !cmp.id) return null;

  const element = app.tree.findId(cmp.id);
  if (element) {
    element.destroy();
    app.tree.remove(element);
  }
  return null;
}

/**
 * 处理 UPDATE 操作
 */
export function handleUpdate(cmp: Partial<Cmp>, app = getApp()): UI | null {
  if (!app || !cmp.id) return null;

  const element = app.tree.findId(cmp.id);
  if (element) {
    const { id, ...attrs } = cmp;
    for (const key in attrs) {
      element.setAttr(key, attrs[key]);
    }
  }
  return null;
}

export function handleTypeRender({ type, cmp, app }: { type: RenderType; cmp: Cmp; app?: App }) {
  const typeEvents = {
    [RenderType.DELETE]: handleDelete,
    [RenderType.UPDATE]: handleUpdate,
  };
  const event = typeEvents[type];
  if (event) {
    event(cmp, app);
    return true;
  }
  return false;
}

/**
 * 创建组件渲染函数的通用包装器
 */
export function createComponentRenderer<T extends UI>(ComponentClass: new (props: any) => T) {
  return function component({
    cmp,
    type = RenderType.ADD,
    app: scopedApp,
  }: RenderParams): T | null {
    const app = scopedApp || getApp();
    if (!app) return null;
    const isRender = handleTypeRender({ type, cmp, app });
    if (isRender) {
      return null;
    }
    const element = new ComponentClass(cmp);
    app.tree.add(element);
    return element;
  };
}
