/// <reference types="node" />
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const proxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8010'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    allowedHosts: ['perspectiveless-contractibly-millard.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
