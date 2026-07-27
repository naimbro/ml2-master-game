import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/ml2-master-game/',  // Required for GitHub Pages deployment
  server: {
    // The project lives on the Windows filesystem (/mnt/c) but Vite runs from WSL, and inotify
    // events don't cross that boundary: without polling the dev server silently serves a stale
    // cached module forever, with no reload and nothing in the log. See CLAUDE.md.
    watch: { usePolling: true, interval: 300 },
  },
})
