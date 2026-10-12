import { baseConfig } from "@elearning/config/eslint";

// dist/ adalah output kompilasi tsc; src/generated/ adalah output
// openapi-typescript (lihat package.json "generate") -- keduanya kode
// mesin, bukan source yang ditulis manusia, jangan dilint.
export default [{ ignores: ["dist/**", "src/generated/**"] }, ...baseConfig];
