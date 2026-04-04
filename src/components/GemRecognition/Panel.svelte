<script lang="ts">
  import { onDestroy } from 'svelte';

  import {
    GemRecognitionLocaleTypes,
    supportedGemRecognitionLocales,
    type ArkGridAttr,
    type GemRecognitionLocale,
    type LocalizationName,
    LostArkGradeTypes,
  } from '../../lib/constants/enums';
  import { CaptureController } from '../../lib/cv/captureController';
  import type { SnapshotResult } from '../../lib/cv/captureController';
  import { type ArkGridGem, ArkGridGemOptionTypes, ArkGridGemSpecs } from '../../lib/models/arkGridGems';
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
    ko_kr: 'DEBUG',
    en_us: 'DEBUG',
    zh_cn: 'DEBUG',
  };
  const LHideScreen: LocalizationName = {
    ko_kr: '공유 중인 화면 끄기',
    en_us: 'Hide Sharing Screen',
    zh_cn: '隐藏共享屏幕',
  };
  const LSnapShot: LocalizationName = {
    ko_kr: '스냅샷',
    en_us: 'Snapshot',
    zh_cn: '截图识别',
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
  let isReady = $state<boolean>(false);       // 截图模式：已初始化可截图
  let isDebugging = $state<boolean>(false);
  let isLoading = $state<boolean>(false);
  let detectionMargin = $state<number>(2);
  let snapCount = $state<number>(0);          // 已截图次数
  let gemListElem: GemRecognitionGemList | null = null;

  let _captureController: CaptureController | null = null;

  /**
   * 全局已添加的OCR内容键集合（跨位置去重）
   * 每张截图中识别出的护石通过 name|optType1|optType2 去重（不含等级，避免OCR抖动）
   */
  const _globalContentKeys: Set<string> = new Set();

  /**
   * contentKey → 已存储护石信息映射，用于去重判断和邻居上下文验证
   * 当 contentKey 碰撞时，通过对比邻居哈希来判断是否为同一物理护石
   */
  const _globalContentKeyIndex: Map<string, {
    index: number;       // 在 totalGems 数组中的索引
    frameHashes: string[]; // 该护石首次被添加时的完整帧哈希数组
    pos: number;          // 该护石在帧内的位置(0-8)
  }> = new Map();

  async function getCaptureController() {
    if (_captureController) return _captureController;
    _captureController = new CaptureController(debugCanvas);
    return _captureController;
  }

  /**
   * 将韩语属性类型翻译为中文
   */
  function optZh(optType: string): string {
    return ArkGridGemOptionTypes[optType as keyof typeof ArkGridGemOptionTypes]?.name?.zh_cn ?? optType;
  }

  /**
   * 将韩语护石名翻译为中文
   */
  function gemNameZh(name: string): string {
    return ArkGridGemSpecs[name as keyof typeof ArkGridGemSpecs]?.name?.zh_cn ?? name;
  }

  /**
   * 将韩语品质翻译为中文
   */
  function gradeZh(grade: string): string {
    return LostArkGradeTypes[grade as keyof typeof LostArkGradeTypes]?.name?.zh_cn ?? grade;
  }

  /** 输出中文格式的护石信息 */
  function gemLog(gem: ArkGridGem | undefined): string {
    if (!gem) return '(undefined)';
    const n = gemNameZh(gem.name ?? '');
    const g = gradeZh(gem.grade ?? '');
    const o1t = optZh(gem.option1.optionType);
    const o2t = optZh(gem.option2.optionType);
    return `${n} | ${g} | ${o1t} Lv.${gem.option1.value} / ${o2t} Lv.${gem.option2.value}`;
  }

  /**
   * 生成护石的精确内容键（用于全局去重）
   *
   * 包含全部 OCR 识别字段：
   *   name(护石名) | gemAttr(秩序/混沌) | req(意志力) | point(点数)
   *   grade(品质) | option1(属性+等级) | option2(属性+等级)
   *
   * 精确匹配：只有完全相同的 key 才去重
   */
  function gemContentKey(gem: ArkGridGem): string {
    const norm = (s: string) => s.replace(/\s+/g, '');
    return `${norm(gem.name ?? '')}|${gem.gemAttr}|${gem.req}|${gem.point}|${gem.grade ?? ''}|${norm(gem.option1.optionType)}|${gem.option1.value}|${norm(gem.option2.optionType)}|${gem.option2.value}`;
  }

  /**
   * 将单帧识别结果合并到总列表（基于 contentKey 精确去重）
   *
   * 去重策略：
   * contentKey 包含完整 9 个字段（名称、属性、意志力、点数、品质、两个选项的类型+等级）。
   * 当 contentKey 完全匹配时，视为同一护石，直接覆盖更新。
   * 不同物理护石恰好所有字段完全相同的概率极低，因此不需要额外的邻居哈希验证。
   */
  function applySnapshotResult(result: SnapshotResult) {
    const totalGems = result.gemAttr == '질서' ? totalOrderGems : totalChaosGems;
    const frameHashes = result.gemHashes ?? [];

    console.log(`[截图识别] ${result.gemAttr === '질서' ? '秩序' : '混沌'} | 共${result.gems.length}个`, JSON.stringify(result.gems.map((g, idx) => ({
      idx,
      zh: gemLog(g),
      raw: `${g.name} | ${g.grade} | ${g.option1.optionType} Lv.${g.option1.value} / ${g.option2.optionType} Lv.${g.option2.value}`,
    })), null, 2));

    let addedAny = false;
    let newCount = 0;
    let updateCount = 0;

    for (let i = 0; i < result.gems.length; i++) {
      const gem = result.gems[i];
      const key = gemContentKey(gem);

      const existingEntry = _globalContentKeyIndex.get(key);
      if (existingEntry) {
        // contentKey 命中 → 同一护石（覆盖更新最新OCR值）
        const old = totalGems[existingEntry.index];
        console.log(`  [命中✓] pos=${i} | ${gemLog(gem)} → 覆盖旧值 (${gemLog(old)})`);
        totalGems[existingEntry.index] = gem;
        // 更新帧哈希（用于后续可能的邻居比较）
        existingEntry.frameHashes = [...frameHashes];
        existingEntry.pos = i;
        updateCount++;
        addedAny = true;
      } else {
        // 新护石：添加到列表
        console.log(`  [新增] pos=${i} | ${gemLog(gem)} | key=${key}`);
        _globalContentKeys.add(key);
        _globalContentKeyIndex.set(key, { index: totalGems.length, frameHashes: [...frameHashes], pos: i });
        totalGems.push(gem);
        newCount++;
        addedAny = true;
      }
    }

    if (newCount > 0 || updateCount > 0) {
      console.log(`  [去重统计] 新增:${newCount} 更新:${updateCount} 总数:${totalGems.length}`);
    }

    if (addedAny) {
      gemListElem?.selectTab(result.gemAttr == '질서' ? 0 : 1);
      gemListElem?.scroll('bottom');
    }

    return addedAny;
  }

  // ==================== 流式模式（保留兼容）====================

  let _prevHashes: string[] | null = null;
  let _lastAddedSequence: string | null = null;
  const _posSeenHashes: Map<number, string[]> = new Map();
  const HAMMING_THRESHOLD = 520;

  function hammingDistance(hash1: string, hash2: string): number {
    if (!hash1 || !hash2) return 999;
    if (hash1.length !== hash2.length) return 999;
    let dist = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) dist++;
    }
    return dist;
  }

  function applyCurrentGems(gemAttr: ArkGridAttr, currentGems: ArkGridGem[], gemHashes: string[] = []) {
    const totalGems = gemAttr == '질서' ? totalOrderGems : totalChaosGems;
    let isNearIdentical = false;
    if (_prevHashes !== null && gemHashes.length > 0) {
      const minLen = Math.min(_prevHashes.length, gemHashes.length);
      if (minLen >= 3) {
        let diffCount = 0;
        for (let i = 0; i < minLen; i++) {
          if (hammingDistance(_prevHashes[i], gemHashes[i]) > HAMMING_THRESHOLD) {
            diffCount++;
            if (diffCount > 1) break;
          }
        }
        isNearIdentical = (diffCount <= 1);
      }
    }
    _prevHashes = [...gemHashes];

    const hashKey = gemHashes.join('|');
    if (_lastAddedSequence === hashKey && isNearIdentical) return;

    console.log(`[护石识别] ${gemAttr === '질서' ? '秩序' : '混沌'} | 共${currentGems.length}个`, JSON.stringify(currentGems.map((g, idx) => ({
      idx,
      name: g.name,
      grade: g.grade,
      opt1: `${g.option1.optionType} Lv.${g.option1.value}`,
      opt2: `${g.option2.optionType} Lv.${g.option2.value}`,
      hash: gemHashes[idx]?.substring(0, 20),
    })), null, 2));

    let addedAny = false;
    for (let i = 0; i < currentGems.length; i++) {
      const gem = currentGems[i];
      const hash = gemHashes[i] || '';
      gem.visualHash = hash;
      const contentKey = gemContentKey(gem);

      if (_globalContentKeys.has(contentKey)) continue;

      if (!isHashSeenAtPosition(i, hash)) {
        registerHashAtPosition(i, hash);
        _globalContentKeys.add(contentKey);
        totalGems.push(gem);
        addedAny = true;
      } else {
        _globalContentKeys.add(contentKey);
        totalGems.push(gem);
        addedAny = true;
      }
    }

    if (addedAny) {
      _lastAddedSequence = hashKey;
      gemListElem?.selectTab(gemAttr == '질서' ? 0 : 1);
      gemListElem?.scroll('bottom');
    }
  }

  function isHashSeenAtPosition(pos: number, hash: string): boolean {
    if (!hash) return false;
    const seen = _posSeenHashes.get(pos);
    if (!seen) return false;
    for (const prev of seen) {
      if (hammingDistance(prev, hash) <= HAMMING_THRESHOLD) return true;
    }
    return false;
  }

  function registerHashAtPosition(pos: number, hash: string): void {
    if (!hash) return;
    const list = _posSeenHashes.get(pos);
    if (list) {
      list.push(hash);
      // 防止无界增长：每个位置最多保留最近 50 条哈希记录
      if (list.length > 50) list.shift();
    } else _posSeenHashes.set(pos, [hash]);
  }

  // ==================== UI事件处理 ====================

  function updateRecognitionLocale(event: Event) {
    setGemRecognitionLocale((event.currentTarget as HTMLSelectElement).value as GemRecognitionLocale);
  }

  /** 初始化：启动屏幕共享并进入ready状态 */
  async function initCapture() {
    const isFirefox = typeof (window as any).InstallTrigger !== 'undefined';
    if (isFirefox) {
      window.alert(LFirefoxNotSupported);
      return;
    }
    const controller = await getCaptureController();
    isLoading = true;
    resetState();

    controller.onLoad = () => {
      isLoading = false;
    };
    controller.onStartCaptureError = (err) => {
      let msg = '알 수 없는 에러가 발생하였습니다.';
      switch (err) {
        case 'recording': msg = '이미 녹화 중입니다.'; break;
        case 'screen-permission-denied': msg = '화면 공유를 거부하였습니다.'; break;
        case 'worker-init-failed': msg = '분석 엔진을 준비하는데 실패하였습니다.'; break;
        default: msg = '알 수 없는 에러가 발생하였습니다';
      }
      window.alert(msg);
      isLoading = false;
    };
    controller.onReady = () => {
      isReady = true;
    };
    controller.onLevelRoiDump = (images, labels) => {
      // 将等级 ROI 区域导出为 PNG 文件下载（用于重新制作模板）
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const label = labels[i] ?? `roi_${i}`;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0);
          // 转为 blob 并触发下载
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `level_roi_${label}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          }, 'image/png');
        } finally {
          img.close();
        }
      }
    };

    await controller.startCapture(
      recognitionLocale,
      appConfig.current.uiConfig.deferredScreenSharingInit
    );
  }

  /** 手动截图：截取一帧并识别 */
  async function captureOneFrame() {
    const controller = await getCaptureController();
    if (!controller.isReady()) return;

    try {
      const result = await controller.captureSingleFrame();
      snapCount += 1;
      applySnapshotResult(result);
    } catch (err) {
      console.error('[截图] 失败:', err);
    }
  }

  /** 启动旧的流式录制模式 */
  async function startGemCapture() {
    await initCapture();
    const controller = await getCaptureController();
    // 等待 ready 后自动进入 recording loop
    controller.onReady = () => {
      isReady = true;
      isRecording = true;
      controller.startRecording(); // 进入流式循环
    };
  }

  async function stopGemCapture() {
    const controller = await getCaptureController();
    if (controller.isRecording() || controller.isReady()) {
      await controller.stopCapture();
      isRecording = false;
      isReady = false;
      debugCanvas?.getContext('2d')?.reset();
      // 释放 Controller 引用，让 GC 回收所有关联资源
      _captureController = null;
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

  /** 重置所有状态 */
  function resetState() {
    _prevHashes = null;
    _lastAddedSequence = null;
    _posSeenHashes.clear();
    _globalContentKeys.clear();
    _globalContentKeyIndex.clear();
    snapCount = 0;
  }

  /** 清空护石列表（含所有缓存状态） */
  function clearGems() {
    totalOrderGems = [];
    totalChaosGems = [];
    _globalContentKeys.clear();
    _globalContentKeyIndex.clear();
    _posSeenHashes.clear();
    _prevHashes = null;
    _lastAddedSequence = null;
    snapCount = 0;
  }

  onDestroy(async () => {
    // 只有当 Controller 还存在时才停止（避免创建新实例后立刻销毁）
    if (_captureController) {
      await _captureController.stopCapture();
      _captureController = null;
    }
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
    <div class="status-dot" class:online={isRecording || isReady} class:offline={!isRecording && !isReady}></div>
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
            disabled={isRecording || isReady || isLoading}
          >
            {#each supportedGemRecognitionLocales as targetLocale}
              <option value={targetLocale}>{GemRecognitionLocaleTypes[targetLocale].name[locale]}</option>
            {/each}
          </select>
          <small>{LGameEnvironmentHint}</small>
        </div>

        <!-- 连接/断开按钮 -->
        {#if !isReady && !isRecording}
          <button onclick={initCapture} data-track="init-capture"
            >🖥️ {LStartCapture[locale]}</button
          >
        {:else}
          <button onclick={stopGemCapture}>🖥️ {LStopCapture[locale]}</button>
        {/if}

        <!-- 截图模式按钮 -->
        {#if isReady && !isRecording}
          <button onclick={captureOneFrame} class:active={snapCount > 0}>
            📸 {LSnapShot[locale]}{snapCount > 0 ? `(${snapCount})` : ''}
          </button>
        {/if}

        <button class:active={isDebugging} onclick={toggleDrawDebug}>
          🔨 {isDebugging ? LHideScreen[locale] : LShowScreen[locale]}
        </button>
        <button onclick={clearGems} disabled={totalOrderGems.length + totalChaosGems.length === 0}>
          🗑️ {locale === 'zh_cn' ? '清空列表' : locale === 'en_us' ? 'Clear List' : '목록 비우기'}
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
    background-color: #22c55e;
  }
  .status-dot.offline {
    background-color: #9ca3af;
  }

  .panel > .content {
    display: flex;
    flex-direction: column;
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
    align-items: center;
    gap: 1rem;
  }
  .debug-screen > .threshold-controller > label {
    width: 20rem;
  }
  .debug-screen > .threshold-controller > input {
    transform: translateY(2px);
  }

  button.secondary {
    opacity: 0.7;
    font-size: 0.85rem;
  }
</style>
