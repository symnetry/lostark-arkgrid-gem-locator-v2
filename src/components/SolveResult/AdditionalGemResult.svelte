<script lang="ts">
  import { type ArkGridAttr, ArkGridAttrs } from '../../lib/constants/enums';
  import { LChaos, LOrder } from '../../lib/constants/localization';
  import { gemSetPackKey } from '../../lib/solver/utils';
  import { appLocale } from '../../lib/state/locale.state.svelte';
  import type {
    AdditionalGemResult,
    NeedLauncherGem,
    SolveAnswer,
  } from '../../lib/state/profile.state.svelte';

  type Props = {
    additionalGemResult: AdditionalGemResult;
    solveAnswer: SolveAnswer;
    needLauncherGem: NeedLauncherGem;
  };
  const { additionalGemResult, solveAnswer, needLauncherGem }: Props = $props();

  let currentKey = $derived<Record<ArkGridAttr, [number, number, number]>>({
    질서: gemSetPackKey(solveAnswer.gemSetPackTuple.gsp1),
    혼돈: gemSetPackKey(solveAnswer.gemSetPackTuple.gsp2),
  });
  const sortedAdditionalGemResult = $derived({
    질서: Object.values(additionalGemResult['질서']).sort((a, b) => b.score - a.score),
    혼돈: Object.values(additionalGemResult['혼돈']).sort((a, b) => b.score - a.score),
  });
  const isEmpty = $derived({
    질서: Object.keys(additionalGemResult['질서']).length === 0,
    혼돈: Object.keys(additionalGemResult['혼돈']).length === 0,
  });

  function prettyCorePoints(attr: ArkGridAttr, v: [number, number, number]) {
    // 코어 포인트를 증감 여부와 함께 표시
    return [
      {
        value: v[0],
        increased: v[0] > currentKey[attr][0],
        decreased: v[0] < currentKey[attr][0],
      },
      {
        value: v[1],
        increased: v[1] > currentKey[attr][1],
        decreased: v[1] < currentKey[attr][1],
      },
      {
        value: v[2],
        increased: v[2] > currentKey[attr][2],
        decreased: v[2] < currentKey[attr][2],
      },
    ];
  }
  function prettyScoreDiff(v: number, o: number) {
    // 전투력 %p 차이를 소숫점 2번째 자리까지 표시
    return `${((v - o) * 100).toFixed(2)}%`;
  }

  // i18n
  let locale = $derived(appLocale.current);
  const LTitle = $derived(
    {
      ko_kr: '젬 추가 시뮬레이션',
      en_us: 'Next Astrogem Preview',
      zh_cn: '追加护石预览',
    }[locale]
  );
  const LAttr = { 질서: LOrder, 혼돈: LChaos };
  const LTitleDesc = $derived(
    {
      ko_kr:
        '17P를 달성하지 못한 사용자들을 위해 하나의 젬을 추가로 가공했을 때 가능한 배치들을 보여줍니다. ',
      en_us:
        'This shows the possible combinations when an additional astrogem is added for users who have not reached 17P. ',
      zh_cn:
        '这向未达到17P的用户显示，当额外加工一个护石时可能的组合。',
    }[locale]
  );
  const LCurrentPoints = $derived(
    {
      ko_kr: '현재 코어 포인트',
      en_us: 'Current Core Points',
      zh_cn: '当前核心点数',
    }[locale]
  );
  const LMaximumPoint = $derived(
    {
      ko_kr: '최대 포인트에 도달하였습니다.',
      en_us: 'Maximum Points Reached.',
      zh_cn: '已达到最大点数。',
    }[locale]
  );
  const LCannotSucceedWithOneGem = $derived(
    {
      ko_kr: '한 개의 추가 젬만으로는 다음 단계를 달성할 수 없습니다.',
      en_us: 'You cannot reach the next stage with only one additional astrogem.',
      zh_cn: '仅追加一个护石无法达到下一阶段。',
    }[locale]
  );
</script>

<div class="root">
  <div class="title">
    {LTitle}
    <span class="tooltip">
      <i class="fa-solid fa-circle-info info-icon"></i>
      <span class="tooltip-text">{LTitleDesc}</span>
    </span>
  </div>
  {#each ArkGridAttrs as attr}
    <div class="attr-container">
      <div class="title">
        <div class="main">
          {LAttr[attr][locale]}<br />
        </div>
        <div class="sub core-points">
          {LCurrentPoints}
          {#each prettyCorePoints(attr, currentKey[attr]) as cp, i}
            <span class:increased={cp.increased}>{cp.value}</span>
            {#if i < 2}
              <span class="sep">/&nbsp;</span>
            {/if}
          {/each}
        </div>
      </div>
      <div class="scenario-container">
        {#if isEmpty[attr]}
          <!-- 두 가지 이유로 empty일 수 있다. 1개 만으로는 다음 단계를 달성할 수 없거나, 발사대가 필요 없거나 -->
          {#if needLauncherGem[attr]}
            {LCannotSucceedWithOneGem}
          {:else}
            {LMaximumPoint}
          {/if}
        {/if}
        {#each sortedAdditionalGemResult[attr] as value}
          <div class="scenario">
            <div class="core-points">
              {#each prettyCorePoints(attr, value.corePointTuple) as cp, i}
                <span class:increased={cp.increased} class:decreased={cp.decreased}>{cp.value}</span
                >
                {#if i < 2}
                  <span class="sep">/&nbsp;</span>
                {/if}
              {/each}
              <span class="cp-diff">
                {prettyScoreDiff(value.score, solveAnswer.gemSetPackTuple.score)}
              </span>
            </div>
            <div class="gem-container">
              {#each value.gems as gem}
                <div class="gem">
                  {gem.req} / {gem.point}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .root {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }
  .root > .title {
    font-weight: 500;
    font-size: 1.4em;
  }
  /* 속성별 컨테이너 */
  .attr-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .attr-container > .title {
    text-align: center;
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0) 0%,
      var(--title-shadow) 30%,
      var(--title-shadow) 70%,
      rgba(0, 0, 0, 0) 100%
    );
  }
  .attr-container > .title > .main {
    font-weight: 500;
    font-size: 1.2em;
  }
  .attr-container > .title > .sub {
    font-size: 1em;
  }

  /* 추가 젬으로 가능한 시나리오들 */
  .scenario-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .scenario {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .scenario .core-points::before {
    content: '‣ ';
  }
  /* 전투력 변화량 */
  .cp-diff {
    font-size: 0.85rem;
  }
  .cp-diff::before {
    content: '(+';
  }
  .cp-diff::after {
    content: ')';
  }

  /* 시나리오를 달성하기 위해 가능한 젬들 */
  .gem-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .gem {
    flex: 0 0 auto;
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 999em;
    padding: 0.3rem 0.6rem;
    align-items: center;
    justify-content: center;
    background-color: var(--border);
  }
</style>
