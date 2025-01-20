import { Button, Form, Input, InputNumber, Switch } from 'antd';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import ColorPicker from '../../../../ColorPicker';
import generateRect from '../../../mock/generateRect';
import useCanvasStore from '../../../store/canvas';
import useToolbarStore, { ToolBarState } from '../../../store/toolbar';
import styles from './index.module.less';

export default function CanvasProperties() {
  const [xCount, setXCount] = useState(50);
  const [yCount, setYCount] = useState(50);
  const { state: toolbarState } = useToolbarStore();
  const {
    canvasName,
    canvasBackgroundColor,
    rulerVisible,
    darkMode,
    setCanvasName,
    setCanvasBackgroundColor,
    setRulerVisible,
    setDarkMode,
  } = useCanvasStore(
    useShallow((state) => ({
      canvasName: state.canvasName,
      canvasBackgroundColor: state.canvasBackgroundColor,
      rulerVisible: state.rulerVisible,
      darkMode: state.darkMode,
      setCanvasName: state.setCanvasName,
      setCanvasBackgroundColor: state.setCanvasBackgroundColor,
      setRulerVisible: state.setRulerVisible,
      setDarkMode: state.setDarkMode,
    })),
  );
  return (
    <div className={styles['canvas-properties']}>
      <Form layout='vertical' className={styles['properties-form']}>
        <Form.Item label='画布名称'>
          <Input
            value={canvasName}
            onChange={(e) => setCanvasName(e.target.value)}
            placeholder='未命名画布'
          />
        </Form.Item>

        <Form.Item label='背景颜色'>
          <ColorPicker value={canvasBackgroundColor} onChange={setCanvasBackgroundColor} />
        </Form.Item>

        <Form.Item label='暗黑模式'>
          <Switch checked={darkMode} onChange={setDarkMode} />
        </Form.Item>

        <Form.Item label='标尺设置'>
          <div className={styles['ruler-settings']}>
            <div className={styles['setting-item']}>
              <span>显示标尺</span>
              <Switch checked={rulerVisible} onChange={setRulerVisible} />
            </div>
          </div>
        </Form.Item>
        {toolbarState === ToolBarState.LineRect && (
          <Form.Item label='数据测试'>
            <div className={styles['rect-test']}>
              <div className={styles['rect-test-inputs']}>
                <InputNumber
                  addonAfter='行'
                  min={1}
                  defaultValue={50}
                  value={xCount}
                  onChange={(value) => setXCount(value)}
                />
                <InputNumber
                  addonAfter='列'
                  min={1}
                  defaultValue={50}
                  value={yCount}
                  onChange={(value) => setYCount(value)}
                />
              </div>
              <Button
                type='primary'
                onClick={() => {
                  generateRect({ xCount, yCount });
                }}>
                生成数据
              </Button>
            </div>
          </Form.Item>
        )}
      </Form>
    </div>
  );
}
