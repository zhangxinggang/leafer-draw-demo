import '@leafer-in/export';
import { App } from '@leafer-ui/worker';
import { cmpRenderMapWorker } from '../../renderer/components/indexWorker';
import { Cmp, CmpRenderParams, RenderType } from '../../types';
import { setApp } from '../../utils/leafer';

const leaferApp = new App({
  width: 1,
  height: 1,
  tree: { type: 'design' },
});
setApp(leaferApp);

function cmpRender({ cmps, type = RenderType.ADD, busData }: CmpRenderParams) {
  const isDelete = type === RenderType.DELETE;
  const isUpdate = type === RenderType.UPDATE;
  if (isDelete) {
    cmps.forEach((cmp) => {
      const element = leaferApp.tree.findId(cmp.id);
      if (element) {
        leaferApp.tree.remove(element);
      }
    });
    return;
  }
  cmps.forEach((cmp) => {
    let cType = null;
    let cmpData = { ...cmp, lock: true, editable: false } as Cmp;
    if (isUpdate) {
      cType = cmpData.backendData.type;
    } else {
      cType = cmp.backendData.type;
    }
    const renderFn = cmpRenderMapWorker[cType];
    if (!renderFn) return;
    renderFn({ cmp: { ...cmpData }, type: type || RenderType.ADD, busData });
  });
}

self.onmessage = ({ data }) => {
  const dataObj = JSON.parse(data);
  Object.keys(dataObj.app).forEach((key) => {
    leaferApp.tree[key] = dataObj.app[key];
  });
  cmpRender(dataObj);
  leaferApp.tree.export('jpg').then((res) => {
    console.log(res.data);
  });
};
