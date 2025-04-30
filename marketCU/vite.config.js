import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Determine if we're in production
  const isProd = mode === 'production'
  
  // Get the API URL from env or use default
  const apiUrl = env.VITE_API_BASE_URL || (isProd 
    ? 'https://lionbay-api.onrender.com' 
    : 'http://localhost:3003')
  
  console.log(`Mode: ${mode}, API URL: ${apiUrl}`)
  
  return {
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
          target: apiUrl,
          changeOrigin: true,
        }
      }
    },
    define: {
      // To avoid runtime errors about process
      'process.env': {}
    }
  }
})
