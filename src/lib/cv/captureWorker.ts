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
    gemImage: 0.72,
    willPower: 0.65,   // 意志力阈值降低(单数字3-6，匹配难度大，失败时用默认值兜底)
    corePoint: 0.8,
    optionName: 0.8,
    optionLevel: 0.8,
  };

  /** dHash 复用缓冲区（避免每帧 new Array(4096)） */
  private _dHashBuffer: Float64Array = new Float64Array(64 * 64);
  constructor() {
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D context not available!');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  /** 清理所有 OpenCV 资源和 Canvas 引用，释放 WASM 堆内存 */
  destroy() {
    // 释放所有 atlas 的 cv.Mat（每组语言 × 6类 atlas）
    if (this.loadedAsset) {
      const { atlasAnchorByLocale, atlasGemAttr, altasGemImage, atlasWillPower, atlasCorePoint, atlasOptionName, atlasOptionLevel } = this.loadedAsset;
      for (const atlas of Object.values(atlasAnchorByLocale)) { atlas.atlas.delete(); }
      for (const atlas of Object.values(atlasGemAttr)) { atlas.atlas.delete(); }
      for (const atlas of Object.values(altasGemImage)) { atlas.atlas.delete(); }
      for (const atlas of Object.values(atlasWillPower)) { atlas.atlas.delete(); }
      for (const atlas of Object.values(atlasCorePoint)) { atlas.atlas.delete(); }
      for (const atlas of Object.values(atlasOptionName)) { atlas.atlas.delete(); }
      for (const atlas of Object.values(atlasOptionLevel)) { atlas.atlas.delete(); }
      this.loadedAsset = null;
    }
    // 置空状态引用，让 GC 回收 Canvas 和 Mat
    this.previousInfo = null;
    this.cv = null;
    this.frameTimes.length = 0;
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
      optionName: { x: 118, y: 2, width: 260, height: 34 },
      optionLevel: { gapX: -2, fallbackX: 46, width: 56, height: 34 },
      optionYOffset: { top: 4, bottom: 32 },
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

  /**
   * 计算给定区域的差分感知哈希 (difference hash, dHash)
   * 
   * 比 aHash 更适合文字/边缘场景：
   * - aHash 比较每个像素与全局均值 → 文字细节被平均掉
   * - dHash 比较相邻像素的梯度方向 → 保留文字笔画边缘信息
   * 
   * 使用 Canvas getImageData 提取像素，完全绕过 OpenCV 的 ROI 操作。
   */
  private computeDHash(
    canvas: OffscreenCanvas,
    ctx: OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): string {
    try {
      const cw = canvas.width;
      const ch = canvas.height;
      const sx = Math.max(0, Math.round(x));
      const sy = Math.max(0, Math.round(y));
      const sw = Math.min(Math.round(w), cw - sx);
      const sh = Math.min(Math.round(h), ch - sy);

      if (sw <= 0 || sh <= 0) return '';

      // 提取 RGBA 像素数据
      const imageData = ctx.getImageData(sx, sy, sw, sh);
      const pixels = imageData.data;

      // 使用 64x64 分辨率（4096位哈希），高精度区分韩文选项名
      const HASH_SIZE = 64;
      const grayPixels = this._dHashBuffer; // 复用缓冲区，避免每帧 new Array

      // 缩放到 HASH_SIZE x HASH_SIZE（中心点采样）
      for (let gy = 0; gy < HASH_SIZE; gy++) {
        for (let gx = 0; gx < HASH_SIZE; gx++) {
          const srcX = Math.min(((gx + 0.5) / HASH_SIZE) * sw, sw - 1) | 0;
          const srcY = Math.min(((gy + 0.5) / HASH_SIZE) * sh, sh - 1) | 0;
          const idx = (srcY * sw + srcX) * 4;
          grayPixels[gy * HASH_SIZE + gx] =
            pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
        }
      }

      // dHash：比较每个像素与右侧邻居（最后一列与倒数第二列比较）
      let hash = '';
      for (let gy = 0; gy < HASH_SIZE; gy++) {
        for (let gx = 0; gx < HASH_SIZE; gx++) {
          const current = grayPixels[gy * HASH_SIZE + gx];
          const right = grayPixels[gy * HASH_SIZE + ((gx + 1) % HASH_SIZE)];
          hash += current > right ? '1' : '0';
        }
      }

      return hash;
    } catch (e) {
      return '';
    }
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
      /** 每个护石的感知哈希，与currentGems一一对应 */
      const gemHashes: string[] = [];
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

        // 诊断：输出每行匹配失败的具体环节
        const missing: string[] = [];
        if (!gemName) missing.push('gemName');
        if (!willPower) missing.push('willPower');
        if (!corePoint) missing.push('corePoint');
        if (!optionTop.optionName) missing.push('optTop.name');
        if (!optionTop.optionLevel) missing.push('optTop.level');
        if (!optionBottom.optionName) missing.push('optBot.name');
        if (!optionBottom.optionLevel) missing.push('optBot.level');

        if (missing.length > 0) {
          postToMain({
            type: 'debug',
            message: `[row ${i}] MISS: ${missing.join(', ')}` +
            ` | gemName=${gemName?.score?.toFixed(2) ?? '-'} ` +
            ` will=${willPower?.score?.toFixed(2) ?? '-'}` +
            ` core=${corePoint?.score?.toFixed(2) ?? '-'}` +
            ` optN1=${optionTop.optionName?.score?.toFixed(2) ?? '-'} optL1=${optionTop.optionLevel?.score?.toFixed(2) ?? '-'}` +
            ` optN2=${optionBottom.optionName?.score?.toFixed(2) ?? '-'} optL2=${optionBottom.optionLevel?.score?.toFixed(2) ?? '-'}`,
          });
        }

        if (
          gemName !== null &&
          // willPower 和 corePoint 匹配失败时不再丢弃整行
          // willPower 默认用5(中间值)，corePoint默认用4
          corePoint !== null &&
          optionTop.optionName !== null &&
          optionTop.optionLevel !== null &&
          optionBottom.optionName !== null &&
          optionBottom.optionLevel !== null
        ) {
          const reqVal = willPower ? Number(willPower.key) : 5;
          const gem: ArkGridGem = {
            gemAttr: gemAttr.key,
            name: gemName.key,
            req: reqVal,
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

          // 计算该护石的差分感知哈希(dHash)，用于主线程滚动去重
          //
          // v2优化：
          // 1. HASH_SIZE从32提升到64(1024位→4096位)，精度4倍
          // 2. 采样区域收窄：去掉大面积背景padding，聚焦文字区域
          //    背景(渐变/边框)在不同护石间完全一致，会淹没文字差异导致hash碰撞
          let rowHash = '';
          if (gemName && optionTop.optionName && optionBottom.optionName) {
            const centerX = gemName.loc.x;
            const optNameX = centerX + layout.optionName.x;
            const optY = rowY + layout.optionYOffset.top;
            // 收窄区域：去掉多余padding，只保留选项名+等级的文字部分
            rowHash = this.computeDHash(
              canvas, ctx,
              optNameX,
              optY,
              layout.optionName.width + layout.optionLevel.width,    // 去掉+20余量
              layout.optionName.height * 2 + 8                      // 用紧凑高度替代原bottom偏移
            );
          }
          gemHashes.push(rowHash);
        }
      }
      return { locale: currentLocale, gemAttr: gemAttr.key, gems: currentGems, gemHashes };
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

    case 'stop':
      // 자원 정리 및 Worker 종료 준비
      processor.destroy();
      postToMain({ type: 'init:done' }); // 用已有消息类型表示清理完成
      break;
  }
};
