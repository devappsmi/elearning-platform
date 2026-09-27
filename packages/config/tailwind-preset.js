/** Shared Tailwind preset for apps/student and apps/admin. apps/api doesn't
 * use this. Design tokens intentionally minimal for now — filled in once
 * Fase 1's UI plan lands; this phase just needs both apps building on a
 * shared base so they don't quietly diverge from day one. */
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        jp: ["Noto Sans JP", "sans-serif"],
      },
    },
  },
};
