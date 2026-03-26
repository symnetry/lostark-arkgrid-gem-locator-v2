<script lang="ts">
  import { toast } from '@zerodevx/svelte-toast';
  import { tick } from 'svelte';

  import { type LocalizationName } from '../../lib/constants/enums';
  import { LChaos, LOrder } from '../../lib/constants/localization';
  import { appLocale } from '../../lib/state/locale.state.svelte';
  import {
    type AllGems,
    addGem,
    clearGems,
    getCurrentProfile,
  } from '../../lib/state/profile.state.svelte';
  import ArkGridGemList from '../ArkGridGemList.svelte';

  interface Props {
    gems: AllGems;
  }

  let { gems }: Props = $props();

  let locale = $derived(appLocale.current);
  const LTitle: LocalizationName = {
    ko_kr: '인식된 젬 목록',
    en_us: 'Recognized Astrogems',
    zh_cn: '已识别的护石列表',
  };
  const LEmpty: LocalizationName = {
    ko_kr: '인식된 젬이 없습니다.',
    en_us: 'No astrogems detected',
    zh_cn: '未检测到护石',
  };
  const LApply: LocalizationName = {
    ko_kr: '현재 프로필에 반영',
    en_us: 'Apply to Current Profile',
    zh_cn: '应用到当前配置',
  };
  const LReset: LocalizationName = {
    ko_kr: '초기화',
    en_us: 'Reset',
    zh_cn: '重置',
  };
  const LConfirm: LocalizationName = {
    ko_kr: '반영 완료',
    en_us: 'Astrogems applied',
    zh_cn: '护石已应用',
  };
  const LWarning: LocalizationName = {
    ko_kr:
      '⚠️현재 프로필에 젬이 존재합니다.\n' +
      '해당 젬을 모두 삭제하고 덮어 씌우시겠습니까?\n' +
      '취소할 경우 인식된 젬이 추가만 됩니다.',
    en_us:
      '⚠️ Astrogems already exist in the current profile.\n' +
      'Do you want to delete all existing astrogems and overwrite them?\n' +
      'If you cancel, the recognized astrogems will only be added.',
    zh_cn:
      '⚠️当前配置中已有护石。\n' +
      '是否要删除所有现有护石并覆盖？\n' +
      '如取消，只会添加已识别的护石。',
  };
  let container: ArkGridGemList;
  let orderGems = $derived(gems.orderGems);
  let chaosGems = $derived(gems.chaosGems);
  let scrollPositions = $state<number[]>([0, 0]);

  const LGemTotalCount = $derived({
    ko_kr: `젬 보유 수량 ${orderGems.length + chaosGems.length} / 100<br>(질서 ${orderGems.length}개, 혼돈 ${chaosGems.length}개
    보유 중)`,
    en_us: `Astrogems Owned: ${orderGems.length + chaosGems.length} / 100<br>(Order ${orderGems.length}, Chaos ${chaosGems.length} owned)`,
    zh_cn: `护石持有量 ${orderGems.length + chaosGems.length} / 100<br>(秩序 ${orderGems.length}个，混沌 ${chaosGems.length}个)`,
  });
  // 탭 상태
  let activeTab = $state(0);
  let tabs = $derived([LOrder[locale], LChaos[locale]]);
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

  export function selectTab(index: number) {
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
  export function scroll(command: 'top' | 'bottom') {
    container.scroll(command);
  }

  function applyGemList(overrideGem: boolean) {
    // 현재 수집한 젬을 현재 프로필에 덮어 씌우기
    let done = false;
    if (orderGems.length > 0) {
      if (overrideGem) clearGems('질서');
      for (const gem of orderGems) {
        addGem(gem);
      }
      done = true;
    }
    if (chaosGems.length > 0) {
      if (overrideGem) clearGems('혼돈');
      for (const gem of chaosGems) {
        addGem(gem);
      }
      done = true;
    }
    return done;
  }
</script>

<div class="panel">
  <div class="title">{LTitle[locale]}</div>
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
    showDeleteButton={false}
    emptyDescription={LEmpty[locale]}
    bind:this={container}
  ></ArkGridGemList>
  <div class="gem-count">
    {@html LGemTotalCount[locale]}
  </div>
  <div class="buttons">
    <div>
      <button
        disabled={orderGems.length == 0 && chaosGems.length == 0}
        onclick={() => {
          // 혼돈 젬을 인식하지 않은 경우 한 번 경고
          // if (chaosGems.length == 0) {
          //   if (
          //     !window.confirm(
          //       '혼돈 젬을 인식하지 않았습니다. 진행하시겠습니까?'
          //     )
          //   )
          //     return;
          // }

          // 현재 프로필에 젬이 있는 경우 덮어 씌울 것인지 물음
          const profile = getCurrentProfile();
          let overrideGem = true;

          if (profile.gems.orderGems.length > 0 || profile.gems.chaosGems.length > 0) {
            overrideGem = window.confirm(LWarning[locale]);
          }
          if (applyGemList(overrideGem)) toast.push(LConfirm[locale]);
        }}
      >
        ✅ {LApply[locale]}
      </button>
    </div>
    <div>
      <button
        disabled={orderGems.length == 0 && chaosGems.length == 0}
        onclick={() => {
          orderGems.length = 0;
          chaosGems.length = 0;
        }}>{LReset[locale]}</button
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
  }
  .buttons button {
    /* 너비는 자동이지만 최소 5em */
    width: auto;
    min-width: 5em;
  }
</style>
