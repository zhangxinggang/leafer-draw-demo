import { CmpRenderParams, cmpRender } from '@momo/leafer-draw';
import useBusinessStore from '../../store/business';

const renderView = (props: CmpRenderParams) => {
  cmpRender({ busData: useBusinessStore.getState(), ...props });
};

export { renderView };
