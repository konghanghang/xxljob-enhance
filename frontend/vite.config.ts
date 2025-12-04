import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Use classic JSX runtime for better compatibility
      jsxRuntime: 'classic',
    }),
  ],
  build: {
    // Ensure source maps for debugging
    sourcemap: false,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'antd': ['antd'],
        },
      },
    },
  },
})
