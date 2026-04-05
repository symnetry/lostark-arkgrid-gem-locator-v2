<script lang="ts">
  import type { LocalizationName } from '../../lib/constants/enums';
  import { appConfig, toggleUI } from '../../lib/state/appConfig.state.svelte';
  import { appLocale } from '../../lib/state/locale.state.svelte';

  const guideAssets = import.meta.glob<string>('/src/assets/guide/*', {
    eager: true,
    import: 'default',
  });
  const LTitle: LocalizationName = {
    ko_kr: '가이드',
    en_us: 'Guide',
    zh_cn: '指南',
  };
  let locale = $derived(appLocale.current);
</script>

<div class="guide">
  <div class="title">
    <span>🎓️ {LTitle[locale]}</span>
    <button class="fold-button" onclick={() => toggleUI('showGemRecognitionGuide')}
      >{appConfig.current.uiConfig.showGemRecognitionGuide ? '▲' : '▼'}</button
    >
  </div>
  <div class="content" hidden={!appConfig.current.uiConfig.showGemRecognitionGuide}>
    {#if locale === 'ko_kr'}
      <p>
        1. 게임에서 젬 목록 화면을 연 뒤 <b>모든 젬을 장착 해제</b>해주세요.<br />
        안 쓰는 아크 그리드 프리셋으로 전환하는 것으로 손쉽게 젬을 해제할 수 있습니다.
      </p>
      <p>2. [🖥️ 화면 공유 시작] 버튼을 통해 로스트아크 게임 화면을 공유해주세요</p>
      <p>3. 게임에서 젬 목록을 열고 "보석"을 클릭해 작은 젬 목록을 보여주세요.</p>
      <p>4. 웹 페이지의 스냅샷 버튼을 클릭하고, 모든 젬을 수집할 때까지 반복해주세요.</p>
      <p>
        5. 수집된 젬의 개수를 확인하고, <b>질서와 혼돈 모든 젬</b>이 수집되었으면 [✅ 현재 프로필에
        반영] 버튼을 눌러 프로필에 저장해주세요.
      </p>
      <br />
      <h2>FAQ</h2>
      <p>
        Q. 화면 공유에 실패하거나 거부하였다고 나옵니다.<br />
        A. 데스크톱 환경에서 크롬 혹은 엣지 브라우저로 실행해주세요.
      </p>
      <p>
        Q. 젬이 인식되지 않습니다.<br />
        A. [🔨 공유 중인 화면 보기]를 눌러 다음 사항을 확인해주세요.
      </p>
      <ol>
        <li>게임 화면이 올바르게 갱신 중인지 확인해주세요.</li>
        <li>
          젬 옵션을 추출하는 영역이 실제 위치와 일치하지 않는다면 게임 해상도를 "1920x1080 (16:9)"로
          화면을 "창 모드"로 변경해주세요. "21:9 강제 설정"을 사용 중이라면 해제해주세요.
        </li>
        <li>
          젬 옵션을 추출하는 영역이 빨갛게 되어 있다면 상단 '허용 오차 범위' 슬라이더를 높혀서
          시도해주세요.
        </li>
        <li>마우스가 젬과 상호작용하지 않도록 스크롤 위에 위치시킨 채로 스크롤을 조작해주세요.</li>
        <br />
      </ol>
      <p>혹은 사이트 하단 카카오톡을 통해 문의 부탁드립니다.</p>
    {/if}{#if locale === 'en_us'}
      <div class="content">
        <p>
          1. Open an Astrogem list and unequip all.<br />
          You can switch to an unused Ark Grid preset to quickly unequip all astrogems.
        </p>
        <p>2. Press the [🖥️ Start Screen Sharing] button to share your Lost Ark game screen.</p>
        <p>3. In the game, open the gem list and click "Gems" to show the small gem interface.</p>
        <p>4. Then click the snapshot button on the webpage, and repeat until all gems are captured.</p>
        <p>
          5. Verify the total number of collected astrogems. Once <b
            >all Order and Chaos astrogems</b
          >
          have been collected, click the [✅ Apply to Current Profile] button to save them to your profile.
        </p>
        <br />
        <h2>FAQ</h2>
        <p>
          Q. I get a message saying screen sharing failed or was denied.<br />
          A. Please use Chrome or Edge browser.
        </p>
        <p>
          Q. Astrogems are not being recognized.<br />
          A. Press the [🔨 Display Shared Screen] and check the following:
        </p>
        <ol>
          <li>Make sure the game screen is updating properly.</li>
          <li>
            If the area used to extract astrogem options does not match the actual screen, set the
            game resolution to "1920x1080 (16:9)" and switch to "windowed mode". If you are using
            "Force 21:9 Aspect Ratio", please disable it.
          </li>
          <li>
            If parts of the extraction area are highlighted in red, try increasing the “Recognition
            Tolerance Range” slider at the top.
          </li>
          <li>
            Scroll while keeping the mouse cursor positioned over the scrollbar, so it does not
            interact with the astrogems.
          </li>
        </ol>
        <p>Alternatively, you can contact us via Discord in the site footer.</p>
      </div>
    {/if}{#if locale === 'zh_cn'}
      <div class="content">
        <p>
          1. 在游戏中打开护石列表，然后<b>卸下所有护石</b>。<br />
          您可以切换到未使用的方舟棋盘预设来快速卸下所有护石。
        </p>
        <p>2. 点击 [🖥️ 开始屏幕共享] 按钮来共享失落的方舟游戏画面。</p>
        <p>3. 在游戏中打开护石界面并点击"宝石"展示小护石界面。</p>
        <p>4. 然后点击网页的截图识别，重复到截取结束。</p>
        <p>
          5. 确认收集的护石总数。一旦<b>秩序和混沌的所有护石</b>都已收集，点击 [✅ 应用到当前配置]
          按钮将它们保存到您的配置中。
        </p>
        <br />
        <h2>常见问题</h2>
        <p>
          Q. 显示屏幕共享失败或被拒绝的消息。<br />
          A. 请使用 Chrome 或 Edge 浏览器。
        </p>
        <p>
          Q. 护石没有被识别。<br />
          A. 点击 [🔨 查看共享屏幕] 并检查以下内容：
        </p>
        <ol>
          <li>确保游戏画面正在正确更新。</li>
          <li>
            如果用于提取护石选项的区域与实际屏幕不匹配，请将游戏分辨率设置为 "1920x1080 (16:9)"
            并切换到 "窗口模式"。如果您正在使用 "强制 21:9 宽高比"，请禁用它。
          </li>
          <li>如果提取区域的部分区域显示为红色，请尝试调高顶部的 "识别公差范围" 滑块。</li>
          <li>滚动时保持鼠标光标位于滚动条上方，以避免与护石交互。</li>
        </ol>
        <p></p>
      </div>
    {/if}
  </div>
</div>

<style>
  .guide {
    border: 1px solid var(--border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border-radius: 0.4rem;
    background-color: var(--card-inner);
    padding: 1rem;
    width: 100%;
    box-sizing: border-box;
    gap: 10px;
    display: flex;
    flex-direction: column;
  }
  .guide > .title {
    font-weight: 700;
    font-size: 1.4rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
  }
  /* .guide img {
    max-width: 100%;
    height: auto;
    display: block;
  } */
  .fold-button {
    flex: 1;
    text-align: right;
    border: none;
    background: none;
  }
</style>
