import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')
  return {
    base: env.GITHUB_PAGES ? '/Lyrics-Sushi-Bouquet/' : '/',
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom', 'three'],
    },
  }
})
