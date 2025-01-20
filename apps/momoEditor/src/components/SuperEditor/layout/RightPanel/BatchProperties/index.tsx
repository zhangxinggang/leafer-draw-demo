import { Icon } from '@iconify/react';
import { Cmp } from '@momo/leafer-draw/types/cmp';
import { Button, Form, InputNumber, Slider } from 'antd';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import ColorPicker from '../../../../ColorPicker';
import useModelStore from '../../../store/model';
import styles from './index.module.less';

interface Props {
  cmps: Cmp[];
}

export default function BatchProperties({ cmps }: Props) {
  const { updateCmps, removeCmpByIds, copyCmpByIds } = useModelStore(
    useShallow((state) => ({
      updateCmps: state.updateCmps,
      removeCmpByIds: state.removeCmpByIds,
      copyCmpByIds: state.copyCmpByIds,
    })),
  );

  // 检查哪些属性支持批量操作
  const hasFill = useMemo(() => cmps.some((cmp) => cmp.fill !== undefined), [cmps]);
  const hasStroke = useMemo(() => cmps.some((cmp) => cmp.stroke !== undefined), [cmps]);
  const hasStrokeWidth = useMemo(() => cmps.some((cmp) => cmp.strokeWidth !== undefined), [cmps]);

  const ids = cmps.map((cmp) => cmp.id);

  const handleBatchChange = (updates: Partial<Cmp>) => {
    updateCmps(
      ids.map((id) => {
        return {
          ...updates,
          id,
        };
      }),
    );
  };

  const handleBatchCopy = () => {
    copyCmpByIds(ids);
  };

  const handleBatchDelete = () => {
    removeCmpByIds(ids);
  };

  return (
    <div className={styles['batch-properties']}>
      <Form layout='vertical' className={styles['properties-form']}>
        {hasFill && (
          <Form.Item label='填充'>
            <ColorPicker
              value=''
              onChange={(value: string) => {
                handleBatchChange({ fill: value });
              }}
            />
          </Form.Item>
        )}

        {hasStroke && (
          <>
            <Form.Item label='描边'>
              <ColorPicker
                value=''
                onChange={(value: string) => {
                  handleBatchChange({ stroke: value });
                }}
              />
            </Form.Item>
            {hasStrokeWidth && (
              <Form.Item label='描边宽度'>
                <InputNumber
                  min={0}
                  onChange={(value: number | null) => {
                    handleBatchChange({ strokeWidth: value || 0 });
                  }}
                />
              </Form.Item>
            )}
          </>
        )}

        <Form.Item label='透明度'>
          <Slider
            min={0}
            max={1}
            step={0.1}
            defaultValue={1}
            onChange={(value) => handleBatchChange({ opacity: value })}
          />
        </Form.Item>

        <Form.Item label='操作'>
          <div className={styles['operator-controls']}>
            <Button icon={<Icon icon='mdi:content-copy' />} onClick={handleBatchCopy}>
              复制
            </Button>
            <Button icon={<Icon icon='mdi:delete' />} danger onClick={handleBatchDelete}>
              删除
            </Button>
          </div>
        </Form.Item>
      </Form>
    </div>
  );
}
