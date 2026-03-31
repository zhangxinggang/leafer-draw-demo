import { App } from 'leafer-ui';
import { cmpRenderMap } from '../../renderer/components';
import { initWorker, workerRender } from '../../renderer/worker';
import { Cmp, CmpRenderParams, RenderType } from '../../types';
import { deleteMapsByIds, getCmpMaps, setMaps, updateMaps } from '../../utils/cmp';
import { getApp } from '../../utils/leafer';

let haveInit = false;
const initLeaferInstance = (app: App) => {
  if (!app?.tree || haveInit) return;
  haveInit = true;
  const add = app.tree.add;
  app.tree.add = (...args: any[]) => {
    const params = [...args];
    // 去掉额外的渲染数据
    delete params[0].backendData;
    const result = add.apply(app.tree, args);
    return result;
  };
};

function cmpRender(props: CmpRenderParams) {
  const app = getApp();
  initLeaferInstance(app);
  initWorker();
  if (!app) return;
  const { cmps, type = RenderType.ADD, noRecord, updateEditBox, busData } = props;
  const isDelete = type === RenderType.DELETE;
  const isUpdate = type === RenderType.UPDATE;
  if (isDelete) {
    cmps.forEach((cmp) => {
      const element = app.tree.findId(cmp.id);
      if (element) {
        app.tree.remove(element);
      }
    });
    !noRecord && deleteMapsByIds(cmps.map((item) => item.id));
    workerRender({ app, cmps, type, busData });
    return;
  }
  const cmpMaps = getCmpMaps();
  const newCmps = cmps.map((cmp) => {
    if (isUpdate) {
      return { ...cmpMaps.get(cmp.id), ...cmp };
    } else {
      return cmp;
    }
  });
  newCmps.forEach((cmp) => {
    let cType = null;
    let cmpData = { ...cmp, selectable: true } as Cmp;
    if (isUpdate) {
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
    const params = { cmp: { ...cmpData }, type: type || RenderType.ADD, busData };
    renderFn(params);
    if (updateEditBox) {
      app.editor.updateEditBox();
    }
  });
  workerRender({ app, cmps: newCmps, type, busData });
}

export { cmpRender };
