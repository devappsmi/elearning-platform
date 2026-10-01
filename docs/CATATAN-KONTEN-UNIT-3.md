# Catatan tinjauan konten — Unit 3 "Percakapan di Tempat Kerja"

Sumber: `apps/api/prisma/seed-data/source/Percakapan_di_Tempat_Kerja_Unit_3.docx` (11 pola, 55 entri, 145 kalimat). Cara kerja
impor: [`DEPLOY.md`, bagian 5b](DEPLOY.md).

**Baca ini sebelum unit dipakai murid.** Saat mengubah dokumen jadi pelajaran saya menemukan beberapa kalimat yang menurut saya
keliru. Saya **bukan penutur asli** dan **tidak mengubah satu pun tulisan Jepang dari pengajar** — semuanya di bawah ini hanya
dugaan yang perlu dikonfirmasi pengajar. Yang saya ubah otomatis hanya salah ketik yang jelas (daftar di bagian C).

Cara memperbaiki: ubah kalimatnya di berkas Word, lalu jalankan `pnpm --filter api run unit:import unit_kerja_3`, periksa
ringkasannya, commit, dan `db:seed` ulang di server. Kolom "ID" di bawah adalah id kalimat di data (mis. `k3s_6_1_2`) bila perlu
dicari.

## A. Dugaan kesalahan yang paling penting

| # | Bagian (pelajaran) | Yang tertulis di template | Dugaan masalah | Saran |
|---|---|---|---|---|
| 1 | 6 ～ことになっている, entri 1 (`k3s_6_1_1`–`3`) | チェックインが午後三時**からことになっています** | 「から」langsung diikuti「ことになっている」tidak gramatikal | 午後三時からになっています / 午後三時からと決まっています / 午後三時からということになっています |
| 2 | 6, entri 2 (`k3s_6_2_1`–`3`) | 経費計算を提出**ことになっています** | 「する」hilang: 提出 adalah kata benda-する. Selain itu 計算 (langkah 1) dan 精算 (langkah 2–3) tidak konsisten | 経費精算を提出**する**ことになっています (istilah yang lazim: 経費精算) |
| 3 | 6, entri 5 (`k3s_6_5_1`–`3`) | 一方通行**だったことになっていました** | Artinya jadi "dianggap dulunya satu arah", bukan "peraturan saat itu jalan satu arah" seperti terjemahannya | 一方通行になっていました (mis. 昔、この道は一方通行になっていました) |
| 4 | 8 ～そう, entri 4 (`k3s_8_4_1`–`3`) | 彼女は毎日忙しくて疲れている**そうです** | Bentuk biasa + そうです berarti "katanya" (pola bagian 9), padahal terjemahan dan judul bagian: "kelihatannya" | 疲れて**い**そうです (kelihatannya lelah) — atau, bila memang "katanya", pindahkan ke bagian 9 |
| 5 | 1 ～ている, entri 1 (`k3s_1_1_1`–`2`) | 会議が**始めて**いるところです | 始める adalah kata kerja transitif, tak cocok dengan subjek 会議が. Terjemahan "baru saja mulai" juga bukan arti ～ているところ ("sedang di tengah…") | 会議が始まったところです (baru mulai) atau 会議を始めているところです (sedang memulai rapat) |
| 6 | 3 ～するところ, entri 2 (`k3s_3_2_1`–`3`) | 食べ始め**ている**ところです | Terjemahan "sedang **mau** segera mulai makan", tetapi ～ている berarti sedang berlangsung. Bagian ini seharusnya "segera" (akan) | 食べ始めるところです |

## B. Hal yang lebih kecil

- **ピックニック** (bagian 5, entri 1) — ejaan baku: ピクニック.
- **温かい天気** (bagian 10b, entri 3) — untuk cuaca/suhu lingkungan lazimnya 暖かい (温かい untuk benda/makanan).
- **お客様と対応している** (bagian 1, entri 4) — 対応する memakai に untuk lawannya: お客様に対応している (「と」= bersama-sama).
- **崩す vs くずさない** (bagian 4, entri 4) — rangkaian memakai kanji, kalimat memakai kana; ejaan tidak konsisten. Hal yang sama:
  見つかり (bagian 8, entri 5, langkah 1) vs みつかり (langkah 2–3).
- **ことになる = "memutuskan"** (bagian 5) — ことになる berarti "diputuskan/ditetapkan (oleh keadaan atau pihak lain)"; "memutuskan
  sendiri" adalah ことにする. Terjemahan "memutuskan untuk…" bisa menyesatkan.
- **Terjemahan janggal:** "Tepat sudah mau segera bertanya ke sensei." (bagian 3, entri 3, langkah 3) — mungkin "Saya tadi tepat
  mau bertanya kepada sensei."
- **Kalimat ganda:** 先生に質問しようとしたところです tertulis dua kali berturut-turut (bagian 3, entri 3); satu saja yang dipakai.
- **Bagian yang tidak lengkap:** kalimat この料理は少し辛いようです hanya ada versi ようです di tulisan Jepang (みたいです hanya di
  romaji, bagian 7, entri 4); terjemahan bagian ketiga rangkaian 責任感 → 責任感が強い → 責任感が強くて tidak ditulis (bagian 10b,
  entri 1; di catatan tampil "…").
- **Judul bagian 4:** romaji "you ni **site** iru" (seharusnya shite iru) — hanya muncul di baris pola pada catatan.

## C. Yang saya ubah otomatis (semuanya tercatat beserta alasannya di `unit_kerja_3.overrides.json`)

- **Salah ketik Indonesia:** "Nai (kendaraan)" → "Naik (kendaraan)"; "lemberunya" → "lemburnya" (3×); "nonto TV" → "nonton TV" (2×);
  "ｄitentukankan/Ditentukankan" → "ditentukan/Ditentukan"; "saya Sedang mau" → "saya sedang mau"; kata ulang diberi tanda hubung
  ("Anak anak", "Laki laki", "Akhir akhir" → "Anak-anak", "Laki-laki", "Akhir-akhir").
- **Kanji:** rangkaian bagian 3 entri 2 memakai 初めている (huruf 初) di tengah 始める → 始めている → 始めているところです → dibetulkan
  menjadi 始めている.
- **Romaji** (tidak tampil ke murid, dipakai untuk menurunkan bacaan kana): "Ima koro" → "Ima goro" (今頃); "ibentou" → "ibento"
  (イベント); "takakuite" → "takakute" (高くて); "keihi keisan" → "keihi seisan" di dua kalimat yang tulisannya 経費精算.
- Potongan susun-kalimat untuk 4 kalimat yang tak bisa diturunkan otomatis (急いでください。, 体調をくずさないように, 答えが見つかりそうにない,
  複雑で答えがみつかりそうにない) dan bacaan 続 = つづ ditetapkan manual.

Bacaan (kana) kalimat diturunkan dari romaji pengajar dan **dicocokkan dengan tulisan Jepangnya**: romaji yang tak cocok dengan kana
di kalimat langsung terdeteksi (itulah cara ketiga salah ketik romaji di atas ketahuan). Yang tak bisa terdeteksi: kesalahan
bacaan **di dalam deretan kanji** (mis. romaji menulis "keisan" tetapi tulisannya 精算 hanya ketahuan karena saya membandingkannya
sendiri). Tolong dengarkan/baca sekilas bacaan di layar pilih-arti-kalimat (baris kecil di bawah kalimat Jepang) untuk pelajaran
yang Anda pakai.
