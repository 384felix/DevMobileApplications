import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, './src');
const PUBLIC_DIR = path.resolve(__dirname, './public');
const BUILD_DIR = path.resolve(__dirname, './www');

export default async ({ command }) => {
  return {
    plugins: [react()],
    root: SRC_DIR,

    // ✅ für GitHub Pages (Repo: DevMobileApplications)
    base: command === 'serve' ? '/' : '/DevMobileApplications/',

    publicDir: PUBLIC_DIR,
    build: {
      outDir: BUILD_DIR,
      assetsInlineLimit: 0,
      emptyOutDir: true,
      rollupOptions: { treeshake: false },
    },
    resolve: {
      alias: { '@': SRC_DIR },
    },
    server: { host: true },
  };
};
