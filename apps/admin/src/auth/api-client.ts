import { createApiClient, createLocalStorageTokenStorage } from "@elearning/api-client";

// Prefix "admin" -- key localStorage jadi `admin_access_token`/
// `admin_refresh_token`, sama seperti yang sudah dipakai AuthGuard SEBELUM
// pass ini (lihat riwayat git) -- dan SENGAJA beda namespace dari
// apps/student (`access_token`/`refresh_token`, prefix kosong), konsisten
// dengan pemisahan token murid vs admin yang sudah ada di backend (secret
// JWT beda total, lihat plan "Auth student vs admin benar-benar terpisah").
export const tokenStorage = createLocalStorageTokenStorage("admin");

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL,
  tokenStorage,
  refreshPath: "/admin/auth/refresh",
  onUnauthenticated: () => {
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  },
});
