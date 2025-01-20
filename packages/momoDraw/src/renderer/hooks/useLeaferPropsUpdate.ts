import { UI } from 'leafer-ui';
import { useEffect } from 'react';
import { usePrevious } from 'react-use';
import { AnyObj } from '../../types';

export default function usePropsUpdate<T extends UI>(leaferInstance: T | undefined, props: AnyObj) {
  const lastProps = usePrevious(props) as AnyObj;

  useEffect(() => {
    if (!leaferInstance) return;

    for (const key in props) {
      if (lastProps[key] !== props[key]) {
        leaferInstance.setAttr(key, props[key]);
      }
    }
  }, [props, leaferInstance]);

  return null;
}
