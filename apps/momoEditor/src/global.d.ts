import { Cmp } from '@momo/leafer-draw';
import { App } from 'leafer-ui';

declare global {
  interface Window {
    spuEditorApp: App | null;
    spuEditorCmpRenderMap: Map<string, Cmp>;
  }
}
