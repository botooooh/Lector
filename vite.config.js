import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'Lector logo.png'],
      manifest: {
        name: 'Lector Music Player',
        short_name: 'Lector',
        description: 'A beautiful local and YouTube music player.',
        theme_color: '#381E72',
        background_color: '#F4EFF4',
        icons: [
          {
            src: 'Lector logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
