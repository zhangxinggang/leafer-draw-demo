import { cmpRender } from '@momo/leafer-draw/render';
import { RenderType } from '@momo/leafer-draw/types/cmp';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useBusinessStore from '../../store/business';
import useCanvasStore from '../../store/canvas';
import useModelStore from '../../store/model';

export default function useRender() {
  const { app, genCmp, tempReminderCmps } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
      genCmp: state.genCmp,
      tempReminderCmps: state.tempReminderCmps,
    })),
  );
  const haveInitRef = useRef(false);
  const prevTempReminderCmpsRef = useRef<typeof tempReminderCmps>([]);

  const { initialized, cmps } = useModelStore(
    useShallow((state) => ({
      initialized: state.initialized,
      cmps: state.cmps,
    })),
  );

  useEffect(() => {
    if (!app?.tree || haveInitRef.current || !initialized) return;
    haveInitRef.current = true;
    const busData = useBusinessStore.getState();
    cmpRender({ cmps, type: RenderType.ADD, busData });
  }, [app, initialized]);

  useEffect(() => {
    if (!app?.tree || !genCmp) return;
    const cmp = app.tree.findId(genCmp.id);
    const busData = useBusinessStore.getState();
    cmpRender({ cmps: [genCmp], type: cmp ? RenderType.UPDATE : RenderType.ADD, busData });
  }, [app, genCmp]);

  useEffect(() => {
    if (!app?.tree) return;
    const busData = useBusinessStore.getState();
    if (tempReminderCmps.length) {
      tempReminderCmps.forEach((item) => {
        const cmp = app.tree.findId(item.id);
        cmpRender({ cmps: [item], type: cmp ? RenderType.UPDATE : RenderType.ADD, busData });
      });
    } else {
      cmpRender({ cmps: prevTempReminderCmpsRef.current, type: RenderType.DELETE, busData });
    }
    prevTempReminderCmpsRef.current = tempReminderCmps;
  }, [app, tempReminderCmps]);
}
