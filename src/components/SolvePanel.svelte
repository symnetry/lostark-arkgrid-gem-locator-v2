<script lang="ts">
  import { type ArkGridAttr, ArkGridAttrs } from '../lib/constants/enums';
  import { type ArkGridCoreType, ArkGridCoreTypes } from '../lib/models/arkGridCores';
  import { type ArkGridGem } from '../lib/models/arkGridGems';
  import {
    Core,
    Gem,
    GemSet,
    GemSetPack,
    GemSetPackTuple,
    buildScoreMap,
    gemOptionLevelCoeffs,
    gemOptionLevelCoeffsSupporter,
  } from '../lib/solver/models';
  import { getBestGemSetPacks, getPossibleGemSets } from '../lib/solver/solver';
  import { gemSetPackKey } from '../lib/solver/utils';
  import { appLocale } from '../lib/state/locale.state.svelte';
  import {
    type AdditionalGemResult,
    type CharacterProfile,
    getCurrentProfile,
    unassignGems,
    updateAdditionalGemResult,
    updateAnswerCores,
    updateNeedLauncherGem,
    updateScoreSet,
    updateSolveAnswer,
  } from '../lib/state/profile.state.svelte';
  import SolveCoreEdit from './SolveCoreEdit.svelte';
  import SolveResult from './SolveResult/SolveResult.svelte';

  type Props = {
    profile: CharacterProfile;
  };
  let { profile = $bindable() }: Props = $props();

  let locale = $derived(appLocale.current);
  const LTitle = $derived(
    {
      ko_kr: '최적화 설정',
      en_us: 'Optimization Settings',
    }[locale]
  );
  const LSubtitle = $derived(
    {
      ko_kr: '코어별 최소 포인트 설정',
      en_us: 'Minimum Core Points',
    }[locale]
  );
  const LRunSolve = $derived(
    {
      ko_kr: '최적화 실행',
      en_us: 'Run Optimization',
    }[locale]
  );
  const LFailed = $derived(
    {
      ko_kr: '목표 포인트를 조절해보세요.',
      en_us: 'Please adjust the minimum core points.',
    }[locale]
  );
  const LOrderFailed = $derived(
    {
      ko_kr: '질서 배치 실패',
      en_us: 'Order cores optimization failed',
    }[locale]
  );
  const LChaosFailed = $derived(
    {
      ko_kr: '혼돈 배치 실패',
      en_us: 'Chaos cores optimization failed',
    }[locale]
  );

  const coreComponents: Record<ArkGridAttr, Record<ArkGridCoreType, SolveCoreEdit | null>> = $state(
    Object.fromEntries(
      Object.values(ArkGridAttrs).map((attr) => [
        attr,
        Object.fromEntries(Object.values(ArkGridCoreTypes).map((type) => [type, null])),
      ])
    )
  ) as Record<ArkGridAttr, Record<ArkGridCoreType, SolveCoreEdit | null>>;

  // 이론상 최대 전투력을 구하기 위한 종결젬들
  const perfectGems = [
    {
      req: 3,
      point: 5,
      option1: { optionType: '공격력', value: 5 },
      option2: {
        optionType: '추가 피해',
        value: 5,
      },
    },
    {
      req: 4,
      point: 5,
      option1: { optionType: '공격력', value: 5 },
      option2: {
        optionType: '보스 피해',
        value: 5,
      },
    },
    {
      req: 5,
      point: 5,
      option1: {
        optionType: '추가 피해',
        value: 5,
      },
      option2: {
        optionType: '보스 피해',
        value: 5,
      },
    },
  ] satisfies Partial<ArkGridGem>[];
  const perfectGemsSupporter = [
    {
      req: 3,
      point: 5,
      option1: { optionType: '낙인력', value: 5 },
      option2: {
        optionType: '아군 피해 강화',
        value: 5,
      },
    },
    {
      req: 4,
      point: 5,
      option1: { optionType: '아군 피해 강화', value: 5 },
      option2: {
        optionType: '아군 공격 강화',
        value: 5,
      },
    },
    {
      req: 5,
      point: 5,
      option1: {
        optionType: '낙인력',
        value: 5,
      },
      option2: {
        optionType: '아군 공격 강화',
        value: 5,
      },
    },
  ] satisfies Partial<ArkGridGem>[];

  let failedSign = $derived.by(() => {
    // 배치 실패 여부 반환
    if (profile.solveInfo.after) {
      const answerCores = profile.solveInfo.after.answerCores;
      const solveAnswer = profile.solveInfo.after.solveAnswer;

      // 코어가 애초에 없으면 실패를 안 함
      const allOrderCoresNull =
        !answerCores || Object.values(answerCores['질서']).every((v) => v == null);
      const allChaosCoresNull =
        !answerCores || Object.values(answerCores['혼돈']).every((v) => v == null);

      return {
        order: solveAnswer?.gemSetPackTuple.gsp1 === null && !allOrderCoresNull,
        chaos: solveAnswer?.gemSetPackTuple.gsp2 === null && !allChaosCoresNull,
      };
    }
    return {
      order: false,
      chaos: false,
    };
  });
  let isSupporter = $derived(profile.isSupporter);

  let gemOptionCoeff = $derived(
    !isSupporter ? gemOptionLevelCoeffs : gemOptionLevelCoeffsSupporter
  );

  // 발사대용 젬 계산이 필요한지 판단
  let needLauncherGem: Record<ArkGridAttr, boolean> = { 질서: false, 혼돈: false };
  // 발사대용 젬 계산 결과 임시 보관
  let additionalGem = $derived<AdditionalGemResult>({
    질서: {},
    혼돈: {},
  });

  function convertToSolverGems(
    gem: ArkGridGem[],
    isSupporter: boolean
  ): {
    gems: Gem[];
    reverseMap: ArkGridGem[];
  } {
    // Svelte에서 사용하는 ArkGridGem을 solver가 사용하는 형태로 변경
    const reverseMap: ArkGridGem[] = [];
    const optionIndexMap = !isSupporter
      ? ['공격력', '추가 피해', '보스 피해']
      : ['아군 피해 강화', '낙인력', '아군 공격 강화']; // 수집할 옵션들
    const gems = gem.map((g, index) => {
      let coeff = [0, 0, 0];

      for (const option of [g.option1, g.option2]) {
        const index = optionIndexMap.findIndex((p) => p == option.optionType);
        if (index == -1) continue;
        coeff[index] += option.value;
      }
      reverseMap[index] = g;
      return new Gem(BigInt(index), g.req, g.point, coeff[0], coeff[1], coeff[2]);
    });
    return {
      gems,
      reverseMap,
    };
  }

  function getMaxStat(gss: GemSet[], statType: 'att' | 'skill' | 'boss') {
    // 주어진 GemSet[]에서 가장 높은 statType의 값을 가져옵니다.
    let result = 0;
    for (const gs of gss) {
      if (gs[statType] > result) {
        result = gs[statType];
      }
    }
    return result;
  }

  function assignGem(
    gs: GemSet | null | undefined,
    reverseMap: ArkGridGem[],
    coreIndex: number
  ): ArkGridGem[] {
    // GemSet에서 대응되는 ArkGridGem를 찾아서 assign
    if (!gs) return [];
    let b: bigint = gs.bitmask;
    let pos = 0;
    const result: ArkGridGem[] = [];

    while (b > 0n) {
      if ((b & 1n) == 1n) {
        const gem = reverseMap[pos];
        result.push(gem);
        gem.assign = coreIndex;
      }
      pos += 1;
      b >>= 1n;
    }
    return result;
  }
  function isGspNeedMoreGem(gsp: GemSetPack | null) {
    /*
    주어진 GemSetPack의 Core 중에 적절 포인트 (고대 유물은 17, 전설은 14, 영웅은 10)
    을 못 채운 코어가 하나라도 있는가?

    있으면 필요 젬 분석 로직 돌리게, 없으면 제외
    */

    if (!gsp) return false;
    return [gsp?.gs1, gsp?.gs2, gsp?.gs3].some((p) => {
      if (p == null) return false;

      // core에 따로 grade넣기 보다는 energy로 구분
      let maxPoint = 0;
      switch (p.core.energy) {
        case 9:
          maxPoint = 10;
          break;
        case 12:
          maxPoint = 14;
          break;
        case 15:
        case 17:
          maxPoint = 17;
          break;
      }
      if (maxPoint === 0) return false; // something wrong

      return p.point < maxPoint;
    });
  }

  function solve(
    inOrderGems: ArkGridGem[],
    inChaosGems: ArkGridGem[],
    isSupporter = false, // 서폿용?
    perfectSolve = false, // 중복 무시?
    dryRun = false // 결과 업데이트 여부
  ) {
    /* sovler.Core로 변경 */
    const orderCores: Core[] = [];
    const chaosCores: Core[] = [];
    for (const attr of Object.values(ArkGridAttrs)) {
      for (const ctype of Object.values(ArkGridCoreTypes)) {
        const core = coreComponents[attr][ctype];
        if (!core) continue;
        const targetCores = attr === '질서' ? orderCores : chaosCores;
        if (!profile.cores[attr][ctype]) {
          targetCores.push(new Core(0, 0, [0]));
        } else {
          const solverCore = core.convertToSolverCore();
          if (solverCore) {
            targetCores.push(solverCore);
          }
        }
      }
    }
    /* sovler.Gem으로 변경 */
    const { gems: orderGems, reverseMap: orderGemReverseMap } = convertToSolverGems(
      inOrderGems,
      isSupporter
    );
    const { gems: chaosGems, reverseMap: chaosGemReverseMap } = convertToSolverGems(
      inChaosGems,
      isSupporter
    );

    /* 각 코어별 장착 가능한 조합 (GemSet) 수집 */
    const orderGssList = orderCores.map((c) => {
      return getPossibleGemSets(c, orderGems);
    });
    const chaosGssList = chaosCores.map((c) => {
      return getPossibleGemSets(c, chaosGems);
    });
    if (perfectSolve) {
      // perfectSolve에서는 어짜피 중복 무시할 거라 장착 후 공, 추, 보만 보고 중복 제거
      for (const gssList of [orderGssList, chaosGssList]) {
        for (let i = 0; i < gssList.length; i++) {
          const gss = gssList[i];
          const seen = new Set<string>();
          const uniqueGss: GemSet[] = [];
          for (const gs of gss) {
            const key = JSON.stringify({
              att: gs.att,
              skill: gs.skill,
              boss: gs.boss,
              coreScore: gs.coreCoeff,
            });
            if (!seen.has(key)) {
              seen.add(key);
              uniqueGss.push(gs);
            }
          }
          gssList[i] = uniqueGss;
        }
      }
    }
    const allGssList = orderGssList.concat(chaosGssList);
    /* 공격력, 추가 피해, 보스 피해 Lv의 최대 */
    // 가지고 있는 모든 젬을 사용했을 때 도달할 수 있는 최대 "공격력" 구하기
    // 각 코어가 가진 젬 조합 중 가장 높은 공격력을 가진 것을 고르고 합하는 것으로 가능 (중복 검사는 하지 않음)
    // 러프하지만 빠르게 가능

    // 이를 공격력 이외에도 추가 피해과 보스 피해에 대해서 수행
    let attMax = 0,
      skillMax = 0,
      bossMax = 0;
    for (const gss of allGssList) {
      attMax += getMaxStat(gss, 'att');
      skillMax += getMaxStat(gss, 'skill');
      bossMax += getMaxStat(gss, 'boss');
    }

    const scoreMaps = [
      buildScoreMap(gemOptionCoeff[0], attMax),
      buildScoreMap(gemOptionCoeff[1], skillMax),
      buildScoreMap(gemOptionCoeff[2], bossMax),
    ];

    // 각 GemSet의 전투력 범위 설정
    for (const gss of allGssList) {
      for (const gs of gss) {
        gs.setScoreRange(scoreMaps);
      }
    }

    // 질서와 혼돈 코어에 대해서 중복을 고려한, 장착 가능한 GemSet들이 3개 모인 GemSetPack 계산
    let start = performance.now();
    const orderGspList = getBestGemSetPacks(orderGssList, scoreMaps, perfectSolve);
    if (!dryRun) console.log(`질서 배치 실행 시간: ${performance.now() - start} ms`);
    start = performance.now();
    const chaosGspList = getBestGemSetPacks(chaosGssList, scoreMaps, perfectSolve);
    if (!dryRun) console.log(`혼돈 배치 실행 시간: ${performance.now() - start} ms`);

    // gspList는 maxScore 기준으로 내림차순 정렬되어 있음
    // 서로의 영향력이 적을 수록 실제 전투력은 maxScore와 가까우니, 우선 각 첫 번째 원소를 대상으로 시작 설정
    let answer = new GemSetPackTuple(orderGspList[0] ?? null, chaosGspList[0] ?? null, isSupporter);

    start = performance.now();
    // GemSetPack은 정말 많지만, 실제로 그들의 값 (공, 추, 보, 코어)만 보면 몇 종류 되지 않음
    // 같은 종류라면 하나의 GemSetPack만 수집하기
    const gemSetPackSet: GemSetPack[][] = [[], []];

    for (const [i, gspList] of [orderGspList, chaosGspList].entries()) {
      const seen = new Set<string>();
      for (const gsp of gspList) {
        const signature = {
          att: gsp.att,
          skill: gsp.skill,
          boss: gsp.boss,
          coreScore: gsp.coreScore,
        };
        const key = `${signature.att}|${signature.skill}|${signature.boss}|${signature.coreScore}`;
        if (!seen.has(key)) {
          seen.add(key);
          gemSetPackSet[i].push(gsp);
        }
      }
    }
    if (!dryRun) console.log(`중복 제거 실행 시간: ${performance.now() - start} ms`);
    if (gemSetPackSet[0].length > 0 && gemSetPackSet[1].length > 0) {
      for (const gsp1 of gemSetPackSet[0]) {
        for (const gsp2 of gemSetPackSet[1]) {
          const gspt = new GemSetPackTuple(gsp1, gsp2, isSupporter);
          if (gspt.score > answer.score) {
            answer = gspt;
          }
        }
      }
    }
    if (!dryRun) {
      // 진짜인 경우에만 결과 갱신
      unassignGems();
      updateSolveAnswer({
        assignedGems: JSON.parse(
          JSON.stringify([
            assignGem(answer.gsp1?.gs1, orderGemReverseMap, 0),
            assignGem(answer.gsp1?.gs2, orderGemReverseMap, 1),
            assignGem(answer.gsp1?.gs3, orderGemReverseMap, 2),
            assignGem(answer.gsp2?.gs1, chaosGemReverseMap, 3),
            assignGem(answer.gsp2?.gs2, chaosGemReverseMap, 4),
            assignGem(answer.gsp2?.gs3, chaosGemReverseMap, 5),
          ])
        ), // deep copy gems
        gemSetPackTuple: answer,
      });
      unassignGems(); // gem들에 달린 assign 필드 삭제
      needLauncherGem = {
        질서: isGspNeedMoreGem(answer.gsp1),
        혼돈: isGspNeedMoreGem(answer.gsp2),
      };
    }
    return answer;
  }
  function runSolve(isSupporter: boolean) {
    const orderGems = getCurrentProfile().gems.orderGems;
    const chaosGems = getCurrentProfile().gems.chaosGems;
    const perfectOrderGems: ArkGridGem[] = [];
    const perfectChaosGems: ArkGridGem[] = [];
    for (const gem of !isSupporter ? perfectGems : perfectGemsSupporter) {
      for (let i = 0; i < 4; i++) {
        perfectOrderGems.push({ gemAttr: '질서', ...gem });
        perfectChaosGems.push({ gemAttr: '혼돈', ...gem });
      }
    }
    const answer = solve(orderGems, chaosGems, isSupporter, false, false);
    const score = (answer.score - 1) * 100; // 내 최고 점수
    const bestScore =
      (solve(perfectOrderGems, perfectChaosGems, isSupporter, true, true).score - 1) * 100; // 내 코어로 가능한 점수

    const perfectScore = // 이론상 최고 점수
      !isSupporter // 딜러
        ? ((((((1.09 * // 고대 질서 해
            1.09 * // 고대 질서 달
            1.06 * // 고대 질서 별
            1.04 * // 고대 혼돈 해
            1.04 * // 고대 혼돈 별
            1.04 * // 고대 혼돈 달
            (Math.floor((60 * gemOptionCoeff[0]) / 120) + 10000)) /
            10000) * // 공격력 Lv. 60
            (Math.floor((90 * gemOptionCoeff[1]) / 120) + 10000)) /
            10000) * // 추가 피해 Lv. 90
            (Math.floor((90 * gemOptionCoeff[2]) / 120) + 10000)) /
            10000 - // 보스 피해 Lv. 90
            1) *
          100
        : ((((((1.0942 * // 고대 질서 해
            1.0942 * // 고대 질서 달
            1.033 * // 고대 질서 별
            1.06 * // 고대 혼돈 해
            1.06 * // 고대 혼돈 별
            1.0353 * // 고대 혼돈 달 TODO 무공
            (Math.floor((60 * gemOptionCoeff[0]) / 120) + 10000)) /
            10000) * // 아군 피해 강화 Lv. 60
            (Math.floor((90 * gemOptionCoeff[1]) / 120) + 10000)) /
            10000) * // 낙인력 Lv. 90
            (Math.floor((90 * gemOptionCoeff[2]) / 120) + 10000)) /
            10000 - // 아군 공격 강화 Lv. 90
            1) *
          100;
    updateScoreSet({
      score,
      bestScore,
      perfectScore,
    });
    updateAnswerCores(JSON.parse(JSON.stringify(profile.cores)));

    // 발사대 젬 시뮬레이션이 필요한 사람인지 확인
    additionalGem = {
      질서: {},
      혼돈: {},
    };
    for (const { attr, gsp } of [
      { attr: '질서', gsp: answer.gsp1 },
      { attr: '혼돈', gsp: answer.gsp2 },
    ] satisfies { attr: ArkGridAttr; gsp: GemSetPack | null }[]) {
      // 발사대용 젬 계산이 필요한 attr에 대해서만 수행
      if (needLauncherGem[attr] && gsp) {
        // 현재 달성 코어 포인트 확인
        const currentKey = gemSetPackKey(gsp).join(',');

        // 모든 젬을 한 개씩 추가해서 확인
        // XXX 범위를 줄일까?
        for (let gemReq = 3; gemReq < 10; gemReq++) {
          for (let gemPoint = 5; gemPoint >= 1; gemPoint--) {
            const newGem: ArkGridGem = {
              gemAttr: attr,
              req: gemReq,
              point: gemPoint,
              option1: { optionType: '공격력', value: 0 },
              option2: { optionType: '추가 피해', value: 0 },
            };
            const newAnswer = solve(
              attr === '질서' ? [...orderGems, newGem] : orderGems,
              attr === '혼돈' ? [...chaosGems, newGem] : chaosGems,
              isSupporter,
              false,
              true
            );

            const newGsp = attr === '질서' ? newAnswer.gsp1 : newAnswer.gsp2;
            if (newGsp === null) continue;

            const newKeyRaw = gemSetPackKey(newGsp);
            const newKey = newKeyRaw.join(',');
            const targetAdditionalGem = additionalGem[attr];
            // 계산 후 갱신이 필요하면 수행
            if (newKey !== currentKey && newAnswer.score > answer.score) {
              // console.log(gemReq, gemPoint, '가 있으면', newKey, '달성 가능');
              if (targetAdditionalGem[newKey]) {
                targetAdditionalGem[newKey].gems.push(newGem);
                if (targetAdditionalGem[newKey].score < newAnswer.score) {
                  targetAdditionalGem[newKey].score = newAnswer.score;
                }
              } else {
                targetAdditionalGem[newKey] = {
                  corePointTuple: newKeyRaw,
                  gems: [newGem],
                  score: newAnswer.score,
                };
              }
            }
          }
        }
      }
    }
    updateAdditionalGemResult(additionalGem);
    updateNeedLauncherGem(needLauncherGem);
  }
</script>

<div class="panel">
  <div class="title">{LTitle}</div>
  <div class="container">
    <div class="core-solve-goal-edit">
      <div class="title">{LSubtitle}</div>
      <div class="container">
        {#each Object.values(ArkGridAttrs) as attr}
          {#each Object.values(ArkGridCoreTypes) as ctype}
            <SolveCoreEdit
              {attr}
              {ctype}
              bind:core={profile.cores[attr][ctype]}
              bind:this={coreComponents[attr][ctype]}
            ></SolveCoreEdit>
          {/each}
        {/each}
      </div>
    </div>
    {#if failedSign.order || failedSign.chaos}
      <div class="failed-sign">
        {#if failedSign.order}
          <div class="big">⚠️ {LOrderFailed} ⚠️</div>
        {/if}
        {#if failedSign.chaos}
          <div class="big">⚠️ {LChaosFailed} ⚠️</div>
        {/if}
        <div class="small">{LFailed}</div>
      </div>
    {/if}
    <button class="solve-button" onclick={() => runSolve(isSupporter)} data-track="run-solve"
      >{LRunSolve}</button
    >
    {#if profile.solveInfo.after}
      <SolveResult solveAfter={profile.solveInfo.after}></SolveResult>
    {/if}
  </div>
</div>

<style>
  .panel {
    min-height: 60rem;
  }
  .solve-button {
    font-size: 1.5rem;
    width: 15rem;
    height: 4rem;
    align-self: center;
  }

  .panel > .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .core-solve-goal-edit {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1rem;
  }
  .core-solve-goal-edit > .title {
    font-size: 1.4rem;
    font-weight: 500;
    /* text-align: center; */
  }
  .core-solve-goal-edit > .container {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .failed-sign {
    background: var(--card);
    border-radius: 0.4rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }
  .failed-sign > .big {
    font-weight: 500;
    font-size: 1.2rem;
  }
  .failed-sign > .small {
    font-size: 1rem;
  }
</style>
