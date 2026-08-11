import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { rmSync } from 'fs'

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'clean-dev-skins',
      closeBundle() {
        rmSync('dist/skins', { recursive: true, force: true })
        rmSync('dist/snippets', { recursive: true, force: true })
      },
    },
  ],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  build: { target: 'esnext', outDir: 'dist' },
})
