/** Data statis AI tutor -- port dari `server/ai_tutor` lama (repo BELAJAR
 * BAHASA, TIDAK tersedia di repo ini, lihat docs/PLAN.md bagian 6):
 * 4 skenario + 3 karakter sebagai konstanta sisi-server, BUKAN baris DB.
 *
 * Nama tipe `TutorScenario` (bukan `Scenario`) SENGAJA -- `Scenario` di
 * Prisma/`packages/domain` itu template percakapan TERSTRUKTUR (jawaban
 * benar/salah tetap, ScenariosModule, Milestone 9); ini system-prompt untuk
 * LLM bebas. Dua hal berbeda yang kebetulan sama-sama berbau "skenario".
 *
 * PENTING -- yang PASTI berasal dari versi lama: id keempat skenario
 * (`perkenalan`/`restoran`/`arah`/`belanja`), id ketiga karakter (`yuki`/
 * `kenji`/`sora`), serta kepribadian+suara `yuki` (ramah/sabar, "nova").
 * Sisanya (kalimat system prompt persis, kepribadian+suara `kenji`/`sora`,
 * judul/deskripsi) TIDAK tercatat di spesifikasi behavioral yang tersedia --
 * ditulis ulang di sini mengikuti nada yang tercatat (JLPT N5, maks 2
 * kalimat, koreksi dianyam natural, jangan pernah Bahasa Inggris) dan HARUS
 * ditinjau pengajar/product owner sebelum dianggap final. */

export interface TutorScenario {
  id: string;
  title: string;
  description: string;
  /** Latar situasi -- digabung dengan aturan dasar + karakter oleh
   * `buildTutorInstructions`, TIDAK pernah dikirim ke client. */
  systemPrompt: string;
}

export interface TutorCharacter {
  id: string;
  name: string;
  /** Kepribadian (Bahasa Indonesia) -- masuk system prompt LLM. */
  personality: string;
  /** Nama voice OpenAI TTS (alloy/ash/ballad/coral/echo/fable/onyx/nova/sage/
   * shimmer/verse). */
  voice: string;
  /** Instruksi gaya bicara untuk `gpt-4o-mini-tts` (paling efektif dalam
   * Bahasa Inggris, satu-satunya tempat Bahasa Inggris dipakai -- ini input
   * model suara, bukan yang dibaca/didengar murid). */
  voiceInstructions: string;
}

export const DEFAULT_TUTOR_CHARACTER_ID = "yuki";

export const TUTOR_SCENARIOS: readonly TutorScenario[] = [
  {
    id: "perkenalan",
    title: "Perkenalan Diri",
    description: "Berkenalan dengan teman sekelas baru: sebut nama, asal, dan kegiatanmu.",
    systemPrompt:
      "Situasi: perkenalan diri. Kamu bertemu murid untuk pertama kalinya di kelas. Sapa dia, lalu tanyakan nama, asal, dan pekerjaan/sekolahnya -- satu pertanyaan per giliran.",
  },
  {
    id: "restoran",
    title: "Di Restoran",
    description: "Memesan makanan dan minuman kepada pelayan restoran.",
    systemPrompt:
      "Situasi: di restoran. Kamu pelayan restoran. Sambut murid, tanyakan pesanan makanan/minumannya beserta jumlahnya, lalu tanyakan apakah ada tambahan -- satu pertanyaan per giliran.",
  },
  {
    id: "arah",
    title: "Menanyakan Arah",
    description: "Bertanya jalan menuju stasiun, toko, atau toilet.",
    systemPrompt:
      "Situasi: menanyakan arah. Kamu warga setempat yang dimintai tolong murid yang sedang tersesat. Beri petunjuk arah sederhana (右, 左, まっすぐ) selangkah demi selangkah, dan pastikan dia mengerti.",
  },
  {
    id: "belanja",
    title: "Belanja di Toko",
    description: "Mencari barang, menanyakan harga, dan membeli di toko.",
    systemPrompt:
      "Situasi: berbelanja di toko. Kamu penjaga toko. Bantu murid mencari barang, sebutkan harga dengan angka sederhana, dan tanggapi pertanyaan atau tawarannya.",
  },
];

export const TUTOR_CHARACTERS: readonly TutorCharacter[] = [
  {
    id: "yuki",
    name: "Yuki",
    personality: "Ramah dan sabar; suka memuji usaha murid dan berbicara pelan dengan kalimat sederhana.",
    voice: "nova",
    voiceInstructions:
      "Speak in a warm, friendly and patient tone, slowly and clearly, like a kind teacher talking to a beginner learner of Japanese.",
  },
  {
    // PLACEHOLDER -- kepribadian+suara tidak tercatat di spesifikasi lama.
    id: "kenji",
    name: "Kenji",
    personality: "Santai dan ceria, sedikit bercanda; berbicara ringan seperti teman sekelas.",
    voice: "echo",
    voiceInstructions:
      "Speak in a relaxed, upbeat and friendly tone like a cheerful classmate, at a clear and moderate pace.",
  },
  {
    // PLACEHOLDER -- kepribadian+suara tidak tercatat di spesifikasi lama.
    id: "sora",
    name: "Sora",
    personality: "Tenang dan sopan; konsisten memakai bentuk sopan (です/ます) seperti staf profesional.",
    voice: "sage",
    voiceInstructions: "Speak in a calm, polite and professional tone, clearly and at a moderate pace.",
  },
];

export function findTutorScenario(id: string): TutorScenario | undefined {
  return TUTOR_SCENARIOS.find((s) => s.id === id);
}

export function findTutorCharacter(id: string): TutorCharacter | undefined {
  return TUTOR_CHARACTERS.find((c) => c.id === id);
}
