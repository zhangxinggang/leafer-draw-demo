import { Arrow } from '@leafer-in/arrow';
import { Box, Ellipse, Image, Path, PropertyEvent, Rect, Text } from '@leafer-ui/worker';
import { CmpType, RenderParams } from '../../types';
import commonGenerate from './common';
import connectorGenerate from './connector';
import rectGroupGenerate from './rectGroup';
import rectLineGenerate from './rectLine';

export const cmpRenderMapWorker: Record<string, (params: RenderParams) => void> = {
  [CmpType.Rect]: commonGenerate(Rect),
  [CmpType.RectLine]: rectLineGenerate({ Rect, Box, Text }),
  [CmpType.Text]: commonGenerate(Text),
  [CmpType.Ellipse]: commonGenerate(Ellipse),
  [CmpType.Line]: commonGenerate(Path),
  [CmpType.Arrow]: commonGenerate(Arrow),
  [CmpType.Image]: commonGenerate(Image),
  [CmpType.Path]: commonGenerate(Path),
  [CmpType.Pen]: commonGenerate(Path),
  [CmpType.Connector]: connectorGenerate({ PropertyEvent }),
  [CmpType.rectGroup]: rectGroupGenerate({ Ellipse, Rect, Text }),
};
