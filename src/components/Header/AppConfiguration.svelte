<script lang="ts">
  import { toast } from '@zerodevx/svelte-toast';
  import { onMount } from 'svelte';

  import {
    type LocalizationName,
  } from '../../lib/constants/enums';
  import { apiClient } from '../../lib/openapi';
  import alipayQR from '../../assets/alipay.png';
  import wechatQR from '../../assets/wechat.png';
  import {
    appConfig,
    toggleDarkMode,
    toggleUI,
    updateOpenApiJWT,
  } from '../../lib/state/appConfig.state.svelte';
  import { appLocale, toggleLocale } from '../../lib/state/locale.state.svelte';

  let showDonationModal = $state(false);
  let locale = $derived(appLocale.current);
  const LDarkMode: LocalizationName = {
    ko_kr: '다크 모드',
    en_us: 'Dark Mode',
    zh_cn: '暗黑模式',
  };
  const LOpenAPIConfig: LocalizationName = {
    ko_kr: 'OpenAPI 설정',
    en_us: 'Config OpenAPI',
    zh_cn: 'OpenAPI 设置',
  };
  const LBuyMeACoffee: LocalizationName = {
    ko_kr: '커피 한잔 사주세요',
    en_us: 'Buy Me a Coffee',
    zh_cn: '请我喝一杯',
  };





  function updateOpenApiConfig() {
    // 값 반영하기
    let jwtInput = window.prompt(
      '로스트아크 OpenAPI JWT를 입력해주세요',
      appConfig.current.openApiConfig.jwt
    );
    if (!jwtInput) {
      return;
    }
    if (jwtInput == appConfig.current.openApiConfig.jwt) return;
    updateOpenApiJWT(jwtInput);
    toast.push('OpenAPI JWT 갱신 완료');
  }
  onMount(() => {
    const jwt = appConfig.current.openApiConfig.jwt;
    if (jwt) {
      apiClient.setSecurityData({ jwt });
    }
  });
</script>

<div class="buttons">
  <button onclick={updateOpenApiConfig} disabled={locale !== 'ko_kr'}
    >{LOpenAPIConfig[locale]}</button
  >
  <button onclick={() => showDonationModal = true} data-track="buy-me-a-coffee"
    >{LBuyMeACoffee[locale]}</button
  >
  <button hidden={!appConfig.current.uiConfig.debugMode} onclick={() => toggleUI('debugMode')}
    >개발자 모드 {appConfig.current.uiConfig.debugMode ? '끄기' : '켜기'}</button
  >
  <button onclick={toggleDarkMode} style="">
    {LDarkMode[locale]}
    <i
      class="fa-solid"
      class:fa-toggle-on={appConfig.current.uiConfig.darkMode}
      class:fa-toggle-off={!appConfig.current.uiConfig.darkMode}
    ></i>
  </button>
  <button onclick={toggleLocale}>Locale {locale}</button>
</div>

{#if showDonationModal}
<div class="modal-overlay" onclick={() => showDonationModal = false}>
  <div class="modal-content" onclick={(e) => e.stopPropagation()}>
    <button class="modal-close" onclick={() => showDonationModal = false}>×</button>
    <h2>{LBuyMeACoffee[locale]}</h2>
    <p>If you find this tool helpful, consider buying me a coffee to support development!</p>
    <div class="donation-options">
      <div class="donation-option">
        <h3>Alipay (支付宝)</h3>
        <img src={alipayQR} alt="Alipay QR Code" class="qrcode" />
        <p>Scan with Alipay app</p>
      </div>
      <div class="donation-option">
        <h3>WeChat Pay (微信支付)</h3>
        <img src={wechatQR} alt="WeChat Pay QR Code" class="qrcode" />
        <p>Scan with WeChat app</p>
      </div>
    </div>
  </div>
</div>
{/if}

<style>
  .buttons {
    display: flex;
    flex-direction: row;
    gap: 10px;
    justify-content: right;
    flex-wrap: wrap;
  }
  button {
    background-color: var(--card);
  }
  button:hover {
    background-color: var(--card-innner);
  }
  
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .modal-content {
    background-color: var(--background);
    padding: 2rem;
    border-radius: 8px;
    max-width: 600px;
    width: 90%;
    position: relative;
  }
  
  .modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text);
  }
  
  .modal-content h2 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .modal-content p {
    margin-bottom: 2rem;
  }
  
  .donation-options {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    justify-content: center;
  }
  
  .donation-option {
    text-align: center;
  }
  
  .donation-option h3 {
    margin-bottom: 1rem;
  }
  
  .qrcode {
    width: 200px;
    height: 200px;
    object-fit: contain;
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  
  @media (max-width: 768px) {
    .donation-options {
      flex-direction: column;
      gap: 1.5rem;
    }
    
    .qrcode {
      width: 150px;
      height: 150px;
    }
  }
</style>
