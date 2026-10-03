/** Bentuk BAKU sebuah email di seluruh sistem: spasi tepi dibuang dan semua
 * huruf kecil. Email disimpan, dicari, dan dipakai sebagai kunci Redis
 * (kunci lockout login, batas reset password) HANYA dalam bentuk ini --
 * sebelumnya "Budi@Example.com" dan "budi@example.com" dianggap dua alamat
 * berbeda: murid yang mengetik huruf besar gagal masuk, tautan reset tidak
 * pernah terkirim, dan lockout bisa dilewati dengan mengganti kapitalisasi.
 *
 * SENGAJA hanya trim + huruf kecil. Tidak ada kanonikalisasi ala Gmail (titik
 * di local-part, "+tag") -- itu mengubah alamat yang sah dan bukan aturan
 * email umum. `toLowerCase()` (bukan `toLocaleLowerCase()`) supaya hasilnya
 * tidak bergantung pada locale server. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
