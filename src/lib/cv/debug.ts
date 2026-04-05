import type { MatchingResult } from './matcher';
import type { CvRect } from './types';

export function showMatch(
  debugCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined,
  roi: CvRect,
  matchingResult: MatchingResult<string>,
  option?: {
    rectColor?: string;
    rectLineWidth?: number;
    fontColor?: string;
    fontSize?: number;
    scoreThreshold?: number;
  }
) {
  if (!debugCtx) return;
  // 用于调试
  const rectLineWidth = option?.rectLineWidth ?? 1;
  debugCtx.lineWidth = rectLineWidth;

  // 1. 显示 roi
  debugCtx.lineWidth = 1;
  debugCtx.strokeStyle = 'white';
  debugCtx.strokeRect(roi.x, roi.y, roi.width, roi.height);

  // 显示检测到的区域
  const rect = {
    x: matchingResult.loc.x,
    y: matchingResult.loc.y,
    w: matchingResult.template.cols,
    h: matchingResult.template.rows,
  };
  if (option?.scoreThreshold) {
    debugCtx.strokeStyle = matchingResult.score > option.scoreThreshold ? 'green' : 'red';
  } else {
    debugCtx.strokeStyle = option?.rectColor ?? 'white';
  }
  debugCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  const fontSize = option?.fontSize ?? 12;
  debugCtx.font = `${fontSize}px Arial`; // 字体设置
  debugCtx.fillStyle = option?.fontColor ?? 'white';
  debugCtx.textBaseline = 'top'; // y 基准对齐到 rect.y
  const debugMsg = `${matchingResult.key} ${matchingResult.score.toFixed(2)}`;
  debugCtx.fillText(debugMsg, roi.x + rectLineWidth, roi.y + rectLineWidth);
}
