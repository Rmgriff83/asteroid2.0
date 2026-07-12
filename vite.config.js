import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' so the built app loads from capacitor:// or file:// on device
export default defineConfig({
  base: './',
  plugins: [vue()],
})
