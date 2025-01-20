import { Tabs } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useModelStore from '../../store/model';
import useToolbarStore, { ToolBarState } from '../../store/toolbar';
import BatchProperties from './BatchProperties';
import BusinessProperties from './BusinessProperties';
import CanvasProperties from './CanvasProperties';
import ElementProperties from './ElementProperties';
import styles from './index.module.less';

export default function RightPanel() {
  const [activeKey, setActiveKey] = useState<string>('canvas');
  const { selectCmpIds, cmps } = useModelStore(
    useShallow((state) => ({
      selectCmpIds: state.selectCmpIds,
      cmps: state.cmps,
    })),
  );
  const { state: toolbarState, setState } = useToolbarStore();

  const selectedCmps = useMemo(() => {
    return cmps.filter((cmp) => selectCmpIds.includes(cmp.id));
  }, [cmps, selectCmpIds]);

  const isBus = [ToolBarState.LineRect, ToolBarState.RectLine, ToolBarState.rectGroup].includes(
    toolbarState,
  );
  // 构建Tab项
  const tabItems = useMemo(() => {
    const items: Array<{ key: string; label: string; children: React.ReactNode }> = [
      {
        key: 'canvas',
        label: '画布属性',
        children: <CanvasProperties />,
      },
    ];

    // 多选时添加批量操作
    if (selectCmpIds.length > 1) {
      items.push({
        key: 'batch',
        label: '批量操作',
        children: <BatchProperties cmps={selectedCmps} />,
      });
    }

    // 单选时添加元素属性
    if (selectCmpIds.length === 1) {
      items.push({
        key: 'element',
        label: '元素属性',
        children: <ElementProperties cmp={selectedCmps[0]} />,
      });
    }

    // 选中连线矩形时添加业务设置
    if (isBus) {
      items.push({
        key: 'business',
        label: '业务设置',
        children: <BusinessProperties />,
      });
    }

    return items;
  }, [selectCmpIds.length, selectedCmps, toolbarState]);

  // 当tab项变化时，自动切换到第一个可用的tab
  useEffect(() => {
    if (tabItems.length > 0 && !tabItems.find((item) => item.key === activeKey)) {
      setActiveKey(tabItems[0].key);
    }
  }, [tabItems, activeKey]);

  return (
    <div className={styles['right-panel']}>
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={tabItems}
        type='card'
        className={styles['right-panel-tabs']}
      />
    </div>
  );
}
