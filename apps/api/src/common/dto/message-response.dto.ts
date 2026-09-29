/** Respons `{ message }` polos -- dipakai endpoint yang cuma perlu memberi
 * tahu "sudah diproses" (lupa/reset password, minta undangan ulang). Anotasi
 * tipe balik eksplisit di controller + class di `dto/*.dto.ts` dibutuhkan
 * plugin CLI Swagger, lihat catatan di common/dto/token-pair.dto.ts. */
export class MessageResponseDto {
  message!: string;
}
