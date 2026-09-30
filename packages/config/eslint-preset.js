import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

/** Base flat-config preset shared by every workspace package. Each package's
 * own eslint.config.js spreads this and appends anything package-specific
 * (e.g. apps/student adds the React plugin's JSX rules). */
export const baseConfig = [
  // Berkas sementara yang dibuat vite/vitest saat memuat konfigurasinya (`vitest.config.ts.timestamp-<waktu>-<acak>.mjs`)
  // lalu dihapus beberapa milidetik kemudian. Turbo menjalankan `lint` dan `test` SATU PAKET bersamaan: bila ESLint sempat
  // mendaftar berkas itu dan vitest menghapusnya sebelum terbaca, ESLint mati dengan ENOENT (exit 2) -- CI merah acak yang
  // tak ada hubungannya dengan kode. Bukan source, jadi tidak dilint (objek yang hanya berisi `ignores` = global ignore).
  { ignores: ["**/*.config.*.timestamp-*.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];

export const reactConfig = [
  ...baseConfig,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
