import { App } from '@momo/leafer-draw/renderer';
import { IEditorConfig } from 'leafer-ui';
import { useShallow } from 'zustand/react/shallow';
import useBusinessStore from '../../store/business';
import useCanvasStore from '../../store/canvas';
import useModelStore from '../../store/model';
import useToolbarStore, { ToolBarState } from '../../store/toolbar';
import useEventHandler from './useEventHandler';
import useRender from './useRender';

export default function Canvas({ renderId }: { renderId: string }) {
  const { setApp, editorConfig } = useCanvasStore(
    useShallow((state) => ({
      setApp: state.setApp,
      editorConfig: state.editorConfig,
    })),
  );
  const { zoomLayer, selectCmpIds } = useModelStore(
    useShallow((state) => ({
      zoomLayer: state.zoomLayer,
      selectCmpIds: state.selectCmpIds,
    })),
  );
  const { canvasBackgroundColor, rulerVisible, darkMode } = useCanvasStore(
    useShallow((state) => ({
      canvasBackgroundColor: state.canvasBackgroundColor,
      rulerVisible: state.rulerVisible,
      darkMode: state.darkMode,
    })),
  );
  const {
    onPointDown,
    onPointMove,
    onPointUp,
    onSelect,
    onViewMove,
    onViewZoom,
    onMoveEnd,
    onScaleEnd,
    onRotateEnd,
    onPathChange,
    onTap,
  } = useEventHandler();

  const state = useToolbarStore((state) => state.state);
  const { rectGroupOption } = useBusinessStore.getState().businessStyle;

  const isBus = [ToolBarState.LineRect, ToolBarState.rectGroup].includes(state);
  const defaultEditorConfig = { ...editorConfig, visible: ![ToolBarState.Dragger].includes(state) };
  const busEditorConf: IEditorConfig = {
    moveable: false,
    resizeable: false,
    rotateable: false,
    rect: {
      fill: rectGroupOption.fill,
    },
  };

  useRender();

  const domExist = document.getElementById(renderId);
  if (!domExist) {
    return null;
  }
  return (
    <App
      renderId={renderId}
      zoomLayer={zoomLayer}
      editorConf={isBus ? busEditorConf : defaultEditorConfig}
      selectCmpIds={selectCmpIds}
      canvasBackgroundColor={canvasBackgroundColor}
      rulerVisible={rulerVisible}
      darkMode={darkMode}
      onPointDown={onPointDown}
      onPointMove={onPointMove}
      onPointUp={onPointUp}
      onSelect={onSelect}
      onMoveEnd={onMoveEnd}
      onScaleEnd={onScaleEnd}
      onRotateEnd={onRotateEnd}
      onPathChange={onPathChange}
      onViewMove={onViewMove}
      onViewZoom={onViewZoom}
      onTap={onTap}
      onAppChange={(app) => {
        setApp(app);
      }}
    />
  );
}
