import '@leafer-in/export';
import { App } from '@leafer-ui/worker';
import { cmpRenderMapWorker } from '../../renderer/components/indexWorker';
import type { Cmp, CmpRenderParams } from '../../types';
import { RenderType } from '../../types';
import { deleteMapsByIds, setMaps, updateMaps } from '../../utils/cmp';
import { setApp } from '../../utils/leafer';
import { refreshConnections } from '../components/connector';

const leaferApp = new App({
  width: 1,
  height: 1,
  tree: { type: 'design' },
});
setApp(leaferApp);

function cmpRender({ cmps, type = RenderType.ADD, busData, noRecord }: CmpRenderParams) {
  const isDelete = type === RenderType.DELETE;
  const isUpdate = type === RenderType.UPDATE;
  if (isDelete) {
    cmps.forEach((cmp) => {
      const element = leaferApp.tree.findId(cmp.id);
      if (element) {
        element.destroy();
      }
    });
    if (!noRecord) deleteMapsByIds(cmps.map((cmp) => cmp.id));
    refreshConnections(leaferApp, busData);
    return;
  }
  if (!noRecord) {
    if (isUpdate) updateMaps(cmps);
    else setMaps(cmps);
  }
  cmps.forEach((cmp) => {
    let cType = null;
    const cmpData = { ...cmp, lock: true, editable: false } as Cmp;
    if (isUpdate) {
      cType = cmpData.backendData.type;
    } else {
      cType = cmp.backendData.type;
    }
    const renderFn = cmpRenderMapWorker[cType];
    if (!renderFn) return;
    renderFn({
      cmp: { ...cmpData },
      type: type || RenderType.ADD,
      busData,
      recordBusiness: !noRecord,
    });
  });
  refreshConnections(leaferApp, busData);
}

self.onmessage = ({ data }) => {
  const dataObj = JSON.parse(data);
  Object.keys(dataObj.app).forEach((key) => {
    leaferApp.tree[key] = dataObj.app[key];
  });
  cmpRender(dataObj);
};
