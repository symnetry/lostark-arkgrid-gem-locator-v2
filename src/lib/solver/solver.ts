import { Core, Gem, GemSet, GemSetPack } from './models';

export type GemSetPackProgress = {
  current: number;
  total: number;
};

type GemSetPackProgressCallback = (progress: GemSetPackProgress) => void;

export function getMaxStat(gss: GemSet[], statType: 'att' | 'skill' | 'boss') {
  // 从给定的 GemSet[] 中获取最高的 statType 值。
  let result = 0;
  for (const gs of gss) {
    if (gs[statType] > result) {
      result = gs[statType];
    }
  }
  return result;
}

export function getPossibleGemSets(core: Core, gems: Gem[]): GemSet[] {
  // 使用给定的 gems，返回满足所有要求 energy 和 point 的集合。
  const n = gems.length;
  const g = [...gems].sort((a, b) => a.req - b.req);
  const energy = core.energy;
  const point = core.point;
  const result: GemSet[] = [];

  if (point == 0) {
    result.push(new GemSet([], core));
  }

  for (let i = 0; i < n; i++) {
    const ei = energy - g[i].req;
    const pi = g[i].point;

    if (pi >= point && ei >= 0) result.push(new GemSet([g[i]], core));

    if (ei < 3) break;
    if (pi + 15 < point) continue;

    for (let j = i + 1; j < n; j++) {
      const ej = ei - g[j].req;
      const pj = pi + g[j].point;
      if (pj >= point && ej >= 0) result.push(new GemSet([g[i], g[j]], core));
      if (ej < 0) break;
      if (ej < 3) continue;
      if (pj + 10 < point) continue;

      for (let k = j + 1; k < n; k++) {
        const ek = ej - g[k].req;
        const pk = pj + g[k].point;
        if (pk >= point && ek >= 0) result.push(new GemSet([g[i], g[j], g[k]], core));
        if (ek < 0) break;
        if (ek < 3) continue;
        if (pk + 5 < point) continue;
        for (let m = k + 1; m < n; m++) {
          const el = ek - g[m].req;
          const pl = pk + g[m].point;
          if (el < 0) break;
          if (pl >= point && el >= 0) result.push(new GemSet([g[i], g[j], g[k], g[m]], core));
        }
      }
    }
  }
  return result;
}

export function getBestGemSetPacks(
  gssList: GemSet[][],
  scoreMaps: [number, number][][],
  ignoreDuplication = false,
  onProgress?: GemSetPackProgressCallback
): GemSetPack[] {
  if (gssList.length > 3) throw Error('length of gsss should be one of 1, 2, 3');
  const [gss1, gss2, gss3] = gssList;

  let answer = [];
  let targetMin = 0; // 目前找到的配置中战斗力范围下限(min)的最大值

  // validate
  [gss1, gss2, gss3].forEach((gss) => {
    if (gss === undefined || gss.length == 0) return;
    if (
      gss.some((gs) => {
        gs.maxScore == -1 || gs.minScore == -1;
      })
    ) {
      throw Error('maxScore and minScore is not set');
    }
  });
  if (gss1) gss1.sort((a, b) => b.maxScore - a.maxScore);
  if (gss2) gss2.sort((a, b) => b.maxScore - a.maxScore);
  if (gss3) gss3.sort((a, b) => b.maxScore - a.maxScore);

  let lastProgressBucket = -1;
  function emitProgress(current: number, total: number) {
    if (!onProgress || total <= 0) return;
    const bucket = Math.floor((current * 100) / total);
    if (bucket === lastProgressBucket && current < total) return;
    lastProgressBucket = bucket;
    onProgress({ current, total });
  }

  // 二分搜索辅助函数
  function binarySearchThreshold(gss: GemSet[], threshold: number): number {
    let left = 0;
    let right = gss.length;

    while (left < right) {
      const mid = (left + right) >>> 1;
      if (gss[mid].maxScore >= threshold) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    return left;
  }

  function estimateOuterLoopTotal(remainingMaxScoreProduct: number, current: number) {
    if (!Number.isFinite(remainingMaxScoreProduct) || remainingMaxScoreProduct <= 0) {
      return Math.max(current, gss1.length);
    }

    const threshold = targetMin / remainingMaxScoreProduct;
    return Math.max(current, binarySearchThreshold(gss1, threshold));
  }

  const cache = new Map<bigint, Map<number, GemSet[]>>();
  let hitCount = 0;
  let missCount = 0;

  function getCandidatesCache(
    currentBitmask: bigint, // 当前使用的护石
    gemSetIndex: number, // 提取目标 GemSet[]，必须是 0,1,2 中的一个
    threshold: number
    // threshold 是 currentMaxScore 乘以 maxScore 后必须大于 targetMinScore 才能成为候选
    // targetMinScore / currentMaxScore
  ): GemSet[] {
    const gss = gssList[gemSetIndex];
    // 返回给定 Core 拥有的 GemSet 中不与 currentBitmask 冲突的 GemSet 列表
    // 断言 gss 必须按 MaxScore 降序排序！

    const key = (currentBitmask << 3n) | BigInt(gemSetIndex);

    const cached = cache.get(key)?.get(threshold);
    if (cached) {
      hitCount++;
      return cached;
    }
    missCount++;

    // ✅ 优化 4: 使用二分搜索找到 threshold 以上的最后一个索引
    const maxValidIdx = binarySearchThreshold(gss, threshold);

    const res: GemSet[] = [];

    // ✅ 优化 5: 仅遍历需要的范围
    for (let i = 0; i < maxValidIdx; i++) {
      const gs = gss[i];
      if (ignoreDuplication || (gs.bitmask & currentBitmask) === 0n) {
        res.push(gs);
      }
    }

    let innerLevel = cache.get(key);
    if (!innerLevel) cache.set(key, (innerLevel = new Map()));
    innerLevel.set(threshold, res);

    return res;
  }

  // ✅ 改为 Generator - 内存效率更高
  function* getCandidatesGenerator(
    currentBitmask: bigint,
    gemSetIndex: number,
    threshold: number
  ): Generator<GemSet> {
    const gss = gssList[gemSetIndex];

    // 使用二分搜索找到有效范围的末尾
    const maxValidIdx = binarySearchThreshold(gss, threshold);

    // 仅按需 lazy 地 yield
    for (let i = 0; i < maxValidIdx; i++) {
      const gs = gss[i];
      if (ignoreDuplication || (gs.bitmask & currentBitmask) === 0n) {
        yield gs;
      }
    }
  }
  // const getCandidates = getCandidatesCache;
  const getCandidates = getCandidatesGenerator;

  /* 核心 0 个 */
  if (gssList.length == 0) return [];
  /* 核心 1 个 */
  if (gssList.length == 1) {
    return gss1.map((gs) => new GemSetPack(gs, null, null, scoreMaps));
  }

  /* 核心 2 个 */
  if (gssList.length == 2) {
    const gm2 = gss2.length > 0 ? gss2[0].maxScore : 1;
    let current = 0;
    for (const gs1 of gss1) {
      current += 1;
      emitProgress(current, estimateOuterLoopTotal(gm2, current));
      if (gs1.maxScore * gm2 < targetMin) break;

      for (const gs2 of getCandidates(gs1.bitmask, 1, targetMin / gs1.maxScore)) {
        const gsp = new GemSetPack(gs1, gs2, null, scoreMaps);
        if (gsp.maxScore > targetMin) {
          answer.push(gsp);
        }

        if (gsp.minScore > targetMin) {
          targetMin = gsp.minScore;
        }
      }
    }
  }

  /* 核心 3 个 */
  if (gssList.length == 3) {
    const gm2 = gss2.length > 0 ? gss2[0].maxScore : 1;
    const gm3 = gss3.length > 0 ? gss3[0].maxScore : 1;

    let current = 0;
    for (const gs1 of gss1) {
      current += 1;
      emitProgress(current, estimateOuterLoopTotal(gm2 * gm3, current));
      if (gs1.maxScore * gm2 * gm3 < targetMin) break;
      for (const gs2 of getCandidates(gs1.bitmask, 1, targetMin / (gs1.maxScore * gm3))) {
        if (gs1.maxScore * gs2.maxScore * gm3 < targetMin) break;
        for (const gs3 of getCandidates(
          gs1.bitmask | gs2.bitmask,
          2,
          targetMin / (gs1.maxScore * gs2.maxScore)
        )) {
          if (gs1.maxScore * gs2.maxScore * gs3.maxScore < targetMin) break;
          // 计算三个 GemSet 能获得的战斗力范围
          const gsp = new GemSetPack(gs1, gs2, gs3, scoreMaps);
          const maxScore = gsp.maxScore;
          const minScore = gsp.minScore;

          if (maxScore > targetMin && minScore != targetMin) {
            answer.push(gsp);
          }
          if (minScore > targetMin) {
            targetMin = minScore;
          }
        }
      }
    }
  }
  // console.log('缓存 hit', hitCount, 'miss', missCount, hitCount / (hitCount + missCount));
  // maxScore 小于 targetMin 的情况根本不是候选
  answer = answer.filter((g) => g.maxScore >= targetMin);
  answer.sort((a, b) => b.maxScore - a.maxScore);
  return answer;
}
