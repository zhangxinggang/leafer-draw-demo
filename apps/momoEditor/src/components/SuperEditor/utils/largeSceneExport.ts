import type { LargeRectGridScene } from '@momo/leafer-draw/types/largeScene';
import { getLargeSceneBounds } from '@momo/leafer-draw/types/largeScene';

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const numberValue = (value: number) => Number(value.toFixed(4));

export const createLargeSceneSvg = (scene: LargeRectGridScene, backgroundColor: string) => {
  const bounds = getLargeSceneBounds(scene);
  const lineCount = Math.max(1, scene.textLines.length);
  const textAreaHeight = scene.cellHeight * 0.7;
  const lineHeight = textAreaHeight / lineCount;
  const fontSize = Math.max(4, Math.min(14, scene.cellWidth * 0.1, lineHeight * 0.78));
  const backgroundImage = scene.background?.url
    ? `<image href="${escapeXml(scene.background.url)}" x="0" y="0" width="${numberValue(
        scene.cellWidth,
      )}" height="${numberValue(scene.cellHeight)}" opacity="${numberValue(
        scene.background.opacity ?? 1,
      )}" preserveAspectRatio="xMidYMid slice" />`
    : '';
  const text = scene.textLines
    .map(
      (line, index) =>
        `<text x="10" y="${numberValue(
          scene.cellHeight * 0.15 + lineHeight * (index + 0.5),
        )}" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${numberValue(
          fontSize,
        )}" fill="${escapeXml(scene.textFill)}">${escapeXml(line)}</text>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${numberValue(
    bounds.width,
  )}" height="${numberValue(bounds.height)}" viewBox="${numberValue(bounds.x)} ${numberValue(
    bounds.y,
  )} ${numberValue(bounds.width)} ${numberValue(bounds.height)}">
  <rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(
    bounds.width,
  )}" height="${numberValue(bounds.height)}" fill="${escapeXml(backgroundColor)}" />
  <defs>
    <pattern id="large-grid-cell" x="${numberValue(scene.originX)}" y="${numberValue(
      scene.originY,
    )}" width="${numberValue(scene.cellWidth)}" height="${numberValue(
      scene.cellHeight,
    )}" patternUnits="userSpaceOnUse" viewBox="0 0 ${numberValue(
      scene.cellWidth,
    )} ${numberValue(scene.cellHeight)}" preserveAspectRatio="none">
      <rect x="0" y="0" width="${numberValue(scene.cellWidth)}" height="${numberValue(
        scene.cellHeight,
      )}" fill="${escapeXml(scene.fill)}" stroke="${escapeXml(
        scene.stroke,
      )}" stroke-width="${numberValue(scene.strokeWidth)}" />
      ${backgroundImage}
      ${text}
    </pattern>
  </defs>
  <rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(
    bounds.width,
  )}" height="${numberValue(bounds.height)}" fill="url(#large-grid-cell)" />
</svg>`;
};

export const downloadLargeSceneSvg = (
  scene: LargeRectGridScene,
  backgroundColor: string,
  filename: string,
) => {
  const blob = new Blob([createLargeSceneSvg(scene, backgroundColor)], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const captureLargeSceneViewport = () => {
  const gridCanvas = document.getElementById('large-scene-grid-canvas') as HTMLCanvasElement | null;
  const detailCanvas = document.getElementById(
    'large-scene-detail-canvas',
  ) as HTMLCanvasElement | null;
  if (!gridCanvas || !detailCanvas || !gridCanvas.width || !gridCanvas.height) return '';
  const canvas = document.createElement('canvas');
  canvas.width = gridCanvas.width;
  canvas.height = gridCanvas.height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.drawImage(gridCanvas, 0, 0);
  context.drawImage(detailCanvas, 0, 0);
  return canvas.toDataURL('image/png');
};
