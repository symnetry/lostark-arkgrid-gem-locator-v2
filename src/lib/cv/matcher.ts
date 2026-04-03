import type { MinMaxLoc } from '@techstark/opencv-js';

import type { MatchingAtlas } from './atlas';
import { getCv } from './cvRuntime';
import type { CvMat, CvRect } from './types';

export type MatchingResult<K extends string> = {
  key: K;
  score: number;
  loc: { x: number; y: number };
  template: CvMat;
};

export function getBestMatchAtlas<K extends string>(
  frame: CvMat,
  matchingAtlas: MatchingAtlas<K>,
  roi?: CvRect
): MatchingResult<K> {
  const cv = getCv();
  const targetFrame = roi ? frame.roi(roi) : frame;
  if (targetFrame.cols > matchingAtlas.atlas.cols || targetFrame.rows > matchingAtlas.atlas.rows) {
    throw Error(
      `Input matrix(${targetFrame.cols}x${targetFrame.rows}) is larger than atlas(${matchingAtlas.atlas.cols}x${matchingAtlas.atlas.rows})`
    );
  }
  const { atlas, entries } = matchingAtlas;
  const result = new cv.Mat();
  cv.matchTemplate(frame, atlas, result, cv.TM_CCOEFF_NORMED);
  const mm = cv.minMaxLoc(result);
  for (const key of Object.keys(entries) as K[]) {
    const e = entries[key];
    if (mm.maxLoc.x > e.x && mm.maxLoc.x < e.x + e.width) {
      if (roi) targetFrame.delete();
      return {
        key,
        score: mm.maxVal,
        loc: { x: mm.maxLoc.x, y: mm.maxLoc.y },
        template: e.template,
      };
    }
  }
  if (roi) targetFrame.delete();
  throw Error('never reached');
}

export function getBestMatch<K extends string>(
  frame: CvMat,
  matchingAtlas: MatchingAtlas<K>,
  roi?: CvRect,
  option?: {
    method?: number;
    excludeKey?: K;
  }
): MatchingResult<K> | null {
  if (roi) {
    if (
      roi.x < 0 ||
      roi.x + roi.width > frame.cols ||
      roi.y < 0 ||
      roi.y + roi.height > frame.rows ||
      roi.width <= 0 ||
      roi.height <= 0
    ) {
      return null;
    }
  }
  const cv = getCv();
  const targetFrame = roi ? frame.roi(roi) : frame;

  let bestMm: MinMaxLoc | null = null;
  let bestKey: K | null = null;

  for (const key of Object.keys(matchingAtlas.entries) as K[]) {
    if (option?.excludeKey && key === option.excludeKey) continue;
    const template = matchingAtlas.entries[key].template;
    const result = new cv.Mat();
    // if (template.cols > targetFrame.cols && template.rows > targetFrame.rows) {
    //   // 지금은 둘 다 만족하는 경우, image와 templ을 서로 바꿔서 계산한다.
    //   throw Error(
    //     `Template size ${template.cols}x${template.rows} is larger than ROI ${targetFrame.cols}x${targetFrame.rows}. matchTemplate skipped.`
    //   );
    // }
    cv.matchTemplate(
      targetFrame,
      template,
      result,
      option?.method ? option.method : cv.TM_CCOEFF_NORMED
    );
    const mm = cv.minMaxLoc(result);
    if (!bestMm || mm.maxVal > bestMm.maxVal) {
      bestMm = mm;
      bestKey = key;
    }
    result.delete();
  }

  if (roi) targetFrame.delete();

  if (!bestMm || !bestKey) throw Error('matchingAtlas is empty');

  return {
    key: bestKey,
    score: bestMm.maxVal,
    loc: {
      x: roi ? roi.x + bestMm.maxLoc.x : bestMm.maxLoc.x,
      y: roi ? roi.y + bestMm.maxLoc.y : bestMm.maxLoc.y,
    },
    template: matchingAtlas.entries[bestKey].template,
  };
}

export function findLocation(frame: CvMat, template: CvMat, roi?: CvRect) {
  const cv = getCv();
  const targetFrame = roi ? frame.roi(roi) : frame;

  const result = new cv.Mat();
  cv.matchTemplate(targetFrame, template, result, cv.TM_CCOEFF_NORMED);
  const mm = cv.minMaxLoc(result);
  if (roi) targetFrame.delete();

  return {
    key: '',
    score: mm.maxVal,
    loc: {
      x: roi ? roi.x + mm.maxLoc.x : mm.maxLoc.x,
      y: roi ? roi.y + mm.maxLoc.y : mm.maxLoc.y,
    },
    template: template,
  };
}
