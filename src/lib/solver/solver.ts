import { Core, Gem, GemSet, GemSetPack } from './models';

export type GemSetPackProgress = {
  current: number;
  total: number;
};

type GemSetPackProgressCallback = (progress: GemSetPackProgress) => void;

export function getMaxStat(gss: GemSet[], statType: 'att' | 'skill' | 'boss') {
  // 주어진 GemSet[]에서 가장 높은 statType의 값을 가져옵니다.
  let result = 0;
  for (const gs of gss) {
    if (gs[statType] > result) {
      result = gs[statType];
    }
  }
  return result;
}

export function getPossibleGemSets(core: Core, gems: Gem[]): GemSet[] {
  // 주어진 gems을 사용해서 요구하는 energy와 point를 모두 충족하는 집합을 반환합니다.
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
  let targetMin = 0; // 현재까지 찾은 배치 중 전투력 범위의 하한(min)의 가장 큰 값

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

  function emitProgress(current: number, total: number) {
    if (!onProgress || total <= 0) return;
    onProgress({ current, total });
  }

  // 이진 검색 헬퍼 함수
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
    currentBitmask: bigint, // 현재 사용한 젬
    gemSetIndex: number, // 추출 대상 GemSet[], 반드시 0,1,2 중 하나
    threshold: number
    // threshold는 currentMaxScore에 maxScore를 곱했을 때 targetMinScore보다는 커야 후보가 될 수 있기에
    // targetMinScore / currentMaxScore
  ): GemSet[] {
    const gss = gssList[gemSetIndex];
    // 주어진 Core가 가진 GemSet 중 currentBitmask와 충돌하지 않는 GemSet의 목록을 반환
    // assert gss는 반드시 MaxScore에 대해서 내림차순으로 정렬된 상태!

    const key = (currentBitmask << 3n) | BigInt(gemSetIndex);

    const cached = cache.get(key)?.get(threshold);
    if (cached) {
      hitCount++;
      return cached;
    }
    missCount++;

    // ✅ 최적화 4: 이진 검색으로 threshold 이상인 마지막 인덱스 찾기
    const maxValidIdx = binarySearchThreshold(gss, threshold);

    const res: GemSet[] = [];

    // ✅ 최적화 5: 필요한 범위만 순회
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

  // ✅ Generator로 변경 - 메모리 효율적
  function* getCandidatesGenerator(
    currentBitmask: bigint,
    gemSetIndex: number,
    threshold: number
  ): Generator<GemSet> {
    const gss = gssList[gemSetIndex];

    // 이진 검색으로 유효한 범위의 끝 찾기
    const maxValidIdx = binarySearchThreshold(gss, threshold);

    // 필요한 만큼만 lazy하게 yield
    for (let i = 0; i < maxValidIdx; i++) {
      const gs = gss[i];
      if (ignoreDuplication || (gs.bitmask & currentBitmask) === 0n) {
        yield gs;
      }
    }
  }
  // const getCandidates = getCandidatesCache;
  const getCandidates = getCandidatesGenerator;

  /* 코어 0개 */
  if (gssList.length == 0) return [];
  /* 코어 1개 */
  if (gssList.length == 1) {
    return gss1.map((gs) => new GemSetPack(gs, null, null, scoreMaps));
  }

  /* 코어 2개 */
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

  /* 코어 3개 */
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
          // 세 개의 GemSet으로 얻을 수 있는 전투력 범위 구함
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
  // console.log('캐시 hit', hitCount, 'miss', missCount, hitCount / (hitCount + missCount));
  // maxScore이 targetMin보다 작은 경우엔 아예 후보조차 아님
  answer = answer.filter((g) => g.maxScore >= targetMin);
  answer.sort((a, b) => b.maxScore - a.maxScore);
  return answer;
}
