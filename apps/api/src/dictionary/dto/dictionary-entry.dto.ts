// Bentuk respons DictionaryModule (SUP-01). `class`, di `dto/*.dto.ts` --
// lihat catatan lengkap di learning-path/dto/path-view.dto.ts soal kenapa
// plugin CLI @nestjs/swagger butuh KEDUANYA. Dulu `interface` di
// dictionary.service.ts -- registrasi skema OpenAPI KOSONG walau dipakai
// sebagai tipe balik, pola yang sama seperti PathView/AttemptResultView.
export class DictionaryEntryDto {
  id!: string;
  surface!: string;
  reading!: string;
  romaji!: string;
  meaning!: string | null;
  partOfSpeech!: string | null;
  exampleJp!: string | null;
  exampleId!: string | null;
  audio!: string;
}
