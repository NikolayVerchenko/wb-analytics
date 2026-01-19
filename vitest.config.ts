/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@application': resolve(__dirname, 'src/application'),
      '@presentation': resolve(__dirname, 'src/presentation'),
    },
  },
})
