<script lang="ts">
  import { type ArkGridGemOptionName, ArkGridGemOptionTypes } from '../../lib/models/arkGridGems';
  import { appLocale } from '../../lib/state/locale.state.svelte';
  import type { SolveAnswer } from '../../lib/state/profile.state.svelte';

  type Props = {
    solveAnswer: SolveAnswer;
  };
  let { solveAnswer }: Props = $props();
  let answerStatistics: Record<ArkGridGemOptionName, number> = $derived.by(() => {
    let statistics = {
      공격력: 0,
      '보스 피해': 0,
      '추가 피해': 0,
      낙인력: 0,
      '아군 공격 강화': 0,
      '아군 피해 강화': 0,
    };
    if (!solveAnswer) return statistics;
    for (const gems of solveAnswer.assignedGems) {
      for (const gem of gems) {
        statistics[gem.option1.optionType] += gem.option1.value;
        statistics[gem.option2.optionType] += gem.option2.value;
      }
    }
    return statistics;
  });
  let locale = $derived(appLocale.current);
  const LTitle = $derived(
    {
      ko_kr: '젬 옵션',
      en_us: 'Astrogem Options',
      zh_cn: '护石选项',
    }[locale]
  );
</script>

<div class="root">
  <div class="title">{LTitle}</div>
  <div class="container">
    {#each Object.entries(ArkGridGemOptionTypes) as [optionName, optionType]}
      {#if answerStatistics[optionName as ArkGridGemOptionName] != 0}
        <div class="item">
          {optionType.name[locale]} Lv {answerStatistics[optionName as ArkGridGemOptionName]}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .root {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    max-width: 20rem;
    box-sizing: border-box;
  }
  .title {
    font-weight: 500;
    font-size: 1.4em;
  }
  .container {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.2rem;
  }
  .item {
    /* border: 1px black solid; */
    background-color: var(--border);
    padding: 0.5rem;
  }
</style>
