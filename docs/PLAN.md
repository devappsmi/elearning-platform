# Fondasi Produk Baru: Platform Kursus Bahasa Jepang (Single-Tenant, NestJS)

*(Menggantikan plan lama "Rewrite: Nihongo Speaking, Flutter → React + Next.js" — plan itu sudah selesai dikerjakan dan sekarang digantikan sepenuhnya oleh pivot ini.)*

*(Salinan dari plan mode Claude Code, aslinya di `C:\Users\firma\.claude\plans\sunny-cooking-floyd.md` di mesin dev lokal — disalin ke sini supaya ikut terbawa kalau sesi/kerjaan pindah mesin, mis. ke Claude Code cloud session. PRD lengkap (sumber kebenaran fitur) ada di `docs/PRD.md` di folder yang sama, disalin dari `C:\Users\firma\Documents\kimi\Workspaces\E-LEARN\PRD-Aplikasi-Belajar-Bahasa-Jepang.md`.)*

## Context

Sesi ini sebelumnya membangun `webapp/` (Next.js, single-user, tanpa backend — progress tersimpan lokal di browser via Dexie) sebagai rewrite dari app Flutter lama, di repo terpisah (`BELAJAR BAHASA`). User kemudian membagikan PRD baru (`docs/PRD.md`) yang menggambarkan produk yang jauh lebih besar: platform B2B untuk lembaga kursus, dengan akun murid sungguhan (undangan email), aplikasi admin terpisah, backend penuh (auth, database, multi-fitur), dan integrasi AI/speech berbayar.

Setelah evaluasi bersama (celah antara PRD dan kode yang ada, isu internal PRD, tegangan dengan prinsip "hindari kerumitan operasional" yang baru saja diterapkan hari ini lewat penggabungan 2 Docker container jadi 1), user membuat serangkaian keputusan konkret yang menyederhanakan & mengunci arah:

- **`webapp/` (app lama, repo `BELAJAR BAHASA`) ditinggalkan sepenuhnya** — tidak dikembangkan lagi, jadi referensi/arsip saja.
- **Single-tenant**, bukan multi-tenant SaaS — PRD sudah direvisi ke v4.0 untuk mencerminkan ini (tidak ada `org_id` di data model manapun).
- Role admin dan pengajar **digabung jadi satu** (`staff`).
- **Tidak ada kuota kursi/pembatasan jumlah murid.**
- **Online-only** — tidak ada mode offline/cache-materi.
- Audio TTS **di-cache berdasarkan hash konten teks** (entitas baru `AudioAsset`), bukan id manual.
- **Backend: NestJS, satu backend saja.** Logic AI conversation + TTS yang tadinya ada di `server/ai_tutor` (FastAPI/Python, di repo `BELAJAR BAHASA` lama) di-**port** penuh ke NestJS — bukan dipertahankan sebagai service Python terpisah (pelajaran langsung dari operasional 2-service hari ini).
- **Repo terpisah** (`elearning-platform`, repo ini) — git repo sendiri, riwayat sendiri, bukan bagian dari repo `BELAJAR BAHASA`.

PRD final (v4.0, `docs/PRD.md`) adalah sumber kebenaran untuk detail fitur — baca langsung file itu untuk apa pun yang tidak tercakup ringkas di sini.

**Batas scope plan ini:** plan ini HANYA mencakup Fase 0 (Fondasi) + fondasi backend/data yang dibutuhkan untuk mulai Fase 1 (monorepo, skema DB, modul NestJS, auth, migrasi konten, port AI-tutor, skeleton kedua frontend). Fitur Fase 1 per-halaman (UI lengkap tiap layar) dan seluruh Fase 2 (speech assessment, AI conversation bebas, stroke practice) **BUKAN** bagian dari plan ini — akan jadi plan susulan terpisah setelah fondasi ini berdiri, supaya tidak mencoba merencanakan seluruh produk sekaligus dalam satu dokumen.

## Riset yang sudah dilakukan (jangan diulang)

- **Katalog logic domain lama** (`webapp/src/domain/**` di repo `BELAJAR BAHASA` — TIDAK tersedia di cloud sandbox manapun yang cuma clone repo ini; hasil portingnya sudah ada utuh di `packages/domain/` repo ini, jangan coba akses source aslinya): 100% pure TypeScript (tanpa React/Next/Dexie), sudah diporting: `lessonSession.ts`, `exerciseFactory.ts`, `xpService.ts`, `streakService.ts`, `badgeService.ts` (7 badge statis + badge per-unit dinamis), `wordRepetitionService.ts`, `pathLayout.ts`/`unitPathLayout.ts`/`unlockRules.ts`, `japaneseText.ts` (normalisasi kana + Levenshtein `similarityPercent` — relevan untuk validasi toleran-typo EX-05), `content/types.ts` (skema zod Unit/Lesson/Exercise/Vocab/Sentence).
  - **Cuma 3 tipe exercise yang ADA DULU** (`choose`, `assemble`, `speak`) — PRD minta 5 (+matching, listening, isian). Tipe `speak` sudah DIHAPUS TOTAL saat porting (lihat `packages/domain/src/gamification/xpService.ts` dan `lesson/lessonSession.ts` komentarnya) karena skema baru tidak punya padanannya. `matching`/`listening`/`isian` (`FILL_IN`) **belum ada implementasinya sama sekali** di `packages/domain` maupun UI — perlu dibangun baru dari nol saat Milestone 7/frontend detail, bukan porting.
  - **Cuma 1 unit konten yang ada** (`unit_hiragana.json`, 104 vocab/56 sentence/7 lesson, sudah disalin ke `packages/domain/src/content/__fixtures__/unit_hiragana.json`) — kurikulum penuh PRD (5 level) hampir seluruhnya belum ditulis.
  - Tidak ada caching TTS di mana pun di kode lama (konfirmasi lewat eksplorasi) — pipeline cache-by-hash di PRD §9.4 adalah kerja baru sepenuhnya, bukan adaptasi pola lama.
- **Katalog porting `server/ai_tutor`** (FastAPI, repo `BELAJAR BAHASA` lama — juga TIDAK tersedia di cloud sandbox, belum ada portingnya sama sekali di repo ini, Milestone 11 masih pending): 5 endpoint (`/tutor/scenarios`, `/tutor/quota`, `/tutor/transcribe`, `/tutor/reply`, `/tutor/speak`), mekanisme kuota (SQLite, per-device, hardcoded 20/hari, reset implisit per hari lokal), OpenAI Responses API untuk reply (`client.responses.create`), 4 skenario + 3 karakter (data statis sederhana: id/title/description/system_prompt untuk skenario; id/name/personality/voice/voice_instructions untuk karakter), `/tutor/speak` saat ini TIDAK di-cache sama sekali (tiap panggilan hit OpenAI langsung). Model OpenAI yang dipakai: `gpt-5.6-terra` (chat/reply), `gpt-transcribe` (STT), `gpt-4o-mini-tts` (TTS) — lihat env var di `apps/api/.env.example`.

## Keputusan Lintas-Sektor

- **Grading server-authoritative, UX client-optimistic.** `GET /lessons/:id` tetap kirim data exercise lengkap (opsi + kunci jawaban) supaya `exerciseFactory.ts`/`lessonSession.ts` bisa dipakai ulang di browser untuk feedback instan per-soal. Tapi `POST /lessons/:id/attempts` **menghitung ulang skor di server** pakai fungsi `packages/domain` yang SAMA — skor yang disimpan/dapat XP selalu hasil hitungan server, bukan self-report client (perlu karena sekarang ada leaderboard antar-murid, tidak seperti app lama yang single-user/local-trusted).
- **`unlockRules.ts` ditegakkan di server**, bukan cuma di client — `LessonsModule` cek status unlock terhadap `UserLessonProgress` sebelum menerima attempt.
- **`packages/domain` tetap bebas dari Prisma** — fungsi murni, tidak tahu soal database; service di `apps/api` yang jadi lem ke Prisma.
- **Angka XP: PRD menang, tapi mekanismenya di-porting.** Formula lama pakai `10 + 1×correctFirstTry + 5×speakHighCount` + level curve `100×n`. PRD v4.0 (GAM-01/03) minta angka beda: lesson +10–30, checkpoint +50, percakapan +20, kuis harian +10, level curve `1000×n`. Sudah diimplementasi di `packages/domain/src/gamification/xpService.ts` dengan mapping bintang→XP ★=10/★★=20/★★★=30 — **PROPOSAL, perlu dikonfirmasi ke product owner** (PRD kasih rentang & tingkat bintang terpisah, tidak pernah eksplisit memetakan keduanya). `starsForScore(accuracyPercent)` juga sudah ada di file yang sama (ambang LP-03: 80-89=1, 90-99=2, 100=3) — tapi **belum ada yang MEMANGGIL fungsi ini** dari alur completion lesson sungguhan; itu tugas `LessonsModule` (Milestone 7, belum dikerjakan).
- **XP jangan dobel fungsi.** GAM-03 (level/leaderboard) butuh XP monoton naik; GAM-02 (beli streak-freeze pakai 50 XP) butuh XP jadi mata uang yang bisa dibelanjakan. Kalau keduanya pakai ledger yang sama, beli freeze bisa bikin rank turun — kemungkinan tidak diinginkan. **Keputusan:** `XpEvent` tetap ledger append-only selalu positif (sumber kebenaran level+leaderboard); pembelian freeze jadi counter terpisah, bukan `XpEvent` negatif.
- **Auth student vs admin benar-benar terpisah** — signing secret, audience, dan tabel refresh-token yang beda, bukan cuma route beda — supaya token murid yang bocor tidak bisa dipakai sebagai token admin. Sudah diimplementasi (`AuthModule` vs `AdminAuthModule`).

## 1. Struktur Monorepo

**pnpm workspaces + Turborepo.** Nx terlalu berat untuk graf sekecil ini (2 frontend Vite + 1 backend Nest + beberapa shared package); plain workspaces tanpa task runner berarti urutan build/caching harus diatur manual begitu CI masuk. Turborepo pas di tengah: orkestrasi `turbo run build|test|lint` lintas workspace + caching, cukup satu file config, gampang dilepas kalau suatu saat tidak perlu. pnpm dipilih karena `node_modules` yang strict (menangkap impor silang antar-paket yang tidak sengaja — penting supaya `packages/domain` tetap benar-benar decoupled).

```
<repo>/
├── apps/
│   ├── student/          # React + Vite + TS + Tailwind + shadcn/ui, PWA (vite-plugin-pwa)
│   ├── admin/             # React + Vite + TS + Tailwind + shadcn/ui (tanpa PWA)
│   └── api/               # NestJS
│       ├── prisma/{schema.prisma, seed.ts, seed-data/raw/unit_hiragana.json}
│       └── src/
├── packages/
│   ├── domain/            # logic murni hasil porting — TIDAK impor Prisma. Build step tsc->CommonJS
│   │                       # (BUKAN "TS-source-only" seperti draft awal plan ini bilang -- lihat
│   │                       # catatan "koreksi" di bagian bawah plan ini, penting dibaca)
│   ├── ui/                # primitif shadcn/ui + preset Tailwind + design token (shell doang, bukan fitur)
│   └── config/            # tsconfig/eslint/prettier/tailwind preset dasar
├── turbo.json
├── pnpm-workspace.yaml
├── docker-compose.yml      # lokal: postgres + redis + minio
└── .github/workflows/ci.yml
```

Tidak ada `packages/api-types` manual — lihat poin 7 (OpenAPI codegen) supaya tidak ada drift tipe frontend vs backend.

**KOREKSI PENTING dari draft awal plan ini:** draft ini semula bilang "tiap package workspace TS-source-only, tanpa build dist terpisah." Itu SALAH dan sudah diperbaiki saat implementasi: `apps/api` (NestJS) di-compile jadi JS lalu dijalankan `node dist/main.js` di produksi/Docker — proses `node` murni itu TIDAK BISA `require()` file `.ts` mentah. Jadi `packages/domain` (dan `packages/ui`) SEKARANG punya build step `tsc` sungguhan (`"build": "tsc"`, `main`/`types` menunjuk ke `dist/`), bukan menunjuk ke `src/`. `packages/domain` di-compile ke **CommonJS** (harus cocok dengan `apps/api` yang juga CommonJS — sempat salah coba ESM dulu, ketahuan lewat smoke test `require()` sungguhan yang gagal, lihat commit `458971b`). `packages/ui` boleh tetap ESM (`"type": "module"`) karena cuma dikonsumsi Vite (bundling, bukan `node require()` langsung).

## 2. Skema Database (Prisma)

**ORM: Prisma** — client TS yang di-generate langsung memenuhi tujuan PRD §9.1 "shared types," tooling migrasi (`migrate dev`/`deploy`) cocok untuk evolusi skema Fase 0→1→2, dan Prisma Studio berguna selama belum ada UI admin-content (Fase 2). Drizzle jadi fallback kalau tim mau runtime lebih ringan.

Skema lengkap sudah ada di `apps/api/prisma/schema.prisma` — baca file itu langsung, jangan duplikat di sini (plan asli menyalin seluruh isinya di titik ini, tapi sekarang sumber kebenarannya adalah file schema itu sendiri, bukan salinan di dokumen ini yang bisa basi). Ringkasan struktural: `Institution` (singleton, tanpa seat_quota/plan), `AdminUser`+`AdminRefreshToken`, `Class`, `Invitation`, `User`+`RefreshToken`+`PasswordResetToken`, `Level`/`Unit`/`Lesson`/`Exercise`/`Vocab`, `UserLessonProgress`, `ReviewItem`, `Scenario`+`ScenarioAttempt` (template CONV, BEDA dari TutorModule), `XpEvent`, `Streak`, `Badge`+`UserBadge`, `Announcement` (tabel saja, belum ada modul), `AudioAsset` (cache TTS by content-hash). `PronunciationResult` (ada di PRD) SENGAJA belum dimodelkan — murni Fase 2.

**Setelah Milestone 3 selesai diimplementasi, wajib jalankan (belum pernah — Docker tidak ada di mesin dev lokal):** `docker compose up -d` lalu `pnpm db:migrate` (generate migrasi pertama dari schema.prisma yang sudah ditulis, `prisma migrate dev` belum pernah dijalankan sama sekali) — ini genuinely langkah verifikasi baru, bukan formalitas.

## 3. Breakdown Modul NestJS

Global: `AppModule` (composition root), `PrismaModule` (`@Global()`), `RedisModule` (`ioredis` langsung — leaderboard/quota/lockout butuh sorted-set & `INCR` atomik, bukan abstraksi `cache-manager`), `ConfigModule` (validasi env pakai zod, gagal saat boot kalau ada yang kosong), `helmet()` + CORS ketat (origin di-allowlist ke 2 frontend) + CSP, `@nestjs/throttler`.

| Modul | Endpoint | Status |
|---|---|---|
| `AuthModule` | `/auth/invitations/validate`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/forgot`, `/auth/reset` | **SUDAH ADA** (`apps/api/src/auth/`) |
| `AdminAuthModule` | `POST /admin/auth/login` (+refresh) | **SUDAH ADA** (`apps/api/src/admin-auth/`) |
| `UsersModule` | `GET/PATCH /me` | **SUDAH ADA** (`apps/api/src/users/`) |
| `MailModule` | (internal, stub log-to-console) | **SUDAH ADA tapi STUB** — provider email sungguhan (SendGrid/Mailgun/SES) belum dipilih/dikonfigurasi |
| `LearningPathModule` | `GET /path` | **SUDAH ADA** (`apps/api/src/learning-path/`) — diverifikasi end-to-end |
| `LessonsModule` | `GET /lessons/:id`, `POST /lessons/:id/attempts` | **SUDAH ADA** (`apps/api/src/lessons/`) — diverifikasi end-to-end, termasuk jalur lulus & gagal |
| `SrsModule` | (internal) | **SUDAH ADA** (`apps/api/src/srs/`) — tulis `ReviewItem` diverifikasi (salah→stage 0, benar berikutnya→stage maju); belum ada consumer (`GET /flashcards/due` masih Milestone 9) |
| `GamificationModule` | `GET /leaderboard` | **SUDAH ADA** (`apps/api/src/gamification/`) — XP/streak/badge/leaderboard diverifikasi end-to-end |
| `ScenariosModule` | `GET /scenarios`, `GET /scenarios/:id`, `POST /scenarios/:id/attempts` | **BELUM** — Milestone 9 |
| `DictionaryModule` | `GET /dictionary?q=` | **BELUM** — Milestone 9 |
| `FlashcardsModule` | `GET /flashcards/due`, `POST /flashcards/review` | **BELUM** — Milestone 9 |
| `ContentModule` | (internal, akses Prisma content + rekonstruksi bentuk `packages/domain`) | **SUDAH ADA** (`apps/api/src/content/`) — gerbang zod-nya ternyata cukup di SEED time (`prisma/seed.ts`), bukan tiap baca: baca dari Postgres balik ke bentuk domain adalah mapping TS biasa (`content.mapper.ts`), bukan re-validasi -- lihat catatan Milestone 6/7 di bawah |
| `AudioModule` | (internal `resolveAudioUrl(textJp)`) | **BELUM** — Milestone 8 |
| `AdminInvitationsModule`/`AdminClassesModule`/`AdminStudentsModule`/`AdminDashboardModule` | CRUD admin | **BELUM** — Milestone 9 |
| `TutorModule` | 5 endpoint port dari `server/ai_tutor` | **BELUM** — Milestone 11 |

Validasi: `class-validator`/`class-transformer` DTO untuk body flat sederhana (auth, CRUD — pola sudah ada di `apps/api/src/auth/dto/`); skema zod `packages/domain` via `nestjs-zod` untuk payload berbentuk konten (exercise, scenario) begitu `ContentModule` dibangun.

## 4. Auth (SUDAH DIIMPLEMENTASI — `apps/api/src/auth/`, `src/admin-auth/`, `src/users/`)

- **Token undangan**: random opaque (`crypto.randomBytes(32).toString('base64url')`), yang disimpan cuma `sha256(token)` (`src/common/opaque-token.util.ts`) — bukan JWT (JWT tidak bisa di-revoke tanpa blocklist, padahal ADM-12 butuh resend/revoke).
- **Registrasi**: validasi token → hash password `argon2id` → `User` dibuat dengan `classId`/`email` dari `Invitation` yang tervalidasi di server (BUKAN dari body request) → invitation jadi `ACCEPTED` → langsung terbitkan access+refresh JWT (auto-login).
- **JWT**: `@nestjs/jwt`+`@nestjs/passport`+`passport-jwt`; access 1 jam, refresh 14 hari, secret terpisah student (`JWT_STUDENT_SECRET`) vs admin (`JWT_ADMIN_SECRET`). Rotasi refresh dengan deteksi-reuse: token yang sudah di-revoke tapi dipakai lagi → revoke seluruh chain, paksa re-login. Payload JWT `sub` juga dicocokkan dengan `userId`/`adminUserId` hasil lookup DB (pertahanan berlapis).
- **Rate limit/lockout**: lockout 5x-gagal→15 menit per-akun lewat Redis (`login_fail:{email}`/`login_lock:{email}`).
- **Lupa password**: `/auth/forgot` selalu balas 200 (no user enumeration). `/auth/reset` revoke SEMUA refresh token user itu.
- **BELUM ADA YANG BISA DITES END-TO-END SUNGGUHAN** — semua di atas cuma diverifikasi lewat typecheck+lint+unit-test util murni (tidak butuh DB). Perlu Postgres+Redis hidup untuk tes sungguhan (register→login→refresh→forgot→reset lewat REST client beneran).

## 5. Migrasi Konten Hiragana — SELESAI (Milestone 6)

`apps/api/prisma/seed.ts` sudah jalan sungguhan (bukan stub lagi), idempotent (dites re-run 2x, row count sama). Yang ternyata beda dari rencana awal:

1. `unit_hiragana.json` disalin ke `apps/api/prisma/seed-data/raw/` seperti rencana.
2. Skema zod `packages/domain`'s `unitSchema` jadi gerbang validasi SEBELUM upsert, persis rencana.
3. **Skema Prisma ternyata kurang lengkap untuk menampung konten** (baru ketahuan saat benar-benar coba migrasi data, bukan pas nulis draft skema Milestone 3) — dua perbaikan skema (migrasi Prisma baru, bukan cuma dokumentasi):
   - **Model `Sentence` baru** (tidak ada di draft awal sama sekali) — dibutuhkan karena `ExerciseFactory`/`LessonSession` `packages/domain` menarik distractor assemble/choose-kalimat dari SELURUH `unit.sentences`, bukan cuma sentence yang dirujuk satu exercise; tanpa tabel relasional sendiri, tidak mungkin direkonstruksi balik dari Postgres. Field: `surface/kana/romaji/meaning/words(json)/assembleTokens(json?)/voice`, unit-scoped.
   - **`Unit.description`/`Unit.type`/`Unit.grammarNotes`** ditambahkan (draft awal cuma punya `title`/`order`) — dibutuhkan domain `Unit` type.
   - **`Vocab.meaningId` diubah dari wajib jadi nullable** — 104/104 vocab Hiragana TIDAK punya `meaning_id` (karakter fonetik murni, bukan kosakata berarti, mis. あ) di data sungguhan; draft skema salah asumsi field ini selalu terisi.
4. Upsert idempotent by natural key (id dari JSON dipertahankan, BUKAN cuid baru): `Level` HIRAGANA → `Unit` → `Vocab` (104) → `Sentence` (56) → `Lesson` (7) → `Exercise` (CHOOSE/ASSEMBLE reshape langsung, id sintetis `${lessonId}_${order}`; tipe `speak` **tidak dimigrasikan sebagai Exercise** — 56 exercise speak di-skip, datanya tetap ada lewat `Vocab`/`Sentence` yang sudah di-upsert terpisah) → 7 badge statis (unit Hiragana bertipe `kana`, bukan `conversation`, jadi TIDAK dapat badge dinamis per-unit — sesuai `BadgeCatalog.all` yang cuma menghasilkan badge untuk unit `conversation`).
5. Diverifikasi via query langsung (bukan cuma Prisma Studio manual): `Vocab`=104, `Sentence`=56, `Lesson`=7, `Exercise`=128 (104 choose + 24 assemble), `Badge`=7. Re-run kedua menghasilkan angka SAMA (idempotent, tidak dobel).
6. Katakana/Dasar/N5/N4 masih di luar fase ini — authoring konten kerjaan terpisah (pemilik produk + pengajar), pakai pipeline seed yang sama (`toDomainUnit`/`unitSchema` sudah generik, tidak Hiragana-specific).

## 6. Port AI-Tutor (`TutorModule`) — BELUM DIKERJAKAN (Milestone 11)

Port infrastruktur mekanis dari `server/ai_tutor` (FastAPI, repo `BELAJAR BAHASA` lama — **sumber Python-nya TIDAK ada di repo ini**, jadi HARUS kerja dari spesifikasi behavioral di bawah, bukan baca source aslinya):

| Endpoint | Rencana port |
|---|---|
| `GET /tutor/scenarios` | 4 skenario + 3 karakter jadi konstanta sisi-Nest (`scenarios.const.ts`), bukan baris DB. Nama tipe: `TutorScenario` (beda dari model Prisma `Scenario`/CONV — hindari bentrok istilah, `Scenario` Prisma itu template percakapan terstruktur, `TutorScenario` ini system-prompt untuk LLM bebas). |
| `GET /tutor/quota` | Port dari SQLite `(device_id, day)` lama ke Redis `INCR tutor_quota:{userId}:{date}` dengan TTL akhir-hari — sekalian membetulkan race condition check-then-act versi lama. Default 20/hari. |
| `POST /tutor/transcribe` | `FileInterceptor` (multipart) → `openai` npm (`OPENAI_STT_MODEL`, default `gpt-transcribe`), tetap `language:"ja"` hardcode. Guard JWT murid + batas ukuran file Multer. |
| `POST /tutor/reply` | System-prompt dari scenario + suntik vocab opsional + override mode="help" (kalau murid minta bantuan, jangan lanjutkan roleplay, kasih 2-3 contoh kalimat + arti Indonesia) + flatten history jadi "role: text" per baris, panggil OpenAI **Responses API** `client.responses.create({model: OPENAI_CHAT_MODEL, instructions: systemPrompt, input: historyText})`. Kuota dicek SEBELUM generate reply, SETELAH client OpenAI berhasil dibuat (supaya server yang salah config OPENAI_API_KEY tidak diam-diam menghabiskan kuota tanpa panggilan API yang sungguhan terjadi). |
| `POST /tutor/speak` | Perlu logic baru, bukan port murni: delegasikan ke `AudioModule.resolveAudioUrl()` yang SAMA dipakai lesson/dictionary/scenario — satu jalur cache TTS se-sistem, bukan cache terpisah. Catatan: `voice`/`voice_instructions` per-karakter berarti cache key TIDAK bisa cuma dari teks untuk endpoint ini — `AudioAsset.textHash` di schema sengaja string hash opaque (bukan constraint `sha256(text)` di level DB) supaya bisa diperluas ke `hash(text+voiceId)` tanpa migrasi baru. |

Env var (sudah ada template di `apps/api/.env.example`): `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL` (default `gpt-5.6-terra`), `OPENAI_STT_MODEL` (default `gpt-transcribe`), `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`), `OPENAI_TTS_VOICE_DEFAULT` (default `nova`).

4 skenario contoh dari versi lama (id/title/description/system_prompt): `perkenalan`, `restoran`, `arah`, `belanja`. 3 karakter (id/name/personality/voice/voice_instructions): `yuki` (ramah/sabar, voice "nova"), `kenji`, `sora`. Detail persis kalimat system_prompt tidak tercatat di sini (bukan behavioral-critical, bisa ditulis ulang bebas asal nadanya konsisten: JLPT N5 pemula, hiragana/katakana+kanji umum saja, maks 2 kalimat pendek per balasan, koreksi dianyam natural dalam balasan bukan diceramahkan, jangan pernah ganti ke Bahasa Inggris).

## 7. Skeleton Frontend

**Shared** (`packages/ui`, `packages/domain`): primitif shadcn/ui + token Tailwind + shell layout (`AppShell`, `Button` — sudah ada); skema zod konten; logic murni. **Tidak dibagi**: komponen fitur/halaman aktual.

**API client (BELUM ADA)**: rencana `@nestjs/swagger` dekorasi controller/DTO → generate spec OpenAPI → `openapi-typescript`/`openapi-fetch` codegen di frontend. Belum diimplementasi — `apps/student`/`apps/admin` masih pakai `AuthGuard` stub (`localStorage.getItem('access_token')`, tidak benar-benar panggil API apa pun).

**SUDAH ADA** (`apps/student/src/router.tsx`, `apps/admin/src/router.tsx`): semua rute dari PRD §8 resolve ke halaman stub, `AppShell`+nav per app, `AuthGuard` stub, PWA cuma di `apps/student` (app-shell only, tanpa cache konten/audio — online-only). Admin sengaja TIDAK punya rute `/content`/`/reports` (Fase 2, belum dibangun — router harus jujur soal apa yang ada).

**BELUM ADA**: API client sungguhan, login yang benar-benar memanggil `/auth/login` (walking-skeleton di poin verifikasi Milestone 10/12 belum tercapai), dan seluruh UI detail tiap layar (Fase 1 terpisah).

## Status Implementasi

Repo ini (`elearning-platform`) — commit gabungan Milestone 2+3+4+5+10-parsial: `458971b` (di GitHub, `firmansy-hub/elearning-platform`, branch `main`). Milestone 6+7 (migrasi konten Hiragana + vertical slice belajar inti, termasuk verifikasi end-to-end pertama kalinya terhadap Postgres+Redis sungguhan) dikerjakan di sesi Claude Code cloud berikutnya, branch `claude/dazzling-feynman-m7w7t6`.

- [x] Milestone 1 — Bootstrap repo
- [x] Milestone 2 — Port `packages/domain` (82 test lulus, `pnpm --filter @elearning/domain test`)
- [x] Milestone 3 — Skema Prisma (`apps/api/prisma/schema.prisma`) — `prisma migrate dev` sudah jalan (lihat Milestone 6/7)
- [x] Milestone 4 — Skeleton NestJS — **diverifikasi jalan sungguhan**: `GET /health` merespons `{"status":"ok"}` lewat Postgres+Redis sungguhan
- [x] Milestone 5 — Vertical slice auth — **diverifikasi end-to-end lewat REST client sungguhan**: validate-invitation → register → login → GET/PATCH /me → refresh (+deteksi-reuse, revoke seluruh chain) → forgot → reset (+revoke semua refresh token) → admin login, semua lewat curl sungguhan terhadap Postgres+Redis Docker, bukan cuma unit test util murni
- [x] Milestone 6 — Migrasi konten Hiragana — **SELESAI**, lihat bagian 5 di atas (termasuk 2 perbaikan skema yang ketahuan pas migrasi sungguhan)
- [x] Milestone 7 — Vertical slice belajar inti (LearningPathModule/LessonsModule/GamificationModule/SrsModule) — **SELESAI, diverifikasi end-to-end** (lihat "Verifikasi" di bawah untuk detail)
- [ ] Milestone 8 — Pipeline audio (AudioModule) — **BELUM, PALING PENTING SELANJUTNYA**
- [ ] Milestone 9 — Modul admin (Invitations/Classes/Students/Dashboard) + Scenarios/Dictionary/Flashcards
- [x]/[ ] Milestone 10 — Skeleton frontend SEBAGIAN: tooling+router+stub pages+AuthGuard stub selesai; API client (OpenAPI codegen) dan login end-to-end BELUM — sekarang ada API sungguhan (Milestone 5+7) untuk digantungi, sebelumnya belum
- [ ] Milestone 11 — Port TutorModule (lihat poin 6 di atas — sumber Python TIDAK tersedia di repo ini, kerja dari spesifikasi behavioral yang sudah dicatat)
- [ ] Milestone 12 — Checklist keluar fondasi

**Catatan lingkungan (penting untuk sesi berikutnya):** environment cloud sandbox tempat Milestone 6/7 dikerjakan PUNYA Docker (`dockerd`/`containerd` terpasang), tapi daemon-nya tidak otomatis jalan (`service docker start` gagal karena `ulimit` kena batasan sandbox) — jalankan `dockerd &` langsung sebagai root, bukan lewat init script, itu jalan. `docker compose up -d` untuk image `minio/minio:latest` gagal ("pull access denied") — minio Corp membatasi pull anonim image itu di Docker Hub (isu eksternal, bukan konfigurasi repo ini); `quay.io/minio/minio` dicoba sebagai alternatif tapi diblok kebijakan jaringan sandbox (403). `postgres`/`redis` sendiri sempat kena 429 (rate limit Docker Hub untuk pull anonim, kemungkinan IP proxy sandbox dipakai bersama sesi lain) tapi berhasil setelah beberapa retry. **MinIO belum pernah jalan sama sekali** — tidak masalah untuk Milestone 6/7 (tidak menyentuh S3), tapi Milestone 8 (AudioModule, butuh S3) akan butuh ini beres duluan; kalau kena masalah sama, coba lagi beberapa kali dengan jeda, atau minta environment dengan network policy yang mengizinkan `quay.io`.

**Yang PALING PRIORITAS sekarang (Milestone 8):**
1. Selesaikan akses MinIO/S3 (lihat catatan lingkungan di atas) — `docker compose up -d minio` lalu verifikasi `S3_*` env var di `.env` benar-benar bisa dipakai (bikin bucket `audio-assets`).
2. `AudioModule` (internal `resolveAudioUrl(textJp)`): hash SHA-256 teks → cek `AudioAsset` → kalau belum ada, generate TTS (provider belum dipilih, lihat "Yang Masih Perlu Dikonfirmasi") → upload S3 → catat baris baru; kalau sudah ada, pakai `s3Url` tersimpan.
3. Sambungkan ke `ContentService`/`LessonsService` supaya `GET /lessons/:id` bisa mengembalikan URL audio per vocab/sentence (sekarang field `audio` domain `Vocab`/`Sentence` sengaja `""` placeholder, lihat komentar `content.mapper.ts`).
4. Verifikasi: minta audio yang sama 2x, request kedua harus hit `AudioAsset` (tidak panggil TTS provider lagi).
5. Setelah itu: Milestone 9 (modul admin — `AdminInvitationsModule` dkk, supaya invitation tidak perlu dibuat manual lewat script lagi) atau Milestone 10 sisa (API client sungguhan di frontend, sekarang backendnya sudah ada untuk digantungi).

## Verifikasi

- `pnpm turbo run typecheck lint test` — hijau (16 task, 6 package/app, 0 error/warning selain notice caching turbo yang tidak relevan) per sesi ini (Milestone 6+7). Jalankan ulang tiap kali sebelum menganggap suatu milestone selesai.
- [x] Setelah migrate: `docker compose up` (postgres+redis, **minio masih belum** — lihat catatan lingkungan) jalan, `GET /health` merespons `{"status":"ok"}`.
- [x] Setelah auth bisa dites: invitation dibuat manual (script sekali-pakai, `AdminInvitationsModule` belum ada) → register → login → refresh → forgot/reset — token benar-benar tervalidasi/ter-revoke sesuai desain (reuse refresh token lama setelah refresh → 401 + seluruh chain ter-revoke; reset password → SEMUA refresh token lama ter-revoke, bukan cuma yang dipakai).
- [x] Setelah Milestone 6: dihitung langsung (bukan cuma Prisma Studio manual) `Vocab`=104, `Sentence`=56, `Lesson`=7, `Exercise`=128, `Badge`=7 — re-run seed kedua kali menghasilkan angka SAMA (idempotent).
- [x] Setelah Milestone 7: `POST /lessons/:id/attempts` dites jawaban benar & salah lewat `LessonSession` sungguhan (client simulasi tidak pernah mengirim skor sama sekali) — dikonfirmasi: skor DIHITUNG ULANG SERVER dari log jawaban mentah; `unlockRules` menolak attempt ke lesson yang belum unlock (403, dites lesson l3 sebelum l2 selesai); lulus (≥80%) memberi XP+stars+badge+update streak+`GET /path` unlock lesson berikutnya; gagal (<80%) TIDAK memberi XP, TIDAK menandai `completedAt`, lesson berikutnya TETAP terkunci; mengulang lesson yang SUDAH lulus meng-upgrade skor/bintang terbaik tapi TIDAK memberi XP kedua kalinya (lihat keputusan anti-farming di `lessons.service.ts`); jawaban vocab yang salah membuat `ReviewItem` (stage 0, +1 hari) lalu maju ke stage berikutnya (+3 hari) begitu benar di attempt selanjutnya.
- [ ] Setelah Milestone 8: minta audio yang sama 2x — request kedua harus hit `AudioAsset` (tidak panggil TTS provider lagi).
- [ ] Milestone 12 (exit fondasi): browser sungguhan — walking-skeleton login siswa dari `apps/student` benar-benar memanggil `/auth/login` asli dan berhasil, sama untuk admin.

## Yang Masih Perlu Dikonfirmasi ke Product Owner (tidak menghalangi kerja, tapi jangan dilupakan)

- Mapping bintang→XP (★=10/★★=20/★★★=30, di `xpService.ts`) — proposal, belum terkonfirmasi.
- **XP lesson cuma diberikan sekali (penyelesaian PERTAMA), bukan tiap kali lulus** — keputusan baru sesi ini (`lessons.service.ts`, cari "justCompletedFirstTime"), belum ada di PRD/plan manapun sebelumnya. Tanpa ini, mengulang lesson mudah berkali-kali jadi XP farming tanpa batas; PRD tidak eksplisit membahas kasus ini sama sekali. Mengulang tetap diizinkan dan tetap meng-upgrade skor/bintang terbaik yang tersimpan, cuma tidak menghasilkan XP baru.
- **Badge `words_100`/`speaker_50` belum bisa didapat siapa pun** — `BadgeService.evaluate` butuh input `wordsLearned`/`speakingHighCount`, tapi tidak ada tracking persisten untuk "kata yang sudah dipelajari" per user di skema saat ini (beda dari `ReviewItem` yang cuma menyimpan kata yang PERNAH SALAH), dan `speak` sebagai tipe exercise sudah dihapus total dari sistem baru (lihat Milestone 2). `GamificationService.evaluateBadges` sengaja mengirim `0` untuk keduanya (jujur, bukan bug) — butuh tabel baru (mis. `UserLearnedVocab`) kalau badge `words_100` mau benar-benar bisa dikejar; belum dibangun sesi ini (scope call, lihat commit).
- **GAM-05 "3 teratas leaderboard dapat lencana mingguan" belum diimplementasikan** — butuh job terjadwal di rollover minggu (`@nestjs/schedule` belum jadi dependency); leaderboard mingguannya sendiri (peringkat + reset tiap Senin 00:00 via Redis sorted set berkunci tanggal Senin) sudah jalan dan diverifikasi.
- **LP-05 "checkpoint gagal 2x → sarankan lesson terlemah"** belum diimplementasikan — belum ada tracking error-rate per-lesson untuk mendeteksi "lesson terlemah"; checkpoint lulus/gagal sendiri (via flag `Lesson.isCheckpoint`, dipakai untuk pilih `XpService.checkpointXp` vs `lessonXp(stars)`) sudah jalan, tapi tidak ada satu pun `Lesson.isCheckpoint=true` di konten Hiragana yang sudah di-seed (kontennya memang tidak punya checkpoint lesson terpisah) — jalur checkpoint XP belum sempat diuji lewat data sungguhan, cuma lewat pembacaan kode.
- Provider email transaksional (SendGrid/Mailgun/SES) — `MailModule` masih stub log-to-console, perlu kredensial sebelum auth bisa dites penuh dengan email sungguhan.
- Provider TTS untuk `AudioModule` (Milestone 8) — plan merekomendasikan Azure Cognitive Speech (satu vendor dengan Azure Pronunciation Assessment Fase 2), belum final.
