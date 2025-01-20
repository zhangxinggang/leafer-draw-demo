import { UI } from 'leafer-ui';
import { RenderParams, RenderType } from '../../types';
import { getApp } from '../../utils/leafer';

/**
 * 处理 DELETE 操作
 */
export function handleDelete(cmp: Partial<import('../../types').Cmp>): null {
  const app = getApp();
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
export function handleUpdate(cmp: Partial<import('../../types').Cmp>): UI | null {
  const app = getApp();
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

/**
 * 创建组件渲染函数的通用包装器
 */
export function createComponentRenderer<T extends UI>(ComponentClass: new (props: any) => T) {
  return function component({ cmp, type = RenderType.ADD }: RenderParams): T | null {
    const app = getApp();
    if (!app) return null;

    if (type === RenderType.DELETE) {
      return handleDelete(cmp) as null;
    }

    if (type === RenderType.UPDATE) {
      return handleUpdate(cmp) as T | null;
    }

    // ADD (default)
    const element = new ComponentClass(cmp);
    app.tree.add(element);
    return element;
  };
}
