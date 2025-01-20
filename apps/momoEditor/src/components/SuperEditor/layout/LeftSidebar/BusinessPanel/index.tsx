import classNames from 'classnames';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import useCanvasStore from '../../../store/canvas';
import useToolbarStore, { ToolBarState } from '../../../store/toolbar';
import styles from './index.module.less';

interface BusinessItem {
  type: ToolBarState;
  name: string;
  icon: React.ReactNode;
}

const businessItems: BusinessItem[] = [
  {
    type: ToolBarState.RectLine,
    name: '矩形连线',
    icon: '□',
  },
  {
    type: ToolBarState.LineRect,
    name: '连线矩形',
    icon: '→',
  },
  {
    type: ToolBarState.rectGroup,
    name: '发送卡',
    icon: 'S',
  },
];

export default function BusinessPanel() {
  const { state: toolbarState, setState } = useToolbarStore();
  const { secondaryMenuWidth } = useCanvasStore(
    useShallow((state) => ({
      secondaryMenuWidth: state.secondaryMenuWidth,
    })),
  );

  // 根据二级菜单宽度计算列数
  const getColumnsClass = () => {
    if (secondaryMenuWidth < 210) {
      return 'columns-1';
    } else if (secondaryMenuWidth < 315) {
      return 'columns-2';
    }
    return '';
  };

  const handleClick = (item: BusinessItem) => {
    setState(item.type);
  };

  return (
    <div className={styles['business-panel']}>
      <div className={styles['panel-title']}>业务</div>
      <div className={classNames(styles['business-list'], styles[getColumnsClass()])}>
        {businessItems.map((item) => (
          <div
            key={item.type}
            className={classNames(styles['business-item'], {
              [styles.selected]: toolbarState === item.type,
            })}
            onClick={() => handleClick(item)}>
            <div className={styles['business-icon']}>{item.icon}</div>
            <div className={styles['business-name']}>{item.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
