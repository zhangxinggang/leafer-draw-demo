import { CmpType, RenderParams } from '../types';
import App from './app';
import Arrow from './components/arrow';
import Connector from './components/connector';
import Ellipse from './components/ellipse';
import Image from './components/image';
import Line from './components/line';
import Path from './components/path';
import Rect from './components/rect';
import RectGroup from './components/rectGroup';
import RectLine from './components/rectLine';
import Text from './components/text';

export { App, Arrow, Connector, Ellipse, Image, Line, Path, Rect, RectGroup, RectLine, Text };

export const cmpRenderMap: Record<string, (params: RenderParams) => void> = {
  [CmpType.Rect]: Rect,
  [CmpType.RectLine]: RectLine,
  [CmpType.Text]: Text,
  [CmpType.Ellipse]: Ellipse,
  [CmpType.Line]: Path,
  [CmpType.Arrow]: Arrow,
  [CmpType.Image]: Image,
  [CmpType.Path]: Path,
  [CmpType.Pen]: Path,
  [CmpType.Connector]: Connector,
  [CmpType.rectGroup]: RectGroup,
};

export type { IZoomLayer } from './app';
