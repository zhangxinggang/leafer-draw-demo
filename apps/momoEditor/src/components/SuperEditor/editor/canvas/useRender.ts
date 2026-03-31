import { RenderType } from '@momo/leafer-draw/types/cmp';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useCanvasStore from '../../store/canvas';
import useModelStore from '../../store/model';
import { renderView } from './draw';

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
    renderView({ cmps, type: RenderType.ADD });
  }, [app, initialized]);

  useEffect(() => {
    if (!app?.tree || !genCmp) return;
    const cmp = app.tree.findId(genCmp.id);
    renderView({ cmps: [genCmp], type: cmp ? RenderType.UPDATE : RenderType.ADD });
  }, [app, genCmp]);

  useEffect(() => {
    if (!app?.tree) return;
    if (tempReminderCmps.length) {
      tempReminderCmps.forEach((item) => {
        const cmp = app.tree.findId(item.id);
        renderView({ cmps: [item], type: cmp ? RenderType.UPDATE : RenderType.ADD });
      });
    } else {
      renderView({ cmps: prevTempReminderCmpsRef.current, type: RenderType.DELETE });
    }
    prevTempReminderCmpsRef.current = tempReminderCmps;
  }, [app, tempReminderCmps]);
}
