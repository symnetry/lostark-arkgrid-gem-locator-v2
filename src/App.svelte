<script lang="ts">
  import { SvelteToast } from '@zerodevx/svelte-toast';
  import { onMount } from 'svelte';

  import CharacterProfileEditor from './components/CharacterProfileEditor.svelte';
  import Footer from './components/Footer/Footer.svelte';
  import GemRecognitionPanel from './components/GemRecognition/Panel.svelte';
  import AppConfiguration from './components/Header/AppConfiguration.svelte';
  import ProfileEdit from './components/Header/ProfileEditor.svelte';
  import { type LocalizationName } from './lib/constants/enums';
  import { appConfig, enableDarkMode, toggleUI } from './lib/state/appConfig.state.svelte';
  import { appLocale, setLocale } from './lib/state/locale.state.svelte';
  import { type CharacterProfile, getCurrentProfile } from './lib/state/profile.state.svelte';

  let locale = $derived(appLocale.current);
  const LTitle: LocalizationName = {
    ko_kr: '아크 그리드 전투력 최적화',
    en_us: 'Ark Grid Combat Power Optimizer',
    zh_cn: '方舟棋盘战斗力优化器',
  };
  let currentProfile = $state<CharacterProfile>(getCurrentProfile());
  $effect(() => {
    currentProfile = getCurrentProfile();
  });

  $effect(() => {
    document.documentElement.classList.toggle('dark-mode', appConfig.current.uiConfig.darkMode);
  });

  onMount(() => {
    // data-track 이라는 attr이 달린 것만 수집
    if (import.meta.env.PROD) {
      document.addEventListener('click', (e) => {
        const el = e.target as HTMLElement | null;
        const target = el?.closest('[data-track]');
        if (!target) return; // data-track 없는 건 무시

        const label = (target as HTMLElement).dataset.track; // data-track 값
        (window as any).gtag('event', 'click', {
          event_label: label,
        });
      });
    }

    // 다크 모드
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      enableDarkMode();
    }

    // debug CLI
    (window as any).debug = () => {
      toggleUI('debugMode');
      console.log('현재 디버그 모드:', appConfig.current.uiConfig.debugMode);
    };

    // 언어 감지
    const lang = navigator.language.toLowerCase(); // 예: 'ko-KR' 또는 'en-US'
    if (lang.startsWith('ko')) {
      setLocale('ko_kr');
    } else if (lang.startsWith('zh')) {
      setLocale('zh_cn');
    } else {
      setLocale('en_us');
    }
  });
  const pageTitle = $derived(
    {
      ko_kr: '아크 그리드 전투력 최적화',
      en_us: 'Ark Grid Combat Power Optimizer',
      zh_cn: '方舟棋盘战斗力优化器',
    }[appLocale.current]
  );
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<main>
  <SvelteToast options={{ reversed: true, intro: { y: 192 } }} />
  <div class="contents">
    <div class="title">{LTitle[locale]}</div>
    <AppConfiguration></AppConfiguration>
    <ProfileEdit></ProfileEdit>
    <GemRecognitionPanel></GemRecognitionPanel>
    <CharacterProfileEditor bind:profile={currentProfile}></CharacterProfileEditor>
  </div>
</main>
<footer>
  <Footer></Footer>
</footer>

<style>
  .contents {
    display: flex;
    flex-direction: column;
    gap: var(--global-gap);
    /* 넓을 땐 20px 패딩, 960px 이후 (세로 레아이웃) 점점 좁아짐 */
    padding: clamp(8px, 2.083vw, 20px);
  }
  @media (max-width: 767px) {
    .contents {
      padding: 0rem;
    }
  }
  .contents .title {
    font-weight: 700;
    font-size: 3rem;
    text-align: center;
    word-break: keep-all;
    overflow-wrap: break-word;
  }
  :root {
    --toastContainerTop: auto;
    --toastContainerRight: auto;
    --toastContainerBottom: 8rem;
    --toastContainerLeft: calc(50vw - 8rem);
  }
</style>
