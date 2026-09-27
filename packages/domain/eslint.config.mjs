import { baseConfig } from "@elearning/config/eslint";

// `dist/` adalah output kompilasi tsc (lihat package.json "build") -- bukan
// source, jangan dilint. Config object yang isinya cuma `ignores` berlaku
// sebagai global ignore di flat config ESLint 9, terlepas dari urutannya.
export default [{ ignores: ["dist/**"] }, ...baseConfig];
