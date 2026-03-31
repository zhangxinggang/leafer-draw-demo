export const LARGE_SCENE_VERSION = 1 as const;
export const LARGE_SCENE_THRESHOLD = 10_000;

export interface LargeSceneBackground {
  type: 'png' | 'svg';
  url: string;
  opacity?: number;
}

export interface LargeRectGridScene {
  version: typeof LARGE_SCENE_VERSION;
  kind: 'rect-grid';
  id: string;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  originX: number;
  originY: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  textFill: string;
  textLines: string[];
  background?: LargeSceneBackground;
  createdAt: number;
}

export interface LargeRectGridSceneOptions {
  id?: string;
  columns: number;
  rows: number;
  cellWidth?: number;
  cellHeight?: number;
  originX?: number;
  originY?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  textFill?: string;
  textLines?: string[];
  background?: LargeSceneBackground;
}

export interface LargeSceneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const createSceneId = () =>
  `large-grid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createLargeRectGridScene = (
  options: LargeRectGridSceneOptions,
): LargeRectGridScene => {
  const cellWidth = Math.max(1, options.cellWidth ?? 100);
  const cellHeight = Math.max(1, options.cellHeight ?? 100);

  return {
    version: LARGE_SCENE_VERSION,
    kind: 'rect-grid',
    id: options.id ?? createSceneId(),
    columns: Math.max(1, Math.floor(options.columns)),
    rows: Math.max(1, Math.floor(options.rows)),
    cellWidth,
    cellHeight,
    originX: options.originX ?? -cellWidth / 2,
    originY: options.originY ?? -cellHeight / 2,
    fill: options.fill ?? 'rgba(255, 255, 255, 0.66)',
    stroke: options.stroke ?? '#505057',
    strokeWidth: Math.max(0, options.strokeWidth ?? 1),
    textFill: options.textFill ?? '#000000',
    textLines: options.textLines ?? [],
    background: options.background,
    createdAt: Date.now(),
  };
};

export const getLargeSceneCount = (scene: LargeRectGridScene) => scene.columns * scene.rows;

export const getLargeSceneBounds = (scene: LargeRectGridScene): LargeSceneBounds => ({
  x: scene.originX,
  y: scene.originY,
  width: scene.columns * scene.cellWidth,
  height: scene.rows * scene.cellHeight,
});
