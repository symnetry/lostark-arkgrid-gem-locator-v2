import {
  type ArkGridAttr,
  DEFAULT_GEM_RECOGNITION_LOCALE,
  type GemRecognitionLocale,
} from '../constants/enums';
import { type ArkGridGem } from '../models/arkGridGems';
import type { CaptureWorkerRequest, CaptureWorkerResponse } from './types';

const START_CAPTURE_ERROR_TYPES = [
  'recording',
  'worker-init-failed',
  'screen-permission-denied',
  'unknown',
] as const;

type StartCaptureErrorType = (typeof START_CAPTURE_ERROR_TYPES)[number];

/** 单帧识别结果 */
export interface SnapshotResult {
  gemAttr: ArkGridAttr;
  gems: ArkGridGem[];
  /** 每个护石对应的感知哈希(64字符'0'/'1'字符串，与gems数组一一对应，用于邻居上下文去重 */
  gemHashes?: string[];
}

export class CaptureController {
  private state: 'idle' | 'loading' | 'ready' | 'recording' | 'closing' = 'idle';

  // 屏幕录制相关功能
  private reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
  private track: MediaStreamVideoTrack | null = null;
  private mediaStream: MediaStream | null = null; // 持有MediaStream引用以便完整释放

  // web worker
  private worker: Worker | null = null;
  detectionMargin: number = 0;
  private recognitionLocale: GemRecognitionLocale = DEFAULT_GEM_RECOGNITION_LOCALE;

  // debug
  private drawDebug: boolean = false;
  private debugCanvas: HTMLCanvasElement | null = null;

  // 👇 等待中的Promise的resolver
  private awaitWorkerInitialization: {
    resolve: () => void;
    reject: (reason: StartCaptureErrorType) => void;
  } | null = null;
  private awaitFrameCompletion: (() => void) | null = null;

  // 外部注册的回调
  onFrameDone: ((gemAttr: ArkGridAttr, gems: ArkGridGem[], gemHashes?: string[]) => void) | null =
    null; // 分析完成(流式模式)
  onSnapshotDone: ((result: SnapshotResult) => void) | null = null; // 单帧识别完成(截图模式)
  onLoad: (() => void) | null = null; // worker准备完成
  onStartCaptureError: ((err: StartCaptureErrorType) => void) | null = null; // worker准备失败
  onReady: (() => void) | null = null; // 帧读取完成 / 就绪可截图
  onStop: (() => void) | null = null; // 录制中断
  onLevelRoiDump: ((images: ImageBitmap[], labels: string[]) => void) | null = null; // 等级ROI导出(Debug模式)

  constructor(debugCanvas?: HTMLCanvasElement | null) {
    if (debugCanvas) this.debugCanvas = debugCanvas;
  }

  // type-safe wrapper
  private postMessage(msg: CaptureWorkerRequest) {
    if (!this.worker) throw Error('worker is not set');
    this.worker.postMessage(msg);
  }

  private handleWorkerMessage(e: MessageEvent<CaptureWorkerResponse>) {
    const data = e.data;

    switch (data.type) {
      case 'init:done':
        this.awaitWorkerInitialization?.resolve();
        this.awaitWorkerInitialization = null;
        const onLoad = this.onLoad;
        if (onLoad) {
          queueMicrotask(() => onLoad());
        }
        break;

      case 'frame:done':
        // release lock
        this.awaitFrameCompletion?.();
        this.awaitFrameCompletion = null;

        // 调用外部注册的回调

        /*
        queueMicrotask(() => { ... }) 内的代码:

        现在不执行 ❌
        当前调用栈结束后执行 ⭕

        TypeScript 会这样想:

        "在这个回调执行之前，
        无法保证 this.onFrameDone 或 data.result
        不会被修改。"
        */
        if (this.state === 'recording') {
          // 只有在recording时才调用onFrameDone
          const result = data.result;
          const onFrameDone = this.onFrameDone;
          if (onFrameDone && result) {
            queueMicrotask(() => {
              onFrameDone(result.gemAttr, result.gems, result.gemHashes);
            });
          }
        } else if (this.state === 'ready') {
          // ready(截图模式)时调用onSnapshotDone
          const result = data.result;
          const onSnapshotDone = this.onSnapshotDone;
          if (onSnapshotDone && result) {
            queueMicrotask(() => {
              onSnapshotDone({
                gemAttr: result.gemAttr,
                gems: result.gems,
                gemHashes: result.gemHashes,
              });
            });
          }
        }
        break;

      case 'init:error':
        if (this.awaitWorkerInitialization) {
          this.awaitWorkerInitialization.reject('worker-init-failed');
          this.awaitWorkerInitialization = null;
        }
        break;

      case 'debug':
        try {
          if (data.message) console.log(data.message);
          if (data.image && this.debugCanvas) {
            if (this.state == 'recording') {
              this.debugCanvas.width = data.image.width;
              this.debugCanvas.height = data.image.height;
              this.debugCanvas.getContext('2d')?.drawImage(data.image, 0, 0);
            }
          }
        } finally {
          if (data.image) data.image.close();
        }
        break;

      case 'level-roi-dump':
        if (this.onLevelRoiDump && data.images?.length) {
          const images = data.images;
          const labels = data.labels ?? [];
          queueMicrotask(() => this.onLevelRoiDump!(images, labels));
        } else {
          // 没有注册回调时自动释放
          data.images?.forEach((img) => img.close());
        }
        break;
    }
  }

  private async requestDisplayMedia() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      if (!stream) {
        throw Error('No stream');
      }
      this.mediaStream = stream; // 持有引用以便完整释放
      this.track = stream.getVideoTracks()[0];
      if (!this.track) {
        throw Error('No video track');
      }
      const processor = new MediaStreamTrackProcessor({ track: this.track });
      this.reader = processor.readable.getReader();
    } catch (err: any) {
      throw err;
    }
    return;
  }

  isStartCaptureError(err: unknown): err is StartCaptureErrorType {
    // 错误是否是我抛出的StartCaptureErrorType之一?
    return (
      typeof err === 'string' && START_CAPTURE_ERROR_TYPES.includes(err as StartCaptureErrorType)
    );
  }

  private classifyCaptureError(err: unknown): StartCaptureErrorType {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError') {
        return 'screen-permission-denied';
      }
    }

    if (this.isStartCaptureError(err)) {
      return err; // 🔥 直接传递
    }

    return 'unknown';
  }

  async startCapture(
    recognitionLocale: GemRecognitionLocale,
    deferDisplayRequest: boolean = false
  ) {
    // 只有在idle状态下才可以
    // 开始录制。
    // 创建worker并加载资源后，向用户请求屏幕共享。
    // 两者都完成后切换到ready状态（循环需要另外调用startRecording）

    try {
      if (this.state !== 'idle') {
        throw 'recording' satisfies StartCaptureErrorType;
      }

      // 切换到loading状态（加锁）
      this.state = 'loading';
      this.recognitionLocale = recognitionLocale;

      // worker创建后注册handler
      if (!this.worker) {
        this.worker = new Worker(new URL('./captureWorker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
      }
      // 创建等待worker初始化的promise后发送init请求
      // （根据worker的响应也可能会reject！）
      const waitForInit = new Promise<void>((resolve, reject) => {
        this.awaitWorkerInitialization = { resolve, reject };
      });
      this.postMessage({ type: 'init' });

      if (deferDisplayRequest) {
        await waitForInit;
        await this.requestDisplayMedia();
      } else {
        // 初始化期间向用户请求屏幕共享，两者都等待
        await Promise.all([this.requestDisplayMedia(), waitForInit]);
      }

      // 完成后reader已设置可以读取
      if (!this.reader) {
        throw Error('reader is not ready');
      }

      // 等待直到可以读取第一帧
      const { value, done } = await this.reader.read();
      if (done) {
        throw Error('Failed to read even a frame');
      }
      value?.close();

      // 准备完成 → ready状态（循环在另外的startRecording中执行）
      this.state = 'ready';
      const onReady = this.onReady;
      if (onReady) {
        queueMicrotask(() => {
          onReady();
        });
      }
    } catch (err) {
      // 初始化过程中发生错误则分类后调用onStartCaptureError
      const classified = this.classifyCaptureError(err);
      this.onStartCaptureError?.(classified);
    } finally {
      // 开始失败的话回到idle
      if (this.state == 'loading') {
        this.state = 'idle';
      }
    }
  }

  /**
   * 从ready状态进入recording循环模式（兼容旧的流式API）
   */
  startRecording() {
    if (this.state === 'ready') {
      this.state = 'recording';
      this.loop();
    }
  }

  /**
   * 单帧截图识别：从当前画面截取一帧发送给worker，返回Promise<识别结果>
   * 需要在 ready 状态下调用（即已经调用过startCapture并成功初始化）
   */
  async captureSingleFrame(): Promise<SnapshotResult> {
    if (this.state !== 'ready') {
      throw Error(`Cannot capture frame in state: ${this.state}. Need 'ready' state.`);
    }
    if (!this.reader || !this.worker) {
      throw Error('reader or worker not initialized');
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(Error('captureSingleFrame timeout'));
        }
      }, 10000);

      this.onSnapshotDone = (result) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(result);
        }
      };

      // 读取一帧
      this.reader
        .read()
        .then(({ value, done }) => {
          if (done || !value) {
            clearTimeout(timeout);
            if (!resolved) {
              resolved = true;
              reject(Error('Stream ended'));
            }
            return;
          }
          // 发送给worker分析
          this.worker!.postMessage(
            {
              type: 'frame',
              frame: value,
              drawDebug: this.drawDebug,
              detectionMargin: this.detectionMargin,
              recognitionLocale: this.recognitionLocale,
            } satisfies CaptureWorkerRequest,
            [value]
          );
        })
        .catch((err) => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
    });
  }

  private async loop() {
    // 帧率限制：每帧最少间隔200ms
    const FRAME_INTERVAL_MS = 200;
    let lastFrameTime = 0;

    // 如果state是recording，就从reader读取帧，传递给worker并等待结果
    while (this.state == 'recording') {
      if (!this.reader) {
        throw Error('reader not exists');
      }
      let value: VideoFrame | undefined;
      try {
        if (!this.worker) throw Error('worker not exists');
        const result = await this.reader.read();
        value = result.value;
        const done = result.done;
        if (done) break; // 用户中断屏幕共享时在这里break
        if (!value) break;

        // 分析完成后resolve的promise创建
        const waitForAnalysis = new Promise<void>((resolve) => {
          this.awaitFrameCompletion = resolve;
        });
        // 当前frame通过postMessage发送
        this.worker.postMessage(
          {
            type: 'frame',
            frame: value,
            drawDebug: this.drawDebug,
            detectionMargin: this.detectionMargin,
            recognitionLocale: this.recognitionLocale,
          } satisfies CaptureWorkerRequest,
          [value]
        );
        value = undefined;
        // 注意：value的所有权已经转移给worker了，所以不能再碰了，设为undefined
        await waitForAnalysis;

        // 帧率限制：如果处理太快，等待到下一帧间隔
        const elapsed = performance.now() - lastFrameTime;
        if (elapsed < FRAME_INTERVAL_MS) {
          await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS - elapsed));
        }
        lastFrameTime = performance.now();
      } finally {
        // 如果某种原因value的所有权没有转移，就由controller关闭
        value?.close();
      }
    }
    // loop退出后设为idle
    await this.cleanup();
    const onStop = this.onStop;
    if (onStop) {
      queueMicrotask(() => {
        onStop();
      });
    }
  }

  /**
   * 同步立即停止所有资源（用于 beforeunload 等紧急情况）
   * 不等待 Promise，立即释放所有可释放的资源
   */
  stopCaptureImmediate() {
    if (this.state === 'idle') return;

    // 立即停止 MediaStream 轨道
    this.track?.stop();
    this.track = null;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    // 立即取消 reader
    if (this.reader) {
      try {
        this.reader.cancel();
      } catch {}
      this.reader = null;
    }

    // 立即终止 Worker（不等待清理）
    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'stop' });
      } catch {}
      this.worker.terminate();
      this.worker = null;
    }

    this.state = 'idle';
  }

  async stopCapture() {
    // 上面的循环中read或waitForAnalysis这样的Promise是不能取消的，
    // 所以从一开始创建promise的时候就应该和带取消信号的Promise进行race。
    // （带取消信号的Promise先reject的话，原Promise就不用等了，这样就有取消效果了）
    // 感觉太冗长了，所以就用loop结束的方式...
    if (this.state === 'recording') {
      this.state = 'closing'; // 之后loop退出后期待回到idle
    } else if (this.state === 'ready' || this.state === 'loading') {
      // ready/loading状态下也可以停止
      await this.cleanup();
      this.state = 'idle';
    }
  }

  /** 清理所有资源（reader/track/stream/worker） */
  private async cleanup() {
    this.track?.stop();
    this.track = null;
    // 停止mediaStream所有轨道（音频+视频），确保完全释放
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    try {
      await this.reader?.cancel();
    } catch {}
    this.reader = null;
    await this.destroyWorker();
  }
  /** 完全销毁 Worker，释放 OpenCV WASM 内存 */
  async destroyWorker() {
    if (this.worker) {
      try {
        // 先发送 stop 消息让 Worker 内部清理
        this.worker.postMessage({ type: 'stop' });
        // 给一点时间让 Worker 完成清理（200ms）
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (e) {
        // 忽略错误
      }
      // 强制终止 Worker
      this.worker.terminate();
      this.worker = null;

      // 尝试触发垃圾回收（浏览器可能忽略，但尽力而为）
      if ('gc' in window) {
        try {
          (window as any).gc();
        } catch (e) {}
      }
    }
  }
  isIdle() {
    return this.state === 'idle';
  }
  isReady() {
    return this.state === 'ready';
  }
  isRecording() {
    return this.state == 'recording';
  }
  toggleDrawDebug() {
    this.drawDebug = !this.drawDebug;
    return this.drawDebug;
  }
}
