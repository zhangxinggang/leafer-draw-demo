import type { Cmp } from '@momo/leafer-draw';
import { CmpType, generateCmp, RenderType } from '@momo/leafer-draw';
import {
  checkConnIsSquare,
  checkIsOverMaxArea,
  fromIdGetEntireRectLines,
  onBusAddCmp,
} from '@momo/leafer-draw/utils/business';
import { getCmpByIds, setMaps } from '@momo/leafer-draw/utils/cmp';
import type { PointerEvent } from 'leafer-ui';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import useBusinessStore from '../../../store/business';
import useCanvasStore from '../../../store/canvas';
import useModelStore from '../../../store/model';
import { renderView } from '../draw';

interface IAddRectLineProps {
  event: PointerEvent;
}
const useLineRect = () => {
  const preLineRect = useRef<Cmp[] | null>(null); // 矩形中心店
  const onceAddConnsRef = useRef<Cmp[]>([]);
  const { app, addTempReminderCmps } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
      addTempReminderCmps: state.addTempReminderCmps,
    })),
  );
  const { freeRouting, businessConf, businessStyle } = useBusinessStore(
    useShallow((state) => ({
      freeRouting: state.freeRouting,
      businessConf: state.businessConf,
      businessStyle: state.businessStyle,
    })),
  );
  const { addAndUpdateCmps, addCmps } = useModelStore(
    useShallow((state) => ({
      addCmps: state.addCmps,
      addAndUpdateCmps: state.addAndUpdateCmps,
    })),
  );
  const appRef = useRef(app);

  useEffect(() => {
    appRef.current = app;
  }, [app]);

  const addLineRect = ({ event }: IAddRectLineProps) => {
    const cNode: any = appRef.current?.tree.pick(event);
    const tid = cNode?.target?.id;
    if (!preLineRect.current || !tid) return;
    const targetOriginalData = getCmpByIds([tid])[0];
    if (targetOriginalData?.backendData.type !== CmpType.RectLine) return;
    const isExist = preLineRect.current.some((item) => item.id === tid);
    if (isExist) return;
    const isOverMaxArea = checkIsOverMaxArea({
      cmps: [...preLineRect.current, targetOriginalData],
      maxArea: businessConf.connGroupLimit,
    });
    const lastRect = preLineRect.current[preLineRect.current.length - 1];
    if (
      !lastRect ||
      targetOriginalData.backendData.sourceConnId ||
      targetOriginalData.backendData.targetConnId
    )
      return;
    const sourceConnId = lastRect.id;
    const connComp = generateCmp(CmpType.Connector, {
      leaferAttr: {
        stroke: '#adc',
      },
      backendData: {
        sourceConnId,
        targetConnId: tid,
      },
    });

    if (isOverMaxArea) {
      const tempTargetId = tid + '_temp';
      if (useCanvasStore.getState().tempReminderCmps.some((cmp) => cmp.id === tempTargetId)) return;
      const tempConnTargetId = connComp.id + '_tempconn';
      const tempTarget: Cmp = {
        ...targetOriginalData,
        id: tempTargetId,
        editable: false,
        fill: businessStyle.tempReminderColor,
        backendData: { type: CmpType.RectLine },
      };
      const tempConnComp: Cmp = {
        ...connComp,
        id: tempConnTargetId,
        editable: false,
        backendData: {
          ...connComp.backendData,
          sourceConnId: sourceConnId,
          targetConnId: tempTargetId,
        },
      };
      const tempCmps = [tempTarget, tempConnComp];
      addTempReminderCmps(tempCmps);
    } else {
      renderView({ cmps: [connComp], type: RenderType.ADD, noRecord: true });
      onceAddConnsRef.current.push(connComp);
      preLineRect.current.push(targetOriginalData);
    }
  };

  const beforeAddLineRect = ({ event }: IAddRectLineProps) => {
    const cNode: any = appRef.current?.tree.pick(event);
    const tid = cNode?.target?.id;
    if (!tid) return;
    const target = getCmpByIds([tid])[0];
    if (target?.backendData.type !== CmpType.RectLine) return;
    preLineRect.current = fromIdGetEntireRectLines(tid);
  };

  const endAddLineRect = () => {
    if (!preLineRect.current) return;
    setMaps(onceAddConnsRef.current);
    onceAddConnsRef.current.forEach(onBusAddCmp);
    if (!freeRouting) {
      const result = checkConnIsSquare(preLineRect.current, {
        connGroupLimit: businessConf.connGroupLimit,
        rectGroupLimitWidth: businessConf.rectGroupLimitWidth,
        rectGroupLimitHeight: businessConf.rectGroupLimitHeight,
      });
      let optionRectData = result.length ? result : preLineRect.current;
      optionRectData = optionRectData.map((item) => ({
        id: item.id,
        fill: result.length ? businessStyle.tempReminderColor : undefined,
      }));
      addAndUpdateCmps({
        addCmps: onceAddConnsRef.current,
        updateCmps: optionRectData,
        addNoRender: true,
        updateNoRender: false,
      });
    } else {
      addCmps(onceAddConnsRef.current, true);
    }
    preLineRect.current = null;
    onceAddConnsRef.current = [];
  };

  return { addLineRect, beforeAddLineRect, endAddLineRect };
};

export default useLineRect;
