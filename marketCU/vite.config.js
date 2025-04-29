import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    // Ensure the build directory is resolved correctly
    // This guarantees the output is in marketCU/dist
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: import.meta.env.PROD 
          ? 'https://lionbay-api.onrender.com'
          : 'http://localhost:3001',
        changeOrigin: true,
        secure: true,
        ws: true
      }
    }
  }
})
