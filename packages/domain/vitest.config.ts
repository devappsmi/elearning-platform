import { defineConfig } from 'vitest/config';

// Paket ini murni TypeScript tanpa dependensi DOM/React (dikonfirmasi ulang
// setelah porting selesai -- lihat src/index.ts untuk daftar modulnya), jadi
// environment default ('node') sudah cukup, tidak perlu jsdom.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
