<script lang="ts">
  import imgCorePoint from '../assets/corepoint.png';
  import imgWillPower from '../assets/willpower.png';
  import type { AppLocale } from '../lib/constants/enums';
  import type { ArkGridGem } from '../lib/models/arkGridGems';
  import { ArkGridGemOptionTypes, getGemImage, determineGemGradeByGem } from '../lib/models/arkGridGems';
  import { appLocale } from '../lib/state/locale.state.svelte';
  import { deleteGem } from '../lib/state/profile.state.svelte';

  interface Props {
    gem: ArkGridGem;
    showDeleteButton?: boolean;
    showCopyButton?: boolean;
    /** 是否允许编辑（护石识别列表中开启） */
    editable?: boolean;
    /** 自定义删除回调（如不传则用默认的 deleteGem） */
    onDelete?: (gem: ArkGridGem) => void;
    /** 自定义复制回调 */
    onCopy?: (gem: ArkGridGem) => void;
  }

  let { gem, showDeleteButton = true, showCopyButton = false, editable = false, onDelete, onCopy }: Props = $props();
  let locale: AppLocale = $derived(appLocale.current);

  let editing = $state(false);
  let editingField = $state<string | null>(null);
  let editValue = $state(0);

  function startEditField(field: string) {
    if (!editing) {
      editing = true;
    }
    editingField = field;
    switch (field) {
      case 'req': editValue = gem.req; break;
      case 'point': editValue = gem.point; break;
      case 'opt1': editValue = gem.option1.value; break;
      case 'opt2': editValue = gem.option2.value; break;
    }
  }

  function applyEdit(min: number, max: number) {
    const num = Math.max(min, Math.min(max, Number(editValue) || min));
    switch (editingField) {
      case 'req': gem.req = num; break;
      case 'point': gem.point = num; break;
      case 'opt1': gem.option1.value = num; break;
      case 'opt2': gem.option2.value = num; break;
    }
    editingField = null;
  }

  function toggleEdit() {
    if (editing) {
      // 退出编辑模式时重新计算品质
      if (editingField !== null) {
        // 如果正在编辑某个字段，先应用
        const limits: Record<string, [number, number]> = {
          req: [3, 6], point: [3, 6], opt1: [1, 5], opt2: [1, 5],
        };
        const [min, max] = limits[editingField] ?? [0, 99];
        applyEdit(min, max);
      }
      gem.grade = determineGemGradeByGem(gem);
      editing = false;
      editingField = null;
    } else {
      editing = true;
    }
  }

  /** 编辑框键盘事件 */
  function onInputKeydown(e: KeyboardEvent, min: number, max: number) {
    if (e.key === 'Enter') {
      applyEdit(min, max);
    } else if (e.key === 'Escape') {
      editingField = null;
    }
  }
</script>

<div class="gem-box">
  <div class="gem" data-locale={locale}>
    <div class="gem-image" data-grade={gem.grade}>
      <img src={getGemImage(gem.gemAttr, gem.name)} alt={gem.name} />
    </div>

    <!-- 意志力 req -->
    <div class="willPower gem-spec">
      {#if editable && editing && (editingField === 'req')}
        <input
          class="inline-edit"
          type="number"
          bind:value={editValue}
          min={3}
          max={6}
          onkeydown={(e) => onInputKeydown(e, 3, 6)}
          onblur={() => applyEdit(3, 6)}
          autofocus
        />
      {:else}
        <div
          class="text"
          class:editable={editable}
          onclick={() => startEditField('req')}
        >
          {gem.req}
        </div>
      {/if}
      <img src={imgWillPower} alt="W" />
    </div>

    <div class="vl"></div>

    <!-- 选项1 -->
    <div class="option1 gem-spec">
      <div class="text shrinkable">
        {ArkGridGemOptionTypes[gem.option1.optionType].name[locale]}
      </div>
      {#if editable && editing && (editingField === 'opt1')}
        <input
          class="inline-edit"
          type="number"
          bind:value={editValue}
          min={1}
          max={5}
          onkeydown={(e) => onInputKeydown(e, 1, 5)}
          onblur={() => applyEdit(1, 5)}
          autofocus
        />
      {:else}
        <div
          class="text"
          class:editable={editable}
          onclick={() => startEditField('opt1')}
        >
          Lv. {gem.option1.value}
        </div>
      {/if}
    </div>

    <!-- 点数 point -->
    <div class="corePoint gem-spec">
      {#if editable && editing && (editingField === 'point')}
        <input
          class="inline-edit"
          type="number"
          bind:value={editValue}
          min={3}
          max={6}
          onkeydown={(e) => onInputKeydown(e, 3, 6)}
          onblur={() => applyEdit(3, 6)}
          autofocus
        />
      {:else}
        <div
          class="text"
          class:editable={editable}
          onclick={() => startEditField('point')}
        >
          {gem.point}
        </div>
      {/if}
      <img src={imgCorePoint} alt="P" />
    </div>

    <!-- 选项2 -->
    <div class="option2 gem-spec">
      <div class="text shrinkable">
        {ArkGridGemOptionTypes[gem.option2.optionType].name[locale]}
      </div>
      {#if editable && editing && (editingField === 'opt2')}
        <input
          class="inline-edit"
          type="number"
          bind:value={editValue}
          min={1}
          max={5}
          onkeydown={(e) => onInputKeydown(e, 1, 5)}
          onblur={() => applyEdit(1, 5)}
          autofocus
        />
      {:else}
        <div
          class="text"
          class:editable={editable}
          onclick={() => startEditField('opt2')}
        >
          Lv. {gem.option2.value}
        </div>
      {/if}
    </div>
  </div>
  <div class="edit-button">
    {#if showCopyButton}
      <button onclick={() => onCopy?.(gem)} title={locale === 'zh_cn' ? '复制护石' : locale === 'en_us' ? 'Copy Gem' : '젬 복사'}>📋</button>
    {/if}
    {#if showDeleteButton}
      <button onclick={() => (onDelete ? onDelete(gem) : deleteGem(gem))}>🗑️</button>
    {/if}
    {#if editable}
      <button onclick={toggleEdit}>
        {#if editing}
          {#if locale === 'zh_cn'}✅完成{:else if locale === 'en_us'}✅Done{:else}✅완료{/if}
        {:else}
          {#if locale === 'zh_cn'}✏️编辑{:else if locale === 'en_us'}✏️Edit{:else}✏️편집{/if}
        {/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .gem-box {
    container-type: inline-size;
    /* scroll-snap-align: start; */
    border: 1px solid var(--border);
    border-radius: 0.4rem;

    min-width: 15rem;
    max-width: 40rem;
    overflow-x: hidden;

    height: 3rem;
    min-height: 3rem;
    max-height: 3rem;

    display: flex;
    align-items: stretch;
    padding: 0.4rem;
    overflow-y: hidden;
  }
  .gem-box > .edit-button {
    margin-left: auto;
  }

  /* Grid 배치 */
  .gem {
    /* 내부 요소 */
    display: grid;
    /* 이미지(2.5rem) 의지력(2rem) 세로줄(1px) 공격력 Lv.5 (auto)*/
    grid-template-columns: 2.5rem 2rem min-content auto;
    grid-template-rows: 1fr 1fr;
    gap: 0 0.7rem;
    height: 100%;
  }
  @container (max-width: 300px) {
    /* CoreGemEquipped 전용 css */
    /* 영문 버전 글자가 많아서, vertical line 제거 및 약간의 margin으로 대칭 */
    .gem[data-locale='en_us'] {
      column-gap: 0.3rem;
      grid-template-columns: 2.5rem 2rem auto;
    }
    .gem[data-locale='en_us'] > .vl {
      display: none;
      height: 0%;
    }
    .gem[data-locale='en_us'] > .gem-spec {
      margin-left: 0.1rem;
    }
  }
  /* 두 칸씩 먹는 이미지와 세로선 */
  .gem-image {
    grid-column: 1;
    grid-row: 1 / span 2;
  }
  .gem > .vl {
    grid-column: 3;
    grid-row: 1 / span 2;
    height: 80%;
    margin: auto 0;
    border-left: 1px solid rgb(156, 156, 156);
  }

  /* 모든 젬 내부 div는 flex box */
  .gem > .gem-spec,
  .gem-image {
    display: flex;
    flex-direction: row;
    gap: 0.3rem;
    /* 상하는 중앙 정렬, 좌측으로 붙여서 */
    align-items: center;
    justify-content: flex-start;
    white-space: nowrap;
    overflow: hidden;
  }
  .gem > .gem-spec > .text {
    /* gem-spec안의 글자들이 윗공간이 남아서 살짝 올림 */
    transform: translateY(-0.075rem);
  }

  img {
    object-fit: contain;
  }
  .gem-image > img {
    /* 젬 이미지 우측으로 1px */
    width: 100%;
    transform: translateX(0.05rem);
  }
  .gem-spec > img {
    height: 80%;
  }

  .shrinkable {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 可编辑数字样式 */
  .editable {
    cursor: pointer;
    padding: 0 2px;
    border-radius: 3px;
    transition: background-color 0.15s;
  }
  .editable:hover {
    background-color: rgba(255, 200, 50, 0.25);
  }

  .inline-edit {
    width: 2.4rem;
    height: 1.5rem;
    font-size: 0.85rem;
    padding: 0 0.2rem;
    border: 1px solid #eab308;
    background: var(--card);
    color: var(--foreground);
    text-align: center;
    outline: none;
    transform: translateY(-0.075rem);
  }

  div[data-grade] {
    border-radius: 20%;
  }
  /* 공홈 코어 css*/
  div[data-grade='전설'] {
    background: linear-gradient(135deg, #4d3000, #bc7d01);
  }

  div[data-grade='유물'] {
    background: linear-gradient(135deg, #341a09, #a24006);
  }

  div[data-grade='고대'] {
    background: linear-gradient(135deg, #3d3325, #dcc999);
  }
</style>