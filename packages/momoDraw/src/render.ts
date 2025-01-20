import { cmpRenderMap } from './renderer';
import { AnyObj, Cmp, CmpNeedId, RenderType } from './types';
import { deleteMapsByIds, getCmpMaps, setMaps, updateMaps } from './utils/cmp';
import { getApp } from './utils/leafer';

interface CmpRenderParams {
  cmps: CmpNeedId[];
  type?: RenderType;
  noRecord?: boolean;
  updateEditBox?: boolean;
  busData?: AnyObj;
}

function cmpRender({
  cmps,
  type = RenderType.ADD,
  noRecord,
  updateEditBox,
  busData = {},
}: CmpRenderParams) {
  const app = getApp();
  if (!app) return;
  if (type === RenderType.DELETE) {
    cmps.forEach((cmp) => {
      const element = app.tree.findId(cmp.id);
      if (element) {
        app.tree.remove(element);
      }
    });
    !noRecord && deleteMapsByIds(cmps.map((item) => item.id));
    return;
  }
  const cmpMaps = getCmpMaps();
  cmps.forEach((cmp) => {
    let cType = null;
    let cmpData = { ...cmp, selectable: true } as Cmp;
    if (type === RenderType.UPDATE) {
      cmpData = { ...cmpMaps.get(cmp.id), ...cmp };
      cType = cmpData.backendData.type;
      !noRecord && updateMaps([cmpData]);
    } else {
      cType = cmp.backendData.type;
      if (typeof cmp.editable === 'undefined') {
        cmpData.editable = true; // 默认可编辑
      }
      !noRecord && setMaps([cmpData]);
    }
    const renderFn = cmpRenderMap[cType];
    if (!renderFn) return;
    // 去掉额外的渲染数据
    const renderCmpData = { ...cmpData };
    if (!noRecord) {
      // 不记录的数据，存储的数据没有backendData
      delete renderCmpData.backendData;
    }
    renderFn({ cmp: renderCmpData, type: type || RenderType.ADD, busData });
    if (updateEditBox) {
      app.editor.updateEditBox();
    }
  });
}

export { cmpRender, cmpRenderMap };
