import { Spin } from 'antd';
import React, { Suspense, useEffect, useState } from 'react';
import { initStorage } from '../store/engine';
import { MODELSTOREKEY } from '../utils/storage';
import styles from './index.module.less';

export default function Editor() {
  const [initialized, setInitialized] = useState(false);
  const LayoutComponent = React.lazy(() => import('../layout'));

  useEffect(() => {
    initStorage(MODELSTOREKEY);
    setInitialized(true);
  }, []);

  if (!initialized) return null;

  return (
    <Suspense
      fallback={
        <div className={styles.loading}>
          <Spin />
        </div>
      }>
      <LayoutComponent />
    </Suspense>
  );
}
