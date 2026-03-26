<script lang="ts">
  import { type ArkGridAttr } from '../../lib/constants/enums';
  import { formatCoreType } from '../../lib/constants/localization';
  import {
    type ArkGridCore,
    type ArkGridCoreType,
    getDefaultCoreEnergy,
  } from '../../lib/models/arkGridCores';
  import { type ArkGridGem } from '../../lib/models/arkGridGems';
  import { appLocale } from '../../lib/state/locale.state.svelte';
  import ArkGridGemDetail from '../ArkGridGemDetail.svelte';

  let {
    attr,
    ctype,
    core,
    gems,
  }: {
    attr: ArkGridAttr;
    ctype: ArkGridCoreType;
    core: ArkGridCore | null;
    gems: ArkGridGem[];
  } = $props();

  let corePoint = $derived.by(() => {
    return gems.reduce((sum, gem) => {
      return sum + gem.point;
    }, 0);
  });
  let usedPower = $derived.by(() => {
    return gems.reduce((sum, gem) => {
      return sum + gem.req;
    }, 0);
  });
  let locale = $derived(appLocale.current);
  const LTitle = $derived(formatCoreType(attr, ctype, locale));
  const LPoint = $derived(
    {
      ko_kr: '포인트',
      en_us: 'Points',
      zh_cn: '点数',
    }[locale]
  );
  const LCosts = $derived(
    {
      ko_kr: '의지력',
      en_us: 'Costs',
      zh_cn: '消耗',
    }[locale]
  );
</script>

<div class="root">
  <div class="title">
    <div class="name">
      {LTitle}
    </div>
  </div>
  <div class="core-point-and-power">
    <div class="item" hidden={!core}>{LPoint} {corePoint}</div>
    <div class="item" hidden={!core}>
      {LCosts}
      {usedPower}/{getDefaultCoreEnergy(core)}
    </div>
  </div>
  <div class="gems">
    {#each gems as gem}
      <ArkGridGemDetail {gem} showDeleteButton={false}></ArkGridGemDetail>
    {/each}
  </div>
</div>

<style>
  .root {
    width: 18rem;
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    height: 21rem;

    border: 1px solid var(--border);
    border-radius: 0.4rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
  .title {
    font-weight: 500;
    font-size: 1.2rem;
    align-self: center;
  }
  .gems {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .core-point-and-power {
    font-size: 0.9rem;
    align-self: center;
    display: flex;
    flex-direction: row;
    justify-content: space-around;
  }
  .core-point-and-power > .item {
    padding: 0.5rem;
  }
  @media (max-width: 960px) {
    .root {
      /* 모바일일 땐 굳이 높이 지킬 필요 없음 */
      height: 0%;
    }
  }
</style>
