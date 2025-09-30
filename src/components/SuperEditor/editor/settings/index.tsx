import { useMemo } from 'react';
import { Form, InputNumber, Slider } from 'antd';
import { useShallow } from 'zustand/shallow';
import useModelStore from '../../store/model';
import ColorPicker from '../../../ColorPicker';
import useCanvasStore from '../../store/canvas';

import S from './index.module.less';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';

export default function Settings() {
  const {
    selectCmpIds,
    cmps,
    updateCmpById,
    upwardCmp,
    downwardCmp,
    topCmp,
    bottomCmp,
    removeCmpById,
    copyCmpById,
  } = useModelStore(
    useShallow((state) => ({
      selectCmpIds: state.selectCmpIds,
      cmps: state.cmps,
      updateCmps: state.updateCmps,
      updateCmpById: state.updateCmpById,
      upwardCmp: state.upwardCmp,
      downwardCmp: state.downwardCmp,
      topCmp: state.topCmp,
      bottomCmp: state.bottomCmp,
      removeCmpById: state.removeCmpById,
      copyCmpById: state.copyCmpById,
    })),
  );

  const showSetting = useCanvasStore((state) => state.showSetting);

  const selectCmpId = useMemo(() => {
    if (selectCmpIds.length !== 1) return null;
    return selectCmpIds[0];
  }, [selectCmpIds]);

  const selectCmp = useMemo(() => {
    if (selectCmpIds.length !== 1) return;
    const cmp = cmps.find((cmp) => cmp.id === selectCmpIds[0]);
    return cmp;
  }, [selectCmpIds, cmps]);

  const handleOpacityChange = (value: number) => {
    if (!selectCmp) return;
    updateCmpById(selectCmp.id, { opacity: value });
  };

  const handleSettingsChange = (obj: any) => {
    if (!selectCmp) return;
    updateCmpById(selectCmp.id, obj);
  };

  if (!selectCmp || !selectCmpId) return null;

  const { opacity = 1, fill = '', stroke = '', strokeWidth = 0 } = selectCmp;

  return (
    <div
      className={S.settings}
      style={{ display: showSetting ? 'block' : 'none' }}
      key={selectCmpId}>
      <Form layout="vertical">
        <Form.Item label="填充">
          <ColorPicker
            value={fill as string}
            onChange={(value: string) => {
              handleSettingsChange({ fill: value });
            }}
          />
        </Form.Item>
        <Form.Item label="描边">
          <ColorPicker
            value={stroke as string}
            onChange={(value: string) => {
              handleSettingsChange({ stroke: value });
            }}
          />
        </Form.Item>
        <Form.Item label="描边宽度">
          <InputNumber
            value={strokeWidth}
            onChange={(value: number | null) => {
              handleSettingsChange({ strokeWidth: value || 0 });
            }}
          />
        </Form.Item>

        <Form.Item label="透明度">
          <Slider
            min={0}
            max={1}
            step={0.1}
            value={opacity}
            onChange={handleOpacityChange}></Slider>
        </Form.Item>
        <Form.Item label="图层">
          <div className={S.layer}>
            <VerticalAlignTopOutlined
              name="top"
              size={22}
              onClick={() => topCmp(selectCmp?.id as string)}
            />
            <ArrowUpOutlined
              name="shangyi"
              size={20}
              onClick={() => upwardCmp(selectCmp?.id as string)}
            />
            <ArrowDownOutlined
              name="xiayi"
              size={20}
              onClick={() => downwardCmp(selectCmp?.id as string)}
            />
            <VerticalAlignBottomOutlined
              name="zhidi"
              size={22}
              onClick={() => bottomCmp(selectCmp?.id as string)}
            />
          </div>
        </Form.Item>
        <Form.Item label="操作">
          <div className={S.operator}>
            <CopyOutlined
              name="fuzhi"
              size={22}
              onClick={() => {
                copyCmpById(selectCmpId);
              }}
            />
            <DeleteOutlined
              name="shanchu"
              size={22}
              onClick={() => {
                removeCmpById([selectCmpId]);
              }}
            />
          </div>
        </Form.Item>
      </Form>
    </div>
  );
}
