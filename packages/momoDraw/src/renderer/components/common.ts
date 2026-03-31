import type { UI } from 'leafer-ui';
import { createComponentRenderer } from '../utils/renderHelper';

export default function <T extends UI>(ComponentClass: new (props: any) => T) {
  return createComponentRenderer(ComponentClass);
}
