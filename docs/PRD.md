# PRD — Aplikasi Belajar Bahasa Jepang untuk Lembaga Kursus

**Versi:** 4.0 (Final Draft)
**Tanggal:** 27 September 2026
**Status:** Requirement disetujui (single-tenant, keputusan teknis final)
**Platform:** Web Application (desktop-first, responsive, PWA-ready)
**Bahasa UI:** Bahasa Indonesia (konten pembelajaran: Bahasa Jepang)

---

## 1. Ringkasan Produk

Web application pembelajaran Bahasa Jepang untuk penutur Bahasa Indonesia, digunakan oleh murid lembaga kursus bahasa. Murid **hanya bisa masuk melalui undangan email** dari lembaga. Lembaga menggunakan **web admin terpisah** untuk mengelola undangan, kelas, konten, dan monitoring progres murid.

Benchmark: **Duolingo** (learning path + gamifikasi) dan **Hanashi** (fokus percakapan). Diferensiasi utama: **latihan percakapan ber-template dengan koreksi pengucapan otomatis oleh AI**.

### Keputusan Platform
- **Target: Web Application, prioritas desktop.** Student app dioptimalkan untuk browser desktop/laptop terlebih dahulu; tampilan tetap responsive agar usable di tablet & mobile browser.
- Dibangun **PWA-ready** (installable ke home screen/desktop, push notification) agar pengalaman mendekati native app tanpa biaya development terpisah. **Online-only** — tidak ada cache offline untuk materi.
- Native mobile app (Android/iOS) **di luar scope**; dievaluasi kembali setelah product-market fit.

### Keputusan Bisnis & Operasional *(disepakati 27 Sep 2026)*
| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Tenant | **Single-tenant.** Satu lembaga, bukan SaaS multi-lembaga. Tidak ada `org_id`/struktur multi-tenant di data model — ekspansi ke lembaga lain (kalau terjadi) adalah keputusan bisnis terpisah, bukan sesuatu yang disiapkan di arsitektur sejak awal. |
| 2 | Konten | **Pemilik konten: pemilik produk (Anda).** Konten dibuat dan dikelola sendiri; pengajar dilibatkan sebagai reviewer/penyusun kurikulum lewat akun admin (`staff`) yang sama — tidak ada role terpisah untuk pengajar. Konten disimpan sebagai data agar mudah direvisi. |
| 3 | Model bisnis | **B2B: Anda adalah penyedia aplikasi untuk lembaga ini.** Lembaga adalah customer; murid adalah end user lembaga. Tidak ada kuota kursi/pembatasan jumlah murid aktif — skema harga (kalau ada) di luar cakupan sistem ini. |
| 4 | Bahasa pengantar grammar | **Full Bahasa Indonesia.** Istilah teknis JP tetap ditampilkan sebagai label (misal 「partikel は」) tetapi penjelasan seluruhnya Bahasa Indonesia. |
| 5 | Perangkat prioritas | **Desktop dulu** untuk student app di MVP; mobile browser tetap responsive tapi bukan fokus optimasi. |
| 6 | Audio materi | **TTS (text-to-speech Jepang)** untuk semua audio MVP — lesson, listening, dialog percakapan, kamus. Rekaman native dievaluasi di fase 2 untuk skenario utama. |
| 7 | Kuota pronunciation | **20 penilaian penuh per murid per hari** (mode latihan ringan tanpa batas). Kuota dapat dinaikkan per lembaga. |

---

## 2. Tujuan & Indikator Keberhasilan

| # | Tujuan | Indikator | Target |
|---|---|---|---|
| T1 | Murid belajar konsisten | Weekly retention murid aktif | ≥ 60% |
| T2 | Progres terukur | Murid menyelesaikan level aktifnya | ≥ 70% per bulan |
| T3 | Aktivasi undangan efektif | Undangan → registrasi → lesson pertama selesai | ≥ 80% |
| T4 | Nilai tambah lembaga | Admin login & memantau dashboard | ≥ 1x/minggu |
| T5 | Kemampuan bicara meningkat | Rata-rata skor pronunciation | naik ≥ 20% dalam 3 bulan |

---

## 3. Target Pengguna & Persona

### 3.1 Murid (End User)
- **Profil:** Penutur Bahasa Indonesia, usia 15–40 tahun; pelajar SMA/kuliah, pekerja yang menyiapkan JLPT atau rencana kerja/sekolah ke Jepang.
- **Level:** Pemula s/d menengah (JLPT N5–N3).
- **Perangkat:** **Prioritas desktop/laptop** (sesuai keputusan); tetap responsive untuk browser HP.
- **Kebutuhan:** Belajar terstruktur, fleksibel waktu, feedback langsung, latihan bicara tanpa malu.

### 3.2 Admin Lembaga (termasuk pengajar)
- **Profil:** Staf operasional **dan** pengajar lembaga kursus — satu role yang sama (`staff`), tidak dipisah. Pengajar mengakses admin app yang sama untuk meninjau/menyusun konten (ADM-40/41), bukan lewat proses terpisah.
- **Kebutuhan:** Onboarding murid cepat (bulk invite), pantau progres tanpa tanya satu per satu, bukti progres untuk laporan ke murid/orang tua, review/susun konten kurikulum.
- **Perangkat:** Laptop/desktop di kantor.

### 3.3 Pemilik Lembaga (peran admin tingkat lanjut)
- Semua hak admin + kelola akun admin lain, atur branding lembaga (logo/nama), atur kurikulum aktif. Setara role `owner`.

### 3.4 Pemilik Produk (Anda)
- Mengelola konten master kurikulum; secara teknis juga operator/developer sistem ini. Single-tenant — tidak ada "onboarding lembaga baru" atau kuota kursi untuk dikelola.

---

## 4. Arsitektur Aplikasi (3 Komponen)

| Komponen | Pengguna | Deskripsi |
|---|---|---|
| **Student Web App** (`app.domain.com`) | Murid | Belajar, latihan, percakapan, progres. Desktop-first, PWA. |
| **Admin Web App** (`admin.domain.com`) | Admin & pemilik lembaga | Invite, kelas, konten, monitoring, laporan. Desktop. |
| **Backend API** (`api.domain.com`) | — | Auth, konten, scoring, speech processing, email, reporting. |

Satu monorepo, shared design system & shared types antara student dan admin app.

---

## 5. Ruang Lingkup per Fase

### Fase 1 — MVP (target 8–12 minggu)
| Area | Termasuk |
|---|---|
| Auth | Undangan email, registrasi via link, login, lupa password |
| Belajar | Path Hiragana → Katakana → Kosakata dasar → JLPT N5 |
| Latihan | Pilihan ganda, matching, susun kalimat, listening (audio TTS), isian |
| Percakapan | 10 template skenario, role-play mode pilih respon, audio TTS |
| Gamifikasi | XP, streak, level, badge, leaderboard kelas |
| Pendukung | Kamus mini JP–ID, flashcard, kuis harian |
| Admin | Invite single/bulk CSV, kelola kelas, monitoring progres, dashboard |

### Fase 2 — Speech & AI (target +6–8 minggu)
| Area | Termasuk |
|---|---|
| Pronunciation | Koreksi pengucapan AI per kata/mora, skor, tips, audio perbandingan (kuota 20x/hari) |
| Percakapan AI | Jawaban bebas (teks/suara) dengan AI conversation partner |
| Menulis | Stroke practice Hiragana/Katakana/Kanji |
| Ujian | Simulasi JLPT N5–N4 |
| Admin | Editor konten percakapan, export laporan, pengumuman |
| Notifikasi | Email + web push pengingat belajar |

### Fase 3 — Skala (visi, masih single-tenant)
- Konten N3–N2, kelas live terintegrasi (video)
- Native mobile app (evaluasi ulang)
- API publik untuk integrasi LMS lembaga
- *(Multi-lembaga/SaaS eksplisit di luar visi ini — kalau suatu saat jadi kebutuhan, itu keputusan bisnis terpisah yang butuh evaluasi arsitektur ulang, bukan kelanjutan langsung dari fase ini.)*

---

## 6. Fitur Detail — Student App

Setiap fitur ditulis dengan format: **User Story**, **Acceptance Criteria (AC)**, dan **Aturan Bisnis (AB)**.

### 6.1 AUTH — Onboarding Berbasis Undangan

**AUTH-01 Pengiriman Undangan (dipicu admin)**
- User Story: Sebagai admin, saya ingin mengundang murid via email agar hanya murid terdaftar lembaga yang bisa mengakses aplikasi.
- AC:
  - Email berisi: nama lembaga, nama kelas, tombol/link undangan unik, masa berlaku (7 hari).
  - Link berbentuk `https://app.domain.com/invite/{token}` (token signed, one-time use).
  - Status undangan tercatat: `pending` → `accepted` / `expired` / `revoked`.
- AB: Satu email hanya bisa punya satu undangan aktif per lembaga.

**AUTH-02 Registrasi via Undangan**
- User Story: Sebagai murid, saya ingin membuat akun dari link undangan agar bisa mulai belajar.
- AC:
  - Form: nama lengkap, password (min. 8 karakter, huruf+angka), konfirmasi password; email terisi otomatis & terkunci.
  - Token invalid/kedaluwarsa → halaman error dengan tombol "Minta undangan ulang" (notifikasi ke admin).
  - Setelah registrasi berhasil → auto-login → onboarding singkat (3 layar) → dashboard.
- AB: Email & password di-hash (argon2/bcrypt). Satu email = satu akun.

**AUTH-03 Login & Session**
- AC: Login email+password; session JWT (access 1 jam + refresh 14 hari); rate limit 5 percobaan gagal → lock 15 menit; "Lupa password" kirim link reset via email (kedaluwarsa 1 jam).

**AUTH-04 Penempatan Kelas Otomatis**
- AC: Akun baru otomatis terdaftar (enrolled) ke kelas sesuai data undangan; murid melihat nama kelasnya di profil.

**AUTH-05 Placement Test (opsional, bisa dimatikan lewat pengaturan)**
- AC: 15 soal campuran (kana, kosakata, grammar); hasil menentukan level mulai (Hiragana / Katakana / N5 unit awal); bisa dilewati → mulai dari awal.

### 6.2 LP — Learning Path

**LP-01 Struktur Kurikulum**
```
Level 1: Hiragana        (5 unit: a-ko, sa-to, na-ho, ma-yo, ra-n + dakuten/kombinasi)
Level 2: Katakana        (5 unit, struktur sama)
Level 3: Dasar           (kosakata & kanji N5 inti: angka, waktu, keluarga, salam)
Level 4: JLPT N5         (10 unit tematik + grammar N5)
Level 5: JLPT N4 (fase lanjut)
```
- Setiap unit = 4–8 lesson; setiap lesson = 8–12 soal campuran + 5–10 kosakata baru.
- AB: Lesson terbuka berurutan; unit berikutnya terbuka setelah checkpoint lulus.

**LP-02 Tampilan Path (alá Duolingo)**
- AC: Peta vertikal per level; node lesson berstatus: terkunci 🔒 / aktif / selesai ✓ (dengan jumlah bintang 1–3 berdasarkan skor); progress bar per unit; tombol "Lanjutkan Belajar" selalu terlihat.

**LP-03 Kelulusan Lesson**
- AC: Skor lesson = % jawaban benar; lulus ≥ 80%; bintang: 80–89% ★, 90–99% ★★, 100% ★★★; gagal → bisa ulang langsung tanpa penalti.

**LP-04 Review Adaptif (Spaced Repetition)**
- AC: Sistem mencatat kata/kanji yang salah; item salah muncul lagi di lesson berikutnya & di kuis harian; interval SRS: 1 hari → 3 hari → 7 hari → 14 hari → 30 hari.

**LP-05 Checkpoint Unit**
- AC: 20 soal campuran dari seluruh unit; lulus ≥ 80%; gagal 2x → sistem sarankan review lesson terlemah (otomatis terdeteksi dari error rate).

### 6.3 EX — Format Latihan (Mesin Soal)

| ID | Tipe | Spesifikasi |
|---|---|---|
| EX-01 | Pilihan ganda | 4 opsi; prompt teks/gambar/audio; opsi diacak |
| EX-02 | Matching | 5 pasang kartu JP↔ID atau karakter↔romaji; drag/tap |
| EX-03 | Susun kalimat | Word bank 5–9 kata; tap/drag ke area jawaban; ada distractor |
| EX-04 | Listening | Audio TTS; jawab pilihan ganda atau ketik; tombol putar ulang + tombol lambat (0.75x) |
| EX-05 | Isian | Ketik jawaban; validasi toleran: hiragana/katakana/romaji diterima bila setara; typo 1 huruf = benar dengan catatan |
| EX-06 | Stroke practice *(fase 2)* | Kanvas tulis; penilaian urutan goresan, jumlah goresan, bentuk |

**Aturan mesin soal umum:**
- Feedback langsung per soal: benar (hijau + bunyi) / salah (merah + jawaban benar + penjelasan singkat dalam Bahasa Indonesia).
- Soal yang salah di lesson diulang di akhir lesson (max 2x pengulangan).
- Semua konten soal dikelola sebagai data (JSON), bukan hardcode — memudahkan revisi konten oleh pemilik konten.

### 6.4 CONV — Latihan Percakapan Ber-template

**CONV-01 Katalog Skenario**
- Minimal 10 skenario MVP: perkenalan diri (自己紹介), di restoran, di stasiun/kereta, belanja di konbini, bertanya arah, di sekolah, wawancara kerja part-time, telepon reservasi, di rumah sakit, memperkenalkan hobi.
- Setiap skenario: judul (ID+JP), ilustrasi, tingkat kesulitan, estimasi durasi, daftar peran.

**CONV-02 Struktur Template**
```json
{
  "scenario_id": "restaurant-01",
  "title": {"id": "Memesan di Restoran", "jp": "レストランで注文"},
  "level": "N5",
  "roles": ["customer", "waiter"],
  "lines": [
    {
      "speaker": "waiter",
      "jp": "いらっしゃいませ。何名様ですか。",
      "romaji": "irasshaimase. nanmei-sama desu ka.",
      "id": "Selamat datang. Berapa orang?"
    },
    {
      "speaker": "customer",
      "type": "choice",
      "options": [
        {"jp": "二人です。", "correct": true},
        {"jp": "二人がいます。", "correct": false, "feedback_id": "Untuk menyatakan jumlah orang, gunakan pola 「〜人です」."}
      ]
    }
  ],
  "vocab": [...], "grammar_notes": [...]
}
```
*(Tidak ada field `audio` di JSON — URL audio setiap baris di-resolve otomatis dari hash konten teks `jp` saat runtime, bukan ditulis manual per baris. Lihat 9.4.)*

**CONV-03 Mode Latihan**
- AC: Murid pilih peran; dialog berjalan seperti chat; giliran murid = pilih respon dari 3–4 opsi; salah → feedback + bisa coba lagi tanpa batas; setiap baris bisa diputar audio TTS-nya; tombol tampilkan romaji/terjemahan (default tersembunyi, toggle).

**CONV-04 Mode Tes**
- AC: Tanpa terjemahan/romaji; 3x kesempatan salah total; skor akhir = % respon benar + bonus waktu; tercatat ke progres & XP.

**CONV-05 Ringkasan Pasca-Skenario**
- AC: Tampil skor, kosakata skenario (bisa ditambah ke flashcard), catatan grammar berbahasa Indonesia.

### 6.5 PRON — Koreksi Pengucapan AI *(Fase 2 — fitur unggulan)*

**PRON-01 Rekam & Nilai**
- User Story: Sebagai murid, saya ingin pengucapan saya dikoreksi otomatis agar tahu cara memperbaikinya tanpa harus menunggu guru.
- AC:
  - Tombol rekam (hold-to-record atau tap-toggle) dengan visual waveform; durasi max 15 detik.
  - Hasil < 5 detik: skor keseluruhan 0–100 + skor per kata.
  - Highlight warna: hijau (≥80), kuning (50–79), merah (<50).
- AB: Murid perlu izin mikrofon browser; jika ditolak → fallback mode teks + panduan mengaktifkan mic.

**PRON-02 Komponen Skor**
| Komponen | Bobot | Deskripsi |
|---|---|---|
| Akurasi fonem | 40% | Ketepatan bunyi per mora |
| Pitch accent | 20% | Pola nada (misal 橋 vs 箸) |
| Ritme/timing | 20% | Kesesuaian irama mora, jeda wajar |
| Kelancaran | 20% | Kecepatan & kestabilan |

**PRON-03 Audio Perbandingan**
- AC: Pemutar A/B: suara murid vs suara TTS native; bisa diputar bergantian otomatis.

**PRON-04 Tips Berbahasa Indonesia**
- AC: Feedback spesifik per kesalahan, misal: "Vokal 'a' pada おばあさん perlu dipanjangkan — おばさん (bibi) ≠ おばあさん (nenek)."
- Bank tips mencakup kesalahan umum orang Indonesia: vokal panjang/pendek (長音), konsonan ganda (促音, misal きて vs きって), bunyi ん, R/L (ら行), fu/hu (ふ), vokal bisu (u/i lemah pada desu/masu).

**PRON-05 Integrasi Gamifikasi**
- AC: Skor pronunciation menghasilkan XP; badge "Pelafal Handal" (rata-rata ≥ 85 dalam 10 percakapan); skor masuk leaderboard kategori "Pengucapan".

**PRON-06 Batas Pemakaian**
- AB: Mode latihan ringan tanpa batas; **penilaian penuh max 20x/hari/murid** (kendali biaya API Azure Pronunciation Assessment — ini kuota kendali-biaya, beda dari kuota kursi/seat di ADM yang sudah dihapus). Angka bisa diubah lewat konfigurasi oleh pemilik produk.

### 6.6 GAM — Gamifikasi

| ID | Fitur | Spesifikasi |
|---|---|---|
| GAM-01 | XP | Lesson +10–30 XP, checkpoint +50, percakapan +20, kuis harian +10; target harian default 30 XP (murid bisa ubah 10/30/50) |
| GAM-02 | Streak | Hari dengan XP > 0 menambah streak; streak freeze (1x, beli 50 XP) melindungi 1 hari bolong |
| GAM-03 | Level akun | Total XP → level (setiap level = 1000 XP × nomor level); ditampilkan di profil |
| GAM-04 | Badge | Min. 12 badge MVP: "Langkah Pertama", "7 Hari Beruntun", "Master Hiragana", "Master Katakana", "100 Kata", "Bintang Sempurna", dst. |
| GAM-05 | Leaderboard kelas | Mingguan berdasarkan XP; reset tiap Senin 00:00; hanya dalam kelas (bukan global); 3 teratas dapat lencana mingguan |
| GAM-06 | Notifikasi streak *(fase 2)* | Pengingat "Streak-mu 6 hari, jangan putus!" |

### 6.7 SUP — Fitur Pendukung

| ID | Fitur | Spesifikasi |
|---|---|---|
| SUP-01 | Kamus mini JP–ID | Cari via romaji/kana/kanji/Indonesia; entri: arti, contoh kalimat + audio TTS, bentuk kata; min. 1500 entri N5 |
| SUP-02 | Flashcard | Deck otomatis dari kosakata yang sudah dipelajari; mode flip + mode tes; SRS (interval sama dengan LP-04) |
| SUP-03 | Kuis harian | 5 soal campuran dari materi yang sudah dipelajari; 1x/hari; +10 XP |
| SUP-04 | Profil | Statistik: XP total, streak, lesson selesai, waktu belajar, riwayat skor, badge; edit nama/foto |
| SUP-05 | Pengumuman *(fase 2)* | Banner/inbox pengumuman dari admin lembaga |

---

## 7. Fitur Detail — Admin Web App

### 7.1 ADM — Autentikasi & Peran
| ID | Fitur | Spesifikasi |
|---|---|---|
| ADM-01 | Login admin | Email+password; session terpisah dari student app; 2FA opsional |
| ADM-02 | Peran | `owner` (semua hak + kelola admin) dan `staff` (semua kecuali kelola admin & branding — **termasuk akses penuh editor konten ADM-40/41**, karena pengajar memakai role ini juga) |

### 7.2 ADM — Manajemen Undangan
| ID | Fitur | Spesifikasi |
|---|---|---|
| ADM-10 | Invite single | Form: nama, email, kelas; preview email sebelum kirim |
| ADM-11 | Invite bulk CSV | Upload CSV (kolom: nama, email, kelas); validasi format email & duplikat; laporan hasil: X terkirim, Y gagal (dengan alasan per baris); template CSV bisa diunduh |
| ADM-12 | Daftar undangan | Tabel: nama, email, kelas, status, tanggal kirim, kedaluwarsa; filter status/kelas; aksi: resend, revoke |

*(ADM-13 "Kuota kursi" dihapus — tidak ada batasan jumlah murid aktif; invite tidak pernah ditolak karena kuota.)*

### 7.3 ADM — Kelas & Murid
| ID | Fitur | Spesifikasi |
|---|---|---|
| ADM-20 | CRUD kelas | Nama kelas, level target, deskripsi; arsipkan kelas (data murid tetap ada, read-only) |
| ADM-21 | Daftar murid | Tabel per kelas: nama, email, status, last active, XP, streak; pindah kelas; nonaktifkan akun (murid tidak bisa login, data tidak hilang) |
| ADM-22 | Reset bantuan | Admin bisa trigger kirim ulang email reset password ke murid |

### 7.4 ADM — Monitoring & Laporan
| ID | Fitur | Spesifikasi |
|---|---|---|
| ADM-30 | Dashboard ringkas | Kartu: murid aktif minggu ini, rata-rata XP, distribusi streak, lesson completion rate per kelas |
| ADM-31 | Detail murid | Timeline belajar, skor per unit, skor percakapan, (fase 2: skor pronunciation + replay rekaman), heatmap aktivitas |
| ADM-32 | Laporan *(fase 2)* | Filter per kelas & rentang tanggal; export CSV/Excel; kolom: progres level, XP, streak, skor rata-rata |
| ADM-33 | Peringatan pasif *(fase 2)* | Daftar murid tidak aktif ≥ 7 hari agar admin bisa follow-up |

### 7.5 ADM — Konten *(fase 2)*
| ID | Fitur | Spesifikasi |
|---|---|---|
| ADM-40 | Editor skenario percakapan | Editor dialog: tambah baris, peran, opsi respon benar/salah + feedback, generate audio TTS; preview sebagai murid; version draft/published. Kepemilikan konten master: pemilik produk |
| ADM-41 | Bank soal custom | Tambah soal pilihan ganda/isian ke unit tertentu |
| ADM-42 | Pengumuman | Broadcast teks ke semua murid / kelas tertentu |

---

## 8. Inventaris Layar (Screen Inventory)

### Student App (desktop-first, PWA)
| # | Layar | Rute | Isi utama |
|---|---|---|---|
| S1 | Invite landing | `/invite/:token` | Sambutan lembaga, form registrasi |
| S2 | Login | `/login` | Email, password, lupa password |
| S3 | Onboarding | `/welcome` | 3 layar: target harian, level, mulai |
| S4 | Home / Path | `/` | Peta learning path, streak, target XP |
| S5 | Lesson session | `/learn/:lessonId` | Mesin soal, progress bar, nyawa/XP |
| S6 | Hasil lesson | `/learn/:lessonId/result` | Skor, bintang, XP, review jawaban salah |
| S7 | Percakapan list | `/conversation` | Katalog skenario + status |
| S8 | Percakapan session | `/conversation/:id` | Dialog role-play + (fase 2) rekam suara |
| S9 | Hasil percakapan | `/conversation/:id/result` | Skor, (fase 2) detail pronunciation |
| S10 | Kamus | `/dictionary` | Pencarian + entri kata |
| S11 | Flashcard | `/flashcards` | Deck + sesi review |
| S12 | Leaderboard | `/leaderboard` | Peringkat kelas mingguan |
| S13 | Profil | `/profile` | Statistik, badge, pengaturan akun |

### Admin App (desktop)
| # | Layar | Rute | Isi utama |
|---|---|---|---|
| A1 | Login | `/login` | — |
| A2 | Dashboard | `/` | Kartu ringkasan + grafik |
| A3 | Undangan | `/invitations` | Daftar + invite single/bulk |
| A4 | Kelas | `/classes` | CRUD kelas + anggota |
| A5 | Murid | `/students` | Tabel murid semua kelas |
| A6 | Detail murid | `/students/:id` | Progres lengkap |
| A7 | Konten *(fase 2)* | `/content` | Editor skenario & soal |
| A8 | Laporan *(fase 2)* | `/reports` | Filter + export |
| A9 | Pengaturan | `/settings` | Profil lembaga, admin |

---

## 9. Desain Teknis

### 9.1 Stack
| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui; PWA (vite-plugin-pwa) | Cepat, satu codebase untuk student & admin app; desktop-first responsive |
| Backend | Node.js + NestJS — REST | Type-safe, struktur modular, shared TypeScript types dengan kedua frontend. Satu backend saja — logic AI conversation + TTS yang tadinya di `server/ai_tutor` (FastAPI/Python, proyek lama) di-port ke sini, bukan dipertahankan sebagai service Python terpisah |
| DB utama | PostgreSQL | Relasional kuat (user, progress, konten). Single-tenant — tidak ada kolom `org_id` |
| Cache/session | Redis | Leaderboard, rate limit, session refresh token |
| Storage | S3-compatible (MinIO/cloud) | Audio TTS cache & rekaman murid (fase 2) |
| Email | SendGrid / Mailgun / SES | Email transaksional undangan & reset |
| TTS | Azure / Google TTS Bahasa Jepang | Semua audio materi MVP; hasil di-cache ke S3 agar hemat biaya |
| Speech (fase 2) | Azure Pronunciation Assessment (utama) — fallback Google STT | Scoring per fonem paling matang |
| LLM (fase 2) | API LLM untuk conversation partner, system prompt per skenario + guardrail | Jawaban bebas terkendali |
| Deploy | Docker; student/admin static hosting + satu API container (NestJS); managed PostgreSQL & Redis | Sederhana & portable — satu backend container, bukan API + microservice Python terpisah (pelajaran dari proyek lama: operasional 2 service yang saling bergantung itu merepotkan) |

### 9.2 API Utama (ringkas)
```
POST   /auth/invitations/validate        # cek token undangan
POST   /auth/register                    # registrasi via token
POST   /auth/login | /auth/refresh | /auth/forgot | /auth/reset
GET    /me | PATCH /me
GET    /path                             # learning path + status node
GET    /lessons/:id                      # data soal lesson
POST   /lessons/:id/attempts             # submit jawaban → skor, XP, SRS update
GET    /scenarios | GET /scenarios/:id
POST   /scenarios/:id/attempts
POST   /pronunciation/assess (fase 2)    # multipart audio → skor detail
GET    /dictionary?q=
GET    /flashcards/due | POST /flashcards/review
GET    /leaderboard
# Admin (prefix /admin, auth admin)
POST   /admin/invitations | POST /admin/invitations/bulk
GET    /admin/invitations | POST /admin/invitations/:id/resend | DELETE /admin/invitations/:id
CRUD   /admin/classes | GET /admin/students | GET /admin/students/:id/progress
GET    /admin/reports/export (fase 2)
```

### 9.3 Data Model (entitas & field kunci)

Single-tenant: tidak ada `org_id` di tabel manapun. `Institution` cuma satu baris singleton (branding), bukan tabel multi-row dengan kuota/plan komersial.

```
Institution(id, name, logo)  # singleton — 1 baris saja, cuma untuk branding
AdminUser(id, name, email, password_hash, role[owner|staff])
Class(id, name, target_level, status[active|archived])
Invitation(id, class_id, name, email, token_hash, status, expires_at, accepted_at)
User(id, class_id, name, email, password_hash, avatar, status, created_at, last_active_at)
Level(id, code[N5...], order) — Unit(id, level_id, title, order) — Lesson(id, unit_id, title, order)
Exercise(id, lesson_id, type, payload_json, difficulty)
UserLessonProgress(id, user_id, lesson_id, score, stars, attempts, completed_at)
ReviewItem(id, user_id, item_type[word|kanji], item_id, srs_stage, next_review_at)
Scenario(id, title_jp, title_id, level, payload_json, status[draft|published])
ScenarioAttempt(id, user_id, scenario_id, mode, score, duration_sec, created_at)
PronunciationResult(id, attempt_id, overall, accuracy, pitch, rhythm, fluency, detail_json, audio_url)  # fase 2
XpEvent(id, user_id, source, amount, created_at)
Streak(id, user_id, current, longest, last_activity_date, freeze_available)
Badge(id, code, name_id, criteria_json) — UserBadge(user_id, badge_id, earned_at)
Announcement(id, title, body, target[class_id|all], created_at)  # fase 2
AudioAsset(id, text_hash, text_jp, s3_url, created_at)  # cache TTS, key = hash(text_jp), lihat 9.4
```

### 9.4 Pipeline Audio TTS (MVP)
1. Setiap kali teks JP (baris dialog, kosakata, soal listening) perlu audio: hitung hash (SHA-256) dari teks JP persis → cek tabel `AudioAsset` by `text_hash`.
2. Kalau belum ada: generate via TTS JP → simpan ke S3 → catat baris baru di `AudioAsset` (`text_hash`, `text_jp`, `s3_url`).
3. Kalau sudah ada: pakai `s3_url` yang tersimpan langsung, tidak generate ulang.
4. Konsekuensi: konten JSON (lihat CONV-02) **tidak perlu field audio manual** — resolusi audio selalu otomatis dari teks JP-nya sendiri, teks sama = file sama, biaya TTS hanya sekali per teks unik selamanya.

### 9.5 Integrasi Speech (fase 2)
1. Frontend rekam audio (MediaRecorder, format webm/opus → transcode WAV 16kHz di server).
2. Backend (NestJS) kirim ke Azure Pronunciation Assessment dengan reference text (baris dialog target).
3. Respons (skor per kata/fonem) dinormalisasi ke `PronunciationResult` + dipetakan ke bank tips Bahasa Indonesia.
4. Rekaman disimpan ke S3 (retensi 90 hari, bisa dihapus murid/admin — privasi).
5. Kuota: 20 penilaian penuh/murid/hari, dihitung di Redis.

---

## 10. Kebutuhan Non-Fungsional

| Kategori | Requirement |
|---|---|
| Performa | LCP halaman utama < 2.5 dtk; API p95 < 300 ms; audio TTS streaming cepat (cache CDN) |
| Responsif/PWA | **Desktop-first** (min. 1280px optimal); responsive usable di 360px+; installable PWA (ikon/tampilan app-like). **Semua fitur butuh koneksi online** — tidak ada mode offline/cache-materi-untuk-dibaca-offline; instalasi PWA murni untuk kenyamanan akses, bukan offline support |
| Keamanan | HTTPS only; argon2/bcrypt; token undangan signed & one-time; rate limit auth; sanitasi input; CORS ketat; CSP header |
| Privasi | Rekaman suara terenkripsi at-rest; murid bisa hapus rekaman; kepatuhan UU PDP (Indonesia) |
| Reliabilitas | Uptime 99.5%; backup DB harian (retensi 14 hari) |
| Skala | Single-tenant, ±50–500 murid. Tidak dirancang untuk multi-lembaga — ekspansi ke lembaga lain butuh evaluasi arsitektur terpisah, bukan sekadar scale-up |
| Aksesibilitas | Kontras WCAG AA; semua audio ada transkrip; navigasi keyboard dasar; font JP dengan furigana opsional |
| Observability | Log terstruktur, error tracking (Sentry), dashboard uptime |

---

## 11. Analytics & Event Tracking

Event minimal (nama event — properti):
- `invite_sent`, `invite_accepted` (class)
- `registered`, `login` (user)
- `lesson_started`, `lesson_completed` (lesson_id, score, duration)
- `checkpoint_passed / failed` (unit_id)
- `scenario_started / completed` (scenario_id, mode, score)
- `pronunciation_assessed` (scenario_id, overall_score) — fase 2
- `streak_extended`, `badge_earned`, `leaderboard_viewed`
- `admin_invite_bulk`, `admin_report_exported`

Dashboard produk: funnel undangan → registrasi → lesson pertama; DAU/WAU; retention W1/W4; completion per unit.

---

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Biaya speech API membengkak | Tinggi | Kuota 20x/hari (PRON-06); cache; mulai dari skenario populer |
| STT kurang akurat untuk aksen Indonesia | Tinggi | Threshold skor dikalibrasi dengan data pengajar; loop koreksi manual; opsi fallback "mode ringan" |
| Beban pembuatan konten di satu pihak | Tinggi | Libatkan pengajar lembaga pilot sebagai reviewer; konten sebagai data (bukan hardcode); prioritaskan N5 saja di MVP |
| Churn murid setelah minggu pertama | Sedang | Streak + reminder + leaderboard kelas + pengumuman admin |
| Izin mikrofon ditolak | Sedang | Fallback mode teks; panduan izin per-browser (termasuk desktop Chrome/Edge) |
| Scope creep 2 aplikasi | Sedang | Monorepo + shared component; MVP admin dibuat minimal dulu |

---

## 13. Roadmap

| Fase | Durasi | Deliverable | Kriteria keluar |
|---|---|---|---|
| 0 — Fondasi | 2–3 minggu | Finalisasi PRD, wireframe, desain DB, kurikulum N5 + 10 skenario, setup repo & infra | PRD disetujui; lembaga pilot terkonfirmasi |
| 1 — MVP | 8–12 minggu | Student app (path N5, 5 tipe soal, percakapan pilih-respon, gamifikasi, kamus, flashcard, audio TTS) + Admin (invite, kelas, monitoring) | Pilot 1 lembaga, 30–50 murid, aktivasi ≥ 80% |
| 2 — Speech & AI | 6–8 minggu | Koreksi pengucapan, AI conversation, stroke practice, notifikasi push, editor konten, export laporan | Skor pronunciation dipakai ≥ 50% murid aktif |
| 3 — Skala | berkelanjutan | N4/N3, kelas live, evaluasi native app | Lembaga pilot pakai penuh & puas; ekspansi ke lembaga lain (kalau terjadi) dievaluasi sebagai proyek/keputusan bisnis terpisah |

---

## 14. Riwayat Perubahan

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 27 Sep 2026 | Draft awal dari sesi brainstorming |
| 2.0 | 27 Sep 2026 | Detail: user story + AC, screen inventory, API, data model; platform dikunci web application |
| 3.0 | 27 Sep 2026 | Open questions terjawab: 1 lembaga pilot, konten milik pemilik produk, model B2B, bahasa pengantar full Indonesia, desktop-first, audio TTS, kuota pronunciation 20x/hari |
| 4.0 | 27 Sep 2026 | Revisi hasil evaluasi teknis: **single-tenant** (bukan multi-tenant, `org_id` dihapus dari seluruh data model); role admin & pengajar digabung jadi satu (`staff`); **kuota kursi (ADM-13) dihapus**, tidak ada batasan jumlah murid; **online-only**, klaim offline-cache di NFR dihapus; audio TTS di-cache berdasar hash konten teks (bukan id manual di JSON, field `audio` dihapus dari contoh CONV-02, entitas `AudioAsset` ditambah); **backend dikunci NestJS** (bukan lagi "atau FastAPI") — logic AI conversation + TTS dari proyek lama (`server/ai_tutor`, FastAPI/Python) di-port penuh ke NestJS, tidak dipertahankan sebagai service terpisah |
