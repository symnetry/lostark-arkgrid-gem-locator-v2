<script lang="ts">
  import { ArkGridAttrs, type LocalizationName } from '../lib/constants/enums';
  import { LDealeer, LSupporter } from '../lib/constants/localization';
  import { ArkGridCoreTypes, resetCoreCoeff } from '../lib/models/arkGridCores';
  import { appConfig, toggleUI } from '../lib/state/appConfig.state.svelte';
  import { appLocale } from '../lib/state/locale.state.svelte';
  import {
    type CharacterProfile,
    imgRoleCombat,
    imgRoleSupporter,
    updateIsSupporter,
  } from '../lib/state/profile.state.svelte';
  import ArkGridCoreEditElement from './ArkGridCoreEditElement.svelte';

  interface Props {
    profile: CharacterProfile;
  }
  let { profile }: Props = $props();

  let locale = $derived(appLocale.current);
  const LTitle: LocalizationName = {
    ko_kr: '코어 설정',
    en_us: 'Core Setting',
    zh_cn: '核心设置',
  };

  let cores = $derived(profile.cores);
  let isSupporter = $derived(profile.isSupporter);
  const LSwitchRole = $derived({
    ko_kr: `${isSupporter ? LDealeer.ko_kr : LSupporter.ko_kr}로 전환`,
    en_us: `Switch to ${isSupporter ? LDealeer.en_us : LSupporter.en_us}`,
    zh_cn: `切换到${isSupporter ? LDealeer.zh_cn : LSupporter.zh_cn}`,
  });
  const LShowCoeff: LocalizationName = {
    ko_kr: '전투력 계수 보기',
    en_us: 'Display Core Coeff.',
    zh_cn: '显示核心系数',
  };
  const LHideCoeff: LocalizationName = {
    ko_kr: '전투력 계수 숨김',
    en_us: 'Hide Core Coeff.',
    zh_cn: '隐藏核心系数',
  };

  const attrs = Object.values(ArkGridAttrs);
  const ctypes = Object.values(ArkGridCoreTypes);

  function toggleIsSupporter() {
    // 딜러 서폿 전환
    updateIsSupporter(!profile.isSupporter);

    // 코어들 계수 서폿용으로 다시 입력
    for (const attr of attrs) {
      for (const ctype of ctypes) {
        const core = cores[attr][ctype];
        if (!core) continue;
        core.tier = 0; // 티어 모두 초기화. TODO 티어 저장? 굳이?
        resetCoreCoeff(core, isSupporter, profile.weapon);
      }
    }
  }
</script>

<div class="panel">
  <div class="title-and-button">
    <div class="title">
      {LTitle[locale]} - {isSupporter ? LSupporter[locale] : LDealeer[locale]}
      <img src={profile.isSupporter ? imgRoleSupporter : imgRoleCombat} alt="role" />
    </div>
    <button onclick={toggleIsSupporter}>⇆ {LSwitchRole[locale]}</button>
  </div>
  {#each attrs as attr}
    {#each ctypes as ctype}
      <ArkGridCoreEditElement {attr} {ctype} {isSupporter} weapon={profile.weapon}
      ></ArkGridCoreEditElement>
    {/each}
  {/each}
  <div class="buttons">
    <button
      onclick={() => {
        toggleUI('showCoreCoeff');
      }}
    >
      {appConfig.current.uiConfig.showCoreCoeff ? LHideCoeff[locale] : LShowCoeff[locale]}
    </button>
  </div>
</div>

<style>
  .panel {
    position: relative; /* overlay 위치 기준 */
  }

  /* 버튼 모음 */
  .buttons {
    /* 버튼 모음은 panel 가장 하단 */
    margin-top: auto;
    display: flex;
    gap: 0.4rem;
    justify-content: right;
  }
  .buttons > button {
    /* 너비는 자동이지만 최소 5em */
    width: auto;
    min-width: 5em;
  }
  .title-and-button {
    display: flex;
    flex-direction: row;
    /* justify-content: space-between; */
    /* 이거 대신 button에게 margin-left를 사용함 */
    flex-wrap: wrap;
    gap: 0.7rem;
  }
  .title-and-button .title {
    /* flex 기본 크기를 내용물(auto)대로 설정 */
    /* 이게 없이 wrap만 설정하면, 좁아져도 줄바꿈을 해야하는 이유를 모름 */
    flex-basis: auto;
    font-size: 1.4rem;
    font-weight: 700;
  }
  .title-and-button button {
    margin-left: auto; /* 남는 공간을 밀어 버튼을 오른쪽으로 */
  }
  .title {
    display: flex;
    flex-direction: row;
    flex: 1;
    gap: 0.3rem;
    align-items: center;
  }
  .title > img {
    height: 75%;
    transform: translateY(1px);
  }
</style>
