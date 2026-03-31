import type { LargeRectGridScene } from '../../types/largeScene';

export interface LargeSceneViewport {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  pixelRatio: number;
}

export interface LargeSceneRenderStats {
  backend: 'webgl2' | 'canvas2d';
  detailLevel: 'overview' | 'detail';
  visibleDetailCount: number;
}

interface ShaderLocations {
  resolution: WebGLUniformLocation;
  pixelRatio: WebGLUniformLocation;
  pan: WebGLUniformLocation;
  scale: WebGLUniformLocation;
  origin: WebGLUniformLocation;
  cell: WebGLUniformLocation;
  grid: WebGLUniformLocation;
  strokeWidth: WebGLUniformLocation;
  background: WebGLUniformLocation;
  fill: WebGLUniformLocation;
  stroke: WebGLUniformLocation;
}

const DETAIL_CELL_SIZE = 56;
const MAX_DETAIL_CELLS = 5_000;
const MAX_FALLBACK_PATTERN_SIZE = 2_048;
const colorCache = new Map<string, [number, number, number, number]>();

const vertexShaderSource = `#version 300 es
precision highp float;

const vec2 positions[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);

void main() {
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform vec2 u_pan;
uniform float u_scale;
uniform vec2 u_origin;
uniform vec2 u_cell;
uniform vec2 u_grid;
uniform float u_strokeWidth;
uniform vec4 u_background;
uniform vec4 u_fill;
uniform vec4 u_stroke;

out vec4 outColor;

vec4 over(vec4 top, vec4 bottom) {
  float alpha = top.a + bottom.a * (1.0 - top.a);
  if (alpha <= 0.0) return vec4(0.0);
  return vec4((top.rgb * top.a + bottom.rgb * bottom.a * (1.0 - top.a)) / alpha, alpha);
}

void main() {
  vec2 screen = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_pixelRatio;
  vec2 world = (screen - u_pan) / max(u_scale, 0.000001);
  vec2 relative = world - u_origin;
  vec2 index = floor(relative / u_cell);

  outColor = u_background;
  if (index.x < 0.0 || index.y < 0.0 || index.x >= u_grid.x || index.y >= u_grid.y) {
    return;
  }

  vec2 local = relative - index * u_cell;
  float projectedCell = min(u_cell.x, u_cell.y) * u_scale;

  if (projectedCell < 1.5) {
    float density = clamp(projectedCell / 1.5, 0.18, 1.0);
    outColor = over(vec4(u_stroke.rgb, u_stroke.a * density), u_background);
    return;
  }

  float edgeWorld = min(min(local.x, u_cell.x - local.x), min(local.y, u_cell.y - local.y));
  float edgePixels = edgeWorld * u_scale;
  float border = 1.0 - smoothstep(u_strokeWidth - 0.65, u_strokeWidth + 0.65, edgePixels);
  vec4 cellColor = mix(u_fill, u_stroke, border);
  outColor = over(cellColor, u_background);
}
`;

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('无法创建 WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || '未知 shader 编译错误';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

const createProgram = (gl: WebGL2RenderingContext) => {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();
  if (!program) throw new Error('无法创建 WebGL program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || '未知 program 链接错误';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
};

const getUniform = (gl: WebGL2RenderingContext, program: WebGLProgram, name: string) => {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`缺少 WebGL uniform: ${name}`);
  return location;
};

const parseCssColor = (value: string): [number, number, number, number] => {
  const cached = colorCache.get(value);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [0, 0, 0, 1];
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = '#000000';
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
  const color: [number, number, number, number] = [red / 255, green / 255, blue / 255, alpha / 255];
  colorCache.set(value, color);
  return color;
};

const truncateText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (context.measureText(text).width <= maxWidth) return text;
  const suffix = '...';
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (context.measureText(text.slice(0, middle) + suffix).width <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return text.slice(0, low) + suffix;
};

export class LargeRectGridRenderer {
  private readonly gridCanvas: HTMLCanvasElement;
  private readonly detailCanvas: HTMLCanvasElement;
  private readonly detailContext: CanvasRenderingContext2D;
  private readonly invalidate: () => void;
  private gl: WebGL2RenderingContext | null = null;
  private fallbackContext: CanvasRenderingContext2D | null = null;
  private program: WebGLProgram | null = null;
  private locations: ShaderLocations | null = null;
  private image: HTMLImageElement | null = null;
  private imageUrl = '';
  private destroyed = false;
  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.program = null;
    this.locations = null;
  };
  private readonly handleContextRestored = () => {
    if (this.destroyed || !this.gl) return;
    try {
      this.initWebGL(this.gl);
      this.invalidate();
    } catch (error) {
      console.warn('WebGL2 上下文恢复失败', error);
    }
  };

  constructor(
    gridCanvas: HTMLCanvasElement,
    detailCanvas: HTMLCanvasElement,
    invalidate: () => void,
  ) {
    this.gridCanvas = gridCanvas;
    this.detailCanvas = detailCanvas;
    this.invalidate = invalidate;
    gridCanvas.addEventListener('webglcontextlost', this.handleContextLost);
    gridCanvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    const detailContext = detailCanvas.getContext('2d');
    if (!detailContext) throw new Error('无法初始化大场景文字画布');
    this.detailContext = detailContext;

    try {
      this.gl = gridCanvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      if (this.gl) this.initWebGL(this.gl);
    } catch (error) {
      console.warn('WebGL2 初始化失败，使用 Canvas2D 回退', error);
      this.gl = null;
    }

    if (!this.gl) this.fallbackContext = gridCanvas.getContext('2d');
  }

  get backend(): LargeSceneRenderStats['backend'] {
    return this.gl ? 'webgl2' : 'canvas2d';
  }

  render(
    scene: LargeRectGridScene,
    viewport: LargeSceneViewport,
    backgroundColor: string,
  ): LargeSceneRenderStats {
    if (this.destroyed) {
      return { backend: this.backend, detailLevel: 'overview', visibleDetailCount: 0 };
    }
    this.resize(viewport);
    if (this.gl && this.program && this.locations) {
      this.renderWebGL(scene, viewport, backgroundColor);
    } else {
      this.renderFallback(scene, viewport, backgroundColor);
    }
    return this.renderDetails(scene, viewport);
  }

  destroy() {
    this.destroyed = true;
    this.gridCanvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.gridCanvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
    this.program = null;
    this.locations = null;
    this.image = null;
  }

  private initWebGL(gl: WebGL2RenderingContext) {
    const program = createProgram(gl);
    this.program = program;
    this.locations = {
      resolution: getUniform(gl, program, 'u_resolution'),
      pixelRatio: getUniform(gl, program, 'u_pixelRatio'),
      pan: getUniform(gl, program, 'u_pan'),
      scale: getUniform(gl, program, 'u_scale'),
      origin: getUniform(gl, program, 'u_origin'),
      cell: getUniform(gl, program, 'u_cell'),
      grid: getUniform(gl, program, 'u_grid'),
      strokeWidth: getUniform(gl, program, 'u_strokeWidth'),
      background: getUniform(gl, program, 'u_background'),
      fill: getUniform(gl, program, 'u_fill'),
      stroke: getUniform(gl, program, 'u_stroke'),
    };
    gl.useProgram(program);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  private resize(viewport: LargeSceneViewport) {
    const width = Math.max(1, Math.round(viewport.width * viewport.pixelRatio));
    const height = Math.max(1, Math.round(viewport.height * viewport.pixelRatio));
    if (this.gridCanvas.width !== width || this.gridCanvas.height !== height) {
      this.gridCanvas.width = width;
      this.gridCanvas.height = height;
    }
    if (this.detailCanvas.width !== width || this.detailCanvas.height !== height) {
      this.detailCanvas.width = width;
      this.detailCanvas.height = height;
    }
  }

  private renderWebGL(
    scene: LargeRectGridScene,
    viewport: LargeSceneViewport,
    backgroundColor: string,
  ) {
    const gl = this.gl!;
    const locations = this.locations!;
    gl.viewport(0, 0, this.gridCanvas.width, this.gridCanvas.height);
    gl.useProgram(this.program);
    gl.uniform2f(locations.resolution, this.gridCanvas.width, this.gridCanvas.height);
    gl.uniform1f(locations.pixelRatio, viewport.pixelRatio);
    gl.uniform2f(locations.pan, viewport.x, viewport.y);
    gl.uniform1f(locations.scale, viewport.scale);
    gl.uniform2f(locations.origin, scene.originX, scene.originY);
    gl.uniform2f(locations.cell, scene.cellWidth, scene.cellHeight);
    gl.uniform2f(locations.grid, scene.columns, scene.rows);
    gl.uniform1f(locations.strokeWidth, scene.strokeWidth);
    gl.uniform4fv(locations.background, parseCssColor(backgroundColor));
    gl.uniform4fv(locations.fill, parseCssColor(scene.fill));
    gl.uniform4fv(locations.stroke, parseCssColor(scene.stroke));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private renderFallback(
    scene: LargeRectGridScene,
    viewport: LargeSceneViewport,
    backgroundColor: string,
  ) {
    const context = this.fallbackContext;
    if (!context) return;
    const { pixelRatio } = viewport;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, viewport.width, viewport.height);

    const cellWidth = scene.cellWidth * viewport.scale;
    const cellHeight = scene.cellHeight * viewport.scale;
    const left = viewport.x + scene.originX * viewport.scale;
    const top = viewport.y + scene.originY * viewport.scale;
    const width = scene.columns * cellWidth;
    const height = scene.rows * cellHeight;

    context.save();
    context.beginPath();
    context.rect(left, top, width, height);
    context.clip();

    if (Math.min(cellWidth, cellHeight) < 1.5) {
      context.globalAlpha = Math.max(0.2, Math.min(1, Math.min(cellWidth, cellHeight) / 1.5));
      context.fillStyle = scene.stroke;
      context.fillRect(left, top, width, height);
      context.restore();
      return;
    }

    const tileWidth = Math.ceil(cellWidth * pixelRatio);
    const tileHeight = Math.ceil(cellHeight * pixelRatio);
    if (tileWidth <= MAX_FALLBACK_PATTERN_SIZE && tileHeight <= MAX_FALLBACK_PATTERN_SIZE) {
      const tile = document.createElement('canvas');
      tile.width = Math.max(1, tileWidth);
      tile.height = Math.max(1, tileHeight);
      const tileContext = tile.getContext('2d');
      if (tileContext) {
        tileContext.scale(pixelRatio, pixelRatio);
        tileContext.fillStyle = scene.fill;
        tileContext.fillRect(0, 0, cellWidth, cellHeight);
        tileContext.strokeStyle = scene.stroke;
        tileContext.lineWidth = scene.strokeWidth;
        tileContext.strokeRect(0, 0, cellWidth, cellHeight);
        const pattern = context.createPattern(tile, 'repeat');
        if (pattern) {
          context.translate(left, top);
          context.fillStyle = pattern;
          context.fillRect(0, 0, width, height);
        }
      }
    } else {
      const startColumn = Math.max(0, Math.floor(-left / cellWidth));
      const endColumn = Math.min(scene.columns - 1, Math.ceil((viewport.width - left) / cellWidth));
      const startRow = Math.max(0, Math.floor(-top / cellHeight));
      const endRow = Math.min(scene.rows - 1, Math.ceil((viewport.height - top) / cellHeight));
      context.fillStyle = scene.fill;
      context.strokeStyle = scene.stroke;
      context.lineWidth = scene.strokeWidth;
      for (let column = startColumn; column <= endColumn; column += 1) {
        for (let row = startRow; row <= endRow; row += 1) {
          const x = left + column * cellWidth;
          const y = top + row * cellHeight;
          context.fillRect(x, y, cellWidth, cellHeight);
          context.strokeRect(x, y, cellWidth, cellHeight);
        }
      }
    }
    context.restore();
  }

  private renderDetails(
    scene: LargeRectGridScene,
    viewport: LargeSceneViewport,
  ): LargeSceneRenderStats {
    const context = this.detailContext;
    const { pixelRatio, scale } = viewport;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);

    const projectedWidth = scene.cellWidth * scale;
    const projectedHeight = scene.cellHeight * scale;
    if (Math.min(projectedWidth, projectedHeight) < DETAIL_CELL_SIZE) {
      return { backend: this.backend, detailLevel: 'overview', visibleDetailCount: 0 };
    }

    const leftWorld = (0 - viewport.x) / scale;
    const topWorld = (0 - viewport.y) / scale;
    const rightWorld = (viewport.width - viewport.x) / scale;
    const bottomWorld = (viewport.height - viewport.y) / scale;
    const startColumn = Math.max(0, Math.floor((leftWorld - scene.originX) / scene.cellWidth));
    const endColumn = Math.min(
      scene.columns - 1,
      Math.floor((rightWorld - scene.originX) / scene.cellWidth),
    );
    const startRow = Math.max(0, Math.floor((topWorld - scene.originY) / scene.cellHeight));
    const endRow = Math.min(
      scene.rows - 1,
      Math.floor((bottomWorld - scene.originY) / scene.cellHeight),
    );
    const visibleColumns = Math.max(0, endColumn - startColumn + 1);
    const visibleRows = Math.max(0, endRow - startRow + 1);
    const visibleCount = visibleColumns * visibleRows;
    if (!visibleCount || visibleCount > MAX_DETAIL_CELLS) {
      return { backend: this.backend, detailLevel: 'overview', visibleDetailCount: 0 };
    }

    this.ensureBackgroundImage(scene);
    context.setTransform(
      pixelRatio * scale,
      0,
      0,
      pixelRatio * scale,
      pixelRatio * viewport.x,
      pixelRatio * viewport.y,
    );

    const lineCount = Math.max(1, scene.textLines.length);
    const textAreaHeight = scene.cellHeight * 0.7;
    const lineHeight = textAreaHeight / lineCount;
    const fontSize = Math.max(4, Math.min(14, scene.cellWidth * 0.1, lineHeight * 0.78));
    context.font = `${fontSize}px Arial, sans-serif`;
    context.textBaseline = 'middle';
    context.textAlign = 'left';
    context.fillStyle = scene.textFill;
    const maxTextWidth = Math.max(1, scene.cellWidth - 20);
    const textLines = scene.textLines.map((text) => truncateText(context, text, maxTextWidth));

    for (let column = startColumn; column <= endColumn; column += 1) {
      const x = scene.originX + column * scene.cellWidth;
      for (let row = startRow; row <= endRow; row += 1) {
        const y = scene.originY + row * scene.cellHeight;
        if (this.image?.complete && this.image.naturalWidth) {
          context.save();
          context.globalAlpha = scene.background?.opacity ?? 1;
          context.drawImage(this.image, x, y, scene.cellWidth, scene.cellHeight);
          context.restore();
        }
        textLines.forEach((text, index) => {
          context.fillText(
            text,
            x + 10,
            y + scene.cellHeight * 0.15 + lineHeight * (index + 0.5),
            maxTextWidth,
          );
        });
      }
    }

    return { backend: this.backend, detailLevel: 'detail', visibleDetailCount: visibleCount };
  }

  private ensureBackgroundImage(scene: LargeRectGridScene) {
    const url = scene.background?.url || '';
    if (url === this.imageUrl) return;
    this.imageUrl = url;
    this.image = null;
    if (!url) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (this.imageUrl === url) {
        this.image = image;
        this.invalidate();
      }
    };
    image.onerror = () => {
      if (this.imageUrl === url) console.warn(`大场景背景图片加载失败: ${url}`);
    };
    image.src = url;
  }
}
