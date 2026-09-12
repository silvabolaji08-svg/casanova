import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /* Fail loudly rather than silently moving to 5174 — a shifted port means
       CLIENT_ORIGIN on the API no longer matches and CORS blocks everything,
       which is a confusing way to find out. */
    strictPort: true,
  },
})