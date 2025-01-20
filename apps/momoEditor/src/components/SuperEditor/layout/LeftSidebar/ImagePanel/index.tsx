import { Icon } from '@iconify/react';
import { generateCmp } from '@momo/leafer-draw/generator';
import { CmpType, ImageCmp } from '@momo/leafer-draw/types/cmp';
import { Button, Input, Select, message } from 'antd';
import classNames from 'classnames';
import React, { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useCanvasStore from '../../../store/canvas';
import useImageStore from '../../../store/image';
import useModelStore from '../../../store/model';
import styles from './index.module.less';

const { Search } = Input;

export default function ImagePanel() {
  const { addCmps } = useModelStore(
    useShallow((state) => ({
      addCmps: state.addCmps,
    })),
  );
  const { app, secondaryMenuWidth } = useCanvasStore(
    useShallow((state) => ({
      app: state.app,
      secondaryMenuWidth: state.secondaryMenuWidth,
    })),
  );
  const { zoomLayer } = useModelStore(
    useShallow((state) => ({
      zoomLayer: state.zoomLayer,
    })),
  );
  const {
    images,
    searchKeyword,
    selectedCategory,
    setSearchKeyword,
    setSelectedCategory,
    addImage,
    getFilteredImages,
    getCategories,
  } = useImageStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 计算画布中心点
  const getCanvasCenter = () => {
    if (!app) return { x: 400, y: 300 };
    const { x = 0, y = 0, scale = 1 } = zoomLayer || {};
    const appWidth = app.canvas.width;
    const appHeight = app.canvas.height;
    const centerX = ((appWidth - x) * scale) / 2;
    const centerY = ((appHeight - y) * scale) / 2;
    return { x: centerX, y: centerY };
  };

  // 双击添加到画布中心
  const handleDoubleClick = (image: { id: string; src: string }) => {
    const center = getCanvasCenter();
    const startX = center.x - 100;
    const startY = center.y - 100;
    const endX = center.x + 100;
    const endY = center.y + 100;

    const cmp = generateCmp(CmpType.Image, {
      startX,
      startY,
      endX,
      endY,
    }) as ImageCmp;
    if (cmp) {
      cmp.url = image.src;
    }

    if (cmp) {
      addCmps([cmp]);
    }
  };

  // 拖拽添加
  const handleDragStart = (e: React.DragEvent, image: { id: string; src: string }) => {
    e.dataTransfer.setData('imageSrc', image.src);
  };

  // 上传图片
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      addImage({
        name: '',
        src: base64String,
        category: '临时',
      });
      message.success('上传成功');
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredImages = getFilteredImages();
  const categories = ['全部', ...getCategories()];

  // 根据二级菜单宽度计算列数
  const getColumnsClass = () => {
    if (secondaryMenuWidth < 210) {
      return 'columns-1';
    } else if (secondaryMenuWidth < 315) {
      return 'columns-2';
    }
    return '';
  };

  return (
    <div className={styles['image-panel']}>
      <div className={styles['panel-title']}>图片</div>

      {/* 搜索和分类 */}
      <div className={styles['image-controls']}>
        <Search
          placeholder='搜索图片'
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <Select
          value={selectedCategory}
          onChange={setSelectedCategory}
          style={{ width: '100%' }}
          options={categories.map((cat) => ({ label: cat, value: cat }))}
        />
      </div>

      {/* 上传按钮 */}
      <Button
        icon={<Icon icon='mdi:upload' />}
        block
        style={{ marginBottom: 12 }}
        onClick={() => fileInputRef.current?.click()}>
        上传图片
      </Button>
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        style={{ display: 'none' }}
        onChange={handleUpload}
      />

      {/* 图片列表 */}
      <div className={classNames(styles['image-list'], styles[getColumnsClass()])}>
        {filteredImages.length === 0 ? (
          <div className={styles['empty-state']}>暂无图片</div>
        ) : (
          filteredImages.map((image) => (
            <div
              key={image.id}
              className={styles['image-item']}
              onDoubleClick={() => handleDoubleClick(image)}
              draggable
              onDragStart={(e) => handleDragStart(e, image)}>
              <img src={image.src} alt={image.name} className={styles['image-thumbnail']} />
              <div className={styles['image-name']}>{image.name}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
