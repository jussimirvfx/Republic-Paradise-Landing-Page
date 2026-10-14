import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import express from 'express';
import { createConversionHandler } from './api/meta/conversions.js';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), {
      name:'meta-conversions-dev',
      configureServer(server) {
        const api = express();
        const environment = {...process.env, ...loadEnv(server.config.mode, server.config.root, '')};
        api.all('/api/meta/conversions', express.json({limit:'16kb'}), createConversionHandler({environment}));
        server.middlewares.use(api);
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
