# Deploy di server sendiri (Docker Compose)

Panduan menjalankan **seluruh platform** (aplikasi murid, aplikasi admin, API, database, cache, penyimpanan audio,
HTTPS) di satu server dengan Docker Compose. Semua berkas ada di folder [`deploy/`](../deploy). Langkah inti dan
perintah operasional di bawah sudah dijalankan sungguhan di sandbox; apa yang belum (mis. sertifikat Let's Encrypt)
dan batasnya ada di "Yang sudah dan belum diverifikasi" di akhir.

```
                    internet
                       │  80 / 443 (dan 8080 hanya untuk mode uji lewat IP)
                ┌──────▼───────┐
                │ edge (Caddy) │  HTTPS otomatis · berkas statis kedua aplikasi web
                └─┬────┬─────┬─┘
   /api/* ────────┘    │     └──────── /media/* (hanya baca, hanya situs murid)
         ┌────────────▼──┐      ┌───────────▼───────┐
         │ api (NestJS)  │─────▶│ storage (S3)      │  audio pelajaran
         └───┬───────┬───┘      └───────────────────┘
        ┌────▼───┐ ┌─▼─────┐
        │postgres│ │ redis │      migrate = sekali jalan tiap `up` (skema database)
        └────────┘ └───────┘      tools   = perintah manual (seed, buat admin, cek OpenAI)
```

Hanya `edge` yang membuka port ke luar. Postgres, Redis, penyimpanan, dan API tidak bisa dijangkau dari internet.
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
| `git` | Untuk mengambil kode |

## 2. Langkah cepat (mode domain, HTTPS otomatis)

```bash
# 1. Ambil kode. Berkas deploy saat ini ada di branch PR (belum digabung ke main).
git clone https://github.com/devappsmi/elearning-platform.git
cd elearning-platform
git checkout claude/dazzling-feynman-m7w7t6
cd deploy

# 2. Buat .env dengan rahasia acak, lalu isi alamat akses
sh gen-env.sh
nano .env          # ubah STUDENT_ADDRESS, ADMIN_ADDRESS, PUBLIC_STUDENT_URL, PUBLIC_ADMIN_URL

# 3. Bangun dan jalankan (pertama kali beberapa menit: mengunduh image dan membangun 3 image)
docker compose up -d --build
docker compose ps                 # semua "healthy"/"Up"; migrate dan storage-init "Exited (0)" itu normal

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

Buka `https://admin.belajar.contoh.id`, masuk, buat kelas, lalu undang murid (bagian 5). Sertifikat HTTPS diurus
Caddy sendiri saat pertama diakses — lihat "Pemecahan masalah" bila gagal.

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

## 6. Fitur opsional: AI tutor (OpenAI) dan audio pelajaran (Azure)

Semuanya boleh dikosongkan; hanya fitur terkait yang nonaktif.

- **AI tutor**: isi `OPENAI_API_KEY` di `.env`, lalu `docker compose up -d` (API dibuat ulang). Endpoint `/tutor/*`
  sudah ada, tetapi **belum ada layar tutor di aplikasi murid** (Fase 2). Nama model bawaan
  (`gpt-5.6-terra`, `gpt-transcribe`, `gpt-4o-mini-tts`) belum terbukti ada. Dari server Anda (jaringan bebas)
  bisa langsung dicek — 11 tes, biaya sen:
  ```bash
  docker compose run --rm tools pnpm run test:live-openai
  ```
  Kalau ada nama model yang ditolak, pesan gagalnya mencantumkan model yang tersedia untuk akun Anda; ubah
  `OPENAI_*_MODEL` di `.env`. Rincian ada di `docs/PLAN.md` bagian 6.
- **Audio pelajaran**: isi `AZURE_SPEECH_KEY` dan `AZURE_SPEECH_REGION`, lalu `docker compose up -d` dan ulangi
  `docker compose run --rm tools pnpm run db:seed` (menghasilkan audio untuk seluruh kosakata/kalimat dan
  menyimpannya di penyimpanan). Tanpa ini pelajaran berjalan tanpa audio.
- Perubahan `.env` selalu diikuti `docker compose up -d`; hanya layanan yang variabelnya berubah yang dibuat ulang.

## 7. Penyimpanan audio

Bawaan: SeaweedFS di dalam stack (image `minio/minio` tidak bisa ditarik dari Docker Hub saat diuji: *pull access denied*). Bucket dibaca publik
tanpa kunci — hanya `GET`/`HEAD` objek; tidak bisa daftar isi, menulis, atau menghapus — dan disajikan lewat
`https://<situs murid>/media/...`. API menyimpan alamat publik itu di database (`audio_assets.s3_url`).

**S3 luar** (AWS S3, Cloudflare R2, Wasabi, …): di `.env` kosongkan `COMPOSE_PROFILES`, lalu isi `S3_ENDPOINT`,
`S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, dan `S3_PUBLIC_BASE_URL` (alamat publik bucket,
tanpa garis miring akhir). Bucket harus bisa dibaca publik. Layanan `storage` tidak akan dijalankan.

**Mengganti domain/alamat publik belakangan**: alamat audio yang sudah tersimpan tidak ikut berubah. Perbarui:
```bash
docker compose exec postgres psql -U elearning -d elearning \
  -c "update audio_assets set s3_url = replace(s3_url, 'https://lama.contoh.id', 'https://baru.contoh.id')"
```

## 8. Operasional

| Keperluan | Perintah (di folder `deploy/`) |
|---|---|
| Status / log | `docker compose ps` · `docker compose logs -f api` (atau `edge`, `postgres`, …). Log otomatis dirotasi (3 × 10 MB per layanan) |
| Restart satu layanan | `docker compose restart api` |
| Hentikan / nyalakan semua | `docker compose stop` · `docker compose start` — data aman. Layanan bawaan `restart: unless-stopped` menyala lagi sendiri setelah server reboot |
| Update ke versi baru | `git pull` lalu `docker compose up -d --build`. Migrasi database berjalan otomatis (layanan `migrate`) dan API baru start setelahnya |
| Jalankan seed ulang (konten baru) | `docker compose run --rm tools pnpm run db:seed` |
| Lupa kata sandi admin / admin tambahan | Jalankan lagi `admin:create` dengan email yang sama: kata sandi diganti, akun diaktifkan lagi, semua sesi lamanya dicabut. Email baru = akun admin baru (peran OWNER) |
| Migrasi manual | `docker compose run --rm tools pnpm run db:deploy` |

> **Awas**: `docker compose down -v` menghapus **semua data** (database, Redis, audio, sertifikat). Tanpa `-v`,
> `docker compose down` aman.

### Cadangan dan pemulihan

```bash
sh backup.sh            # -> backup/<waktu>/database.dump (+ storage.tgz bila penyimpanan bawaan dipakai)
```
Isinya data pribadi (email, hash kata sandi): simpan di luar server juga, jangan di-commit (`backup/` diabaikan git).
Jadwalkan dengan cron, mis. `0 2 * * * cd /path/ke/deploy && sh backup.sh`. Redis (pembatas laju, kunci login, kuota
tutor, leaderboard mingguan) tersimpan di volume dan tidak ikut cadangan — hanya berisi data sementara.

Pemulihan (menimpa penuh; hentikan penulis dulu):
```bash
docker compose stop api edge
docker compose exec -T postgres psql -U elearning -d postgres -c "drop database elearning" -c "create database elearning"
docker compose exec -T postgres pg_restore -U elearning -d elearning --no-owner < backup/<waktu>/database.dump
# audio (bila penyimpanan bawaan):
docker compose stop storage
docker run --rm -v elearning_storage_data:/data alpine sh -c 'rm -rf /data/* /data/.[!.]*'
docker run --rm -v elearning_storage_data:/data -v "$PWD/backup/<waktu>":/backup alpine sh -c 'cd /data && tar xzf /backup/storage.tgz'
docker compose start storage api edge
```

### Mengganti rahasia
- `JWT_STUDENT_SECRET` / `JWT_ADMIN_SECRET`: ganti di `.env` lalu `docker compose up -d` — semua orang harus masuk ulang.
- `S3_SECRET_ACCESS_KEY`: ganti di `.env` lalu `docker compose up -d` (penyimpanan dan API sama-sama membacanya).
- `POSTGRES_PASSWORD`: variabel ini hanya dipakai saat database **pertama kali dibuat**. Mengubahnya di `.env` tidak
  mengganti kata sandi yang sudah ada — jalankan dulu
  `docker compose exec postgres psql -U elearning -d elearning -c "alter user elearning password 'BARU'"`
  lalu samakan `.env` dan `docker compose up -d`. Pakai huruf/angka saja (masuk ke URL database).

## 9. Keamanan — daftar periksa

- Firewall: hanya buka 80 dan 443 (mode domain). Port 8080 ikut dipublikasikan Docker tetapi tidak dipakai di mode
  domain — tutup di firewall/penyedia VPS. (Port yang dipublikasikan Docker melewati `ufw`; jangan mengandalkan `ufw`
  saja.)
- `.env` berisi semua rahasia: izin 600 (dibuat begitu oleh `gen-env.sh`), jangan di-commit, tidak masuk image
  (dikecualikan di `.dockerignore`).
- `TRUST_PROXY=1` sudah diset di compose: API membaca IP klien sungguhan dari Caddy sehingga pembatas per-IP
  (login, lupa password, permintaan undangan ulang) bekerja per orang. Caddy menimpa `X-Forwarded-For` dari klien
  (diuji: header palsu tidak mengelabui pembatas). **Kalau server berada di belakang CDN/proxy lain (mis.
  Cloudflare)**, alamat klien akan salah dan perlu `trusted_proxies` di `deploy/Caddyfile`.
- Dokumentasi Swagger (`/api/api-docs*`) diblokir di kedua situs.
- Update berkala: `docker compose pull` (postgres/redis/caddy/seaweedfs) + `docker compose up -d --build`, dan
  update OS server.

## 10. Batasan yang perlu diketahui

- **Email belum terkirim** (bagian 5) — keputusan penyedia email masih terbuka.
- **Satu server, satu instance API.** Pembatas per-IP disimpan di memori proses API; jangan menjalankan lebih dari
  satu replika API tanpa memindahkannya ke Redis (`docs/PLAN.md`, bagian 6f).
- **Belum ada pemantauan/peringatan** (uptime, disk, sertifikat). `GET /healthz` (edge) dan `GET /api/health` bisa
  dipasangi pemantau eksternal.
- **Konten baru Hiragana + 1 skenario percakapan**; kamus ±107 entri. Konten lain adalah pekerjaan pengajar/PO.
- **Halaman Pengaturan admin masih kerangka** (modul backend-nya belum ada); nama lembaga hanya bisa diatur lewat
  `INSTITUTION_NAME` pada `admin:create`.
- **AI tutor belum punya layar** di aplikasi murid (Fase 2).
- Zona waktu "hari" (kuota, streak, leaderboard) mengikuti `TZ` di `.env` (bawaan `Asia/Jakarta`).

## 11. Pemecahan masalah

| Gejala | Penyebab / tindakan |
|---|---|
| `required variable … is missing a value` | Ada yang belum diisi di `deploy/.env` (pesannya menyebut nama variabelnya) |
| `bind: address already in use` (port 80/443) | Ada web server lain di server (nginx/apache): hentikan atau ubah pemetaan port `edge` |
| Build gagal di `apt-get` / `npm` | Server tidak bisa menjangkau mirror Debian / registry npm: periksa DNS dan firewall keluar |
| `api` restart terus | `docker compose logs api` — biasanya env tidak valid (pesannya menyebut variabelnya) atau database belum siap |
| `edge` tidak mau start | `docker compose logs edge` — cek `STUDENT_ADDRESS`/`ADMIN_ADDRESS` (harus nama host atau `:80`/`:8080`) |
| Browser: sertifikat tidak valid / tidak bisa HTTPS | DNS belum mengarah ke server, port 80/443 tertutup, atau batas Let's Encrypt terlampaui. Lihat `docker compose logs edge`. Volume `caddy_data` jangan dihapus |
| `502` di `/api/...` | API belum sehat atau mati: `docker compose ps`, `docker compose logs api` |
| `/media/...` 500/502 beberapa detik setelah restart | Penyimpanan masih menyiapkan volume; sehat dalam ±20 detik |
| Tautan undangan tidak sampai ke murid | Email belum terkirim — ambil dari log (bagian 5) |
| Semua orang terkena "terlalu banyak percobaan" | `TRUST_PROXY` salah/di belakang proxy lain — lihat bagian 9 |

## 12. Peta berkas

| Berkas | Fungsi |
|---|---|
| `deploy/docker-compose.yml` | Stack produksi (layanan, jaringan, volume, healthcheck) |
| `deploy/.env.example` · `deploy/gen-env.sh` | Semua variabel + pembuat rahasia acak |
| `deploy/Caddyfile` · `deploy/edge.Dockerfile` | Reverse proxy/HTTPS + build kedua aplikasi web (`VITE_API_URL=/api`) |
| `apps/api/Dockerfile` | Target `runner` (server API) dan `tools` (migrasi, seed, admin, cek OpenAI) |
| `apps/api/prisma/create-admin.ts` · `src/bootstrap/` | Pembuatan admin pertama / pemulihan kata sandi admin |
| `deploy/backup.sh` | Cadangan database + audio |
| `docker-compose.yml` (root) | Hanya untuk **pengembangan lokal** (Postgres + Redis + penyimpanan, port terbuka ke host) |

## Yang sudah dan belum diverifikasi

**Sudah** (sandbox Linux, Docker 29.3.1 / Compose v5.1.1, mode HTTP `:80`/`:8080`): build ketiga image dari nol;
`up`; migrasi otomatis; seed (104 kosakata, 56 kalimat, 7 lesson, 128 latihan, 7 badge, 1 skenario); pembuatan admin
(termasuk kasus gagal dan pemulihan kata sandi + pencabutan sesi); **18 pemeriksaan di browser sungguhan lewat Caddy**
(login admin, buat kelas, undang murid, tautan dari log, registrasi, onboarding, Beranda, deep-link + reload, login
email huruf besar, semua request satu origin tanpa CORS, tanpa galat konsol); audio publik lewat `/media` (GET, HEAD,
Range, 404, tidak bisa list/tulis/hapus, percobaan path traversal); pembatas per-IP dengan `TRUST_PROXY=1` dan
header palsu tak berpengaruh; header cache/keamanan; Swagger 404; `down`/`up` tanpa kehilangan data; cadangan dan
**pemulihan penuh** (database + audio); mode S3 luar (`COMPOSE_PROFILES` kosong) dan API tetap hidup tanpa penyimpanan;
cek live OpenAI berjalan di container `tools`; compose dev (SeaweedFS pengganti MinIO).

**Belum** (tidak bisa dari sandbox): penerbitan **sertifikat Let's Encrypt** dan akses lewat domain sungguhan;
perilaku di server lain/arsitektur arm64; langkah `apt-get install openssl` di Dockerfile (mirror Debian diblokir di
sandbox — image diuji dengan image Node penuh yang sudah berisi OpenSSL, jadi ukuran image sungguhan akan lebih kecil
dari yang terlihat di sana); panggilan OpenAI/Azure sungguhan; beban dengan banyak pengguna.
