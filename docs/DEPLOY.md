# Deploy di server sendiri (Docker Compose)

Panduan menjalankan **seluruh platform** (aplikasi murid, aplikasi admin, API, database, cache, penyimpanan audio,
HTTPS) di satu server dengan Docker Compose. Semua berkas ada di folder [`deploy/`](../deploy). **Databasenya memakai
Postgres yang sudah ada di server Anda** (bagian 2a); container Postgres bawaan hanya untuk uji cepat. Langkah inti dan
perintah operasional di bawah sudah dijalankan sungguhan di sandbox; apa yang belum (mis. sertifikat Let's Encrypt)
dan batasnya ada di "Yang sudah dan belum diverifikasi" di akhir.

```
                    internet
                       │  80 / 443 (dan 8080 hanya untuk mode uji lewat IP)
                ┌──────▼───────┐
                │ edge (Caddy) │  HTTPS otomatis · berkas statis kedua aplikasi web
                └───┬──────┬───┘
      /api/* ───────┘      └─────── /media/* (hanya baca, hanya situs murid)
                    │
             ┌──────▼────────┐      audio pelajaran ditulis dan disajikan dari
             │ api (NestJS)  │────▶ volume Docker `media_data` (disk server, tanpa S3)
             └───┬───────┬───┘
                 │       └───▶ redis (container)   migrate = sekali jalan tiap `up` (skema database)
                 ▼                                  tools   = perintah manual (seed, buat admin, cek database/OpenAI)
      Postgres ANDA (server sendiri)
      atau container `postgres` bawaan (opsional, uji cepat)
```

Hanya `edge` yang membuka port ke luar. Redis dan API tidak bisa dijangkau dari internet; Postgres milik Anda dijangkau
API lewat jaringan Anda sendiri (bagian 2a).
Aplikasi web memanggil API lewat alamat relatif `/api` di origin-nya sendiri, jadi tidak ada CORS dan image yang
sama berlaku untuk domain/IP mana pun.

## 1. Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| Server Linux | Perkiraan: 2 vCPU, RAM ≥ 2 GB (build TypeScript/Vite memakai cukup banyak memori — tambah swap kalau kurang), disk ≥ 10 GB |
| Docker Engine + Compose v2.20+ | `docker compose version`. Diuji dengan Docker 29 / Compose v5 (linux/amd64; arm64 belum dicoba) |
| Akses internet dari server | Saat build (npm, Docker Hub, paket Debian) dan saat jalan (Let's Encrypt; OpenAI/Azure bila dipakai) |
| Port 80 dan 443 terbuka | Mode domain (HTTPS). Mode uji lewat IP: port 80 dan 8080 |
| Dua nama host (mode domain) | mis. `belajar.contoh.id` (murid) dan `admin.belajar.contoh.id` (admin), keduanya record **A** ke IP server |
| Server Postgres | Yang **sudah ada** (bawaan panduan ini): alamat, nama database, pengguna + kata sandi, dan bisa dijangkau dari server ini — lihat 2a. Tanpa itu, untuk uji cepat: Postgres bawaan stack (`sh gen-env.sh --builtin-db`) |
| `git` | Untuk mengambil kode |

## 2. Langkah cepat (mode domain, HTTPS otomatis)

```bash
# 1. Ambil kode. Berkas deploy saat ini ada di branch PR (belum digabung ke main).
git clone https://github.com/devappsmi/elearning-platform.git
cd elearning-platform
git checkout claude/dazzling-feynman-m7w7t6
cd deploy

# 2. Buat .env dengan rahasia acak, lalu isi alamat akses DAN alamat database Anda (bagian 2a)
sh gen-env.sh      # (Postgres bawaan stack untuk uji cepat: sh gen-env.sh --builtin-db)
nano .env          # ubah STUDENT_ADDRESS, ADMIN_ADDRESS, PUBLIC_STUDENT_URL, PUBLIC_ADMIN_URL, dan DATABASE_URL

# 3. Bangun dan jalankan (pertama kali beberapa menit: mengunduh image dan membangun 3 image)
docker compose up -d --build
docker compose ps                 # semua "healthy"/"Up"; migrate "Exited (0)" itu normal (sekali jalan)
docker compose logs migrate       # laporan database: server, TLS, keadaan schema, migrasi yang diterapkan

# 4. Isi konten pelajaran (Hiragana, badge, skenario) — aman diulang
docker compose run --rm tools pnpm run db:seed

# 5. Buat admin pertama (kata sandi dibaca dari environment, bukan argumen, supaya tidak tampil di daftar proses)
read -rs -p "Kata sandi admin: " ADMIN_PASSWORD; echo; export ADMIN_PASSWORD
docker compose run --rm -e ADMIN_EMAIL=admin@contoh.id -e ADMIN_PASSWORD \
  -e ADMIN_NAME="Nama Anda" -e INSTITUTION_NAME="Nama Lembaga" tools pnpm run admin:create
unset ADMIN_PASSWORD
```

Kata sandi admin minimal 8 karakter dan harus mengandung huruf dan angka (aturan yang sama dengan murid).
`INSTITUTION_NAME` opsional; ia tampil di halaman undangan murid ("Selamat datang di …"). Repo privat: clone dengan
token atau deploy key.

**Langkah 3 berhenti di `service "migrate" didn't complete successfully`?** Itu hampir selalu pengaturan database:
`docker compose logs migrate` menjelaskan penyebabnya (`GAGAL: …` beserta tindakannya). Perbaiki `.env` atau hak di server
database, lalu ulangi `docker compose up -d` — API dan `edge` baru menyala setelah database benar.

Buka `https://admin.belajar.contoh.id`, masuk, buat kelas, lalu undang murid (bagian 5). Sertifikat HTTPS diurus
Caddy sendiri saat pertama diakses — lihat "Pemecahan masalah" bila gagal.

### 2a. Database: Postgres yang sudah ada

Bawaan panduan ini: aplikasi memakai **Postgres yang sudah ada di server Anda** lewat `DATABASE_URL` di `.env`; stack
**tidak** membuat container Postgres. (Untuk uji cepat tanpa server database: "Postgres bawaan" di akhir bagian ini.)

**Yang perlu disiapkan (oleh Anda atau pengelola database)**
1. Alamat server dan port, nama database, nama pengguna, dan kata sandi.
2. Database **kosong dan khusus** aplikasi ini, dengan pengguna sebagai **pemilik database**. Aplikasi membuat sendiri
   24 tabel dan beberapa tipe enum lewat migrasi. Tidak perlu superuser dan tidak butuh ekstensi apa pun:
   ```sql
   CREATE ROLE elearning_app LOGIN PASSWORD '...';
   CREATE DATABASE elearning OWNER elearning_app;
   ```
3. Server bisa dijangkau dari server aplikasi: firewall, `listen_addresses` di `postgresql.conf`, dan `pg_hba.conf` yang
   mengizinkan alamat server aplikasi.

**Mengisi `DATABASE_URL`** di `deploy/.env`:
```
DATABASE_URL=postgresql://elearning_app:KATA_SANDI@db.contoh.id:5432/elearning
```
- **Karakter khusus di nama pengguna/kata sandi harus di-encode**: `@`→`%40` `:`→`%3A` `/`→`%2F` `?`→`%3F` `#`→`%23`
  `%`→`%25` `$`→`%24` spasi→`%20` (kata sandi `Pa@ss:w/rd#1%` ditulis `Pa%40ss%3Aw%2Frd%231%25`). Tanpa encode Prisma
  hanya menjawab "invalid port number in database URL" — `db:check` menjelaskannya. Paling mudah: kata sandi huruf/angka saja.
- **Host**: di dalam container, `localhost` adalah container itu sendiri, **bukan** mesin server. Server database lain →
  pakai nama/IP-nya. Postgres di mesin yang **sama** dengan Docker → `host.docker.internal` (sudah dipetakan ke mesin host
  oleh stack ini), dan Postgres harus mendengarkan di alamat yang bisa dicapai container (bukan hanya `127.0.0.1`) dengan
  `pg_hba.conf` yang mengizinkan jaringan Docker. *(Diuji dengan Postgres yang berjalan sebagai container terpisah; Postgres
  native di mesin host tidak bisa dicoba dari sandbox.)*
- **TLS**: server yang mewajibkan TLS (umum di Postgres terkelola) → tambahkan `?sslmode=require`. Diuji terhadap server yang
  hanya menerima koneksi TLS dengan sertifikat self-signed: tanpa parameter dan `sslmode=require` sama-sama berhasil,
  `sslmode=disable` ditolak server, dan server mengonfirmasi koneksi API memakai TLSv1.3. Dalam mode ini koneksi
  terenkripsi tetapi **sertifikat server tidak diverifikasi**. Tanpa parameter, Prisma memakai TLS bila tersedia dan
  diam-diam jatuh ke koneksi tanpa enkripsi bila tidak — untuk server di luar jaringan tepercaya pakai `sslmode=require`.
- **Database sudah berisi tabel aplikasi lain**: Prisma menolak memigrasi schema `public` yang tidak kosong (P3005). Pilih
  database khusus (disarankan) atau schema khusus dengan `?schema=elearning`; beberapa parameter digabung dengan `&`:
  `...:5432/elearning?schema=elearning&sslmode=require`. Schema dibuat otomatis oleh migrasi bila pengguna berhak `CREATE`
  pada database (atau pengelola membuatnya: `CREATE SCHEMA elearning AUTHORIZATION elearning_app;`). Diuji: tabel aplikasi
  lain di `public` tidak tersentuh dan semua tabel aplikasi ini ada di schema itu.

**Yang dilakukan aplikasi pada database Anda** (satu pengguna dipakai untuk semuanya)
- `migrate` (otomatis tiap `docker compose up`): `prisma migrate deploy` — membuat/mengubah **hanya** tabel dan tipe milik
  aplikasi ini (sekarang 3 migrasi) plus tabel `_prisma_migrations` di schema-nya. Hak `CREATE` pada schema itu diperlukan
  selama ada migrasi.
- `db:seed`: menambah/memperbarui baris konten pelajaran (upsert, aman diulang). `admin:create`: satu baris admin (+ lembaga). `student:create`: satu murid uji tanpa undangan (bagian 5a).
- API: membaca/menulis tabel aplikasi lewat pengguna yang sama.

**Memeriksa koneksi dan kesiapan** (tidak mengubah apa pun; juga berjalan otomatis di awal `db:deploy`, jadi `migrate` mencetaknya):
```bash
docker compose run --rm tools pnpm run db:check
# Database : PostgreSQL 17.11 ... di db.contoh.id:5432/elearning (schema "public", pengguna "elearning_app")
# TLS      : ya
# Schema   : kosong -- siap dimigrasi
```
Bila ada yang salah, ia berhenti dengan `GAGAL: …` dan tindakannya: contoh `GANTI-…` belum diganti, kata sandi belum di-encode,
`localhost` di dalam container, server tak terjangkau, kata sandi/pengguna ditolak, database tidak ada, schema sudah berisi
tabel lain (P3005) atau riwayat migrasi aplikasi Prisma lain, dan pengguna tanpa hak membuat tabel (dengan perintah `GRANT`
yang tepat). Kata sandi tidak pernah dicetak.

**Postgres bawaan (uji cepat, tanpa server database sendiri)**: `sh gen-env.sh --builtin-db` (atau di `.env`: `DATABASE_URL=`
kosong dan `COMPOSE_PROFILES=builtin-db`). Container `postgres` dibuat dengan data di volume `postgres_data`;
`docker compose down -v` menghapusnya. Pindah dari bawaan ke server sendiri: `sh backup.sh` lalu pulihkan ke database baru
(bagian 8, "Cadangan dan pemulihan").

## 3. Mode uji tanpa domain (HTTP lewat IP)

Untuk mencoba cepat tanpa DNS. **Jangan dipakai untuk murid sungguhan**: kata sandi lewat tanpa enkripsi. Di `.env`,
ganti empat baris alamat dengan (ganti `IP-SERVER`):

```
STUDENT_ADDRESS=:80
ADMIN_ADDRESS=:8080
PUBLIC_STUDENT_URL=http://IP-SERVER
PUBLIC_ADMIN_URL=http://IP-SERVER:8080
```

Murid di `http://IP-SERVER`, admin di `http://IP-SERVER:8080`. Langkah lainnya sama. Nilai `PUBLIC_*` dipakai untuk
membentuk tautan undangan/reset, jadi harus alamat yang benar-benar dibuka pengguna.

## 4. Memeriksa bahwa semuanya jalan

```bash
docker compose ps                                  # api "healthy", edge "Up"
curl https://belajar.contoh.id/api/health          # {"status":"ok"}
curl -I https://belajar.contoh.id/api/api-docs     # 404: dokumentasi Swagger sengaja tidak dibuka ke publik
docker compose logs -f api                         # log API; Ctrl+C untuk keluar
docker compose logs migrate                        # laporan database dan migrasi yang diterapkan
```

## 5. Email: tautan undangan dan reset password (PENTING)

**Belum ada pengirim email sungguhan.** `MailModule` masih stub: undangan dan reset password *dibuat benar* tetapi
tautannya hanya **dicetak di log API**, tidak dikirim. Sampai penyedia email dipilih, admin menyalin tautan dari log
dan mengirimnya ke murid (WhatsApp dsb.):

```bash
docker compose logs --no-color api | sed 's/\x1b\[[0-9;]*m//g' | grep "\[STUB\]"
# [STUB] Undangan ke budi@contoh.id (Budi, kelas Pagi): https://belajar.contoh.id/invite/<token>
# [STUB] Reset password ke budi@contoh.id: https://belajar.contoh.id/reset-password/<token>
```

Undangan berlaku sesuai aturan aplikasi; tautan yang kedaluwarsa bisa dikirim ulang dari halaman Undangan admin
(tautan baru muncul di log lagi). Layar "Lupa password" murid menjawab sama untuk semua alamat (anti-enumerasi),
jadi murid yang lupa password menghubungi admin, yang mengambil tautannya dari log.

### 5a. Murid uji tanpa undangan (hanya untuk pengujian)

Murid sungguhan masuk lewat undangan (bagian 5): undangan-lah yang membuktikan pemilik alamat emailnya. Untuk **menguji**
aplikasi murid tanpa mengurus tautan undangan, buat murid langsung dari server:

```bash
# 1) Tempel SATU baris ini saja, tekan Enter, lalu ketik kata sandi dua kali (tidak tampil). Jangan tempel bersama baris
#    lain: baris berikutnya akan terbaca sebagai kata sandi.
read -rs -p "Kata sandi murid uji: " P1; echo; read -rs -p "Ulangi: " P2; echo; if [ "$P1" = "$P2" ]; then export STUDENT_PASSWORD="$P1"; echo "cocok"; else echo "TIDAK sama, ulangi baris ini"; fi; unset P1 P2

# 2) Setelah muncul "cocok":
docker compose run --rm -e STUDENT_EMAIL=murid@contoh.id -e STUDENT_PASSWORD -e STUDENT_NAME="Murid Uji" tools pnpm run student:create
unset STUDENT_PASSWORD
# Murid murid@contoh.id dibuat, kelas "Kelas Uji" (kelas baru dibuat).
```

Masuk di **situs murid** dengan email itu; akun murid dan admin tersimpan terpisah, jadi akun admin tidak berlaku di sana.
Kata sandi minimal 8 karakter dan harus mengandung huruf dan angka (aturan yang sama dengan pendaftaran murid). Yang dibuat
sama dengan pendaftaran lewat undangan: satu baris murid dengan email baku (huruf kecil) dan hash kata sandi argon2id.

- **Kelas**: murid selalu punya kelas. `CLASS_NAME` kosong → satu-satunya kelas **aktif**; belum ada kelas sama sekali →
  "Kelas Uji" dibuat; beberapa kelas aktif → berhenti dan meminta `CLASS_NAME` (menebak bisa memasukkan murid uji ke kelas
  sungguhan). `-e CLASS_NAME="Kelas Pagi"` → kelas aktif bernama itu (huruf besar/kecil diabaikan), dibuat bila belum ada;
  kelas yang diarsipkan ditolak.
- **Murid sudah ada** (email sama): kata sandi diganti, akun diaktifkan lagi, semua sesi lamanya dicabut — jadi ini juga jalur
  "lupa kata sandi" untuk murid uji. Nama dan kelas hanya berubah bila `STUDENT_NAME` / `CLASS_NAME` diisi.
- **Email yang masih punya undangan PENDING** (belum kedaluwarsa) ditolak, karena undangan itu nanti gagal di batas unik email:
  cabut dulu di halaman Undangan admin, atau pakai email lain.
- Setelah 5 kali salah kata sandi, akun terkunci 15 menit (kuncinya di Redis). Untuk membukanya sekarang:
  `docker compose exec -T redis redis-cli del login_lock:murid@contoh.id login_fail:murid@contoh.id`.
- **Bukan untuk murid sungguhan**: tidak ada bukti bahwa pemilik email tahu akunnya, dan kata sandinya dipilih operator. Akun
  uji yang sudah tidak dipakai dinonaktifkan di halaman detail Murid (admin).

## 6. Fitur opsional: AI tutor dan audio pelajaran

Semuanya boleh dikosongkan; hanya fitur terkait yang nonaktif.

- **AI tutor** (OpenAI): isi `OPENAI_API_KEY` di `.env`, lalu `docker compose up -d` (API dibuat ulang). Endpoint `/tutor/*`
  sudah ada, tetapi **belum ada layar tutor di aplikasi murid** (Fase 2). Nama model bawaan
  (`gpt-5.6-terra`, `gpt-transcribe`, `gpt-4o-mini-tts`) belum terbukti ada. Dari server Anda (jaringan bebas)
  bisa langsung dicek — 15 tes, biaya sen:
  ```bash
  docker compose run --rm tools pnpm run test:live-openai
  ```
  Kalau ada nama model yang ditolak, pesan gagalnya mencantumkan model yang tersedia untuk akun Anda; ubah
  `OPENAI_*_MODEL` di `.env`. Rincian ada di `docs/PLAN.md` bagian 6.
- **Audio pelajaran** (suara kosakata/kalimat): lihat 6a. **Tidak wajib Azure** — kunci OpenAI yang sama dengan AI tutor cukup.
- Perubahan `.env` selalu diikuti `docker compose up -d`; hanya layanan yang variabelnya berubah yang dibuat ulang.

### 6a. Audio pelajaran (tanpa Azure)

Audio pelajaran dibuat **sekali**, saat `db:seed` (bukan saat murid membuka pelajaran), lalu disimpan sebagai berkas
(bagian 7). Penyedia suaranya dipilih lewat `TTS_PROVIDER` di `.env`:

| `TTS_PROVIDER` | Yang diisi | Keterangan |
|---|---|---|
| `auto` (bawaan) | — | Azure bila `AZURE_SPEECH_KEY` **dan** `AZURE_SPEECH_REGION` terisi; kalau tidak, OpenAI bila `OPENAI_API_KEY` terisi; kalau tidak ada satu pun, pelajaran berjalan tanpa audio |
| `openai` | `OPENAI_API_KEY` | Kunci yang **sama** dengan AI tutor — tanpa akun Azure. Model = `OPENAI_TTS_MODEL` (bawaan `gpt-4o-mini-tts`); suara `OPENAI_LESSON_TTS_VOICE_FEMALE` / `_MALE` (bawaan `nova` / `onyx`); arahan gaya bicara `OPENAI_LESSON_TTS_INSTRUCTIONS` (bawaan: bahasa Jepang baku, tempo pelan, dibaca apa adanya) |
| `azure` | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Rekomendasi plan (satu vendor dengan Pronunciation Assessment Fase 2); suara `ja-JP-NanamiNeural` / `ja-JP-KeitaNeural` |
| `none` | — | Matikan pembuatan audio pelajaran |

Nama `TTS_PROVIDER` yang salah menggagalkan boot API dan seed dengan pesan yang menyebut pilihannya; kredensial yang
kosong **tidak** (server tetap jalan, seed melewati audio dengan peringatan).

**Langkah dengan OpenAI** (belum punya Azure):

```bash
# 1. Isi OPENAI_API_KEY di deploy/.env (kunci baru -- jangan ditempel di chat/issue/commit), lalu:
docker compose up -d

# 2. DENGARKAN dulu: 9 contoh suara pendek (biaya kecil), tidak menyentuh database
docker compose run --rm tools pnpm run tts:sample
#    mencetak tautan .../media/samples/tts-openai-<sidik>-01-female.mp3 dst.; buka di browser

# 3. Cocok? Buat semua audio (160 teks, satu per satu -- perkiraan beberapa menit; kemajuan tercetak tiap 20 teks)
docker compose run --rm tools pnpm run db:seed
```

Baris `Seed selesai: …` di akhir keluaran seed memuat `audio=lengkap 160/160` (atau `dilewati` / `sebagian n/160`,
alasannya tercetak di peringatan sebelumnya). Seed yang berhenti di tengah (kunci ditolak, kuota habis) aman diulang: yang sudah jadi
tidak dibuat ulang.

**Langkah 2 bukan formalitas.** Kualitas suara Jepang OpenAI untuk huruf kana tunggal belum pernah didengar (sandbox
pengembangan tidak bisa memanggil OpenAI); tes otomatis (`test:live-openai`) hanya membuktikan OpenAI menerima
model/suara/arahan yang dikonfigurasi dan mengembalikan MP3. Dengarkan terutama: `は` harus "ha" (bukan "wa" seperti
partikel), `を` harus "o", `愛` "ai", `今日` "kyou", dan `あ` dibaca sebagai bahasa Jepang. Kurang cocok? Ganti
`OPENAI_LESSON_TTS_VOICE_FEMALE` / `_MALE` (mis. `coral`, `shimmer`, `echo`, `onyx`), `docker compose up -d`, lalu
jalankan `tts:sample` lagi — nama berkas contoh memuat sidik setelan, jadi browser tidak menyajikan contoh lama dari
cache. Tidak ada yang cocok: pakai Azure (`TTS_PROVIDER=azure`) atau `none`.

**Mengganti suara/penyedia setelah audio dibuat.** Audio yang sudah ada dianggap cache, jadi `db:seed` biasa tidak
membuatnya ulang. Untuk membuat ulang semuanya dengan setelan sekarang:

```bash
docker compose run --rm -e SEED_AUDIO_REGENERATE=1 tools pnpm run db:seed
```

Berkas ditimpa di alamat yang sama, dan baris database baru diperbarui setelah berkas barunya tersimpan — bila gagal di
tengah jalan (kuota, kunci), teks yang belum sempat dibuat ulang tetap memakai audio lamanya. Browser murid bisa masih
menyimpan audio lama sampai 1 hari (cache).

## 7. Penyimpanan audio

Untuk tahap uji coba, audio hasil TTS disimpan di **disk server** (volume Docker `media_data`), **bukan S3**. API menulisnya
ke `/data/media/audio/<hash>.mp3` (penulisan atomik) dan menyajikannya di `https://<situs murid>/media/audio/<hash>.mp3`:
Caddy meneruskan `/media/*` dari situs murid ke API, hanya `GET`/`HEAD`, dengan `Range` (seek audio) dan cache 1 hari. Tidak
ada layanan tambahan dan tidak ada yang perlu diisi; volume ikut `backup.sh`.

Yang perlu diketahui: satu server (tidak direplikasi), tanpa CDN, dan audio disajikan lewat proses API (cukup untuk uji
coba, bukan untuk banyak pengguna serentak). Alamat audio yang sudah dipakai tersimpan di database
(`audio_assets.s3_url` -- nama kolom warisan, isinya alamat driver mana pun), jadi **jangan mengganti domain tanpa
memperbarui alamat itu**:
```bash
docker compose exec postgres psql -U elearning -d elearning \
  -c "update audio_assets set s3_url = replace(s3_url, 'https://lama.contoh.id', 'https://baru.contoh.id')"
```

**Pindah ke S3 nanti** (driver S3 tetap ada di kode dan teruji; dipilih lewat env, tanpa mengubah kode):
1. Di `.env`: `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, dan
   `STORAGE_PUBLIC_BASE_URL` (alamat publik bucket, tanpa garis miring akhir). Bucket harus bisa dibaca publik. Salah
   satu variabel S3 yang kurang menggagalkan boot API dengan pesan yang menyebut namanya.
2. Salin berkas yang sudah ada ke bucket dengan kunci sama (`audio/<hash>.mp3`), mis. dengan `rclone`/`aws s3 sync` dari
   isi volume `media_data` (perintahnya tidak dijalankan di uji ini).
3. Perbarui alamat di database dengan `update audio_assets set s3_url = replace(...)` seperti di atas, lalu
   `docker compose up -d`.

## 8. Operasional

| Keperluan | Perintah (di folder `deploy/`) |
|---|---|
| Status / log | `docker compose ps` · `docker compose logs -f api` (atau `edge`, `migrate`, `postgres` bila memakai yang bawaan, …). Log otomatis dirotasi (3 × 10 MB per layanan) |
| Restart satu layanan | `docker compose restart api` |
| Hentikan / nyalakan semua | `docker compose stop` · `docker compose start` — data aman. Layanan bawaan `restart: unless-stopped` menyala lagi sendiri setelah server reboot |
| Update ke versi baru | `git pull` lalu `docker compose up -d --build`. Migrasi database berjalan otomatis (layanan `migrate`) dan API baru start setelahnya |
| Jalankan seed ulang (konten baru) | `docker compose run --rm tools pnpm run db:seed` |
| Lupa kata sandi admin / admin tambahan | Jalankan lagi `admin:create` dengan email yang sama: kata sandi diganti, akun diaktifkan lagi, semua sesi lamanya dicabut. Email baru = akun admin baru (peran OWNER) |
| Murid uji tanpa undangan / lupa kata sandi murid uji | `student:create` (bagian 5a). Email baru = murid baru; email yang sama = kata sandi diganti dan sesi lama dicabut |
| Migrasi manual | `docker compose run --rm tools pnpm run db:deploy` |
| Periksa database | `docker compose run --rm tools pnpm run db:check` (bagian 2a) |

> **Awas**: `docker compose down -v` menghapus volume: Redis, audio, sertifikat HTTPS — dan database **hanya bila memakai
> Postgres bawaan**. Database milik Anda tidak tersentuh (diuji). Tanpa `-v`, `docker compose down` aman. Pakai `docker compose`
> polos tanpa `--profile`: `COMPOSE_PROFILES` dari `.env` yang menentukan apakah `postgres` bawaan ikut dihapus.

### Cadangan dan pemulihan

```bash
sh backup.sh            # -> backup/<waktu>/database.dump + media.tgz (berkas audio dari volume media_data)
```
`database.dump` = cadangan **schema aplikasi ini saja** (format kustom `pg_dump`) dari database yang ditunjuk `DATABASE_URL` —
Postgres milik Anda maupun bawaan; tabel aplikasi lain di database yang sama tidak ikut. `pg_dump` berjalan di container
`pgclient` (image `postgres:17-alpine`) dengan `DATABASE_URL` yang sama dengan API; parameter khusus Prisma di URL (`schema`,
`sslaccept`, `sslcert`, `connection_limit`, …) dibuang otomatis dan `sslmode` diteruskan. **Versi klien harus sama atau lebih
baru dari server**: server Postgres 18 → `PG_CLIENT_IMAGE=postgres:18-alpine` di `.env`. Postgres milik Anda biasanya sudah
punya cadangan dari pengelolanya; ini cadangan tambahan yang bisa dipulihkan tanpa mereka.
Isinya data pribadi (email, hash kata sandi): simpan di luar server juga, jangan di-commit (`backup/` diabaikan git).
Jadwalkan dengan cron, mis. `0 2 * * * cd /path/ke/deploy && sh backup.sh`. Redis (pembatas laju, kunci login, kuota
tutor, leaderboard mingguan) tersimpan di volume dan tidak ikut cadangan — hanya berisi data sementara.

Pemulihan **tidak pernah menimpa**: targetnya harus schema yang kosong atau belum ada (`pg_restore` tanpa `--clean`; ke
schema yang sudah berisi ia berhenti dengan `already exists` dan tidak mengubah apa pun — diuji). Hentikan API dulu:
```bash
docker compose stop api edge

# 1. Kosongkan schema aplikasi -- MENGHAPUS semua data aplikasi ini. Hanya untuk database/schema KHUSUS aplikasi ini
#    (jangan untuk `public` yang dipakai aplikasi lain). Dijalankan sebagai pemilik database; kalau bukan, minta pengelola
#    database menjalankan DROP SCHEMA "<schema>" CASCADE; CREATE SCHEMA "<schema>" AUTHORIZATION "<pengguna>";
docker compose run --rm -T --no-deps -e PGOPTIONS='-c client_min_messages=warning' pgclient \
  -c '. /pgurl.sh; printf "DROP SCHEMA :\"schema\" CASCADE;\nCREATE SCHEMA :\"schema\";\n" | psql -v schema="$SCHEMA" -v ON_ERROR_STOP=1 -q "$PGURL"'

# 2. Pulihkan database
docker compose run --rm -T --no-deps -v "$PWD/backup/<waktu>":/backup:ro pgclient /pg-restore.sh /backup/database.dump

# 3. Pulihkan audio (volume media_data):
docker run --rm -v elearning_media_data:/data alpine sh -c 'rm -rf /data/* /data/.[!.]*'
docker run --rm -v elearning_media_data:/data -v "$PWD/backup/<waktu>":/backup alpine sh -c 'cd /data && tar xzf /backup/media.tgz'
docker compose start api edge
```
Ke database **baru/kosong** (mis. pindah dari Postgres bawaan ke server sendiri): lewati langkah 1 — `pg-restore.sh` membuat
schema bila belum ada. Untuk pindah, arahkan `DATABASE_URL` ke database baru itu (`docker compose run … -e DATABASE_URL=…`
atau ubah `.env`) saat menjalankan langkah 2.

### Mengganti rahasia
- `JWT_STUDENT_SECRET` / `JWT_ADMIN_SECRET`: ganti di `.env` lalu `docker compose up -d` — semua orang harus masuk ulang.
- **Kata sandi database milik Anda**: ganti di server database (`ALTER ROLE elearning_app PASSWORD '...'`), samakan
  `DATABASE_URL` di `.env` (ter-encode, bagian 2a), lalu `docker compose up -d`.
- `POSTGRES_PASSWORD` (hanya Postgres **bawaan**): dipakai saat database **pertama kali dibuat**. Mengubahnya di `.env` tidak
  mengganti kata sandi yang sudah ada — jalankan dulu
  `docker compose exec postgres psql -U elearning -d elearning -c "alter user elearning password 'BARU'"`
  lalu samakan `.env` dan `docker compose up -d`. Pakai huruf/angka saja (masuk ke URL database).

## 9. Keamanan — daftar periksa

- Firewall: hanya buka 80 dan 443 (mode domain). Port 8080 ikut dipublikasikan Docker tetapi tidak dipakai di mode
  domain — tutup di firewall/penyedia VPS. (Port yang dipublikasikan Docker melewati `ufw`; jangan mengandalkan `ufw`
  saja.)
- `.env` berisi semua rahasia (termasuk kata sandi database di `DATABASE_URL`): izin 600 (dibuat begitu oleh `gen-env.sh`),
  jangan di-commit, tidak masuk image (dikecualikan di `.dockerignore`). `db:check` tidak pernah mencetak kata sandi.
- **Database**: pakai pengguna khusus aplikasi ini (pemilik database/schema-nya saja, bukan superuser), batasi `pg_hba.conf`
  ke alamat server aplikasi, dan untuk server di luar jaringan tepercaya wajibkan TLS (`?sslmode=require`; sertifikat server
  tidak diverifikasi dalam mode itu — bagian 2a).
- `TRUST_PROXY=1` sudah diset di compose: API membaca IP klien sungguhan dari Caddy sehingga pembatas per-IP
  (login, lupa password, permintaan undangan ulang) bekerja per orang. Caddy menimpa `X-Forwarded-For` dari klien
  (diuji: header palsu tidak mengelabui pembatas). **Kalau server berada di belakang CDN/proxy lain (mis.
  Cloudflare)**, alamat klien akan salah dan perlu `trusted_proxies` di `deploy/Caddyfile`.
- Dokumentasi Swagger (`/api/api-docs*`) diblokir di kedua situs. `/media` hanya melayani `GET`/`HEAD` (metode lain 405 di
  Caddy), tanpa daftar isi direktori, berkas berawalan titik tidak disajikan, dan jalur `..` tidak bisa keluar dari folder audio.
- Update berkala: `docker compose pull` (postgres/redis) + `docker compose up -d --build`, dan
  update OS server.

## 10. Batasan yang perlu diketahui

- **Email belum terkirim** (bagian 5) — keputusan penyedia email masih terbuka.
- **Audio di disk satu server** (volume `media_data`): tidak direplikasi dan tidak lewat CDN; cadangkan dengan `backup.sh`.
- **Satu server, satu instance API.** Pembatas per-IP disimpan di memori proses API; jangan menjalankan lebih dari
  satu replika API tanpa memindahkannya ke Redis (`docs/PLAN.md`, bagian 6f).
- **Belum ada pemantauan/peringatan** (uptime, disk, sertifikat). `GET /healthz` (edge) dan `GET /api/health` bisa
  dipasangi pemantau eksternal.
- **Konten baru Hiragana + 1 skenario percakapan**; kamus ±107 entri. Konten lain adalah pekerjaan pengajar/PO.
- **Halaman Pengaturan admin masih kerangka** (modul backend-nya belum ada); nama lembaga hanya bisa diatur lewat
  `INSTITUTION_NAME` pada `admin:create`.
- **AI tutor belum punya layar** di aplikasi murid (Fase 2).
- **Migrasi berjalan otomatis** tiap `docker compose up` terhadap database Anda: perubahan skema dari versi kode baru langsung
  diterapkan. Untuk database yang dikelola tim lain, coba versi baru di salinan dulu. Satu pengguna database dipakai untuk
  migrasi dan API (hak `CREATE` diperlukan selama ada migrasi baru).
- **Hanya Postgres yang bisa memakai server sendiri**; Redis tetap container bawaan.
- **`backup.sh` hanya meneruskan `sslmode`** ke `pg_dump` (opsi sertifikat Prisma seperti `sslcert` dibuang, artinya beda di
  libpq dan berkasnya tak ada di container): server yang menuntut sertifikat klien perlu cadangan dari sisi server database.
- **Kualitas suara Jepang dari OpenAI untuk huruf kana tunggal belum pernah didengar** (sandbox pengembangan tidak bisa
  memanggil OpenAI) — dengarkan dulu dengan `tts:sample` (bagian 6a). Lama seed dengan OpenAI sungguhan juga belum diukur
  (160 panggilan berurutan; di sandbox, terhadap server tiruan, selesai dalam 6 detik).
- Zona waktu "hari" (kuota, streak, leaderboard) mengikuti `TZ` di `.env` (bawaan `Asia/Jakarta`).

## 11. Pemecahan masalah

| Gejala | Penyebab / tindakan |
|---|---|
| `required variable … is missing a value` | Ada yang belum diisi di `deploy/.env` (pesannya menyebut nama variabelnya) |
| `up` berhenti: `service "migrate" didn't complete successfully` | Pengaturan database: `docker compose logs migrate` menjelaskan penyebab dan tindakannya (baris berikut). Perbaiki lalu ulangi `docker compose up -d` |
| `GAGAL: DATABASE_URL masih berisi contoh` / `kosong` | Isi `DATABASE_URL` di `.env` (bagian 2a), atau `sh gen-env.sh --builtin-db` untuk Postgres bawaan |
| `DATABASE_URL tidak bisa dibaca` · Prisma `invalid port number` | Kata sandi berkarakter khusus belum di-encode (`@`→`%40`, `/`→`%2F`, `#`→`%23`, …; bagian 2a) |
| `Server tidak terjangkau` | Host/port salah, firewall, `listen_addresses`, atau `pg_hba.conf`. Dari container, `localhost` bukan server: pakai `host.docker.internal` atau alamat server |
| `kata sandi ditolak` | Pengguna/kata sandi salah, atau `pg_hba.conf` menolak alamat ini; kata sandi berkarakter khusus harus di-encode |
| `Database … tidak ada` | Buat dulu (`CREATE DATABASE …`) atau perbaiki nama database di `DATABASE_URL` |
| `schema "public" sudah berisi N tabel/objek lain … (P3005)` | Database berisi tabel aplikasi lain: pakai database khusus, atau schema khusus `?schema=elearning` (bagian 2a) |
| `pengguna … tidak berhak membuat tabel` | Pengguna bukan pemilik database: jalankan `GRANT` yang tercetak, atau jadikan ia pemilik database |
| `riwayat migrasi … milik aplikasi Prisma LAIN` | Schema itu dipakai aplikasi Prisma lain: pakai database atau schema khusus |
| `backup.sh`: `pg_dump … server version mismatch` | Server lebih baru dari klien bawaan (17): `PG_CLIENT_IMAGE=postgres:<versi-server>-alpine` di `.env` |
| `bind: address already in use` (port 80/443) | Ada web server lain di server (nginx/apache): hentikan atau ubah pemetaan port `edge` |
| Build gagal di `apt-get` / `npm` | Server tidak bisa menjangkau mirror Debian / registry npm: periksa DNS dan firewall keluar |
| `api` restart terus | `docker compose logs api` — biasanya env tidak valid (pesannya menyebut variabelnya) atau database belum siap |
| `edge` tidak mau start | `docker compose logs edge` — cek `STUDENT_ADDRESS`/`ADMIN_ADDRESS` (harus nama host atau `:80`/`:8080`) |
| Browser: sertifikat tidak valid / tidak bisa HTTPS | DNS belum mengarah ke server, port 80/443 tertutup, atau batas Let's Encrypt terlampaui. Lihat `docker compose logs edge`. Volume `caddy_data` jangan dihapus |
| `502` di `/api/...` | API belum sehat atau mati: `docker compose ps`, `docker compose logs api` |
| `/media/...` 404 | Berkas belum ada (audio baru dibuat bila penyedia TTS diisi lalu seed diulang, bagian 6a) atau `STORAGE_PUBLIC_BASE_URL` tidak sama dengan alamat yang dibuka browser |
| Seed: `Seed audio DILEWATI` | Belum ada penyedia TTS yang siap: isi `OPENAI_API_KEY` (atau `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`), atau `TTS_PROVIDER=none` bila memang tanpa audio |
| Seed: `Seed audio berhenti di '…'` | Alasannya tercetak (mis. `401` = kunci salah, `429` = kuota habis, `404` = `OPENAI_TTS_MODEL` tidak ada untuk akun Anda). Perbaiki lalu ulangi `db:seed` |
| `tts:sample`: `GAGAL: …` | Sama dengan di atas; kode keluar 1 |
| Log API: `EACCES` saat menulis audio | Volume `media_data` terlanjur dimiliki root. Perbaiki: `docker run --rm -v elearning_media_data:/data alpine chmod -R a+rwX /data` |
| Tautan undangan tidak sampai ke murid | Email belum terkirim — ambil dari log (bagian 5) |
| Semua orang terkena "terlalu banyak percobaan" | `TRUST_PROXY` salah/di belakang proxy lain — lihat bagian 9 |

## 12. Peta berkas

| Berkas | Fungsi |
|---|---|
| `deploy/docker-compose.yml` | Stack produksi (layanan, jaringan, volume, healthcheck) |
| `deploy/.env.example` · `deploy/gen-env.sh` | Semua variabel + pembuat rahasia acak |
| `deploy/Caddyfile` · `deploy/edge.Dockerfile` | Reverse proxy/HTTPS + build kedua aplikasi web (`VITE_API_URL=/api`); `/media` diteruskan ke API |
| `apps/api/Dockerfile` | Target `runner` (server API) dan `tools` (migrasi, seed, admin, cek OpenAI) |
| `apps/api/prisma/create-admin.ts` · `src/bootstrap/admin-bootstrap.ts` | Pembuatan admin pertama / pemulihan kata sandi admin |
| `apps/api/prisma/create-student.ts` · `src/bootstrap/student-bootstrap.ts` | `student:create`: murid uji langsung tanpa undangan / pemulihan kata sandinya (bagian 5a) |
| `deploy/backup.sh` · `pgclient` (compose) · `pgurl.sh` · `pg-dump.sh` · `pg-restore.sh` | Cadangan database + volume audio; klien Postgres sekali-jalan yang memakai `DATABASE_URL` yang sama dengan API (parameter khusus Prisma dibuang) |
| `apps/api/prisma/db-check.ts` · `src/bootstrap/db-check.ts` | `db:check`: pemeriksaan database sebelum migrasi (jalan otomatis di awal `db:deploy`) dengan pesan yang menjelaskan penyebab dan tindakan |
| `apps/api/src/audio/` | Penyimpanan audio: `local-storage.service.ts` (disk, bawaan), `object-storage.service.ts` (S3, untuk nanti), `local-media.ts` (penyajian `/media`), `storage-options.ts` (aturan env) |
| `apps/api/src/audio/tts-options.ts` · `tts-factory.ts` | Pemilihan penyedia TTS audio pelajaran (`TTS_PROVIDER`: auto/azure/openai/none) dan pembuat kliennya; `openai-tts.client.ts`, `azure-tts.client.ts` = kedua penyedia |
| `apps/api/prisma/seed.ts` · `tts-sample.ts` | `db:seed` (konten + audio; `SEED_AUDIO_REGENERATE=1` = buat ulang audio) dan `tts:sample` (contoh suara, tanpa database); logikanya di `src/audio/lesson-audio-seed.ts` dan `tts-sample.ts` |
| `docker-compose.yml` (root) | Hanya untuk **pengembangan lokal** (Postgres + Redis; port terbuka ke host). Audio dev ditulis ke `apps/api/storage` |

## Yang sudah dan belum diverifikasi

**Sudah** (sandbox Linux, Docker 29.3.1 / Compose v5.1.1, mode HTTP `:80`/`:8080`):
- Stack dibangun dari nol dan dijalankan: `up`, migrasi otomatis, seed (104 kosakata, 56 kalimat, 7 lesson, 128 latihan,
  7 badge, 1 skenario), `admin:create` (termasuk kasus gagal dan pemulihan kata sandi + pencabutan sesi).
- **`student:create`** (murid uji tanpa undangan, bagian 5a): 31 tes unit (DB palsu, hash argon2id sungguhan) dan uji mutasi
  (29 kesalahan buatan pada logikanya, semuanya tertangkap). Lalu pada stack sungguhan (image `tools` dibangun dengan
  skripnya, Postgres bawaan): murid dibuat saat belum ada kelas ("Kelas Uji" otomatis); login lewat Caddy (juga dengan email
  huruf besar), `/me`, `/path` (Hiragana terbuka) dan `/lessons/l1` menjawab 200; dijalankan ulang = kata sandi lama ditolak,
  yang baru berlaku, refresh token lama dicabut, tetap satu baris; dua kelas aktif tanpa `CLASS_NAME` = gagal dengan daftar
  kelas dan tidak menulis apa pun; `CLASS_NAME` (huruf/spasi berbeda) memakai kelas yang ada, memindahkan murid, atau membuat
  kelas baru; undangan PENDING menolak lalu berhasil setelah dicabut; akun nonaktif hidup lagi; penguncian 15 menit dan
  perintah `redis-cli del …` di panduan membukanya; kata sandi lemah / email salah / tanpa kata sandi = gagal bersih; kata
  sandi tidak pernah tercetak.
- **18 pemeriksaan di browser sungguhan lewat Caddy**: login admin, buat kelas, undang murid, tautan dari log, registrasi,
  onboarding, Beranda, deep-link + reload, login dengan email huruf besar, semua request satu origin tanpa CORS, tanpa
  galat konsol.
- **Penyimpanan audio lokal**: tulis oleh root (container `tools`, mis. seed) lalu oleh `nestjs` (API) ke direktori yang
  sama; `AudioService` sungguhan + Prisma + disk (panggilan pertama membuat berkas dan baris `audio_assets`, kedua = cache
  hit tanpa TTS); penyajian lewat Caddy `/media` (200, `audio/mpeg`, Range 206, HEAD, 404, tanpa daftar direktori,
  POST/PUT/DELETE 405, situs admin 404, jalur `..` tak bisa keluar); berkas + baris DB bertahan lewat `down`/`up` dan restart
  API; `backup.sh` dan **pemulihan penuh** (database di-drop lalu dipulihkan, volume audio dikosongkan lalu dipulihkan,
  API tetap bisa menulis sesudahnya).
- **Mode pengembangan**: API dengan bawaan (tanpa `STORAGE_*`) menulis ke folder lokal dan menyajikan
  `http://localhost:PORT/media/...`; audio dimuat **di Chromium lintas-origin** (halaman :5199, API :3011), sedangkan
  kontrol dengan `Cross-Origin-Resource-Policy: same-origin` diblokir (`ERR_BLOCKED_BY_RESPONSE`) — jadi penimpaan header itu
  memang diperlukan.
- Pembatas per-IP dengan `TRUST_PROXY=1` (header palsu tak berpengaruh), header cache/keamanan, Swagger 404, dan cek live
  OpenAI yang berjalan di container `tools`.
- Urutan "Langkah cepat" (bagian 2) dijalankan ulang persis dari **clone bersih GitHub** dengan build tanpa cache.
- **Database sendiri (Postgres yang sudah ada)**, di stack compose sungguhan dengan Postgres 17 TERPISAH (container di luar
  proyek compose, dicapai lewat `host.docker.internal`; pengguna BUKAN superuser, hanya pemilik database): stack berjalan
  tanpa container `postgres` (hanya `api`, `edge`, `migrate`, `redis`); migrasi, seed (104/56/7), admin, dan alur aplikasi
  lewat Caddy (admin → kelas → undangan → murid → `GET /lessons/l1` berisi 104 kosakata + 56 kalimat) semuanya di database
  luar; kata sandi berkarakter khusus (`@ : / # %`) ter-encode di `.env` bekerja; `down`/`up` dan `down -v` tidak menyentuh
  database luar. **Database bersama** yang `public`-nya berisi tabel lain: `db:check` melaporkan P3005 dengan jalan keluar,
  dan dengan `?schema=elearning` seluruh aplikasi berjalan di schema itu sementara tabel aplikasi lain utuh. **Server
  hanya-TLS** (self-signed): `sslmode=require` bekerja penuh dan server mengonfirmasi koneksi API memakai TLSv1.3. Mode
  kegagalan yang dijelaskan `db:check` (semuanya diuji terhadap kalimat galat Prisma yang sungguh keluar): contoh `GANTI`,
  kata sandi tak ter-encode, `localhost`, kata sandi salah, database tak ada, port salah, schema berisi tabel lain,
  pengguna tanpa hak `CREATE` (dengan `GRANT` yang tepat), riwayat migrasi aplikasi Prisma lain; `up` dengan `DATABASE_URL` yang
  belum diisi berhenti di `migrate` dan menahan API/edge sampai benar; kata sandi tak pernah tercetak; `db:deploy` berhenti di
  pemeriksaan tanpa menjalankan migrasi. **Cadangan/pemulihan** (`backup.sh`, `pgclient`): dump hanya schema aplikasi (juga
  lewat TLS + `?schema=`; tabel aplikasi lain tak ikut), pulihan ke database baru sama dengan sumber, pemulihan di tempat
  (schema dikosongkan lalu dipulihkan) mengembalikan data dan API sehat, pemulihan ke schema berisi ditolak tanpa menimpa, dan
  `backup.sh` yang gagal tidak meninggalkan dump kosong. **Postgres bawaan** (`gen-env.sh --builtin-db`): jalur lama utuh
  (seed, alur aplikasi, cadangan, pemulihan, `down -v`).
- **Audio pelajaran tanpa Azure (penyedia OpenAI)**, di stack compose sungguhan dengan server OpenAI **TIRUAN** di jaringan
  compose (membuktikan kabel kita, bukan OpenAI-nya): tanpa kredensial, seed melewati audio (`audio=dilewati`) dan
  `GET /lessons/l1` tetap termuat dengan 160 audio kosong; `TTS_PROVIDER` salah ketik → seed gagal satu baris SEBELUM
  menyentuh database dan API gagal boot dengan nama variabelnya; `tts:sample` → 9 tautan, kesembilannya 200 `audio/mpeg`
  lewat Caddy, tanpa menyentuh database (server tiruan menerima suara `nova` untuk perempuan dan `onyx` untuk laki-laki,
  model, arahan gaya, dan format mp3 sesuai konfigurasi); `db:seed` dengan hanya `OPENAI_API_KEY` (mode auto) → 160 berkas
  + 160 baris, dan `GET /lessons/l1` mengembalikan 160 alamat audio yang semuanya `…/media/audio/sha256(teks|suara).mp3`;
  seed ulang = 0 panggilan (cache); `SEED_AUDIO_REGENERATE=1` → 160 berkas ditimpa tanpa mengubah satu alamat pun; OpenAI
  menolak setelah 10 permintaan → seed berhenti di kegagalan pertama (11 panggilan, bukan 160), 10 berkas baru + 150 berkas
  lama utuh + 160 baris tetap, potongan kunci di pesan galat tersamarkan; setelah pulih, pembuatan ulang lengkap.

**Belum** (tidak bisa dari sandbox): penerbitan **sertifikat Let's Encrypt** dan akses lewat domain sungguhan; perilaku di
server lain/arsitektur arm64; langkah `apt-get install openssl` di Dockerfile (mirror Debian diblokir di sandbox — image
diuji dengan image Node penuh yang sudah berisi OpenSSL, jadi ukuran image sungguhan akan lebih kecil dari yang terlihat
di sana); **driver S3** hanya diuji dengan server S3 tiruan (unit test) dan validasi env, tidak dengan S3 sungguhan pada
konfigurasi ini; panggilan OpenAI/Azure sungguhan; beban dengan banyak pengguna; Postgres **native di mesin host** dan Postgres terkelola
sungguhan (RDS, Supabase, Neon, dll.), versi Postgres selain 17, dan pooler (PgBouncer) — tidak bisa dicoba dari sandbox.
