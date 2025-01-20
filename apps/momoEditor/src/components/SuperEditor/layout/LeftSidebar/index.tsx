import { Icon } from '@iconify/react';
import classNames from 'classnames';
import React, { useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useCanvasStore from '../../store/canvas';
import { MenuType } from '../../types';
import BusinessPanel from './BusinessPanel';
import ElementPanel from './ElementPanel';
import ImagePanel from './ImagePanel';
import styles from './index.module.less';
import TextPanel from './TextPanel';

export default function LeftSidebar() {
  const [activeMenu, setActiveMenu] = useState(MenuType.Element);
  const { secondaryMenuWidth, setSecondaryMenuWidth } = useCanvasStore(
    useShallow((state) => ({
      secondaryMenuWidth: state.secondaryMenuWidth,
      setSecondaryMenuWidth: state.setSecondaryMenuWidth,
    })),
  );

  const rightResizeRef = useRef<HTMLDivElement>(null);
  const isRightResizing = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // 右侧菜单宽度调整
  const handleRightMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isRightResizing.current = true;
      const startX = e.clientX;
      const startWidth = secondaryMenuWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isRightResizing.current) return;

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          if (!isRightResizing.current) return;
          const diff = e.clientX - startX; // 正向，因为是从右侧向左拖拽
          // 最小105px，最大360px
          const newWidth = Math.max(105, Math.min(360, startWidth + diff));
          setSecondaryMenuWidth(newWidth);
        });
      };

      const handleMouseUp = () => {
        isRightResizing.current = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [secondaryMenuWidth, setSecondaryMenuWidth],
  );

  const menus: { type: MenuType; icon: React.ReactNode; label: string }[] = [
    { type: MenuType.Text, icon: <Icon icon='mdi:format-size' />, label: '文本' },
    { type: MenuType.Element, icon: <Icon icon='mdi:square-outline' />, label: '元素' },
    { type: MenuType.Business, icon: <Icon icon='mdi:account-circle' />, label: '业务' },
    { type: MenuType.Image, icon: <Icon icon='mdi:file-image' />, label: '图片' },
  ];

  // 计算是否可以拖动（到达最小或最大宽度时不可拖动）
  const canResize = secondaryMenuWidth > 105 && secondaryMenuWidth < 360;

  return (
    <div className={styles['left-sidebar']}>
      {/* 一级菜单 - 固定60px宽度 */}
      <div className={styles['left-sidebar-primary']}>
        {menus.map((menu) => (
          <div
            key={menu.type}
            className={classNames(styles['primary-menu-item'], {
              [styles.active]: activeMenu === menu.type,
            })}
            onClick={() => setActiveMenu(menu.type)}
            title={menu.label}>
            {menu.icon}
          </div>
        ))}
      </div>

      {/* 二级菜单面板 */}
      <div className={styles['left-sidebar-secondary']} style={{ width: secondaryMenuWidth }}>
        {activeMenu === MenuType.Text && <TextPanel />}
        {activeMenu === MenuType.Element && <ElementPanel />}
        {activeMenu === MenuType.Business && <BusinessPanel />}
        {activeMenu === MenuType.Image && <ImagePanel />}
        {/* 右侧拖拽调整 - 仅在可拖动时显示 */}
        {canResize && (
          <div
            ref={rightResizeRef}
            className={classNames(styles['resize-handle'], styles['right-resize'])}
            onMouseDown={handleRightMouseDown}
          />
        )}
      </div>
    </div>
  );
}
