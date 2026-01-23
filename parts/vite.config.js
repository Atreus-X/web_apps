import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Explicitly tell Vite this app lives in the /parts/ folder
  base: '/public/parts/', 
})
