import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import path from 'path'
import fs from 'fs'
import https from 'https'

// Check if the paths exist
const srcPath = path.resolve(__dirname, '../src')
console.log('Source path exists:', fs.existsSync(srcPath))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite(),
  ],
  define: {
    // Provide browser-compatible values for Node.js globals
    'process.env': JSON.stringify({}),
    // Set NODE_ENV based on mode
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  resolve: {
    alias: [
      { find: '@src', replacement: path.resolve(__dirname, '../src') },
      { find: '@core', replacement: path.resolve(__dirname, '../src/core') },
      { find: '@components', replacement: path.resolve(__dirname, '../src/components') },
      { find: '@constants', replacement: path.resolve(__dirname, '../src/constants') },
      { find: '@utils', replacement: path.resolve(__dirname, '../src/utils') },
      { find: '@api', replacement: path.resolve(__dirname, '../src/api') }
    ]
  },
  server: {
    port: 5173, // Default Vite port
    proxy: {
      '/api': {
        target: 'https://localhost:8000', // Use HTTPS to match backend
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        // Explicitly configure the agent to potentially help with SSL issues (like TLS version)
        agent: new https.Agent({
           minVersion: 'TLSv1.2' // Force TLS 1.2 as a common fix
        })
      }
    },
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '.cert/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '.cert/cert.pem'))
    },
    host: true // This is important to expose the server to the network
  },
  // Log resolved paths for debugging
  optimizeDeps: {
    include: ['react', 'react-dom', '@mui/material'],
    exclude: []
  },
  // Special handling for audio files
  assetsInclude: ['**/*.wav', '**/*.mp3', '**/*.ogg', '**/*.midi', '**/*.mid'],
  build: {
    outDir: 'dist',
    sourcemap: true,
    lib: {
      entry: 'src/main.tsx', // Changed from Studio.tsx to main.tsx
      formats: ['es'],
      fileName: 'studio'
    },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js', // Use consistent name without hash
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})