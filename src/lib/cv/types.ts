import CV from '@techstark/opencv-js';

import type { ArkGridAttr, GemRecognitionLocale } from '../constants/enums';
import type { ArkGridGem } from '../models/arkGridGems';

export type CvMat = CV.Mat;
export type CvRect = CV.Rect;
export type CvPoint = CV.Point;

// main → worker
export type CaptureWorkerRequest =
  | { type: 'init' } // init worker
  | {
      type: 'frame';
      frame: VideoFrame;
      drawDebug: boolean;
      detectionMargin: number;
      recognitionLocale: GemRecognitionLocale;
    } // send frame
  | { type: 'stop' };

// worker → main
export type CaptureWorkerResponse =
  | { type: 'init:done' }
  | { type: 'init:error' }
  | {
      type: 'frame:done';
      result:
        | {
            locale: GemRecognitionLocale;
            gemAttr: ArkGridAttr;
            gems: ArkGridGem[];
            /** 每个护石对应的感知哈希(64字符'0'/'1'字符串)，与gems数组一一对应 */
            gemHashes: string[];
          }
        | undefined;
    }
  | { type: 'error'; error: WorkerError }
  | { type: 'debug'; image?: ImageBitmap; message?: string }
  | {
      /** Debug模式下的等级ROI区域导出（用于重新制作模板） */
      type: 'level-roi-dump';
      images: ImageBitmap[];
      labels: string[];
    };

export type WorkerError = {
  message: string;
  stack?: string;
  name?: string;
};
