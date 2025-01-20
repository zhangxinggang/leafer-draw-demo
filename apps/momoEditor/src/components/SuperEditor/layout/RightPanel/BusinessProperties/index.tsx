import { RenderType } from '@momo/leafer-draw';
import { isNotUndefined } from '@momo/leafer-draw/utils';
import { beforeAddRectGroupCheck, getNewRectGroupCmp } from '@momo/leafer-draw/utils/rectGroup';
import { Button, Col, Collapse, Form, Input, InputNumber, message, Row, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import ColorPicker from '../../../../ColorPicker';
import useBusinessStore from '../../../store/business';
import useModelStore from '../../../store/model';
import styles from './index.module.less';

export default function BusinessProperties() {
  const {
    businessConf,
    businessStyle,
    updateBusinessConf,
    updateBusinessStyle,
    updateRectGroupIds,
  } = useBusinessStore(
    useShallow((state) => ({
      businessConf: state.businessConf,
      businessStyle: state.businessStyle,
      updateBusinessConf: state.updateBusinessConf,
      updateBusinessStyle: state.updateBusinessStyle,
      updateRectGroupIds: state.updateRectGroupIds,
    })),
  );

  const { addCmps, selectCmpIds } = useModelStore(
    useShallow((state) => ({
      addCmps: state.addCmps,
      selectCmpIds: state.selectCmpIds,
    })),
  );

  // 本地状态用于临时存储输入值
  const [localConf, setLocalConf] = useState(businessConf);

  // 同步businessConf的变化到localConf
  useEffect(() => {
    setLocalConf(businessConf);
  }, [businessConf]);

  // 处理新增发送卡按钮点击
  const handleAddRectGroup = () => {
    const { overMaxArea, noCmps, width, height, x, y, rectGroupChildIds } = beforeAddRectGroupCheck(
      selectCmpIds,
      businessConf,
    );
    if (overMaxArea) {
      message.error('发送卡已超带载');
    }
    if (noCmps) {
      message.error('请选择接收卡');
    }
    if (width && height && isNotUndefined(x) && isNotUndefined(y)) {
      const cmp = getNewRectGroupCmp({
        x,
        y,
        width,
        height,
        rectGroupChildIds,
      });
      updateRectGroupIds([cmp.id], RenderType.ADD);
      addCmps([cmp]);
    }
  };

  const collapseItems = [
    {
      key: 'operation',
      label: '操作',
      children: (
        <Form.Item>
          <Tooltip title='请框选接收卡'>
            <Button type='primary' onClick={handleAddRectGroup}>
              新增发送卡
            </Button>
          </Tooltip>
        </Form.Item>
      ),
    },
    {
      key: 'device',
      label: '设备设置',
      children: (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label='单元板宽度'>
                <InputNumber
                  value={localConf.unitWidth}
                  onChange={(value) => {
                    setLocalConf({ ...localConf, unitWidth: value ?? 0 });
                  }}
                  onBlur={() => {
                    updateBusinessConf({ unitWidth: localConf.unitWidth });
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label='单元板高度'>
                <InputNumber
                  value={localConf.unitHeight}
                  onChange={(value) => {
                    setLocalConf({ ...localConf, unitHeight: value ?? 0 });
                  }}
                  onBlur={() => {
                    updateBusinessConf({ unitHeight: localConf.unitHeight });
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label='接收卡宽度'>
                <InputNumber
                  value={localConf.rectWidth}
                  onChange={(value) => {
                    setLocalConf({ ...localConf, rectWidth: value ?? 0 });
                  }}
                  onBlur={() => {
                    updateBusinessConf({ rectWidth: localConf.rectWidth });
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label='接收卡高度'>
                <InputNumber
                  value={localConf.rectHeight}
                  onChange={(value) => {
                    setLocalConf({ ...localConf, rectHeight: value ?? 0 });
                  }}
                  onBlur={() => {
                    updateBusinessConf({ rectHeight: localConf.rectHeight });
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label='分组限制宽度(万)'>
                <InputNumber
                  value={localConf.rectGroupLimitWidth / 10000}
                  onChange={(value) => {
                    const numValue = value ?? 0;
                    setLocalConf({
                      ...localConf,
                      rectGroupLimitWidth: Math.round(numValue * 10000),
                    });
                  }}
                  onBlur={() => {
                    updateBusinessConf({ rectGroupLimitWidth: localConf.rectGroupLimitWidth });
                  }}
                  precision={4}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label='分组限制高度(万)'>
                <InputNumber
                  value={localConf.rectGroupLimitHeight / 10000}
                  onChange={(value) => {
                    const numValue = value ?? 0;
                    setLocalConf({
                      ...localConf,
                      rectGroupLimitHeight: Math.round(numValue * 10000),
                    });
                  }}
                  onBlur={() => {
                    updateBusinessConf({ rectGroupLimitHeight: localConf.rectGroupLimitHeight });
                  }}
                  precision={4}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label='分组限制面积(万)'>
                <InputNumber
                  value={localConf.rectGroupLimitArea / 10000}
                  onChange={(value) => {
                    const numValue = value ?? 0;
                    setLocalConf({
                      ...localConf,
                      rectGroupLimitArea: Math.round(numValue * 10000),
                    });
                  }}
                  onBlur={() => {
                    updateBusinessConf({ rectGroupLimitArea: localConf.rectGroupLimitArea });
                  }}
                  precision={4}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label='矩形组名称'>
                <Input
                  value={localConf.rectGroupName}
                  onChange={(e) => {
                    setLocalConf({ ...localConf, rectGroupName: e.target.value });
                  }}
                  onBlur={() => {
                    updateBusinessConf({ rectGroupName: localConf.rectGroupName });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label='网线带载(万)'>
            <InputNumber
              value={localConf.connGroupLimit / 10000}
              onChange={(value) => {
                const numValue = value ?? 0;
                setLocalConf({ ...localConf, connGroupLimit: Math.round(numValue * 10000) });
              }}
              onBlur={() => {
                updateBusinessConf({ connGroupLimit: localConf.connGroupLimit });
              }}
              precision={4}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label='网口数量'>
            <InputNumber
              value={localConf.connGroupLimitNum}
              onChange={(value) => {
                setLocalConf({ ...localConf, connGroupLimitNum: value ?? 0 });
              }}
              onBlur={() => {
                updateBusinessConf({ connGroupLimitNum: localConf.connGroupLimitNum });
              }}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'style',
      label: '样式设置',
      children: (
        <>
          <Form.Item label='接收卡提醒颜色'>
            <ColorPicker
              value={businessStyle.tempReminderColor}
              onChange={(value) => {
                updateBusinessStyle({ tempReminderColor: value });
              }}
            />
          </Form.Item>
          <Form.Item label='接收卡边框颜色'>
            <ColorPicker
              value={businessStyle.rectBorderColor}
              onChange={(value) => {
                updateBusinessStyle({ rectBorderColor: value });
              }}
            />
          </Form.Item>
          <Form.Item label='发送卡颜色组'>
            <div className={styles['color-group']}>
              {businessStyle.rectGroupColors.map((color, index) => (
                <ColorPicker
                  key={index}
                  value={color}
                  onChange={(value) => {
                    const newColors = [...businessStyle.rectGroupColors];
                    newColors[index] = value;
                    updateBusinessStyle({ rectGroupColors: newColors });
                  }}
                />
              ))}
            </div>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label='超载颜色'>
                <ColorPicker
                  value={businessStyle.rectGroupOption.overloadColor}
                  onChange={(value) => {
                    updateBusinessStyle({
                      rectGroupOption: {
                        ...businessStyle.rectGroupOption,
                        overloadColor: value,
                      },
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label='填充颜色'>
                <ColorPicker
                  value={businessStyle.rectGroupOption.fill}
                  onChange={(value) => {
                    updateBusinessStyle({
                      rectGroupOption: {
                        ...businessStyle.rectGroupOption,
                        fill: value,
                      },
                    });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label='网线颜色组'>
            <div className={styles['color-group']}>
              {businessStyle.connGroupColors.map((color, index) => (
                <ColorPicker
                  key={index}
                  value={color}
                  onChange={(value) => {
                    const newColors = [...businessStyle.connGroupColors];
                    newColors[index] = value;
                    updateBusinessStyle({ connGroupColors: newColors });
                  }}
                />
              ))}
            </div>
          </Form.Item>
        </>
      ),
    },
  ];

  return (
    <div className={styles['business-properties']}>
      <Form layout='vertical' className={styles['properties-form']}>
        <Collapse items={collapseItems} defaultActiveKey={['operation']} />
      </Form>
    </div>
  );
}
