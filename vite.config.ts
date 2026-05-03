import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function skipLockedPublicFiles(): Plugin {
  return {
    name: 'skip-locked-public-files',
    enforce: 'post',
    closeBundle() {
      // no-op: just prevent crash on unreadable files
    },
    buildStart() {
      // patch public dir copy to skip unreadable files
      const originalCopyFileSync = fs.copyFileSync.bind(fs);
      (fs as any).copyFileSync = (src: string, dest: string, ...args: any[]) => {
        try {
          fs.accessSync(src, fs.constants.R_OK);
          originalCopyFileSync(src, dest, ...args);
        } catch {
          // skip locked/unreadable file
        }
      };
    }
  };
}

export default defineConfig({
  plugins: [react(), skipLockedPublicFiles()],
  server: {
    port: 5173,
    host: true
  },
});
