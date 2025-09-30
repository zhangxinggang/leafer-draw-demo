import { Button } from 'antd';
import { useShallow } from 'zustand/react/shallow';
import useModelStore, { useTemporalStore } from '../../store/model';
import S from './index.module.less';
import { RedoOutlined, UndoOutlined } from '@ant-design/icons';

export default function UndoRedo() {
  const { undo, redo, pastStates, futureStates } = useTemporalStore((state) => state);
  const { updateSelectCmpIds } = useModelStore(
    useShallow((state) => ({
      updateSelectCmpIds: state.updateSelectCmpIds,
    })),
  );

  return (
    <div className={S['undo-redo']}>
      <Button
        size="large"
        type="text"
        icon={<UndoOutlined name="a-chexiaozhongzuoshangyibu" size={20} />}
        onClick={() => {
          updateSelectCmpIds([]);
          undo();
        }}
        disabled={pastStates.length === 0}
      />
      <Button
        size="large"
        type="text"
        icon={<RedoOutlined name="a-chexiaozhongzuoxiayibu-xianxing" size={20} />}
        onClick={() => {
          updateSelectCmpIds([]);
          redo();
        }}
        disabled={futureStates.length === 0}
      />
    </div>
  );
}
