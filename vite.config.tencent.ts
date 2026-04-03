import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// 腾讯云 CloudBase 配置
export default defineConfig({
  plugins: [svelte()],
  base: '/lostark-arkgrid-gem-locator/',
  worker: {
    format: 'es',
  },
});
