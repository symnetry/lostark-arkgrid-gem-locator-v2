import type { CV } from '@techstark/opencv-js';

import type { GemRecognitionLocale } from '../constants/enums';
import { type ArkGridGem, determineGemGradeByGem } from '../models/arkGridGems';
import type { MatchingAtlas } from './atlas';
import { getCv, initOpenCv } from './cvRuntime';
import { showMatch } from './debug';
import { type KeyOptionLevel, type KeyOptionString, loadGemAsset } from './matStore';
import { type MatchingResult, getBestMatch } from './matcher';
import type { CaptureWorkerRequest, CaptureWorkerResponse, CvMat } from './types';

type RecgonitionTarget<K extends string> = {
  roi: {
    // 전체 frame에서 탐색 대상 roi
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // 사용할 atlas
  atlas: MatchingAtlas<K>;
  threshold: number;
};

type RecognitionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RecognitionLayout = {
  gemAttr: RecognitionRect;
  row: {
    x: number;
    y: number;
    stepY: number;
  };
  gemName: RecognitionRect;
  willPower: RecognitionRect;
  corePoint: RecognitionRect;
  optionName: RecognitionRect;
  optionLevel: {
    gapX: number;
    fallbackX: number;
    width: number;
    height: number;
  };
  optionYOffset: {
    top: number;
    bottom: number;
  };
};

class FrameProcessor {
  // init
  private loadedAsset: Awaited<ReturnType<typeof loadGemAsset>> | null = null;
  private initPromise: Promise<void> | null = null;

  // debug
  debugCanvas: OffscreenCanvas = new OffscreenCanvas(0, 0);
  private frameTimes: number[] = [];

  // frame
  private canvas: OffscreenCanvas = new OffscreenCanvas(0, 0);
  private ctx: OffscreenCanvasRenderingContext2D;
  private cv: CV | null = null;
  private previousInfo: {
    locale: GemRecognitionLocale;
    anchorLoc: { x: number; y: number };
  } | null = null;
  private thresholdSet = {
    anchor: 0.95,
    gemAttr: 0.8,
    gemImage: 0.8,
    willPower: 0.8,
    corePoint: 0.8,
    optionName: 0.8,
    optionLevel: 0.8,
  };
  constructor() {
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D context not available!');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  private getDefaultRecognitionLayout(): RecognitionLayout {
    return {
      gemAttr: { x: -186, y: 91, width: 224, height: 32 },
      row: { x: -287, y: 213, stepY: 63 },
      gemName: { x: 9, y: 14, width: 30, height: 30 },
      willPower: { x: 65, y: 0, width: 18, height: 30 },
      corePoint: { x: 65, y: 30, width: 18, height: 30 },
      optionName: { x: 125, y: 0, width: 200, height: 30 },
      optionLevel: { gapX: 16, fallbackX: 60, width: 48, height: 30 },
      optionYOffset: { top: 0, bottom: 30 },
    };
  }

  private getZhCnRecognitionLayout(): RecognitionLayout {
    return {
      gemAttr: { x: -190, y: 88, width: 236, height: 36 },
      row: { x: -287, y: 213, stepY: 63 },
      gemName: { x: 2, y: 8, width: 42, height: 42 },
      willPower: { x: 62, y: -2, width: 24, height: 32 },
      corePoint: { x: 62, y: 28, width: 24, height: 32 },
      optionName: { x: 118, y: -2, width: 220, height: 34 },
      optionLevel: { gapX: -2, fallbackX: 46, width: 56, height: 34 },
      optionYOffset: { top: 0, bottom: 30 },
    };
  }

  private getRuCnRecognitionLayout(): RecognitionLayout {
    return {
      gemAttr: { x: -190, y: 88, width: 236, height: 36 },
      row: { x: -287, y: 213, stepY: 63 },
      gemName: { x: 2, y: 8, width: 42, height: 42 },
      willPower: { x: 62, y: -2, width: 24, height: 32 },
      corePoint: { x: 62, y: 28, width: 24, height: 32 },
      optionName: { x: 118, y: -2, width: 220, height: 34 },
      optionLevel: { gapX: 14, fallbackX: 72, width: 64, height: 34 },
      optionYOffset: { top: 0, bottom: 30 },
    };
  }

  private getRecognitionLayout(locale: GemRecognitionLocale): RecognitionLayout {
    if (locale === 'zh_cn') return this.getZhCnRecognitionLayout();
    if (locale === 'ru_cn') return this.getRuCnRecognitionLayout();
    return this.getDefaultRecognitionLayout();
  }

  private getOptionLevelXOffset(
    layout: RecognitionLayout,
    optionNameRoi: RecognitionRect,
    optionName: MatchingResult<KeyOptionString> | null
  ) {
    if (!optionName) return layout.optionLevel.fallbackX;

    const optionNameXOffset = optionName.loc.x - optionNameRoi.x + optionName.template.cols;
    return optionNameXOffset + layout.optionLevel.gapX;
  }

  private getOptionLevelThreshold(locale: GemRecognitionLocale, detectionMargin: number) {
    if (locale === 'zh_cn') {
      return 0.72 - detectionMargin;
    }
    return this.thresholdSet.optionLevel - detectionMargin;
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }
    // Q. 두 개의 흐름이 동시에 여기 도착하면?
    // A. JS/Worker는 단일 스레드이며,
    //    첫 await 이전의 동기 코드는 중단되지 않고 원자적으로 실행된다
    this.initPromise = (async () => {
      await initOpenCv();
      this.cv = getCv();
      if (!this.loadedAsset) {
        this.loadedAsset = await loadGemAsset();
      }
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  adjustResolution(height: number) {
    let resolutionScale = 1;
    let expectedResolution = 'FHD';
    // 윈도우 타이틀 바 높이는 32px정도라고 함
    if (height < 1080) {
      // FHD 미만인 경우, FHD로 늘림
      resolutionScale = 1080 / (height - 27); // 윈도우 10 기준 실제로 27px
      expectedResolution = `(경고) FHD 미만`;
    } else if (height >= 1080 && height <= 1080 + 48) {
      // FHD, UWFHD의 경우 그대로 사용
    } else if (height >= 1440 && height <= 1440 + 48) {
      // QHD, UWQHD의 경우 해상도 3/4배
      resolutionScale = 3 / 4;
      expectedResolution = 'QHD';
    } else if (height >= 2160 && height <= 2160 + 48) {
      // UHD의 경우 해상도 1/2배
      resolutionScale = 1 / 2;
      expectedResolution = 'UHD';
    } else {
      // ? FHD 그대로 사용
      expectedResolution = '(경고) Unknown';
    }
    return {
      resolutionScale,
      expectedResolution,
    };
  }

  findBest<K extends string>(
    t: RecgonitionTarget<K>,
    frame: CvMat,
    debugCtx?: OffscreenCanvasRenderingContext2D | null,
    option?: {
      method?: number;
      excludeKey?: K;
    }
  ): MatchingResult<K> | null {
    // 주어진 target을 찾고
    if (!this.cv) throw Error('cv is not ready');
    const roi = new this.cv.Rect(t.roi.x, t.roi.y, t.roi.width, t.roi.height);
    const match = getBestMatch(frame, t.atlas, roi, option);
    if (!match) return null;
    if (debugCtx) {
      showMatch(debugCtx, roi, match, {
        scoreThreshold: t.threshold,
      });
    }
    if (match.score > t.threshold) return match;
    return null;
  }

  processFrame(
    frame: VideoFrame,
    drawDebug: boolean = false,
    detectionMargin: number = 0,
    recognitionLocale: GemRecognitionLocale
  ) {
    const start = performance.now();
    const canvas = this.canvas;
    const ctx = this.ctx;
    let resizedFrame: CvMat | null = null;
    let debugCtx: OffscreenCanvasRenderingContext2D | null = null;
    const cv = this.cv;
    if (!cv) return;

    try {
      if (!this.loadedAsset) return;
      const { resolutionScale, expectedResolution } = this.adjustResolution(frame.displayHeight);
      canvas.width = frame.displayWidth * resolutionScale;
      canvas.height = frame.displayHeight * resolutionScale;
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resizedFrame = cv.matFromImageData(imageData);
      cv.cvtColor(resizedFrame, resizedFrame, cv.COLOR_RGBA2GRAY);
      if (resolutionScale != 1) {
        // 자체적으로 downscale을 할 땐 추가 margin 부여
        detectionMargin += 0.1;
      }
      if (drawDebug) {
        this.debugCanvas.width = frame.displayWidth * resolutionScale;
        this.debugCanvas.height = frame.displayHeight * resolutionScale;

        debugCtx = this.debugCanvas.getContext('2d');
        if (debugCtx) {
          debugCtx?.drawImage(frame, 0, 0, this.debugCanvas.width, this.debugCanvas.height);
          debugCtx.font = `40px Arial`;
          debugCtx.fillStyle = 'white';
          debugCtx.strokeStyle = 'black'; // 테두리 색
          debugCtx.lineWidth = 10 * resolutionScale; // 테두리 두께
          let x = 25;
          let y = 100;
          // 테두리 먼저 그리고 흰 글씨 채우기
          let msg = `Resolution: ${expectedResolution} (${frame.displayWidth}x${frame.displayHeight})`;
          debugCtx.strokeText(msg, x, y);
          debugCtx.fillText(msg, x, y);
          y += 40;

          msg = `FPS: ${(1000 / (this.frameTimes.reduce((acc, v) => acc + v, 0) / this.frameTimes.length)).toFixed(2)}`;
          debugCtx.strokeText(msg, x, y);
          debugCtx.fillText(msg, x, y);
          y += 40;

          debugCtx.font = '20px Arial';
          msg = 'OpenCV Matching Threshold';
          debugCtx.strokeText(msg, x, y);
          debugCtx.fillText(msg, x, y);
          y += 20;
          for (const [key, value] of Object.entries(this.thresholdSet)) {
            const msg = `${key}: ${(value - detectionMargin).toFixed(2)}`;
            debugCtx.strokeText(msg, x, y);
            debugCtx.fillText(msg, x, y);
            y += 20;
          }
        }
      }

      // 1. anchor 찾기
      if (this.previousInfo && this.previousInfo.locale !== recognitionLocale) {
        this.previousInfo = null;
      }

      const currentAnchorAtlas = this.loadedAsset.atlasAnchorByLocale[recognitionLocale];
      const currentAnchorEntry = currentAnchorAtlas.entries[recognitionLocale];
      const roiAnchor = this.previousInfo
        ? {
            x: this.previousInfo.anchorLoc.x,
            y: this.previousInfo.anchorLoc.y,
            width: currentAnchorEntry.width,
            height: currentAnchorEntry.height,
          }
        : { x: canvas.width / 2, y: 0, width: canvas.width / 2, height: canvas.height / 2 };
      const anchor = this.findBest(
        {
          roi: roiAnchor,
          atlas: currentAnchorAtlas,
          threshold: this.thresholdSet.anchor - detectionMargin,
        },
        resizedFrame,
        debugCtx
      );
      if (!anchor) {
        this.previousInfo = null;
        return;
      }

      this.previousInfo = {
        locale: recognitionLocale,
        anchorLoc: {
          x: anchor.loc.x,
          y: anchor.loc.y,
        },
      };

      const currentLocale = this.previousInfo.locale;
      const anchorX = this.previousInfo.anchorLoc.x;
      const anchorY = this.previousInfo.anchorLoc.y;
      const layout = this.getRecognitionLayout(currentLocale);

      //2 질서 혹은 혼돈 문구 탐색
      const gemAttr = this.findBest(
        {
          roi: {
            x: anchorX + layout.gemAttr.x,
            y: anchorY + layout.gemAttr.y,
            width: layout.gemAttr.width,
            height: layout.gemAttr.height,
          },
          atlas: this.loadedAsset.atlasGemAttr[currentLocale],
          threshold: this.thresholdSet.gemAttr - detectionMargin,
        },
        resizedFrame,
        debugCtx
      );
      if (!gemAttr) return;

      // 5. 9개의 젬을 찾아서 이미지 매칭
      const currentGems: ArkGridGem[] = [];
      for (let i = 0; i < 9; i++) {
        const rowX = anchorX + layout.row.x;
        const rowY = anchorY + layout.row.y + layout.row.stepY * i;

        // 1) 젬 종류 (이름)
        const gemName = this.findBest(
          {
            roi: {
              x: rowX + layout.gemName.x,
              y: rowY + layout.gemName.y,
              width: layout.gemName.width,
              height: layout.gemName.height,
            },
            atlas: this.loadedAsset.altasGemImage[currentLocale],
            threshold: this.thresholdSet.gemImage - detectionMargin,
          },
          resizedFrame,
          debugCtx
        );

        // 2) 의지력
        const willPower = this.findBest(
          {
            roi: {
              x: rowX + layout.willPower.x,
              y: rowY + layout.willPower.y,
              width: layout.willPower.width,
              height: layout.willPower.height,
            },
            atlas: this.loadedAsset.atlasWillPower[currentLocale],
            threshold: this.thresholdSet.willPower - detectionMargin,
          },
          resizedFrame,
          debugCtx
        );

        // 3) 질서/혼돈 포인트
        const corePoint = this.findBest(
          {
            roi: {
              x: rowX + layout.corePoint.x,
              y: rowY + layout.corePoint.y,
              width: layout.corePoint.width,
              height: layout.corePoint.height,
            },
            atlas: this.loadedAsset.atlasCorePoint[currentLocale],
            threshold: this.thresholdSet.corePoint - detectionMargin,
          },
          resizedFrame,
          debugCtx
        );

        // 4) 젬 옵션 추출
        type GemOptionResult = {
          optionName: MatchingResult<KeyOptionString> | null;
          optionLevel: MatchingResult<KeyOptionLevel> | null;
          yOffset: number;
        };
        const optionTop: GemOptionResult = {
          optionName: null,
          optionLevel: null,
          yOffset: layout.optionYOffset.top,
        };
        const optionBottom: GemOptionResult = {
          optionName: null,
          optionLevel: null,
          yOffset: layout.optionYOffset.bottom,
        };

        for (const targetOption of [optionTop, optionBottom]) {
          // 옵션 이름
          const optionNameRoi = {
            x: rowX + layout.optionName.x,
            y: rowY + layout.optionName.y + targetOption.yOffset,
            width: layout.optionName.width,
            height: layout.optionName.height,
          };
          let optionName = this.findBest(
            {
              roi: optionNameRoi,
              atlas: this.loadedAsset.atlasOptionName[currentLocale],
              threshold: this.thresholdSet.optionName - detectionMargin,
            },
            resizedFrame,
            currentLocale === 'ru_ru' ? null : debugCtx
          );

          // ru_ru의 경우, "공격력"이 "아군 공격 강화" 문자열에서 캡쳐됨
          if (optionName !== null && currentLocale === 'ru_ru' && optionName.key === '공격력') {
            // 따라서 "공격력"이 없는 atlas에서 다시 한 번 확인
            const tempOptionName = this.findBest(
              {
                roi: optionNameRoi,
                atlas: this.loadedAsset.atlasOptionName[currentLocale],
                threshold: this.thresholdSet.optionName - detectionMargin,
              },
              resizedFrame,
              null,
              {
                excludeKey: '공격력',
              }
            );
            if (tempOptionName) {
              optionName = tempOptionName;
            }
          }

          if (currentLocale === 'ru_ru') {
            if (debugCtx && optionName) {
              showMatch(debugCtx, optionNameRoi, optionName, {
                scoreThreshold: this.thresholdSet.optionName - detectionMargin,
              });
            }
          }

          const optionLevelXOffset = this.getOptionLevelXOffset(layout, optionNameRoi, optionName);

          const optionLevel = this.findBest(
            {
              roi: {
                x: rowX + layout.optionName.x + optionLevelXOffset,
                y: rowY + layout.optionName.y + targetOption.yOffset,
                width: layout.optionLevel.width,
                height: layout.optionLevel.height,
              },
              atlas: this.loadedAsset.atlasOptionLevel[currentLocale],
              threshold: this.getOptionLevelThreshold(currentLocale, detectionMargin),
            },
            resizedFrame,
            debugCtx
          );

          targetOption.optionName = optionName;
          targetOption.optionLevel = optionLevel;
        }

        if (
          gemName !== null &&
          willPower !== null &&
          corePoint !== null &&
          optionTop.optionName !== null &&
          optionTop.optionLevel !== null &&
          optionBottom.optionName !== null &&
          optionBottom.optionLevel !== null
        ) {
          const gem: ArkGridGem = {
            gemAttr: gemAttr.key,
            name: gemName.key,
            req: Number(willPower.key),
            point: Number(corePoint.key),
            option1: {
              optionType: optionTop.optionName.key,
              value: Number(optionTop.optionLevel.key),
            },
            option2: {
              optionType: optionBottom.optionName.key,
              value: Number(optionBottom.optionLevel.key),
            },
          };
          gem.grade = determineGemGradeByGem(gem);
          currentGems.push(gem);
        }
      }
      return { locale: currentLocale, gemAttr: gemAttr.key, gems: currentGems };
      // ... 그 외 인식
      // return 인식된 객체들
    } finally {
      if (resizedFrame) resizedFrame.delete();
      frame.close();
      this.frameTimes.push(performance.now() - start);
      if (this.frameTimes.length > 10) this.frameTimes.shift();
    }
  }
}

function postToMain(msg: CaptureWorkerResponse) {
  self.postMessage(msg);
}
const processor = new FrameProcessor(); // singleton

self.onmessage = async (e: MessageEvent<CaptureWorkerRequest>) => {
  const data = e.data;
  switch (data.type) {
    case 'init':
      // 초기화 요청
      try {
        await processor.init();
        postToMain({ type: 'init:done' });
      } catch {
        postToMain({ type: 'init:error' });
      }
      break;

    case 'frame':
      // 프레임 분석 요청
      const result = processor.processFrame(
        data.frame,
        data.drawDebug,
        data.detectionMargin,
        data.recognitionLocale
      );
      postToMain({
        type: 'frame:done',
        result,
      });
      if (data.drawDebug) {
        postToMain({
          type: 'debug',
          image: processor.debugCanvas.transferToImageBitmap(),
        });
      }
      break;
  }
};
