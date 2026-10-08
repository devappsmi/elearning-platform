# Paket uji dan QC aplikasi belajar bahasa Jepang

Folder ini berisi semua yang dibutuhkan penguji untuk menguji dan memeriksa mutu (QC) aplikasi murid, aplikasi admin, API, dan isi pelajaran.
Folder ini **berdiri sendiri**: bukan bagian dari pnpm workspace, tidak ikut `pnpm build/test/lint`, dan tidak memengaruhi CI aplikasi.

## 1. Isi paket

| Yang Anda butuhkan | Berkas | Dijalankan oleh |
|---|---|---|
| **Kasus uji manual dan lembar kerja** (258 kasus, bug, perangkat, QC rilis, cakupan fitur) | `manual/Buku-Kasus-Uji-QA.xlsx` | Penguji (Excel, LibreOffice, atau Google Sheets) |
| Uji browser otomatis: aplikasi murid (komputer dan ponsel), aplikasi admin, aksesibilitas | `e2e/` (jalankan `npm test`) | Siapa pun yang bisa membuka terminal |
| Uji asap API dan situs (cepat, tanpa browser) | `api/smoke.mjs` (`npm run test:api`) | Siapa pun; ideal tepat setelah deploy |
| Ekspor isi pelajaran untuk diperiksa pengajar + pemeriksaan otomatis salah ketik | `content/export-konten.mjs` (`npm run konten`) | Siapa pun; hasilnya untuk pengajar |
| Daftar periksa sebelum rilis (teks, untuk dicetak) | `checklists/QC-rilis.md` | Penanggung jawab rilis |
| Templat laporan bug | `checklists/Template-Laporan-Bug.md` | Penguji |

Skrip otomatis dan buku kasus uji saling terhubung lewat **ID kasus** (mis. `TC-PL-05`). ID itu tertulis di judul uji otomatis dan di kolom ID buku Excel;
kolom **Otomatis** di buku menunjukkan skrip mana yang menjalankan kasus yang sama.

> **Apa yang sudah diverifikasi kit ini.** Seluruh skrip dijalankan terhadap aplikasi di lingkungan pengembangan (satu komputer, layanan AI **tiruan**): uji browser 134 uji = 132 lulus
> (termasuk 1 yang memang ditandai "diharapkan gagal", lihat bagian 8), 2 dilewati (kartu flashcard belum jatuh tempo, uji rekam suara yang opsional), 0 gagal; uji asap API 26 dari 26 lulus.
> **Belum pernah dijalankan di server penguji Anda**, dengan AI/suara/email sungguhan, di Safari, Firefox, atau ponsel sungguhan. Itu bagian pekerjaan Anda.

## 2. Persiapan (sekali saja)

Kebutuhan: komputer dengan **Node.js 18 atau lebih baru** (disarankan 22), akses internet untuk memasang paket, dan aplikasi yang akan diuji sudah berjalan.
Untuk membaca/mengisi buku kasus uji cukup Excel atau LibreOffice; untuk beberapa kasus (log server, database) Anda perlu bantuan tim teknis.

```bash
cd qa
npm install                  # memasang Playwright dan alat bantu (hanya di folder qa/)
npm run install:browser      # mengunduh browser Chromium untuk uji otomatis (sekali)
cp .env.example .env         # lalu isi qa/.env (lihat di bawah). Berkas .env tidak ikut git.
```

### 2.1 Isi `qa/.env`

| Variabel | Isi |
|---|---|
| `QA_STUDENT_URL`, `QA_ADMIN_URL` | Alamat aplikasi murid dan admin, tanpa garis miring di akhir. Contoh server: `https://belajar.contoh.id` dan `https://admin-belajar.contoh.id`. |
| `QA_API_URL` | Alamat API. Di server dengan Caddy (stack bawaan) API diakses lewat awalan `/api` pada alamat aplikasi: `https://belajar.contoh.id/api`. |
| `QA_STUDENT_*`, `QA_ADMIN_*` | Email dan password akun uji (lihat 2.2). |
| `QA_STUDENT2_*` | Murid uji **kedua**: dipakai uji admin yang mengubah akun (pindah kelas, nonaktifkan, reset). Kosongkan bila tidak ada; uji itu dilewati. |
| `QA_LOCKOUT_*` | Murid **khusus** uji penguncian akun. Setelah uji itu akun terkunci 15 menit. Kosongkan bila tidak ada; uji itu dilewati. |
| `QA_AI` | `auto` (bawaan): uji yang memakai AI dilewati bila server belum punya kunci AI. `on`: gagal bila AI belum aktif. `off`: lewati semua uji AI. |
| `QA_AI_SUARA` | `1` untuk juga menjalankan uji rekam suara dengan mikrofon palsu Chromium. |
| `QA_LESSON_ID` | Pelajaran yang dimainkan uji belajar (bawaan `l1`, pelajaran pertama yang selalu terbuka). |
| `QA_PREFIX` | Awalan nama data uji yang dibuat uji admin (kelas dan undangan), supaya mudah dikenali. |
| `QA_LATENCY_MS` | Ambang waktu respons uji API (bawaan 1500 ms). |
| `QA_TAMPILKAN_BROWSER`, `QA_SLOW_MO` | `1` untuk melihat jendela browser saat uji berjalan; jeda per aksi dalam milidetik. |

### 2.2 Akun uji

**Jangan memakai akun murid atau admin sungguhan.** Minta tim teknis membuat akun khusus uji (perintah lengkap ada di `docs/DEPLOY.md`, bagian 2 dan 5a):

```bash
# di server (tanpa Docker: pnpm --filter api run admin:create / student:create dengan variabel yang sama)
docker compose run --rm -e ADMIN_EMAIL=qa-admin@contoh.id -e ADMIN_PASSWORD -e ADMIN_NAME="QA Admin" tools pnpm run admin:create
docker compose run --rm -e STUDENT_EMAIL=qa-murid@contoh.id -e STUDENT_PASSWORD -e STUDENT_NAME="QA Murid" -e CLASS_NAME="Kelas Uji QA" tools pnpm run student:create
# ulangi untuk murid kedua (qa-murid2) dan murid penguncian (qa-murid-kunci) di kelas yang sama
```

Rekomendasi: ketiga murid uji berada di satu kelas khusus (mis. "Kelas Uji QA"), dan murid uji utama dibuat **baru** sebelum putaran uji agar jalur "murid baru" (pelajaran lain masih terkunci) teruji.
Setelah selesai, nonaktifkan akun uji di halaman detail Murid (admin). Murid uji utama menumpuk kemajuan belajar selama uji; lihat 7 untuk menyiapkan ulang.

### 2.3 Periksa persiapan

```bash
npm run test:api             # 20 pemeriksaan hanya-baca, selesai kurang dari satu menit
npm run typecheck            # memastikan skrip sendiri tidak rusak
```

## 3. Menjalankan uji otomatis

| Tujuan | Perintah | Lama |
|---|---|---|
| Uji asap API dan situs (tepat setelah deploy) | `npm run test:api` | < 1 menit |
| Uji asap API lengkap (mengubah lalu mengembalikan data uji) | `npm run test:api:lengkap` | < 1 menit |
| Uji cepat browser (18 alur terpenting) | `npm run test:smoke` | sekitar 30 detik |
| **Semua uji browser** | `npm test` | sekitar 6 menit (lokal) |
| Hanya aplikasi murid (komputer dan ponsel) | `npm run test:murid` | |
| Hanya aplikasi admin | `npm run test:admin` | |
| Hanya uji Ngobrol dengan AI (memakai jatah harian murid uji) | `npm run test:ai` | |
| Hanya pemindaian aksesibilitas (axe) | `npm run test:a11y` | |
| Satu kasus berdasarkan ID | `npx playwright test -g "TC-PL-05"` | |
| Lihat jendela browser | `QA_TAMPILKAN_BROWSER=1 npm test` | |
| Ekspor isi pelajaran untuk pengajar | `npm run konten` (tambah `-- --audio` bila suara sudah dibuat) | < 1 menit |
| Buka laporan HTML hasil uji terakhir | `npm run laporan` | |

Catatan penting:

- **Uji berjalan satu per satu** (satu pekerja) supaya data uji tidak saling menimpa dan batas permintaan server (100 per menit per alamat IP) tidak terpicu. Jangan menjalankan `npm test` dan `npm run test:api` bersamaan.
- Uji **mengubah data uji** (kemajuan belajar, XP, kelas dan undangan dengan awalan `QA`, nama/target murid yang lalu dikembalikan). Karena itu hanya jalankan terhadap lingkungan uji atau dengan akun uji.
- Beberapa uji menyesuaikan diri dengan keadaan akun: bila pelajaran sudah pernah lulus, pemeriksaan "XP pertama kali" otomatis berubah menjadi "tidak ada XP lagi".
- Hasil tersimpan di `qa/reports/` (tidak ikut git): `html/` (laporan), `hasil.json`, `api-smoke.json`, dan `artefak/<nama-uji>/` berisi **tangkapan layar dan trace** hanya untuk uji yang gagal.
  Buka trace dengan `npx playwright show-trace reports/artefak/<nama-uji>/trace.zip`.
- Kode keluar: 0 = semua lulus, bukan 0 = ada yang gagal (cocok untuk CI/tugas terjadwal).

## 4. Menjalankan kasus uji manual

1. Buka `manual/Buku-Kasus-Uji-QA.xlsx`. Baca lembar **Petunjuk**, isi lembar **Lingkungan**.
2. Kerjakan lembar **Kasus Uji** dari prioritas P1. Filter kolom **Otomatis** = "Tidak (manual)" untuk melihat kasus yang HARUS dikerjakan manual (116 kasus). Kasus yang sudah ada skripnya juga boleh dijalankan manual; isi kolom Hasil sesuai laporan skrip bila Anda mempercayainya.
3. Catat tiap kegagalan di **Log Bug** (atau memakai `checklists/Template-Laporan-Bug.md` untuk tiket), isi ID Bug di kasus uji.
4. Isi **Perangkat** setelah mencoba alur inti di tiap perangkat/browser. Safari, Firefox, dan ponsel sungguhan **tidak** tercakup skrip otomatis.
5. Lembar **Ringkasan** menghitung otomatis. Lembar **QC Rilis** adalah daftar periksa akhir; **Temuan Awal** adalah hal yang ditemukan tim saat menyusun kit ini dan perlu keputusan.

## 5. Mengambil tautan undangan dan reset password

**Email belum terkirim otomatis.** Tautan undangan, reset password, dan permintaan undangan ulang hanya dicatat di log API. Untuk kasus yang membutuhkannya (`TC-AK-01`, `TC-AK-18`, dan lain-lain):

```bash
docker compose logs --no-color api | sed 's/\x1b\[[0-9;]*m//g' | grep "\[STUB\]"
# [STUB] Undangan ke budi@contoh.id (Budi, kelas Pagi): https://belajar.contoh.id/invite/<token>
# [STUB] Reset password ke budi@contoh.id: https://belajar.contoh.id/reset-password/<token>
```

Pastikan alamat di tautan adalah alamat aplikasi murid yang benar (kasus `TC-AD-30`).

## 6. Resep untuk kasus yang butuh akses server

Jalankan dari folder tempat `docker-compose.yml` berada; sesuaikan nama layanan dengan stack Anda.

```bash
# Membuka kunci akun uji penguncian tanpa menunggu 15 menit
docker compose exec -T redis redis-cli del login_lock:qa-murid-kunci@contoh.id login_fail:qa-murid-kunci@contoh.id

# Menjadikan kartu flashcard murid uji jatuh tempo SEKARANG (kartu baru tercipta setelah murid lulus pelajaran)
docker compose exec -T postgres psql -U <user> -d <database> -c \
  "UPDATE review_items SET next_review_at = now() - interval '1 minute' WHERE user_id = (SELECT id FROM users WHERE email = 'qa-murid@contoh.id');"

# Membuat undangan kedaluwarsa tanpa menunggu 7 hari (TC-AK-05)
docker compose exec -T postgres psql -U <user> -d <database> -c \
  "UPDATE invitations SET expires_at = now() - interval '1 day' WHERE email = '<email uji>';"

# Menguji jatah AI habis dengan cepat: turunkan jatah (TC-AI-15), lalu mulai ulang API
#   di .env server:  TUTOR_DAILY_QUOTA=2     docker compose up -d api
```

## 7. Menyiapkan ulang murid uji

Uji otomatis dan manual menumpuk kemajuan murid uji utama (pelajaran lulus, XP, kartu). Untuk mengulang jalur "murid baru":

- Buat murid uji **baru** dengan `student:create` (email baru) dan ganti `QA_STUDENT_EMAIL`/`QA_STUDENT_PASSWORD` di `.env`; atau
- nonaktifkan akun lama di admin dan buat akun baru dengan nama yang sama berurutan (`qa-murid-2`, `qa-murid-3`).

## 8. Uji yang ditandai "diharapkan gagal" (temuan diketahui)

Uji `TC-AD-27` memakai `test.fail()`: ia menuliskan perilaku yang **seharusnya** terjadi (murid yang dinonaktifkan kehilangan sesinya) padahal saat ini sesinya tetap berjalan. Selama perilaku itu belum diubah, uji ini tampil sebagai
"lulus" di laporan (karena memang diharapkan gagal). **Bila suatu saat uji ini dilaporkan "gagal" dengan pesan "expected to fail, but passed", artinya perilakunya sudah diperbaiki**: hapus baris `test.fail(...)` di `e2e/admin/murid.spec.ts`.
Temuan lain dari penyusunan kit ini ada di lembar **Temuan Awal** buku Excel.

## 9. Pemecahan masalah

| Gejala | Penyebab dan jalan keluar |
|---|---|
| `browserType.launch: Executable doesn't exist` | Jalankan `npm run install:browser`. |
| `QA_xxx belum diisi` | Lengkapi `qa/.env` (lihat 2.1). |
| Banyak uji gagal bersamaan di awal, pesan "Terlalu banyak permintaan" | Batas 100 permintaan/menit per IP terlampaui (uji lain berjalan bersamaan, atau jaringan kantor berbagi IP). Tunggu satu menit lalu ulangi. |
| `page.goto: net::ERR_CONNECTION_REFUSED` | Alamat di `.env` salah atau aplikasi belum berjalan. Buka alamat itu di browser dulu. |
| Uji masuk gagal "Email atau password salah" | Akun uji belum dibuat, password salah, atau akun terkunci 15 menit (lihat 6). |
| Uji admin gagal di awal (`setup-admin`) | Akun admin uji belum ada atau terkunci. |
| `TC-AK-15` (penguncian) gagal karena akun sudah terkunci dari putaran sebelumnya | Tunggu 15 menit atau buka kunci (lihat 6). Uji ini sudah menangani akun yang sudah terkunci, tetapi akun harus ada. |
| Uji AI dilewati semua | Server belum punya kunci AI (`QA_AI=auto`). Bila seharusnya aktif, periksa `OPENAI_API_KEY` di server. |
| Uji flashcard `TC-FC-02` dilewati | Murid uji belum punya kartu jatuh tempo; lihat resep di bagian 6. |
| Uji pelajaran gagal "masih terkunci untuk akun uji" | `QA_LESSON_ID` menunjuk pelajaran yang terkunci. Pakai `l1` pada akun baru. |
| Tangkapan layar di laporan menunjukkan halaman putih | Aplikasi gagal memuat (periksa `QA_STUDENT_URL`, sertifikat HTTPS, dan Console browser). |

## 10. Memelihara paket ini

- **Menambah uji otomatis**: tambahkan berkas `*.spec.ts` di `e2e/murid/`, `e2e/admin/`, dan seterusnya. Awali judul uji dengan ID kasus `[TC-XX-NN]`. Setelah itu tambahkan kasusnya di `manual/kasus_*.py` dengan ID yang sama.
- **Menambah atau mengubah kasus uji manual**: ubah `manual/kasus_*.py`, lalu `pip install openpyxl` dan `python3 manual/build_workbook.py`. Skrip memeriksa bahwa semua ID di skrip otomatis ada di katalog, dan bahwa setiap fitur yang tersedia punya kasus uji.
  Setelah membangun ulang, hitung ulang rumusnya dengan membukanya sekali di Excel/LibreOffice (atau pakai skrip recalc milik tim). Catatan: hasil yang sudah diisi penguji di berkas lama tidak ikut pindah; kerjakan satu salinan per putaran uji.
- **Pembaruan Playwright**: versi dikunci di `package.json` (1.56.1) agar cocok dengan browser yang terpasang. Naikkan versinya bersama `npx playwright install chromium`.
- **Selektor** uji mengandalkan teks dan atribut `data-testid` aplikasi; bila teks layar diubah, ubah juga uji yang menunjuknya (pesan galat uji menyebut yang tidak ditemukan).

## 11. Yang TIDAK dicakup (harus dilengkapi penguji)

Mutu balasan dan suara AI sungguhan, pengiriman email sungguhan, Safari/Firefox/Edge lama, ponsel dan tablet sungguhan, pembaca layar, uji beban besar, uji penetrasi mendalam, dan isi/bahasa pelajaran (oleh pengajar).
Kasus manual untuk semuanya ada di buku Excel (area Ngobrol dengan AI, Tampilan ponsel, Aksesibilitas, Konten pelajaran, Keamanan/kinerja/pemulihan).
