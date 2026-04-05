let loading: Promise<void> | null = null;

export function loadOpenCV(): Promise<void> {
  // 确信 window.cv 存在且可用。
  // 曾尝试直接返回 cv，但不太好
  /*
  结论:

  根据构建方式，cv 对象可能是 Promise，也可能是普通 Object
  使用的 @techstark/opencv-js 包中 **cv 本身就是 Promise(thenable 对象)**
  所以调用 resolve(cv) 时，Promise 会识别为"另一个 Promise"并尝试调用 cv.then()
  如果 cv.then() 没有正确实现 → 永远停在 pending 状态
  */
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('browser only'));
  }

  if (window.cv) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.12.0-release.1/dist/opencv.min.js';
    script.async = true;

    script.onload = () => {
      if (!window.cv) {
        loading = null;
        reject(new Error('Failed to load OpenCV: cv not exist on window'));
        return;
      }
      window.cv.onRuntimeInitialized = () => {
        resolve();
      };
    };

    script.onerror = () => {
      loading = null; // 失败时重置
      document.body.removeChild(script); // 移除失败的脚本
      reject(new Error('Failed to load OpenCV'));
    };

    document.body.appendChild(script);
  });

  return loading;
}
