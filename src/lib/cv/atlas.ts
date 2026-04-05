import { getCv } from './cvRuntime';
import type { CvMat } from './types';

export interface AtlasEntry {
  x: number; // atlas中的x坐标
  width: number; // 宽度
  height: number; // 高度
  template: CvMat; // 原图
}

export interface MatchingAtlas<K extends string> {
  atlas: CvMat;
  entries: Record<K, AtlasEntry>;
}

export function generateMatchingAtlas<const M extends Record<string, CvMat>>(mats: M) {
  // 给定的输入是 Record<string, CvMat>，将其泛化为M
  // 返回的entries是Record，向类型确认key值就是输入的key
  const cv = getCv();

  const entries = {} as Record<keyof M, AtlasEntry>;

  // 高度对齐到最大值
  const maxHeight = Math.max(...Object.values(mats).map((mat) => mat.rows));

  let xOffset = 0;
  const paddedMats: CvMat[] = [];
  const matVector = new cv.MatVector();

  for (const key of Object.keys(mats) as (keyof M)[]) {
    let mat = mats[key];
    let padded: CvMat;

    // 高度不同则添加padding
    if (mat.rows < maxHeight) {
      const bottom = maxHeight - mat.rows;
      padded = new cv.Mat();
      cv.copyMakeBorder(
        mat,
        padded,
        0,
        bottom,
        0,
        0,
        cv.BORDER_CONSTANT,
        new cv.Scalar(0, 0, 0, 0)
      );
    } else {
      padded = mat;
    }

    paddedMats.push(padded);
    matVector.push_back(padded);

    entries[key] = {
      x: xOffset,
      width: mat.cols,
      height: mat.rows,
      template: mat,
    };

    xOffset += padded.cols;
  }

  // 创建atlas
  const atlas = new cv.Mat();
  cv.hconcat(matVector, atlas);

  // 清理因padding新创建的Mat
  for (const m of paddedMats) {
    if (!Object.values(mats).includes(m)) {
      m.delete();
    }
  }
  matVector.delete();

  return { atlas, entries };
}
