import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monoRoot = path.resolve(__dirname, '../..');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  resolve: {
    alias: [
      {
        find: /^@momo\/leafer-draw(\/.*)?$/,
        replacement: path.resolve(monoRoot, 'packages/momoDraw/src') + '$1',
      },
      {
        find: /^@momo\/leafer-xpath-editor(\/.*)?$/,
        replacement: path.resolve(monoRoot, 'packages/leaferXPathEditor/src') + '$1',
      },
      {
        find: /^@momo-editor\/(.*)$/,
        replacement: path.resolve(__dirname, 'src') + '/$1',
      },
    ],
  },
});
