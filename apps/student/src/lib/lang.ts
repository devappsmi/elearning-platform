const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff]/;

/** Atribut `lang` untuk sepotong teks: "ja" bila memuatnya kana/kanji, selain itu tidak diisi (ikut bahasa halaman). Dengan `lang="ja"`
 *  huruf Han dipilih dari font Jepang (bukan varian Tionghoa), pembaca layar memakai suara Jepang, dan peramban yang mendukung
 *  `word-break: auto-phrase` memotong baris di batas frasa Jepang, bukan di tengah kata. */
export function langOf(text: string): "ja" | undefined {
  return JAPANESE_RE.test(text) ? "ja" : undefined;
}
