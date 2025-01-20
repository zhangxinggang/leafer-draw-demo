import { Icon } from '@iconify/react';
import { AlignType } from '@momo/leafer-draw';
import { Button, Dropdown, Form, InputNumber, Modal, Segmented, Switch, message } from 'antd';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import ColorPicker from '../../../ColorPicker';
import useCanvasStore from '../../store/canvas';
import useModelStore from '../../store/model';
import useToolbarStore, { ToolBarState } from '../../store/toolbar';
import styles from './index.module.less';

export default function TopBar() {
  const { state, setState } = useToolbarStore();
  const { selectCmpIds, alignCmps, updateZoomLayer, zoomLayer } = useModelStore(
    useShallow((state) => ({
      selectCmpIds: state.selectCmpIds,
      alignCmps: state.alignCmps,
      updateZoomLayer: state.updateZoomLayer,
      zoomLayer: state.zoomLayer,
    })),
  );
  const { undo, redo, pastStates, futureStates } = useModelStore(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      pastStates: state.pastStates,
      futureStates: state.futureStates,
    })),
  );
  const app = useCanvasStore((state) => state.app);
  const { canvasBackgroundColor, setCanvasBackgroundColor } = useCanvasStore(
    useShallow((state) => ({
      canvasBackgroundColor: state.canvasBackgroundColor,
      setCanvasBackgroundColor: state.setCanvasBackgroundColor,
    })),
  );

  const [exportImageModalOpen, setExportImageModalOpen] = useState(false);
  const [exportJsonModalOpen, setExportJsonModalOpen] = useState(false);
  const [importJsonModalOpen, setImportJsonModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [image, setImage] = useState('');
  const [backgroundColor, setBackgroundColor] = useState(canvasBackgroundColor);
  const enabledBackground = Form.useWatch(['background'], form);

  const scale = zoomLayer?.scale || 1;
  const scaleLabel = Math.round(scale * 100);
  const [scaleInputValue, setScaleInputValue] = useState<string>(scaleLabel.toString());
  const canAlign = selectCmpIds.length >= 2;

  // 同步scaleLabel到输入框
  useEffect(() => {
    setScaleInputValue(scaleLabel.toString());
  }, [scaleLabel]);

  // 处理对齐
  const handleAlign = (alignType: AlignType) => {
    if (selectCmpIds.length < 2) {
      message.warning('请至少选择两个元素');
      return;
    }
    alignCmps(selectCmpIds, alignType);
  };

  // 处理缩放
  const handleZoom = (type: 'plus' | 'minus' | 'reset' | 'fit') => {
    if (type === 'plus') {
      if (scale >= 2.5) return;
      updateZoomLayer({ scale: scale + 0.1 });
    } else if (type === 'minus') {
      if (scale <= 0.1) return;
      updateZoomLayer({ scale: scale - 0.1 });
    } else if (type === 'reset') {
      updateZoomLayer({ scale: 1, x: 0, y: 0 });
    } else if (type === 'fit') {
      app.tree.zoom('fit');
    }
  };

  // 导出图片
  const handleExportImage = (type: 'png' | 'jpg') => {
    const { pixelRatio } = form.getFieldsValue();
    const bgColor = enabledBackground ? backgroundColor : 'transparent';
    app?.export('superEditor.' + type, {
      pixelRatio,
      fill: bgColor,
    });
    setExportImageModalOpen(false);
    message.success('导出成功');
  };

  // 导出JSON
  const handleExportJson = () => {
    const modelState = useModelStore.getState();
    const canvasState = useCanvasStore.getState();
    const exportData = {
      model: {
        cmps: modelState.cmps,
        zoomLayer: modelState.zoomLayer,
      },
      canvas: {
        canvasName: canvasState.canvasName,
        canvasBackgroundColor: canvasState.canvasBackgroundColor,
        rulerVisible: canvasState.rulerVisible,
      },
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${canvasState.canvasName || '画布'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportJsonModalOpen(false);
    message.success('导出成功');
  };

  // 导入JSON
  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonStr = event.target?.result as string;
          const data = JSON.parse(jsonStr);
          if (data.model) {
            useModelStore.setState({
              cmps: data.model.cmps || [],
              zoomLayer: data.model.zoomLayer || {},
            });
          }
          if (data.canvas) {
            useCanvasStore.setState({
              canvasName: data.canvas.canvasName || '未命名画布',
              canvasBackgroundColor: data.canvas.canvasBackgroundColor || '#ffffff',
              rulerVisible: data.canvas.rulerVisible ?? true,
            });
          }
          message.success('导入成功');
          setImportJsonModalOpen(false);
        } catch (error) {
          message.error('导入失败：文件格式错误');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 保存
  const handleSave = () => {
    message.success('保存成功（数据已自动保存到本地）');
  };

  // 预览图片
  useEffect(() => {
    if (!exportImageModalOpen || !app) return;
    let bgColor = backgroundColor;
    if (!enabledBackground) {
      bgColor = 'transparent';
    }
    app.export('png', { fill: bgColor }).then((result) => {
      setImage(result.data);
    });
  }, [exportImageModalOpen, app, backgroundColor, enabledBackground]);

  const exportImageMenuItems = [
    {
      key: 'png',
      label: (
        <Button
          icon={<Icon icon='mdi:file-image' />}
          type='text'
          onClick={() => setExportImageModalOpen(true)}>
          导出图片
        </Button>
      ),
    },
    {
      key: 'json',
      label: (
        <Button
          icon={<Icon icon='mdi:file-document' />}
          type='text'
          onClick={() => setExportJsonModalOpen(true)}>
          导出JSON
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className={styles['top-bar']}>
        <div className={styles['top-bar-left']}>
          {/* 选中和移动 */}
          <Button
            type={state === ToolBarState.Select ? 'primary' : 'default'}
            icon={<Icon icon='mdi:cursor-pointer' />}
            onClick={() => setState(ToolBarState.Select)}>
            选中
          </Button>
          <Button
            type={state === ToolBarState.Dragger ? 'primary' : 'default'}
            icon={<Icon icon='mdi:drag' />}
            onClick={() => setState(ToolBarState.Dragger)}>
            移动
          </Button>

          <div className={styles.divider} />

          {/* 撤销重做 */}
          <Button
            icon={<Icon icon='mdi:undo' />}
            onClick={() => {
              undo();
            }}
            disabled={pastStates.length === 0}
          />
          <Button
            icon={<Icon icon='mdi:redo' />}
            onClick={() => {
              redo();
            }}
            disabled={futureStates.length === 0}
          />

          <div className={styles.divider} />

          {/* 缩放 */}
          <Button icon={<Icon icon='mdi:magnify-minus' />} onClick={() => handleZoom('minus')} />
          <InputNumber
            value={parseInt(scaleInputValue)}
            onChange={(value) => {
              if (value !== null && value >= 10 && value <= 250) {
                const newScale = value / 100;
                updateZoomLayer({ scale: newScale });
              }
            }}
            onBlur={() => {
              setScaleInputValue(scaleLabel.toString());
            }}
            min={10}
            max={250}
            style={{ width: 60 }}
            controls={false}
            formatter={(value) => `${value}%`}
            parser={(value) => parseInt(value?.replace('%', '') || '100')}
          />
          <Button icon={<Icon icon='mdi:magnify-plus' />} onClick={() => handleZoom('plus')} />
          <Button
            icon={<Icon icon='mdi:compress' />}
            onClick={() => handleZoom('fit')}
            title='自适应'>
            Fit
          </Button>

          <div className={styles.divider} />

          {/* 对齐 */}
          <Button
            icon={<Icon icon='mdi:format-align-left' />}
            onClick={() => handleAlign(AlignType.LEFT)}
            disabled={!canAlign}
            title='左对齐'
          />
          <Button
            icon={<Icon icon='mdi:format-align-center' />}
            onClick={() => handleAlign(AlignType.CENTER_X)}
            disabled={!canAlign}
            title='水平居中'
          />
          <Button
            icon={<Icon icon='mdi:format-align-right' />}
            onClick={() => handleAlign(AlignType.RIGHT)}
            disabled={!canAlign}
            title='右对齐'
          />
          <Button
            icon={<Icon icon='mdi:format-vertical-align-top' />}
            onClick={() => handleAlign(AlignType.TOP)}
            disabled={!canAlign}
            title='上对齐'
          />
          <Button
            icon={<Icon icon='mdi:format-vertical-align-center' />}
            onClick={() => handleAlign(AlignType.CENTER_Y)}
            disabled={!canAlign}
            title='垂直居中'
          />
          <Button
            icon={<Icon icon='mdi:format-vertical-align-bottom' />}
            onClick={() => handleAlign(AlignType.BOTTOM)}
            disabled={!canAlign}
            title='下对齐'
          />
        </div>

        <div className={styles['top-bar-right']}>
          {/* 导出 */}
          <Dropdown menu={{ items: exportImageMenuItems }} placement='bottomRight' arrow>
            <Button icon={<Icon icon='mdi:export' />}>导出</Button>
          </Dropdown>
          {/* 导入 */}
          <Button icon={<Icon icon='mdi:import' />} onClick={() => handleImportJson()}>
            导入
          </Button>
          {/* 保存 */}
          <Button icon={<Icon icon='mdi:content-save' />} type='primary' onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>

      {/* 导出图片Modal */}
      <Modal
        title='导出图片'
        open={exportImageModalOpen}
        onCancel={() => setExportImageModalOpen(false)}
        footer={null}
        maskClosable={true}
        width={660}>
        <div className={styles['export-modal-content']}>
          <div className={styles['export-preview']}>
            <img className={styles['export-image']} src={image} alt='预览' />
          </div>
          <div className={styles['export-config']}>
            <Form
              size='large'
              className={styles['export-form']}
              form={form}
              initialValues={{ pixelRatio: 1 }}>
              <Form.Item label='背景' name='background'>
                <Switch />
              </Form.Item>
              <Form.Item label='背景颜色'>
                <ColorPicker
                  value={backgroundColor}
                  onChange={(value) => {
                    setBackgroundColor(value);
                    setCanvasBackgroundColor(value);
                  }}
                />
              </Form.Item>
              <Form.Item label='像素比(清晰度)' name='pixelRatio'>
                <Segmented
                  options={[
                    { label: '1x', value: 1 },
                    { label: '2x', value: 2 },
                    { label: '3x', value: 3 },
                  ]}
                />
              </Form.Item>
            </Form>

            <div className={styles['export-operator']}>
              <Button
                icon={<Icon icon='mdi:file-image' />}
                type='primary'
                onClick={() => handleExportImage('png')}>
                PNG
              </Button>
              <Button
                icon={<Icon icon='mdi:file-image' />}
                type='primary'
                onClick={() => handleExportImage('jpg')}>
                JPG
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 导出JSON Modal */}
      <Modal
        title='导出JSON'
        open={exportJsonModalOpen}
        onOk={handleExportJson}
        onCancel={() => setExportJsonModalOpen(false)}
        okText='导出'
        cancelText='取消'>
        <p>将导出当前画布的所有配置和元素数据</p>
      </Modal>

      {/* 导入JSON Modal */}
      <Modal
        title='导入JSON'
        open={importJsonModalOpen}
        onOk={handleImportJson}
        onCancel={() => setImportJsonModalOpen(false)}
        okText='选择文件'
        cancelText='取消'>
        <p>导入后将完全替换当前画布内容</p>
      </Modal>
    </>
  );
}
