import { createApiClient, createLocalStorageTokenStorage } from "@elearning/api-client";

// Prefix kosong -- key localStorage jadi `access_token`/`refresh_token`,
// sama seperti yang sudah dipakai AuthGuard SEBELUM pass ini (lihat riwayat
// git) supaya tidak diam-diam mem-invalidasi sesi yang sedang login.
export const tokenStorage = createLocalStorageTokenStorage("");

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL,
  tokenStorage,
  refreshPath: "/auth/refresh",
  // Dipanggil dari DALAM client.ts (bukan komponen React), di luar konteks
  // router -- hard navigation via window.location, bukan useNavigate().
  // Cuma kena kalau access token basi DAN refresh token-nya juga sudah
  // tidak valid lagi (mis. di-revoke dari device lain) -- AuthGuard sendiri
  // sudah menangani kasus "belum pernah login sama sekali" duluan.
  onUnauthenticated: () => {
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  },
});
