import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use VITE_APP_BASE env var if present, otherwise default to '/' for local dev
  base: process.env.VITE_APP_BASE || '/',
})