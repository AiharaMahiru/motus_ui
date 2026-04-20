import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '..'), '')
  const apiHost = env.APP_HOST && env.APP_HOST !== '0.0.0.0' ? env.APP_HOST : '127.0.0.1'
  const apiPort = env.APP_PORT || '8000'
  const apiBaseUrl = env.APP_BASE_URL || `http://${apiHost}:${apiPort}`
  const proxy = {
    '/api': {
      target: apiBaseUrl,
      changeOrigin: true,
    },
    '/health': {
      target: apiBaseUrl,
      changeOrigin: true,
    },
  }

  return {
    envDir: resolve(__dirname, '..'),
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: ['@xterm/xterm', '@xterm/addon-fit'],
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      proxy,
    },
  }
})
