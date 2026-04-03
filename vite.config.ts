import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// 开发环境默认配置（使用 GitHub Pages 路径）
export default defineConfig({
  plugins: [svelte()],
  base: '/lostark-arkgrid-gem-locator-v2/',
  worker: {
    format: 'es',
    // plugins: () => [svelte()],
    // 'es': ES 모듈 형식으로 Worker 번들링 (import/export 사용 가능)
    // 'iife': 즉시 실행 함수 형식 (레거시 브라우저 지원)
    //
    // 'es'를 선택한 이유:
    // - 최신 브라우저에서 더 효율적
    // - Tree-shaking 가능 (사용하지 않는 코드 제거)
    // - import/export 문법 그대로 사용 가능
  }, 
});
