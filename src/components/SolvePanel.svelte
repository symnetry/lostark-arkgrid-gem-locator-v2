<script lang="ts">
  import { onDestroy } from 'svelte';

  import { type AppLocale, ArkGridAttrs } from '../lib/constants/enums';
  import { ArkGridCoreTypes } from '../lib/models/arkGridCores';
  import type { ArkGridGem } from '../lib/models/arkGridGems';
  import { SolverController } from '../lib/solver/solverController';
  import type { SolverProgress, SolverProgressStage } from '../lib/solver/types';
  import { appLocale } from '../lib/state/locale.state.svelte';
  import {
    type CharacterProfile,
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
  type ProgressLogEntry = {
    header: string;
    text: string;
  };
  let { profile = $bindable() }: Props = $props();

  let locale = $derived(appLocale.current);
  const LTitle = $derived(
    {
      ko_kr: '최적화 설정',
      en_us: 'Optimization Settings',
      zh_cn: '优化设置',
    }[locale]
  );
  const LSubtitle = $derived(
    {
      ko_kr: '코어별 최소 포인트 설정',
      en_us: 'Minimum Core Points',
      zh_cn: '核心最小点数设置',
    }[locale]
  );
  const LRunSolve = $derived(
    {
      ko_kr: '최적화 실행',
      en_us: 'Run Optimization',
      zh_cn: '执行优化',
    }[locale]
  );
  const LRunning = $derived(
    {
      ko_kr: '계산 중...',
      en_us: 'Optimizing...',
      zh_cn: '正在优化...',
    }[locale]
  );
  const LProgressTitle = $derived(
    {
      ko_kr: '진행 상황',
      en_us: 'Optimization Progress',
      zh_cn: '优化进度',
    }[locale]
  );
  const LFailed = $derived(
    {
      ko_kr: '목표 포인트를 조절해보세요.',
      en_us: 'Please adjust the minimum core points.',
      zh_cn: '请调整最小核心点数。',
    }[locale]
  );
  const LOrderFailed = $derived(
    {
      ko_kr: '질서 배치 실패',
      en_us: 'Order cores optimization failed',
      zh_cn: '秩序核心优化失败',
    }[locale]
  );
  const LChaosFailed = $derived(
    {
      ko_kr: '혼돈 배치 실패',
      en_us: 'Chaos cores optimization failed',
      zh_cn: '混沌核心优化失败',
    }[locale]
  );

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
  const solverController = new SolverController();
  let isSolving = $state(false);
  let solveProgress = $state<SolverProgress | null>(null);
  let progressLog = $state<ProgressLogEntry[]>([]);

  solverController.onProgress = (progress: SolverProgress) => {
    solveProgress = progress;
    const header = getProgressLogKey(progress);
    const text = `${progress.stagePercent}% ${getProgressLabel(progress)}`;
    const index = progressLog.findIndex((entry) => entry.header === header);

    // progress가 새로 온 거면 하단에 추가, 이미 있는 거면 텍스트만 바꿔치기
    if (index === -1) {
      progressLog = [...progressLog, { header, text }];
      return;
    }

    if (progressLog[index].text === text) {
      return;
    }

    progressLog = progressLog.map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, text } : entry
    );
  };

  onDestroy(() => {
    solverController.destroy();
  });

  function cloneAssignedGem(gem: ArkGridGem, coreIndex: number): ArkGridGem {
    return JSON.parse(JSON.stringify({ ...gem, assign: coreIndex }));
  }

  function buildAssignedGems(assignedGemIndexes: number[][]): ArkGridGem[][] {
    const orderGems = profile.gems.orderGems;
    const chaosGems = profile.gems.chaosGems;
    const gemPools = [orderGems, orderGems, orderGems, chaosGems, chaosGems, chaosGems];

    return assignedGemIndexes.map((indexes, coreIndex) =>
      indexes.map((gemIndex) => cloneAssignedGem(gemPools[coreIndex][gemIndex], coreIndex))
    );
  }

  function getProgressLabel(progress: SolverProgress | null) {
    if (!progress) {
      return '';
    }

    const LProgressStage: Record<AppLocale, Record<SolverProgressStage, string>> = {
      ko_kr: {
        preparing: '입력 정리 중',
        searching_order_packs: '질서 최적 조합 탐색 중',
        searching_chaos_packs: '혼돈 최적 조합 탐색 중',
        combining_results: '두 조합을 모두 고려하여 최적해 탐색 중',
        simulating_launcher_gems: '젬 추가 시뮬레이션 중',
        finalizing: '결과 정리 중',
      },
      en_us: {
        preparing: 'Preparing inputs',
        searching_order_packs: 'Searching for Order combinations',
        searching_chaos_packs: 'Searching for Chaos combinations',
        combining_results: 'Merging both combinations',
        simulating_launcher_gems: 'Simulating Next Astrogem Preview',
        finalizing: 'Finalizing result',
      },
      zh_cn: {
        preparing: '准备输入中',
        searching_order_packs: '搜索秩序最佳组合中',
        searching_chaos_packs: '搜索混沌最佳组合中',
        combining_results: '综合两个组合搜索最佳解中',
        simulating_launcher_gems: '追加护石模拟中',
        finalizing: '整理结果中',
      },
    };
    const baseLabel = LProgressStage[locale][progress.stage];

    if (progress.stage !== 'simulating_launcher_gems' || !progress.total || !progress.current) {
      return baseLabel;
    }

    const attrLabel =
      {
        ko_kr: {
          질서: '질서',
          혼돈: '혼돈',
        },
        en_us: {
          질서: 'Order',
          혼돈: 'Chaos',
        },
        zh_cn: {
          질서: '秩序',
          혼돈: '混沌',
        },
      }[locale]?.[progress.attr ?? '질서'] || '';

    return `${baseLabel} (${attrLabel} ${progress.current}/${progress.total})`;
  }

  function getProgressLogKey(progress: SolverProgress | null) {
    if (!progress) {
      return '';
    }

    if (progress.stage !== 'simulating_launcher_gems') {
      return progress.stage;
    }

    return `${progress.stage}:${progress.attr ?? ''}`;
  }

  async function runSolve() {
    if (isSolving) return;

    isSolving = true;
    progressLog = [];
    solveProgress = {
      stage: 'preparing',
      totalPercent: 0,
      stagePercent: 0,
    };

    try {
      const result = await solverController.runSolve(profile);

      updateSolveAnswer({
        assignedGems: buildAssignedGems(result.assignedGemIndexes),
        gemSetPackTuple: result.gemSetPackTuple,
      });
      updateScoreSet(result.scoreSet);
      updateAnswerCores(JSON.parse(JSON.stringify(profile.cores)));
      updateAdditionalGemResult(result.additionalGemResult);
      updateNeedLauncherGem(result.needLauncherGem);
    } catch (error) {
      console.error(error);
    } finally {
      isSolving = false;
      if (solveProgress) {
        solverController.onProgress?.({
          ...solveProgress,
          stage: 'finalizing',
          totalPercent: 100,
          stagePercent: 100,
        });
      }
    }
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
            <SolveCoreEdit {attr} {ctype} bind:core={profile.cores[attr][ctype]}></SolveCoreEdit>
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
    <button class="solve-button" onclick={runSolve} disabled={isSolving} data-track="run-solve"
      >{isSolving ? LRunning : LRunSolve}</button
    >
    {#if solveProgress || progressLog.length > 0}
      <div class="solve-progress">
        <div class="title">{LProgressTitle}</div>
        {#if solveProgress}
          <div class="progress-label">
            <span>{getProgressLabel(solveProgress)}</span>
            <span>{solveProgress.stagePercent}%</span>
          </div>
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={solveProgress.totalPercent}
          >
            <div class="fill" style={`width: ${solveProgress.totalPercent}%`}></div>
          </div>
        {/if}
        <div class="progress-log">
          {#each progressLog as entry}
            <div class="progress-log-entry">{entry.text}</div>
          {/each}
        </div>
      </div>
    {/if}
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
  .solve-progress {
    width: min(32rem, 100%);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0.4rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .solve-progress > .title {
    font-size: 1rem;
    font-weight: 600;
  }
  .progress-label {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.95rem;
  }
  .progress-bar {
    width: 100%;
    height: 0.75rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--border) 70%, white);
    overflow: hidden;
  }
  .progress-bar > .fill {
    height: 100%;
    background: linear-gradient(90deg, #2f6fed 0%, #5aa1ff 100%);
    transition: width 160ms ease-out;
  }
  .progress-log {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 10rem;
    overflow: auto;
    padding-top: 0.25rem;
    border-top: 1px solid var(--border);
  }
  .progress-log-entry {
    font-size: 0.9rem;
    color: var(--text-muted, inherit);
    line-height: 1.3;
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
