<script lang="ts">
  import { toast } from '@zerodevx/svelte-toast';
  import { tick } from 'svelte';

  import { type ArkGridAttr } from '../lib/constants/enums';
  import { LChaos, LOrder } from '../lib/constants/localization';
  import { appLocale } from '../lib/state/locale.state.svelte';
  import { type AllGems, clearGems } from '../lib/state/profile.state.svelte';
  import ArkGridGemAddPanel from './ArkGridGemAddPanel.svelte';
  import ArkGridGemList from './ArkGridGemList.svelte';

  interface Props {
    gems: AllGems;
  }

  let { gems }: Props = $props();
  let showDeleteButton = $state(false);

  $effect(() => {
    gems;
    showDeleteButton = false;
  });

  // 탭 상태
  let locale = $derived(appLocale.current);
  let activeTab = $state(0);
  let tabs = $derived([LOrder[locale], LChaos[locale]]);
  let container: ArkGridGemList;
  let scrollPositions = $state<number[]>([0, 0]);

  function selectTab(index: number) {
    scrollPositions[activeTab] = container?.getScrollTop?.() ?? 0;
    activeTab = index;
    // 다음 tick 이후 복원
    queueMicrotask(async () => {
      await tick();
      await new Promise(requestAnimationFrame);

      const pos = scrollPositions[index];
      if (pos != null) {
        container.scrollToPosition(pos);
      }
    });
  }

  // reactive variable
  let currentGems = $derived.by(() => {
    switch (activeTab) {
      case 0:
        return gems.orderGems;
      case 1:
        return gems.chaosGems;
      default:
        return [];
    }
  });
  let currentAttr: ArkGridAttr = $derived(activeTab == 0 ? '질서' : '혼돈');

  function clearGemWithConfirm() {
    if (!window.confirm(LResetConfirm)) return;
    clearGems();
    const doneMsg = LResetDone;
    if (doneMsg) toast.push(doneMsg);
  }
  const LTitle = $derived(
    {
      ko_kr: '젬 목록',
      en_us: 'Astrogems',
      zh_cn: '护石列表',
    }[locale]
  );
  const LGemTotalCount = $derived(
    {
      ko_kr: `젬 보유 수량 ${gems.orderGems.length + gems.chaosGems.length} / 100<br>(질서 ${gems.orderGems.length}개, 혼돈 ${gems.chaosGems.length}개
    보유 중)`,
      en_us: `Astrogems Owned: ${gems.orderGems.length + gems.chaosGems.length} / 100<br>(Order ${gems.orderGems.length}, Chaos ${gems.chaosGems.length} owned)`,
      zh_cn: `护石持有数量 ${gems.orderGems.length + gems.chaosGems.length} / 100<br>(秩序 ${gems.orderGems.length}个，混沌 ${gems.chaosGems.length}个持有中)`,
    }[locale]
  );
  const LEmpty = $derived(
    {
      ko_kr: '인식된 젬이 없습니다.',
      en_us: 'No astrogems owned',
      zh_cn: '没有识别到护石。',
    }[locale]
  );
  const LDeleteGem = $derived(
    {
      ko_kr: '젬 삭제',
      en_us: 'Delete',
      zh_cn: '删除',
    }[locale]
  );
  const LReset = $derived(
    {
      ko_kr: '전체 초기화',
      en_us: 'Reset',
      zh_cn: '全部重置',
    }[locale]
  );
  const LResetConfirm = $derived(
    {
      ko_kr: '현재 프로필의 모든 젬을 삭제합니다. 진행하시겠습니까?',
      en_us: 'This will delete all astrogems in the current profile. Do you want to proceed?',
      zh_cn: '将删除当前配置中的所有护石。确定要继续吗？',
    }[locale]
  );
  const LResetDone = $derived(
    {
      ko_kr: '젬 삭제 완료',
      en_us: 'Astrogems reset',
      zh_cn: '护石已重置',
    }[locale]
  );
</script>

<div class="panel">
  <div class="title">{LTitle}</div>
  <div class="tab-container">
    {#each tabs as tab, i}
      <button class="tab {activeTab === i ? 'active' : ''}" onclick={() => selectTab(i)}>
        {#if activeTab === i}
          &gt
        {/if}
        {tab}
      </button>
    {/each}
  </div>
  <ArkGridGemList
    gems={currentGems}
    bind:this={container}
    {showDeleteButton}
    emptyDescription={LEmpty}
  ></ArkGridGemList>
  <div class="gem-count">
    {@html LGemTotalCount}
  </div>
  <div class="buttons">
    <div class="left">
      <ArkGridGemAddPanel gemAttr={currentAttr}></ArkGridGemAddPanel>
    </div>
    <div class="right">
      <button
        disabled={gems.orderGems.length == 0 && gems.chaosGems.length == 0}
        onclick={() => (showDeleteButton = !showDeleteButton)}
      >
        {LDeleteGem}
      </button>
      <button
        disabled={gems.orderGems.length == 0 && gems.chaosGems.length == 0}
        onclick={() => clearGemWithConfirm()}>{LReset}</button
      >
    </div>
  </div>
</div>

<style>
  .tab-container {
    display: flex;
    gap: 0.3em;
  }

  .tab {
    border: 1px solid #ccc;
    cursor: pointer;
  }

  .tab.active {
    background-color: var(--card);
    font-weight: bold;
  }
  .gem-count {
    align-self: center;
    text-align: center;
  }

  /* 버튼 모음 */
  .buttons {
    display: flex;
    gap: 0.4rem;
    justify-content: space-between;
    /* 버튼 모음은 panel 가장 하단 */
    margin-top: auto;
  }
  .buttons button {
    /* 너비는 자동이지만 최소 5em */
    width: auto;
    min-width: 5em;
  }
</style>
