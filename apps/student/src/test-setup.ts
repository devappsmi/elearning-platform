import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest tidak menyalakan `globals`, jadi cleanup otomatis RTL tidak terpasang --
// tanpa ini render dari tes sebelumnya menumpuk di DOM dan query `screen.*` ambigu.
afterEach(cleanup);
