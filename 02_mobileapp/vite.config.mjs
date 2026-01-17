import path from 'path';
import react from '@vitejs/plugin-react';

const SRC_DIR = path.resolve(__dirname, './src');
const PUBLIC_DIR = path.resolve(__dirname, './public');
const BUILD_DIR = path.resolve(__dirname, './www');

export default async ({ mode }) => {
  const isPages = mode === 'pages';

  return {
    plugins: [react()],
    root: SRC_DIR,

    // ✅ WICHTIG:
    // - Capacitor / iOS braucht relative Pfade: './'
    // - GitHub Pages braucht den Repo-Namen als base
    base: isPages ? '/DevMobileApplications/' : './',

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
