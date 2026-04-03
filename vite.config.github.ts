import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages 配置
export default defineConfig({
  plugins: [svelte()],
  base: '/lostark-arkgrid-gem-locator-v2/',
  worker: {
    format: 'es',
  },
});
