import { Arrow } from '@leafer-in/arrow';
import { Box, Ellipse, Group, Image, Path, PropertyEvent, Rect, Text } from '@leafer-ui/worker';
import type { RenderParams } from '../../types';
import { CmpType } from '../../types';
import commonGenerate from './common';
import connectorGenerate from './connector';
import rectGroupGenerate from './rectGroup';
import rectLineGenerate from './rectLine';

export const cmpRenderMapWorker: Record<string, (params: RenderParams) => void> = {
  [CmpType.Rect]: commonGenerate(Rect),
  [CmpType.RectLine]: rectLineGenerate({ Box, Text, PropertyEvent }),
  [CmpType.Text]: commonGenerate(Text),
  [CmpType.Ellipse]: commonGenerate(Ellipse),
  [CmpType.Line]: commonGenerate(Path),
  [CmpType.Arrow]: commonGenerate(Arrow),
  [CmpType.Image]: commonGenerate(Image),
  [CmpType.Path]: commonGenerate(Path),
  [CmpType.Pen]: commonGenerate(Path),
  [CmpType.Connector]: connectorGenerate({ Group, PropertyEvent }),
  [CmpType.rectGroup]: rectGroupGenerate({ Ellipse, Rect, Text }),
};
