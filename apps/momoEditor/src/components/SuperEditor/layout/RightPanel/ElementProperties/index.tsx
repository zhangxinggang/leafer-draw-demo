import { Icon } from '@iconify/react';
import { Cmp } from '@momo/leafer-draw/types/cmp';
import { getZindexObj } from '@momo/leafer-draw/utils/cmp';
import { Button, Form, InputNumber, Slider } from 'antd';
import { useShallow } from 'zustand/react/shallow';
import ColorPicker from '../../../../ColorPicker';
import useModelStore from '../../../store/model';
import styles from './index.module.less';

interface Props {
  cmp: Cmp;
}

export default function ElementProperties({ cmp }: Props) {
  const { updateCmps, removeCmpByIds, copyCmpByIds } = useModelStore(
    useShallow((state) => ({
      updateCmps: state.updateCmps,
      removeCmpByIds: state.removeCmpByIds,
      copyCmpByIds: state.copyCmpByIds,
    })),
  );

  const zIndexObj = getZindexObj();

  const { opacity = 1, fill = '', stroke = '', strokeWidth = 0, zIndex = 0 } = cmp;

  const handleChange = (obj: Partial<Cmp>) => {
    updateCmps([{ ...obj, id: cmp.id }]);
  };

  return (
    <div key={cmp.id} className={styles['element-properties']}>
      <Form layout='vertical' className={styles['properties-form']}>
        <Form.Item label='填充'>
          <ColorPicker
            value={fill as string}
            onChange={(value: string) => {
              handleChange({ fill: value });
            }}
          />
        </Form.Item>
        <Form.Item label='描边'>
          <ColorPicker
            value={stroke as string}
            onChange={(value: string) => {
              handleChange({ stroke: value });
            }}
          />
        </Form.Item>
        <Form.Item label='描边宽度'>
          <InputNumber
            value={strokeWidth}
            onChange={(value: number | null) => {
              handleChange({ strokeWidth: value || 0 });
            }}
            min={0}
          />
        </Form.Item>

        <Form.Item label='透明度'>
          <Slider
            min={0}
            max={1}
            step={0.1}
            value={opacity}
            onChange={(value) => handleChange({ opacity: value })}
          />
        </Form.Item>

        <Form.Item label='图层'>
          <div className={styles['layer-controls']}>
            <Button
              icon={<Icon icon='mdi:format-vertical-align-top' />}
              onClick={() => {
                updateCmps([{ ...cmp, zIndex: zIndexObj.max + 1 }]);
              }}
              title='置顶'
            />
            <Button
              icon={<Icon icon='mdi:arrow-up' />}
              onClick={() => {
                updateCmps([{ ...cmp, zIndex: zIndex + 1 }]);
              }}
              title='上移'
            />
            <Button
              icon={<Icon icon='mdi:arrow-down' />}
              onClick={() => {
                updateCmps([{ ...cmp, zIndex: zIndex - 1 }]);
              }}
              title='下移'
            />
            <Button
              icon={<Icon icon='mdi:format-vertical-align-bottom' />}
              onClick={() => {
                updateCmps([{ ...cmp, zIndex: zIndexObj.min - 1 }]);
              }}
              title='置底'
            />
          </div>
        </Form.Item>

        <Form.Item label='操作'>
          <div className={styles['operator-controls']}>
            <Button
              icon={<Icon icon='mdi:content-copy' />}
              onClick={() => copyCmpByIds([cmp.id])}
              title='复制'
            />
            <Button
              icon={<Icon icon='mdi:delete' />}
              danger
              onClick={() => removeCmpByIds([cmp.id])}
              title='删除'
            />
          </div>
        </Form.Item>
      </Form>
    </div>
  );
}
