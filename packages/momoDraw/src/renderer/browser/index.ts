import { cmpRenderMap } from '../../renderer/components';
import { initWorker, workerRender } from '../../renderer/worker';
import type { Cmp, CmpRenderParams } from '../../types';
import { CmpType, RenderType } from '../../types';
import { deleteMapsByIds, getCmpMaps, setMaps, updateMaps } from '../../utils/cmp';
import { getApp } from '../../utils/leafer';
import { refreshConnections } from '../components/connector';

function cmpRender(props: CmpRenderParams) {
  const app = getApp();
  if (!app) return;
  initWorker();
  const { cmps, type = RenderType.ADD, noRecord, updateEditBox, busData } = props;
  const isDelete = type === RenderType.DELETE;
  const isUpdate = type === RenderType.UPDATE;
  if (isDelete) {
    cmps.forEach((cmp) => {
      const element = app.tree.findId(cmp.id);
      if (element) {
        element.destroy();
      }
    });
    if (!noRecord) deleteMapsByIds(cmps.map((item) => item.id));
    refreshConnections(app, busData);
    workerRender({ app, cmps, type, busData, noRecord });
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
  // Imports/undo may list a connector before its endpoint rectangles.
  newCmps.sort(
    (a, b) =>
      Number(a.backendData?.type === CmpType.Connector) -
      Number(b.backendData?.type === CmpType.Connector),
  );
  newCmps.forEach((cmp) => {
    let cType = null;
    const cmpData = { ...cmp, selectable: true } as Cmp;
    if (isUpdate) {
      cType = cmpData.backendData.type;
      if (!noRecord) updateMaps([cmpData]);
    } else {
      cType = cmp.backendData.type;
      if (typeof cmp.editable === 'undefined') {
        cmpData.editable = true; // 默认可编辑
      }
      if (!noRecord) setMaps([cmpData]);
    }
    const renderFn = cmpRenderMap[cType];
    if (!renderFn) return;
    const params = {
      cmp: { ...cmpData },
      type: type || RenderType.ADD,
      busData,
      recordBusiness: !noRecord,
    };
    renderFn(params);
    if (updateEditBox) {
      app.editor.updateEditBox();
    }
  });
  refreshConnections(app, busData);
  workerRender({ app, cmps: newCmps, type, busData, noRecord });
}

export { cmpRender };
