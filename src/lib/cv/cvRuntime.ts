// window.cv로 초기화할 수 없음
// 반드시 worker 내에서만 사용
import cvModule from '@techstark/opencv-js';
import type { CV } from '@techstark/opencv-js';

let cvInstance: CV | null = null; //singleton

export async function initOpenCv(): Promise<void> {
  if (cvInstance) return;

  let cv: CV;
  if (cvModule instanceof Promise) {
    cv = await cvModule;
  } else {
    await new Promise<void>((resolve) => {
      cvModule.onRuntimeInitialized = resolve;
    });
    cv = cvModule;
  }

  cvInstance = cv;
}

export function getCv(): CV {
  if (!cvInstance) {
    throw new Error('OpenCV not initialized. Call initOpenCv() first.');
  }
  return cvInstance;
}

/**
 * 尝试释放 OpenCV WASM 内存
 * 注意：这是一个尽力而为的尝试，OpenCV.js 可能不会完全释放所有 WASM 内存
 */
export function destroyOpenCv(): void {
  if (cvInstance) {
    try {
      // 尝试触发 OpenCV 的清理（如果支持）
      if ('clearAll' in cvInstance) {
        (cvInstance as any).clearAll();
      }
    } catch (e) {
      // 忽略清理错误
    }
    cvInstance = null;
  }
}
