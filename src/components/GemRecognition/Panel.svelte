<script lang="ts">
  import { onDestroy } from 'svelte';

  import {
    GemRecognitionLocaleTypes,
    supportedGemRecognitionLocales,
    type ArkGridAttr,
    type GemRecognitionLocale,
    type LocalizationName,
  } from '../../lib/constants/enums';
  import { CaptureController } from '../../lib/cv/captureController';
  import { type ArkGridGem, isSameArkGridGem } from '../../lib/models/arkGridGems';
  import {
    appConfig,
    toggleDeferredScreenSharingInit,
    toggleUI,
  } from '../../lib/state/appConfig.state.svelte';
  import {
    appLocale,
    gemRecognitionLocale,
    setGemRecognitionLocale,
  } from '../../lib/state/locale.state.svelte';
  import GemRecognitionGemList from './GemList.svelte';
  import GemRecognitionGuide from './Guide.svelte';

  let locale = $derived(appLocale.current);
  let recognitionLocale = $derived(gemRecognitionLocale.current);
  const LTitle: LocalizationName = {
    ko_kr: '젬 화면 인식',
    en_us: 'Astrogem Recognition Screen',
    zh_cn: '护石界面识别',
  };
  const LStartCapture: LocalizationName = {
    ko_kr: '화면 공유 시작',
    en_us: 'Start Screen Sharing',
    zh_cn: '开始屏幕共享',
  };
  const LStopCapture: LocalizationName = {
    ko_kr: '화면 공유 종료',
    en_us: 'Stop Screen Sharing',
    zh_cn: '停止屏幕共享',
  };
  const LShowScreen: LocalizationName = {
    ko_kr: '공유 중인 화면 보기',
    en_us: 'Display Sharing Screen',
    zh_cn: '显示共享屏幕',
  };
  const LHideScreen: LocalizationName = {
    ko_kr: '공유 중인 화면 끄기',
    en_us: 'Hide Sharing Screen',
    zh_cn: '隐藏共享屏幕',
  };
  const LThreshold: LocalizationName = {
    ko_kr: '허용 오차 범위',
    en_us: 'Recongition Tolerance Range',
    zh_cn: '识别容差范围',
  };
  const LDetectionMargin = {
    ko_kr: ['일반', '여유', '최대'],
    en_us: ['Normal', 'Sparse', 'Maximum'],
    zh_cn: ['普通', '宽松', '最大'],
  };
  const LFirefoxNotSupported = $derived(
    {
      ko_kr: '파이어폭스 브라우저는 지원하지 않습니다. 크롬 혹은 엣지 브라우저를 이용해주세요.',
      en_us: 'Sorry, Firefox broswer is not supported. Please use Chromium browser.',
      zh_cn: '抱歉，不支持 Firefox 浏览器。请使用 Chrome 或 Edge 浏览器。',
    }[locale]
  );
  const LSupportedClient = $derived(
    {
      ko_kr: '지원 클라이언트: 한국어, 영어, 중국어 간체, 러시아어, 러시아 서버 중국어 번역판',
      en_us: 'Supported Clients: Korean, English, Simplified Chinese, Russian, Russian Server (Chinese Translation)',
      zh_cn: '支持客户端：韩语、英语、简体中文、俄语、俄服汉化',
    }[locale]
  );
  const LControllerLazyLoading = $derived(
    {
      ko_kr: '화면 공유시 튕김 방지',
      en_us: 'Prevent Screen Sharing Crash',
      zh_cn: '防止屏幕共享崩溃',
    }[locale]
  );
  const LGameEnvironment = $derived(
    {
      ko_kr: '게임 환경',
      en_us: 'Game Environment',
      zh_cn: '游戏环境',
    }[locale]
  );
  const LGameEnvironmentHint = $derived(
    {
      ko_kr: '화면 공유 전에 현재 게임 클라이언트 환경을 선택하세요.',
      en_us: 'Select the current game client before starting screen sharing.',
      zh_cn: '开始屏幕共享前，请先选择当前游戏客户端环境。',
    }[locale]
  );
  let debugCanvas: HTMLCanvasElement | null;
  let totalOrderGems = $state<ArkGridGem[]>([]);
  let totalChaosGems = $state<ArkGridGem[]>([]);
  let isRecording = $state<boolean>(false);
  let isDebugging = $state<boolean>(false);
  let isLoading = $state<boolean>(false);
  let detectionMargin = $state<number>(0);
  let gemListElem: GemRecognitionGemList | null = null;

  let _captureController: CaptureController | null = null;
  let _prevGem: string | null = null;
  let _lastAddedGemSequence: string | null = null;

  async function getCaptureController() {
    if (_captureController) return _captureController;
    _captureController = new CaptureController(debugCanvas);
    return _captureController;
  }

  function applyCurrentGems(gemAttr: ArkGridAttr, currentGems: ArkGridGem[]) {
    const gemKey = JSON.stringify(currentGems);
    if (_prevGem === null) _prevGem = gemKey;
    else {
      if (_prevGem == gemKey) {
        return;
      } else {
        _prevGem = gemKey;
      }
    }
    const totalGems = gemAttr == '질서' ? totalOrderGems : totalChaosGems;
    // 젬 추가
    const SAME_COUNT_THRESHOLD = 4;
    if (totalGems.length == 0 && currentGems.length > 0) {
      // 현재 젬이 없다면 화면에 있는 젬으로 갈아치움
      // 이땐 개수가 꼭 9개가 아니어도 됨 (애초에 젬을 적게 깎은 사람들)
      for (const gem of currentGems) {
        totalGems.push(gem);
      }
      _lastAddedGemSequence = gemKey;
      gemListElem?.selectTab(gemAttr == '질서' ? 0 : 1);
      gemListElem?.scroll('bottom');
      // console.log($state.snapshot(totalGems));
    } else {
      if (currentGems.length == 9 && totalGems.length < 100) {
        // 정상적으로 9개의 젬이 모두 인식된 경우에만 진행

        // 如果这个序列刚刚添加过，跳过以防止重复
        if (_lastAddedGemSequence === gemKey) {
          return;
        }

        // Q. 내 화면의 첫 젬이 전체 젬의 어디에 위치하는가?
        // 동일한 옵션의 젬이 2개 이상 있는 경우를 위해 후보를 모두 저장함
        let foundIndices: number[] = [];
        for (let i = 0; i < totalGems.length; i++) {
          if (isSameArkGridGem(totalGems[i], currentGems[0])) {
            foundIndices.push(i);
          }
        }
        
        // 找到最佳匹配（匹配数量最多的那个）
        let bestMatch: { index: number; count: number } | null = null;
        for (let foundIndex of foundIndices) {
          let sameCount = 1;
          for (let i = 1; i < currentGems.length; i++) {
            if (foundIndex + i >= totalGems.length) break;
            if (isSameArkGridGem(totalGems[foundIndex + i], currentGems[i])) {
              sameCount += 1;
            } else {
              break;
            }
          }
          
          if (!bestMatch || sameCount > bestMatch.count) {
            bestMatch = { index: foundIndex, count: sameCount };
          }
        }

        // 只使用最佳匹配进行添加
        if (bestMatch) {
          const { index: foundIndex, count: sameCount } = bestMatch;
          
          // 현재 화면에 있는 모든 젬이 이미 연속적으로 추가된 젬인 경우, 그냥 넘어감
          if (sameCount == 9) {
            return;
          }

          // 스크롤을 너무 빠르게 내린 경우를 제외하기 위해서
          // 내 화면에 있는 젬 중 최소한 4개는 이미 알고 있는 경우에만 수행
          // 추가로 동일한 옵션의 젬을 오판정한 index인 경우 sameCount = 1이라서 걸러야 함
          if (sameCount >= SAME_COUNT_THRESHOLD) {
            // 检查是否真的有新护石需要添加
            let hasNewGems = false;
            for (let i = sameCount; i < 9; i++) {
              if (foundIndex + i >= totalGems.length || 
                  !isSameArkGridGem(totalGems[foundIndex + i], currentGems[i])) {
                hasNewGems = true;
                break;
              }
            }
            
            if (hasNewGems) {
              // 내 화면의 sameCount부터 끝에 있는 젬들까지 추가 대상임
              for (let i = sameCount; i < 9; i++) {
                totalGems.push(currentGems[i]);
                // console.log('추가:', currentGems[i]);
              }
              _lastAddedGemSequence = gemKey;
              gemListElem?.selectTab(gemAttr == '질서' ? 0 : 1);
              gemListElem?.scroll('bottom');
              // console.log($state.snapshot(totalGems));
            }
          }
        }

        if (foundIndices.length == 0) {
          // 만약 내 화면의 첫 젬이 아예 없다면 거꾸로 스크롤하는 것이라고 가정
          // 마지막 젬이 알고 있는지 확인
          let reverseFoundIndices: number[] = [];
          for (let i = 0; i < totalGems.length; i++) {
            if (isSameArkGridGem(totalGems[i], currentGems[8])) {
              reverseFoundIndices.push(i);
            }
          }
          
          // 找到反向滚动的最佳匹配
          let bestReverseMatch: { index: number; count: number } | null = null;
          for (let foundIndex of reverseFoundIndices) {
            let sameCount = 1;
            for (let i = 1; i < currentGems.length; i++) {
              if (foundIndex - i < 0) break;
              if (isSameArkGridGem(totalGems[foundIndex - i], currentGems[8 - i])) {
                sameCount += 1;
              } else {
                break;
              }
            }
            
            if (!bestReverseMatch || sameCount > bestReverseMatch.count) {
              bestReverseMatch = { index: foundIndex, count: sameCount };
            }
          }
          
          if (bestReverseMatch) {
            const { index: foundIndex, count: sameCount } = bestReverseMatch;
            
            if (sameCount == 9) {
              return;
            }
            
            if (sameCount >= SAME_COUNT_THRESHOLD) {
              // 检查是否真的有新护石需要添加
              let hasNewGems = false;
              for (let i = 0; i < 9 - sameCount; i++) {
                if (foundIndex - (9 - sameCount - 1 - i) < 0 || 
                    !isSameArkGridGem(totalGems[foundIndex - (9 - sameCount - 1 - i)], currentGems[i])) {
                  hasNewGems = true;
                  break;
                }
              }
              
              if (hasNewGems) {
                // 내 화면의 0부터 9-sameCount-1에 있는 젬들까지 추가 대상임
                for (let i = 9 - sameCount - 1; i >= 0; i--) {
                  totalGems.unshift(currentGems[i]);
                  // console.log('추가:', currentGems[i]);
                }
                _lastAddedGemSequence = gemKey;
                gemListElem?.selectTab(gemAttr == '질서' ? 0 : 1);
                gemListElem?.scroll('top');
                // console.log($state.snapshot(totalGems));
              }
            }
          }
        }
      }
    }
  }

  function updateRecognitionLocale(event: Event) {
    setGemRecognitionLocale((event.currentTarget as HTMLSelectElement).value as GemRecognitionLocale);
  }

  async function startGemCapture() {
    const isFirefox = typeof (window as any).InstallTrigger !== 'undefined';
    if (isFirefox) {
      window.alert(LFirefoxNotSupported);
      return;
    }
    // 젬 캡쳐 시작
    const controller = await getCaptureController();
    // UI 잠금
    isLoading = true;

    // register callbacks
    controller.onLoad = () => {
      // 로딩 끝나면 UI 로딩 해제
      isLoading = false;
    };
    controller.onStartCaptureError = (err) => {
      let msg = '알 수 없는 에러가 발생하였습니다.';
      switch (err) {
        case 'recording':
          msg = '이미 녹화 중입니다.';
          break;
        case 'screen-permission-denied':
          msg = '화면 공유를 거부하였습니다.';
          break;
        case 'worker-init-failed':
          msg = '분석 엔진을 준비하는데 실패하였습니다.';
          break;
        default:
          msg = '알 수 없는 에러가 발생하였습니다';
      }
      window.alert(msg);
      isLoading = false;
    };
    controller.onReady = () => {
      // 첫 프레임 소비 이후 초록불 ON
      isRecording = true;
    };
    controller.onFrameDone = (gemAttr, gems) => {
      // 분석 이후 현재 임시 젬 저장소에 반영
      applyCurrentGems(gemAttr, gems);
    };
    controller.onStop = () => {
      isRecording = false;
    };
    await controller.startCapture(
      recognitionLocale,
      appConfig.current.uiConfig.deferredScreenSharingInit
    );
  }

  async function stopGemCapture() {
    const controller = await getCaptureController();
    if (controller.isRecording()) {
      // controller 중단 요청 및 완료 이후 중단
      await controller.stopCapture();
      isRecording = false;
      debugCanvas?.getContext('2d')?.reset();
    }
  }
  async function toggleDrawDebug() {
    const controller = await getCaptureController();
    isDebugging = controller.toggleDrawDebug();
  }
  async function updateControllerDetectionMargin(detectionMargin: number) {
    const controller = await getCaptureController();
    controller.detectionMargin = detectionMargin;
  }
  onDestroy(async () => {
    const controller = await getCaptureController();
    await controller.stopCapture();
  });
</script>

<div class="panel">
  {#if isLoading}
    <div class="overlay">
      <div class="spinner"></div>
    </div>
  {/if}
  <div class="title">
    <span>{LTitle[locale]}</span>
    <div class="status-dot" class:online={isRecording} class:offline={!isRecording}></div>
    <span class="tooltip">
      <i class="fa-solid fa-circle-info info-icon"></i>
      <span class="tooltip-text">
        {LSupportedClient}
      </span>
    </span>
    <button
      class="fold-button"
      onclick={() => toggleUI('showGemRecognitionPanel')}
      disabled={isRecording}
      >{appConfig.current.uiConfig.showGemRecognitionPanel ? '▼' : '▲'}</button
    >
  </div>
  <div
    class="content"
    style:display={!appConfig.current.uiConfig.showGemRecognitionPanel ? 'none' : 'flex'}
  >
    <div class="buttons">
      <div class="left">
        <div class="environment-selector">
          <label for="recognition-locale">{LGameEnvironment}</label>
          <select
            id="recognition-locale"
            value={recognitionLocale}
            onchange={updateRecognitionLocale}
            disabled={isRecording || isLoading}
          >
            {#each supportedGemRecognitionLocales as targetLocale}
              <option value={targetLocale}>{GemRecognitionLocaleTypes[targetLocale].name[locale]}</option>
            {/each}
          </select>
          <small>{LGameEnvironmentHint}</small>
        </div>
        {#if !isRecording}
          <button onclick={startGemCapture} data-track="start-capture"
            >🖥️ {LStartCapture[locale]}</button
          >
        {:else}
          <button onclick={stopGemCapture}>🖥️ {LStopCapture[locale]}</button>
        {/if}
        <button class:active={isDebugging} onclick={toggleDrawDebug}>
          🔨 {isDebugging ? LHideScreen[locale] : LShowScreen[locale]}
        </button>
        <button onclick={toggleDeferredScreenSharingInit}>
          {LControllerLazyLoading}
          <i
            class="fa-solid"
            class:fa-circle-dot={appConfig.current.uiConfig.deferredScreenSharingInit}
            class:fa-circle={!appConfig.current.uiConfig.deferredScreenSharingInit}
          ></i>
        </button>
      </div>
      <div class="right"></div>
    </div>
    <div hidden={!isDebugging}>
      <div class="debug-screen">
        <div class="threshold-controller">
          <input
            id="slider"
            type="range"
            min="0"
            max="2"
            step="1"
            bind:value={detectionMargin}
            oninput={async () => {
              await updateControllerDetectionMargin(detectionMargin / 10);
            }}
          />
          <label for="slider"
            >{LThreshold[locale]}: {LDetectionMargin[locale][detectionMargin]}</label
          >
        </div>
        <canvas bind:this={debugCanvas} style="border: 1px black solid;"></canvas>
      </div>
    </div>
    <div class="dual-panel">
      <div>
        <GemRecognitionGuide></GemRecognitionGuide>
      </div>
      <GemRecognitionGemList
        gems={{
          orderGems: totalOrderGems,
          chaosGems: totalChaosGems,
        }}
        bind:this={gemListElem}
      />
    </div>
  </div>
</div>

<style>
  /* 오버레이 + 중앙 정렬 */
  .panel {
    position: relative;
  }

  .panel > .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  /* .panel > .title > .title-with-dot {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  } */

  .title .tooltip-text {
    bottom: -200%;
  }
  .panel > .title > .fold-button {
    flex-grow: 1;
    text-align: right;
    border: none;
    background: none;
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
    vertical-align: middle;
  }
  .status-dot.online {
    background-color: #22c55e; /* 녹색 */
  }
  .status-dot.offline {
    background-color: #9ca3af; /* 회색 */
  }

  .panel > .content {
    /* 내부 요소들은 상하 정렬 */
    display: flex;
    flex-direction: column;

    /* panel 내부 요소들 사이의 상하 간격 */
    gap: 0.7rem;
    overflow-y: hidden;
  }
  .content > .buttons {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .buttons > div {
    display: flex;
    align-items: stretch;
    gap: 8px;
    flex-wrap: wrap;
  }
  .buttons > div > button {
    flex-basis: auto;
  }
  .environment-selector {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 15rem;
  }
  .environment-selector > label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .environment-selector > select {
    background-color: var(--card);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
  }
  .environment-selector > small {
    color: var(--muted-foreground);
    line-height: 1.3;
  }
  .debug-screen {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    justify-content: center;
  }
  .debug-screen > canvas {
    width: auto;
  }
  .debug-screen > .threshold-controller {
    display: flex;
    /* height: 60px; */
    align-items: center;
    gap: 1rem;
  }
  .debug-screen > .threshold-controller > label {
    width: 20rem;
  }
  .debug-screen > .threshold-controller > input {
    transform: translateY(2px);
  }
</style>
