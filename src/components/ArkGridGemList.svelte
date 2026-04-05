<script lang="ts">
  import { tick } from 'svelte';

  import type { ScrollCommand } from '../lib/constants/enums';
  import type { ArkGridGem } from '../lib/models/arkGridGems';
  import ArkGridGemDetail from './ArkGridGemDetail.svelte';

  interface Props {
    gems: ArkGridGem[];
    showDeleteButton?: boolean;
    showCopyButton?: boolean;
    emptyDescription?: string;
    /** 是否允许编辑护石数值 */
    editable?: boolean;
    /** 自定义删除回调 */
    onDelete?: (gem: ArkGridGem) => void;
    /** 自定义复制回调 */
    onCopy?: (gem: ArkGridGem) => void;
  }
  let {
    gems,
    showDeleteButton = true,
    showCopyButton = false,
    emptyDescription = '보유한 젬이 없습니다.',
    editable = false,
    onDelete,
    onCopy,
  }: Props = $props();

  let container: HTMLDivElement;
  let scheduled = false;
  let lastCommand: ScrollCommand = null;

  export function scroll(command: 'top' | 'bottom') {
    // DOM 갱신이 완료된 이후에 가장 위 혹은 아래로 scroll
    lastCommand = command;

    if (scheduled) return;

    scheduled = true;

    queueMicrotask(async () => {
      await tick();
      await new Promise(requestAnimationFrame);

      scheduled = false;

      if (!lastCommand) return;

      if (lastCommand === 'top') {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }

      lastCommand = null;
    });
  }
  export function getScrollTop() {
    // 현재 내부 컨테이너의 scrollTop 반환
    return container.scrollTop;
  }

  export function scrollToPosition(top: number) {
    // 특정 위치로 즉시 scroll
    container.scrollTo({
      top,
      behavior: 'auto',
    });
  }
</script>

<div class="gems" bind:this={container}>
  {#if gems.length > 0}
    {#each gems as gem}
      <ArkGridGemDetail {gem} {showDeleteButton} {showCopyButton} {editable} {onDelete} {onCopy} />
    {/each}
  {:else}
    <span class="epmty-description">{emptyDescription} </span>
  {/if}
</div>

<style>
  .gems {
    /* 인게임이랑 똑같이 9개 보여주게 */
    height: 39rem;

    /* 테두리 */
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 0.5rem 0.5rem 0;

    /* 내부 배치 */
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    gap: 0.5rem;
    /* 괜찮아 보이는데 나중에 추가... */
    /* scroll-snap-type: y proximity;  */
  }
  .gems > .epmty-description {
    align-self: center;
  }
</style>
