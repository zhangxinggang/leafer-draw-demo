import {
  IArrowType,
  IBlendMode,
  IPaint,
  IPathCommandData,
  IPointData,
  IShadowEffect,
} from 'leafer-ui';
import { AnyObj } from '.';

export interface CmpLeaferAttr {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface CmpBackendData {
  type?: CmpType; // 所有组件都有的属性
  sourceConnId?: string | undefined; // 连接线源节点ID
  targetConnId?: string | undefined; // 连接线目标节点ID
  rectGroupId?: string | undefined; // 矩形组ID
  rectGroupChildIds?: string[]; // 矩形组子元素ID
  connectorId?: string | undefined; // 连接线组ID
}

export interface Cmp {
  id: string;
  x?: number;
  /** y */
  y?: number;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 是否可编辑 */
  editable?: boolean;
  /** 是否可见 */
  visible?: boolean;
  /** 填充颜色 */
  fill?: string | IPaint | IPaint[];
  /** 描边 */
  stroke?: string | IPaint | IPaint[];
  /** 透明度 */
  opacity?: number;
  /** 外阴影 */
  shadow?: IShadowEffect | IShadowEffect[];
  /** 内阴影 */
  innerShadow?: IShadowEffect | IShadowEffect[];
  /** 混合模式 */
  blendMode?: IBlendMode;
  /** 旋转 */
  rotation?: number;
  /** 水平倾斜 */
  skewX?: number;
  /** 垂直倾斜 */
  skewY?: number;
  /** X 缩放 */
  scaleX?: number;
  /** Y 缩放 */
  scaleY?: number;
  /** 层叠顺序 */
  zIndex?: number;
  strokeWidth?: number;
  /** 点坐标（用于线条和箭头） */
  points?: number[] | IPointData[];
  text?: string;
  fontSize?: number;
  path?: string | IPathCommandData;
  autoHeight?: boolean;
  backendData?: CmpBackendData;
}

// 继承Cmp，但id必须存在
export interface CmpNeedId extends Partial<Cmp> {
  id: string;
}

export interface TextCmp extends Cmp {
  type: CmpType.Text;
  text: string;
  fontSize: number;
  fontFamily: string;
  autoHeight?: boolean;
}

export interface RectCmp extends Cmp {
  type: CmpType.Rect;
}

export interface EllipseCmp extends Cmp {
  type: CmpType.Ellipse;
}

export interface LineCmp extends Cmp {
  type: CmpType.Line;
  toPoint?: IPointData;
  points?: number[] | IPointData[];
}

export interface ArrowCmp extends Cmp {
  type: CmpType.Arrow;
  startArrow?: IArrowType;
  endArrow?: IArrowType;
  points?: number[] | IPointData[];
}

export interface ImageCmp extends Cmp {
  type: CmpType.Image;
  url: string;
}

export interface PathCmp extends Cmp {
  path?: string;
}

export interface PenCmp extends Cmp {
  path?: string | IPathCommandData;
}

export enum CmpType {
  Text,
  Rect,
  Ellipse,
  Line,
  Arrow,
  Image,
  Path,
  Pen,
  RectLine,
  LineRect,
  Connector,
  rectGroup,
}

export enum RenderType {
  ADD = 'ADD',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  MIXED = 'MIXED',
}

export interface RenderParams {
  cmp: CmpNeedId;
  type?: RenderType;
  busData?: AnyObj;
}

export interface UndoRedoState {
  type: RenderType;
  addCmps?: Cmp[];
  // 更新前的元素数据（用于撤销）
  updateOldCmps?: CmpNeedId[];
  // 更新后的元素数据（用于重做）
  updateNewCmps?: CmpNeedId[];
  deleteCmps?: Cmp[];
  // 操作时间戳（可选，用于调试）
  timestamp?: number;
}
