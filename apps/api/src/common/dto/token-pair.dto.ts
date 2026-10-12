/** Bentuk respons login/register/refresh -- SAMA untuk auth murid maupun
 * admin (AuthService.issueTokenPair/AdminAuthService.issueTokenPair
 * struktural identik), jadi satu DTO dipakai bareng. Dideklarasikan sebagai
 * anotasi tipe balik EKSPLISIT di controller (bukan cuma dibiarkan
 * terinferensi dari service) -- plugin CLI @nestjs/swagger butuh itu untuk
 * bisa menghasilkan skema respons yang benar di openapi.json; tanpa ini
 * responses.200 di dokumen jadi kosong walau request body-nya (DTO
 * class-validator) tetap terdeteksi. Lihat catatan di generate-openapi.ts. */
export class TokenPairDto {
  accessToken!: string;
  refreshToken!: string;
}
