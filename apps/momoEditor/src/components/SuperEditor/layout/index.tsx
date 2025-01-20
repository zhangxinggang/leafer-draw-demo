import classNames from 'classnames';
import { useShallow } from 'zustand/react/shallow';
import useCanvasStore from '../store/canvas';
import CanvasArea from './CanvasArea';
import styles from './index.module.less';
import LeftSidebar from './LeftSidebar';
import RightPanel from './RightPanel';
import TopBar from './TopBar';

export default function Layout() {
  const { darkMode } = useCanvasStore(
    useShallow((state) => ({
      darkMode: state.darkMode,
    })),
  );

  return (
    <div className={classNames(styles['super-editor-layout'], { [styles['dark-mode']]: darkMode })}>
      <TopBar />
      <div className={styles['layout-content']}>
        <LeftSidebar />
        <CanvasArea />
        <RightPanel />
      </div>
    </div>
  );
}
