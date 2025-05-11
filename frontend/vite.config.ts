import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import path from 'path'
import fs from 'fs'
import https from 'https'

// Removed srcPath check as it was causing issues in Vercel build environment
// const srcPath = path.resolve(__dirname, '../src')
// console.log('Source path exists:', fs.existsSync(srcPath))

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    plugins: [
      react(),
      TanStackRouterVite(),
    ],
    define: {
      // Provide browser-compatible values for Node.js globals
      'process.env': JSON.stringify({}),
      // Set NODE_ENV based on mode
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || (isDev ? 'development' : 'production')),
    },
    resolve: {
      alias: [
        { find: '@src', replacement: path.resolve(__dirname, 'src') },
        { find: '@core', replacement: path.resolve(__dirname, 'src/core') },
        { find: '@components', replacement: path.resolve(__dirname, 'src/components') },
        { find: '@constants', replacement: path.resolve(__dirname, 'src/constants') },
        { find: '@utils', replacement: path.resolve(__dirname, 'src/utils') },
        { find: '@api', replacement: path.resolve(__dirname, 'src/api') }
      ]
    },
    server: {
      port: 5173, // Default Vite port
      proxy: {
        // '/api': {
        //   target: 'https://localhost:8000', // Use HTTPS to match backend
        //   changeOrigin: true,
        //   secure: false, // Allow self-signed certificates
        //   agent: new https.Agent({
        //      minVersion: 'TLSv1.2'
        //   })
        // }
        '/auth': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ minVersion: 'TLSv1.2' })
        },
        '/users': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ minVersion: 'TLSv1.2' })
        },
        '/projects': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ minVersion: 'TLSv1.2' })
        },
        '/sounds': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ minVersion: 'TLSv1.2' })
        },
        '/soundfonts': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ minVersion: 'TLSv1.2' })
        },
        '/drum-samples': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ minVersion: 'TLSv1.2' })
        },
        '/assistant': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ minVersion: 'TLSv1.2' })
        },
        '/health': { 
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ minVersion: 'TLSv1.2' })
        }
      },
      https: isDev ? {
        key: fs.readFileSync(path.resolve(__dirname, '.cert/key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, '.cert/cert.pem'))
      } : undefined, // HTTPS only for dev server
      host: true // This is important to expose the server to the network for local dev
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
      sourcemap: true, // Consider setting to false or 'hidden' for production
      rollupOptions: {
        output: {
          // Use hashed filenames for cache busting in production
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  }
})