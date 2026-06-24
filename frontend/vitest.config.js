import { defineConfig, mergeConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';
import viteConfig from './vite.config.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default mergeConfig(viteConfig, defineConfig({
  // Redirect Three.js packages to stubs — @react-three/fiber fails to load
  // in jsdom because its reconciler calls WebGL APIs at module initialisation.
  // These aliases apply only during vitest runs (this file is not used by the
  // vite dev server).
  resolve: {
    alias: {
      '@react-three/fiber': path.resolve(__dirname, 'src/__tests__/__mocks__/react-three-fiber.jsx'),
      '@react-three/drei':  path.resolve(__dirname, 'src/__tests__/__mocks__/react-three-drei.jsx'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
  },
}));
