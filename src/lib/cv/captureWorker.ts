import type { CV } from '@techstark/opencv-js';

import type { GemRecognitionLocale } from '../constants/enums';
import { type ArkGridGem, determineGemGradeByGem } from '../models/arkGridGems';
import type { MatchingAtlas } from './atlas';
import { getCv, initOpenCv, destroyOpenCv } from './cvRuntime';
import { showMatch } from './debug';
import { type KeyOptionLevel, type KeyOptionString, loadGemAsset } from './matStore';
import { type MatchingResult, getBestMatch } from './matcher';
import type { CaptureWorkerRequest, CaptureWorkerResponse, CvMat } from './types';

type RecgonitionTarget<K extends string> = {
  roi: {
    // 整个帧中的搜索目标roi
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // 使用的atlas
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
    /** bottom行专用fallback(当optionName未匹配时使用，需跳过属性名) */
    bottomFallbackX?: number;
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
    
    // 释放 OpenCV WASM 内存
    destroyOpenCv();
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
      // 模板为 "Lv. X" 格式(~45x18)，ROI 精确适配
      // bottomFallbackX: 底部行optionName未匹配时的fallback(属性名较长，需更大偏移)
      optionLevel: { gapX: -2, fallbackX: 44, width: 52, height: 24, bottomFallbackX: 80 },
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
      // ru_cn(俄服汉化): 属性名较长("盟友攻击强化"、"友军伤害强化"等6字)
      // 关键改进：ROI 加宽覆盖整个"属性名+等级"区域，让模板匹配自动定位"Lv."
      //   - 不再依赖 optionName 匹配结果计算偏移（optionName 可能只匹配部分文字）
      //   - 宽度设为 ~140px 足够容纳最长属性名(6字~72px) + Lv.X(~45px) + 余量
      optionLevel: { gapX: 0, fallbackX: 0, width: 140, height: 28 },
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
    // Q. 两个流程同时到达这里怎么办?
    // A. JS/Worker是单线程，
    //    第一个await之前的同步代码不会中断，会原子性执行
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
    // 窗口标题栏高度大概是32px
    if (height < 1080) {
      // FHD以下的情况，放大到FHD
      resolutionScale = 1080 / (height - 27); // Windows 10 实际是27px
      expectedResolution = `(警告) FHD 以下`;
    } else if (height >= 1080 && height <= 1080 + 48) {
      // FHD, UWFHD的情况直接使用
    } else if (height >= 1440 && height <= 1440 + 48) {
      // QHD, UWQHD的情况分辨率3/4倍
      resolutionScale = 3 / 4;
      expectedResolution = 'QHD';
    } else if (height >= 2160 && height <= 2160 + 48) {
      // UHD的情况分辨率1/2倍
      resolutionScale = 1 / 2;
      expectedResolution = 'UHD';
    } else {
      // ? 直接使用FHD
      expectedResolution = '(警告) Unknown';
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
      /** 置信度边距：最佳匹配必须比第二名高出的最小分数 */
      minConfidenceMargin?: number;
    }
  ): MatchingResult<K> | null {
    // 找到给定的target
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
        // 自己进行downscale时添加额外margin
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
          debugCtx.strokeStyle = 'black'; // 边框颜色
          debugCtx.lineWidth = 10 * resolutionScale; // 边框厚度
          let x = 25;
          let y = 100;
          // 先画边框再填白色文字
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

      // 1. 寻找anchor
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

      //2 寻找秩序或者混沌文字
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

      // 5. 找到9个护石并进行图像匹配
      const currentGems: ArkGridGem[] = [];
      /** 每个护石的感知哈希，与currentGems一一对应 */
      const gemHashes: string[] = [];
      for (let i = 0; i < 9; i++) {
        const rowX = anchorX + layout.row.x;
        const rowY = anchorY + layout.row.y + layout.row.stepY * i;

        // 1) 护石种类 (名字)
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

        // 2) 意志力
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

        // 3) 秩序/混沌点数
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

        // 4) 护石选项提取
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

        for (const [optIdx, targetOption] of [optionTop, optionBottom].entries()) {
          // 选项名字
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

          // ru_ru的情况下，"攻击力"从"友军攻击强化"字符串中捕获
          if (optionName !== null && currentLocale === 'ru_ru' && optionName.key === '공격력') {
            // 因此再次确认没有"攻击力"的atlas
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

          // 等级ROI偏移策略：
          //   - fallbackX > 0: 使用optionName动态定位(传统模式)
          //   - fallbackX == 0: 宽ROI模式，从optionName区域起始开始，让模板匹配自动找"Lv."
          const useWideRoi = layout.optionLevel.fallbackX === 0;
          const levelBaseOffset = useWideRoi
            ? 0
            : (() => {
                const offset = this.getOptionLevelXOffset(layout, optionNameRoi, optionName);
                const isBottom = optIdx === 1;
                if (isBottom && !optionName && layout.optionLevel.bottomFallbackX) {
                  return layout.optionLevel.bottomFallbackX;
                }
                return offset;
              })();

          const optionLevel = this.findBest(
            {
              roi: {
                x: rowX + layout.optionName.x + levelBaseOffset,
                y: rowY + layout.optionName.y + targetOption.yOffset,
                width: layout.optionLevel.width,
                height: layout.optionLevel.height,
              },
              atlas: this.loadedAsset.atlasOptionLevel[currentLocale],
              threshold: this.getOptionLevelThreshold(currentLocale, detectionMargin),
            },
            resizedFrame,
            debugCtx,
            {
              diagLabel: `row${i}_${optIdx === 0 ? 'T' : 'B'}`,
              // 置信度边距：最佳必须明显优于第二名，否则拒绝识别
              minConfidenceMargin: 0.03,
              marginRejectLabel: `lv-row${i}-${optIdx === 0 ? 'T' : 'B'}`,
            }
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
      // ... 其他识别
      // return 识别的对象们
    } finally {
      if (resizedFrame) resizedFrame.delete();
      frame.close();
      this.frameTimes.push(performance.now() - start);
      if (this.frameTimes.length > 10) this.frameTimes.shift();
    }
  }

  /**
   * 公共方法：在 Debug 模式下导出当前帧的等级 ROI 区域
   */
  exportLevelRoiDump(recognitionLocale: GemRecognitionLocale): { images: ImageBitmap[]; labels: string[] } | null {
    if (!this.previousInfo) return null;
    return this.dumpLevelROIs(
      this.canvas,
      this.getRecognitionLayout(recognitionLocale),
      this.previousInfo.anchorLoc.x,
      this.previousInfo.anchorLoc.y
    );
  }

  /** @internal 内部实现：裁剪并导出等级 ROI 区域 */
  dumpLevelROIs(
    canvas: OffscreenCanvas,
    layout: RecognitionLayout,
    anchorX: number,
    anchorY: number
  ): { images: ImageBitmap[]; labels: string[] } | null {
    const images: ImageBitmap[] = [];
    const labels: string[] = [];

    for (let i = 0; i < 9; i++) {
      const rowX = anchorX + layout.row.x;
      const rowY = anchorY + layout.row.y + layout.row.stepY * i;

      for (const [posIdx, [posName, yOffset]] of [['top', layout.optionYOffset.top], ['bottom', layout.optionYOffset.bottom]].entries()) {
        // 计算等级 ROI 的实际坐标（与 findBest 调用时一致）
        const isBottom = posIdx === 1;
        const useWideRoi = layout.optionLevel.fallbackX === 0;
        const optionLevelXOffset = useWideRoi ? 0 : (
          (isBottom && layout.optionLevel.bottomFallbackX)
            ? layout.optionLevel.bottomFallbackX
            : layout.optionLevel.fallbackX
        );
        const x = Math.round(rowX + layout.optionName.x + optionLevelXOffset);
        const y = Math.round(rowY + layout.optionName.y + yOffset);
        // 使用实际 ROI 尺寸（不加额外放大，方便精确检查匹配区域）
        const w = Math.round(layout.optionLevel.width * 1.2);
        const h = Math.round(layout.optionLevel.height * 1.5);

        try {
          // 创建裁剪用的 OffscreenCanvas
          const cropCanvas = new OffscreenCanvas(w, h);
          const cropCtx = cropCanvas.getContext('2d');
          if (!cropCtx) continue;
          // 从主画布裁剪（使用 RGBA 原图，保留颜色信息便于人工检查）
          cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
          images.push(cropCanvas.transferToImageBitmap());
          labels.push(`row${i}_${posName}_lv`);
        } catch {
          // 忽略单次裁剪失败
        }
      }
    }

    return images.length > 0 ? { images, labels } : null;
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
      // 初始化请求
      try {
        await processor.init();
        postToMain({ type: 'init:done' });
      } catch {
        postToMain({ type: 'init:error' });
      }
      break;

    case 'frame':
      // 帧分析请求
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
        // 导出等级 ROI 区域（用于重新制作模板）
        const levelDump = processor.exportLevelRoiDump(data.recognitionLocale);
        if (levelDump) {
          postToMain({ type: 'level-roi-dump', images: levelDump.images, labels: levelDump.labels });
        }
      }
      break;

    case 'stop':
      // 资源清理及Worker终止准备
      processor.destroy();
      postToMain({ type: 'init:done' }); // 用已有消息类型表示清理完成
      break;
  }
};
