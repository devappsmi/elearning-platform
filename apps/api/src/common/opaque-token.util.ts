import { randomBytes, createHash } from "node:crypto";

/** Pola token opaque dipakai bersama oleh Invitation dan PasswordResetToken
 * (lihat plan bagian 4): token MENTAH cuma pernah ada sebentar (di link
 * email, sebelum dikirim), yang disimpan ke DB cuma hash-nya. Beda dari JWT
 * yang dipakai untuk access/refresh token -- opaque token dipilih di sini
 * justru karena harus BISA di-revoke sepihak dari server (resend/revoke di
 * ADM-12), yang tidak bisa dilakukan JWT tanpa blocklist terpisah. */
export function generateOpaqueToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashOpaqueToken(token) };
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
