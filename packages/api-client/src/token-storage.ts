export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Abstraksi penyimpanan token -- SENGAJA bukan hardcode localStorage di
 * client.ts supaya key-nya beda per app (student vs admin, lihat plan
 * "Auth student vs admin benar-benar terpisah"). Tiap app pasang prefix-nya
 * sendiri lewat `createLocalStorageTokenStorage`, konsisten dengan key yang
 * sudah dipakai AuthGuard stub sebelum pass ini (`access_token` murid,
 * `admin_access_token` admin). */
export interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(pair: TokenPair): void;
  clear(): void;
}

export function createLocalStorageTokenStorage(keyPrefix: string): TokenStorage {
  const accessKey = keyPrefix ? `${keyPrefix}_access_token` : "access_token";
  const refreshKey = keyPrefix ? `${keyPrefix}_refresh_token` : "refresh_token";

  return {
    getAccessToken: () => localStorage.getItem(accessKey),
    getRefreshToken: () => localStorage.getItem(refreshKey),
    setTokens: ({ accessToken, refreshToken }) => {
      localStorage.setItem(accessKey, accessToken);
      localStorage.setItem(refreshKey, refreshToken);
    },
    clear: () => {
      localStorage.removeItem(accessKey);
      localStorage.removeItem(refreshKey);
    },
  };
}
