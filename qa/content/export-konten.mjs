#!/usr/bin/env node
/**
 * Ekspor isi pelajaran untuk diperiksa guru/penulis konten, plus pemeriksaan otomatis atas kesalahan yang sering terselip.
 *
 *   node content/export-konten.mjs                 ekspor + pemeriksaan (tanpa memeriksa berkas audio)
 *   node content/export-konten.mjs --audio         ditambah memeriksa tiap tautan audio bisa dibuka
 *   node content/export-konten.mjs --keluar=folder lokasi hasil (bawaan: reports/konten)
 *
 * Hasil: konten.html (dibaca/dicetak), serta CSV (kosakata, kalimat, catatan-tata-bahasa, pelajaran, skenario, temuan-otomatis)
 * yang bisa dibuka di Excel; kolom "Hasil periksa" dan "Komentar" sengaja kosong untuk diisi pemeriksa.
 * Sumber data: API yang sama dengan aplikasi murid (login memakai QA_STUDENT_*). Tidak mengubah data apa pun.
 * Kode keluar 0 = tidak ada temuan tingkat Galat, 1 = ada, 2 = konfigurasi belum lengkap.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function muatEnv(berkas) {
  if (!existsSync(berkas)) return;
  for (const mentah of readFileSync(berkas, "utf8").split(/\r?\n/)) {
    const baris = mentah.trim();
    if (!baris || baris.startsWith("#")) continue;
    const sama = baris.indexOf("=");
    if (sama < 1) continue;
    const kunci = baris.slice(0, sama).trim();
    let nilai = baris.slice(sama + 1).trim();
    if ((nilai.startsWith('"') && nilai.endsWith('"')) || (nilai.startsWith("'") && nilai.endsWith("'"))) nilai = nilai.slice(1, -1);
    else nilai = nilai.replace(/\s+#.*$/, "");
    if (process.env[kunci] === undefined) process.env[kunci] = nilai;
  }
}
muatEnv(resolve(AKAR, ".env"));

const baca = (nama, bawaan = "") => (process.env[nama] ?? bawaan).trim();
const API = baca("QA_API_URL", "http://localhost:3001").replace(/\/+$/, "");
const AKUN = { email: baca("QA_STUDENT_EMAIL"), password: baca("QA_STUDENT_PASSWORD") };
const periksaAudio = process.argv.includes("--audio");
const argKeluar = process.argv.find((a) => a.startsWith("--keluar="));
const FOLDER = resolve(AKAR, argKeluar ? argKeluar.slice("--keluar=".length) : "reports/konten");

if (process.argv.includes("--bantuan") || process.argv.includes("--help")) {
  console.log("Pemakaian: node content/export-konten.mjs [--audio] [--keluar=folder]\nLihat komentar di awal berkas ini dan qa/README.md.");
  process.exit(0);
}
if (!AKUN.email || !AKUN.password) {
  console.error("QA_STUDENT_EMAIL dan QA_STUDENT_PASSWORD belum diisi. Salin qa/.env.example menjadi qa/.env lalu isi nilainya.");
  process.exit(2);
}

// ---- Pengambilan data ----------------------------------------------------------------------------------------------

async function minta(metode, alamat, { token, json } = {}) {
  const res = await fetch(`${API}${alamat}`, {
    method: metode,
    headers: { accept: "application/json", ...(json ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: json ? JSON.stringify(json) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const teks = await res.text();
  let body = null;
  try {
    body = JSON.parse(teks);
  } catch {
    /* bukan JSON */
  }
  if (!res.ok) throw new Error(`${metode} ${alamat} menjawab ${res.status}: ${teks.slice(0, 160)}`);
  return body;
}

console.log(`Mengambil konten dari ${API} ...`);
const sesi = await minta("POST", "/auth/login", { json: AKUN });
const token = sesi.accessToken;
const jalur = await minta("GET", "/path", { token });
const daftarPelajaran = jalur.levels.flatMap((level) => level.units.map((unit) => ({ level: level.name, unit }))).flatMap(({ level, unit }) => unit.lessons.map((l) => ({ level, unitId: unit.id, lessonId: l.id })));

/** unitId -> { level, unit (isi lengkap dari API), pelajaran: Map(lessonId -> lesson) } */
const unitMap = new Map();
for (const { level, unitId, lessonId } of daftarPelajaran) {
  const { unit, lesson } = await minta("GET", `/lessons/${lessonId}`, { token });
  if (!unitMap.has(unitId)) unitMap.set(unitId, { level, unit, pelajaran: new Map() });
  unitMap.get(unitId).pelajaran.set(lessonId, lesson);
}
const ringkasSkenario = await minta("GET", "/scenarios", { token });
const skenario = [];
for (const s of ringkasSkenario) skenario.push(await minta("GET", `/scenarios/${s.id}`, { token }));
console.log(`  ${unitMap.size} unit, ${daftarPelajaran.length} pelajaran, ${skenario.length} skenario.`);

// ---- Pemeriksaan otomatis ------------------------------------------------------------------------------------------

const temuan = [];
const tambah = (tingkat, kode, tempat, pesan) => temuan.push({ tingkat, kode, tempat, pesan });

const kosong = (nilai) => nilai === undefined || nilai === null || String(nilai).trim() === "";
const MENCURIGAKAN = /\b(undefined|null|NaN|TODO|FIXME|XXX|lorem|ipsum)\b|\?\?\?|\{\{|\}\}|<\/?[a-z][^>]*>/i;
const KATAKANA_SETENGAH = /[｡-ﾟ]/;

function periksaTeks(tempat, label, nilai) {
  if (kosong(nilai)) return;
  const teks = String(nilai);
  if (/^\s|\s$/.test(teks)) tambah("Peringatan", "KT-06", tempat, `${label}: ada spasi di awal/akhir ("${teks.slice(0, 40)}")`);
  if (/ {2,}/.test(teks)) tambah("Peringatan", "KT-06", tempat, `${label}: ada spasi ganda ("${teks.slice(0, 40)}")`);
  if (MENCURIGAKAN.test(teks)) tambah("Peringatan", "KT-06", tempat, `${label}: teks mencurigakan/sisa pengembang ("${teks.slice(0, 60)}")`);
  if (KATAKANA_SETENGAH.test(teks)) tambah("Peringatan", "KT-06", tempat, `${label}: memuat katakana setengah-lebar ("${teks.slice(0, 40)}")`);
}

// --- Romaji vs kana (pemeriksaan longgar: hanya untuk mencurigai salah ketik) ---
const KANA = {
  あ: "a", い: "i", う: "u", え: "e", お: "o", か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko", さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to", な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no", は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo", や: "ya", ゆ: "yu", よ: "yo", ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro", わ: "wa", を: "o", ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go", ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo", だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo", ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po", ゔ: "vu",
};
const KECIL = { ゃ: "ya", ゅ: "yu", ょ: "yo" };
const VARIAN = { は: ["ha", "wa"], へ: ["he", "e"], を: ["o", "wo"] };

function katakanaKeHiragana(teks) {
  return teks.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** Semua kemungkinan bacaan romaji (untuk partikel ambigu), sudah dinormalkan. Null bila ada karakter yang tidak dikenali. */
function kanaKeRomaji(kana) {
  const teks = katakanaKeHiragana(kana);
  let hasil = [""];
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    const berikut = teks[i + 1];
    let potongan;
    if (c === "っ") {
      const depan = berikut && KANA[berikut] ? (KANA[berikut].startsWith("ch") ? "t" : KANA[berikut][0]) : "";
      potongan = [depan];
    } else if (c === "ー") {
      potongan = [""];
    } else if (berikut && KECIL[berikut] && KANA[c]) {
      const dasar = KANA[c];
      const kecil = KECIL[berikut];
      const gabung = /(shi|chi|ji)$/.test(dasar) ? dasar.slice(0, -1) + kecil.slice(1) : dasar.slice(0, -1) + kecil;
      potongan = [gabung.replace(/^(sh|ch|j)y/, "$1")];
      i += 1;
    } else if (VARIAN[c]) potongan = VARIAN[c];
    else if (KANA[c]) potongan = [KANA[c]];
    else if (/[\s。、！？!?.,・「」『』（）()〜～\-—…]/.test(c)) potongan = [""];
    else return null;
    hasil = hasil.flatMap((awal) => potongan.map((p) => awal + p)).slice(0, 16);
  }
  return hasil.map(normalkanRomaji);
}

function normalkanRomaji(teks) {
  return teks
    .toLowerCase()
    .replace(/[āâ]/g, "aa").replace(/[īî]/g, "ii").replace(/[ūû]/g, "uu").replace(/[ēê]/g, "ee").replace(/[ōô]/g, "oo")
    .replace(/[^a-z]/g, "")
    .replace(/tch/g, "cch")
    .replace(/dj/g, "j") // ぢ ditulis "dji" di sebagian sumber
    .replace(/dz/g, "z") // づ ditulis "dzu"
    .replace(/jy|zy/g, "j") // じゃ/じゅ/じょ: "ja" (Hepburn) = "jya" = "zya"
    .replace(/m(?=[bmp])/g, "n")
    .replace(/oo|ou/g, "o")
    .replace(/uu/g, "u")
    .replace(/aa/g, "a")
    .replace(/ii/g, "i")
    .replace(/ee|ei/g, "e")
    .replace(/(?<=[aeiou])wo/g, "o")
    .replace(/wo/g, "o");
}

function periksaRomaji(tempat, kana, romaji) {
  if (kosong(kana) || kosong(romaji)) return;
  const kandidat = kanaKeRomaji(kana);
  if (!kandidat) return; // ada karakter di luar kana: tidak dinilai
  const dibaca = normalkanRomaji(romaji);
  if (!kandidat.includes(dibaca)) tambah("Peringatan", "KT-11", tempat, `Romaji mungkin tidak cocok dengan kana: kana "${kana}" vs romaji "${romaji}" (cek manual)`);
}

// --- Per unit ---
for (const [unitId, { unit, pelajaran }] of unitMap) {
  const ids = new Set();
  const unikan = (daftar, jenis) => {
    for (const item of daftar) {
      const kunci = `${jenis}:${item.id}`;
      if (ids.has(kunci)) tambah("Galat", "KT-02", `${unitId}`, `ID ${jenis} ganda: ${item.id}`);
      ids.add(kunci);
    }
  };
  unikan(unit.vocab, "kosakata");
  unikan(unit.sentences, "kalimat");
  unikan(unit.lessons, "pelajaran");
  unikan(unit.grammarNotes, "catatan");

  const vocabById = new Map(unit.vocab.map((v) => [v.id, v]));
  const sentenceById = new Map(unit.sentences.map((s) => [s.id, s]));

  for (const v of unit.vocab) {
    const tempat = `${unitId} / kosakata ${v.id}`;
    if (kosong(v.surface) || kosong(v.kana) || kosong(v.romaji)) tambah("Galat", "KT-04", tempat, "Tulisan, kana, atau romaji kosong");
    if (unit.type !== "kana" && kosong(v.meaning)) tambah("Peringatan", "KT-03", tempat, `Kosakata "${v.surface}" belum punya arti Indonesia`);
    for (const [label, nilai] of [["tulisan", v.surface], ["kana", v.kana], ["romaji", v.romaji], ["arti", v.meaning]]) periksaTeks(tempat, label, nilai);
    periksaRomaji(tempat, v.kana, v.romaji);
  }
  for (const s of unit.sentences) {
    const tempat = `${unitId} / kalimat ${s.id}`;
    if (kosong(s.surface) || kosong(s.kana) || kosong(s.romaji)) tambah("Galat", "KT-04", tempat, "Tulisan, kana, atau romaji kosong");
    if (kosong(s.meaning)) tambah("Galat", "KT-04", tempat, `Kalimat "${s.surface}" tidak punya arti Indonesia`);
    if (!s.words?.length) tambah("Peringatan", "KT-04", tempat, "Kalimat tanpa pecahan kata (words)");
    for (const [label, nilai] of [["tulisan", s.surface], ["kana", s.kana], ["romaji", s.romaji], ["arti", s.meaning]]) periksaTeks(tempat, label, nilai);
    periksaRomaji(tempat, s.kana, s.romaji);
    if (s.assembleTokens?.length) {
      const gabung = s.assembleTokens.join("");
      const rapi = (t) => t.replace(/[\s。、！？!?]/g, "");
      if (rapi(gabung) !== rapi(s.surface) && rapi(gabung) !== rapi(s.kana)) {
        tambah("Peringatan", "KT-05", tempat, `Kepingan susun kalimat bila digabung ("${gabung}") tidak sama dengan tulisan kalimat ("${s.surface}")`);
      }
    }
  }
  for (const n of unit.grammarNotes) {
    const tempat = `${unitId} / catatan ${n.id}`;
    if (kosong(n.title) || kosong(n.bodyMd)) tambah("Galat", "KT-04", tempat, "Catatan tata bahasa tanpa judul atau isi");
    if (n.lessonId && !unit.lessons.some((l) => l.id === n.lessonId)) tambah("Galat", "KT-08", tempat, `Catatan menunjuk pelajaran yang tidak ada: ${n.lessonId}`);
    periksaTeks(tempat, "judul", n.title);
  }
  for (const [lessonId, lesson] of pelajaran) {
    const tempat = `${unitId} / pelajaran ${lessonId}`;
    if (!lesson.exercises.length) tambah("Galat", "KT-07", tempat, "Pelajaran tidak punya soal");
    else if (lesson.exercises.length < 5) tambah("Peringatan", "KT-07", tempat, `Pelajaran hanya punya ${lesson.exercises.length} soal`);
    for (const e of lesson.exercises) {
      if (!vocabById.has(e.ref) && !sentenceById.has(e.ref)) tambah("Galat", "KT-01", tempat, `Soal ${e.type} menunjuk "${e.ref}" yang tidak ada di kosakata/kalimat unit`);
      if (e.type === "assemble" && sentenceById.has(e.ref) && !sentenceById.get(e.ref).assembleTokens?.length && !sentenceById.get(e.ref).words?.length) {
        tambah("Galat", "KT-01", tempat, `Soal susun "${e.ref}" tidak punya kepingan kata`);
      }
    }
    if (!unit.grammarNotes.some((n) => n.lessonId === lessonId) && unit.type === "conversation") tambah("Info", "KT-07", tempat, "Pelajaran ini belum punya catatan tata bahasa yang ditautkan");
  }
}

for (const s of skenario) {
  const tempatDasar = `skenario ${s.id}`;
  const baris = s.content?.lines ?? [];
  if (!baris.length) tambah("Galat", "KT-10", tempatDasar, "Skenario tidak punya baris dialog");
  if (!(s.content?.estimatedMinutes > 0)) tambah("Peringatan", "KT-10", tempatDasar, "Perkiraan menit kosong atau nol (bonus waktu skor jadi tidak masuk akal)");
  baris.forEach((b, i) => {
    const tempat = `${tempatDasar} / baris ${i}`;
    if (b.kind === "narration") {
      if (kosong(b.jp) || kosong(b.meaning)) tambah("Galat", "KT-10", tempat, "Baris narasi tanpa teks Jepang atau arti");
      periksaTeks(tempat, "teks Jepang", b.jp);
      periksaTeks(tempat, "arti", b.meaning);
      periksaRomaji(tempat, b.jp, b.romaji);
    } else {
      const benar = b.options.filter((o) => o.correct).length;
      if (benar !== 1) tambah("Galat", "KT-10", tempat, `Baris pilihan punya ${benar} jawaban benar (harus tepat 1)`);
      if (b.options.length < 2) tambah("Galat", "KT-10", tempat, "Baris pilihan kurang dari 2 opsi");
      for (const o of b.options) {
        periksaTeks(tempat, "opsi", o.jp);
        if (!o.correct && kosong(o.feedbackId)) tambah("Peringatan", "KT-10", tempat, `Opsi salah "${o.jp}" belum punya catatan koreksi Indonesia`);
      }
    }
  });
}

// --- Audio (opsional) ---
const daftarAudio = [];
for (const [unitId, { unit }] of unitMap) {
  for (const v of unit.vocab) daftarAudio.push({ tempat: `${unitId} / kosakata ${v.id}`, url: v.audio });
  for (const s of unit.sentences) daftarAudio.push({ tempat: `${unitId} / kalimat ${s.id}`, url: s.audio });
}
const adaAudio = daftarAudio.filter((a) => !kosong(a.url)).length;
if (daftarAudio.length && adaAudio < daftarAudio.length) {
  tambah("Info", "KT-09", "audio", `${daftarAudio.length - adaAudio} dari ${daftarAudio.length} butir belum punya audio (${adaAudio} sudah ada). Wajar bila suara belum dibuat dengan perintah tts:seed.`);
}
if (periksaAudio) {
  console.log(`Memeriksa ${adaAudio} tautan audio ...`);
  const antrean = daftarAudio.filter((a) => !kosong(a.url));
  const alamat = (url) => (/^https?:\/\//.test(url) ? url : `${API}${url.startsWith("/") ? "" : "/"}${url}`);
  let indeks = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (indeks < antrean.length) {
        const butir = antrean[indeks++];
        try {
          const res = await fetch(alamat(butir.url), { method: "HEAD", signal: AbortSignal.timeout(15_000) });
          const jenis = res.headers.get("content-type") ?? "";
          if (!res.ok) tambah("Galat", "KT-09", butir.tempat, `Audio tidak bisa dibuka (${res.status}): ${butir.url}`);
          else if (!/audio|octet-stream/.test(jenis)) tambah("Galat", "KT-09", butir.tempat, `Audio bertipe ${jenis}, bukan audio: ${butir.url}`);
          else if (Number(res.headers.get("content-length") ?? 1) < 500) tambah("Peringatan", "KT-09", butir.tempat, `Berkas audio sangat kecil (kosong?): ${butir.url}`);
        } catch (galat) {
          tambah("Galat", "KT-09", butir.tempat, `Audio tidak bisa dihubungi: ${butir.url} (${galat.cause?.code ?? galat.message})`);
        }
      }
    }),
  );
}

// ---- Keluaran ------------------------------------------------------------------------------------------------------

mkdirSync(FOLDER, { recursive: true });

const csvSel = (nilai) => {
  const teks = nilai === undefined || nilai === null ? "" : String(nilai);
  return /[",\n\r;]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
};
const tulisCsv = (nama, kolom, baris) => {
  const isi = [kolom.join(","), ...baris.map((b) => b.map(csvSel).join(","))].join("\r\n");
  writeFileSync(resolve(FOLDER, nama), `﻿${isi}\r\n`, "utf8"); // BOM supaya Excel membaca UTF-8 (huruf Jepang) dengan benar
};
const KOLOM_PERIKSA = ["Hasil periksa", "Komentar"];

const barisKosakata = [];
const barisKalimat = [];
const barisCatatan = [];
const barisPelajaran = [];
for (const [unitId, { level, unit, pelajaran }] of unitMap) {
  for (const v of unit.vocab) barisKosakata.push([level, unitId, v.id, v.surface, v.kana, v.romaji, v.meaning ?? "", v.audio ? "ada" : "belum", "", ""]);
  for (const s of unit.sentences) barisKalimat.push([level, unitId, s.id, s.surface, s.kana, s.romaji, s.meaning, (s.assembleTokens ?? []).join(" | "), s.audio ? "ada" : "belum", "", ""]);
  for (const n of unit.grammarNotes) barisCatatan.push([level, unitId, n.id, n.title, n.lessonId ?? "", n.bodyMd, "", ""]);
  for (const [lessonId, lesson] of pelajaran) {
    const hitung = (jenis) => lesson.exercises.filter((e) => e.type === jenis).length;
    barisPelajaran.push([level, unitId, lessonId, lesson.title, lesson.exercises.length, hitung("choose"), hitung("assemble"), hitung("speak"), "", ""]);
  }
}
tulisCsv("kosakata.csv", ["Level", "Unit", "ID", "Tulisan", "Kana", "Romaji", "Arti", "Audio", ...KOLOM_PERIKSA], barisKosakata);
tulisCsv("kalimat.csv", ["Level", "Unit", "ID", "Tulisan", "Kana", "Romaji", "Arti", "Kepingan susun", "Audio", ...KOLOM_PERIKSA], barisKalimat);
tulisCsv("catatan-tata-bahasa.csv", ["Level", "Unit", "ID", "Judul", "Pelajaran", "Isi", ...KOLOM_PERIKSA], barisCatatan);
tulisCsv("pelajaran.csv", ["Level", "Unit", "ID", "Judul", "Jumlah soal", "Pilih", "Susun", "Ucap", ...KOLOM_PERIKSA], barisPelajaran);

const barisSkenario = [];
for (const s of skenario) {
  (s.content?.lines ?? []).forEach((b, i) => {
    if (b.kind === "narration") barisSkenario.push([s.id, s.titleJp, i + 1, "narasi", b.speaker, b.jp, b.romaji, b.meaning, "", "", "", ""]);
    else for (const o of b.options) barisSkenario.push([s.id, s.titleJp, i + 1, "pilihan", b.speaker, o.jp, "", "", o.correct ? "BENAR" : "salah", o.feedbackId ?? "", "", ""]);
  });
}
tulisCsv("skenario.csv", ["Skenario", "Judul", "Baris", "Jenis", "Pembicara", "Teks Jepang", "Romaji", "Arti", "Kunci", "Catatan koreksi", ...KOLOM_PERIKSA], barisSkenario);

const urutTingkat = { Galat: 0, Peringatan: 1, Info: 2 };
temuan.sort((a, b) => urutTingkat[a.tingkat] - urutTingkat[b.tingkat] || a.kode.localeCompare(b.kode) || a.tempat.localeCompare(b.tempat));
tulisCsv("temuan-otomatis.csv", ["Tingkat", "Kode", "Tempat", "Temuan", "Hasil periksa", "Komentar"], temuan.map((t) => [t.tingkat, t.kode, t.tempat, t.pesan, "", ""]));

const esc = (nilai) => String(nilai ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hitungTingkat = (t) => temuan.filter((x) => x.tingkat === t).length;

const bagianUnit = [...unitMap.entries()]
  .map(([unitId, { level, unit, pelajaran }]) => {
    const kv = (v) => `<tr><td>${esc(v.id)}</td><td lang="ja">${esc(v.surface)}</td><td lang="ja">${esc(v.kana)}</td><td>${esc(v.romaji)}</td><td>${esc(v.meaning ?? "")}</td><td>${v.audio ? "ada" : "belum"}</td><td class="isi"></td></tr>`;
    const ks = (s) => `<tr><td>${esc(s.id)}</td><td lang="ja">${esc(s.surface)}</td><td lang="ja">${esc(s.kana)}</td><td>${esc(s.romaji)}</td><td>${esc(s.meaning)}</td><td lang="ja">${esc((s.assembleTokens ?? []).join(" | "))}</td><td class="isi"></td></tr>`;
    const catatan = unit.grammarNotes
      .map((n) => `<div class="catatan"><h4>${esc(n.title)} <small>(${esc(n.id)}${n.lessonId ? `, pelajaran ${esc(n.lessonId)}` : ""})</small></h4><pre lang="ja">${esc(n.bodyMd)}</pre></div>`)
      .join("");
    const ps = [...pelajaran.entries()]
      .map(([id, l]) => {
        const butir = l.exercises
          .map((e) => {
            const v = unit.vocab.find((x) => x.id === e.ref);
            const s = unit.sentences.find((x) => x.id === e.ref);
            const teks = v ? `${v.surface} (${v.romaji})` : s ? `${s.surface} (${s.meaning})` : `${e.ref} (TIDAK DITEMUKAN)`;
            return `<li><b>${esc(e.type)}</b> <span lang="ja">${esc(teks)}</span></li>`;
          })
          .join("");
        return `<details><summary>${esc(id)} &mdash; ${esc(l.title)} (${l.exercises.length} soal)</summary><ol>${butir}</ol></details>`;
      })
      .join("");
    return `<section><h2>${esc(level)} &rsaquo; ${esc(unit.title)} <small>(${esc(unitId)}, ${esc(unit.type)})</small></h2><p>${esc(unit.description)}</p>
<h3>Pelajaran (${unit.lessons.length})</h3>${ps}
<h3>Catatan tata bahasa (${unit.grammarNotes.length})</h3>${catatan || "<p>Tidak ada.</p>"}
<h3>Kosakata (${unit.vocab.length})</h3><table><thead><tr><th>ID</th><th>Tulisan</th><th>Kana</th><th>Romaji</th><th>Arti</th><th>Audio</th><th>Periksa / komentar</th></tr></thead><tbody>${unit.vocab.map(kv).join("")}</tbody></table>
<h3>Kalimat (${unit.sentences.length})</h3><table><thead><tr><th>ID</th><th>Tulisan</th><th>Kana</th><th>Romaji</th><th>Arti</th><th>Kepingan susun</th><th>Periksa / komentar</th></tr></thead><tbody>${unit.sentences.map(ks).join("")}</tbody></table></section>`;
  })
  .join("\n");

const bagianSkenario = skenario
  .map((s) => {
    const baris = (s.content?.lines ?? [])
      .map((b, i) =>
        b.kind === "narration"
          ? `<li><b>${esc(b.speaker)}:</b> <span lang="ja">${esc(b.jp)}</span> <i>${esc(b.romaji)}</i> &mdash; ${esc(b.meaning)}</li>`
          : `<li><b>${esc(b.speaker)} memilih:</b><ul>${b.options.map((o) => `<li class="${o.correct ? "benar" : "salah"}"><span lang="ja">${esc(o.jp)}</span> ${o.correct ? "&#10003; benar" : `&#10007; salah${o.feedbackId ? ` &mdash; ${esc(o.feedbackId)}` : " &mdash; <em>tanpa catatan koreksi</em>"}`}</li>`).join("")}</ul></li>`,
      )
      .join("");
    return `<section><h2>Skenario: ${esc(s.titleJp)} <small>${esc(s.titleId)} (${esc(s.id)}, ${esc(s.level)})</small></h2><ol>${baris}</ol></section>`;
  })
  .join("\n");

const barisTemuan = temuan.map((t) => `<tr class="${t.tingkat.toLowerCase()}"><td>${esc(t.tingkat)}</td><td>${esc(t.kode)}</td><td>${esc(t.tempat)}</td><td>${esc(t.pesan)}</td></tr>`).join("");

writeFileSync(
  resolve(FOLDER, "konten.html"),
  `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ekspor konten untuk pemeriksaan</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:24px auto;max-width:1100px;padding:0 16px;color:#1b1b1b;line-height:1.45}
h1{margin-bottom:4px} h2{border-bottom:2px solid #1f4fd8;padding-bottom:4px;margin-top:36px} h3{margin-top:22px}
small{color:#666;font-weight:normal} table{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0} th,td{border:1px solid #bbb;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#eef2ff} td.isi{min-width:140px} pre{white-space:pre-wrap;background:#f7f7f7;padding:10px;border-radius:6px;font-family:inherit}
tr.galat td:first-child{background:#fecaca;font-weight:bold} tr.peringatan td:first-child{background:#fde68a} tr.info td:first-child{background:#dbeafe}
li.benar{color:#146c2e} li.salah{color:#9a1c1c} details{margin:4px 0} summary{cursor:pointer;font-weight:bold}
@media print{details{display:block} details>summary{display:none} h2{page-break-before:always}}
</style></head><body>
<h1>Ekspor konten untuk pemeriksaan</h1>
<p>Dibuat ${esc(new Date().toLocaleString("id-ID"))} dari ${esc(API)}. ${unitMap.size} unit, ${daftarPelajaran.length} pelajaran, ${skenario.length} skenario.
Berkas CSV dengan isi yang sama (untuk Excel) ada di folder yang sama; tambahkan hasil periksa di kolom kosongnya.</p>
<h2>Temuan otomatis: ${hitungTingkat("Galat")} galat, ${hitungTingkat("Peringatan")} peringatan, ${hitungTingkat("Info")} info</h2>
<p>Galat = pasti bermasalah (soal rusak, ID ganda). Peringatan = patut dicek manusia (mis. romaji mungkin salah ketik; pemeriksaan romaji sengaja longgar dan bisa keliru). Info = catatan saja.</p>
${temuan.length ? `<table><thead><tr><th>Tingkat</th><th>Kode</th><th>Tempat</th><th>Temuan</th></tr></thead><tbody>${barisTemuan}</tbody></table>` : "<p>Tidak ada temuan otomatis.</p>"}
${bagianUnit}
${bagianSkenario}
</body></html>`,
  "utf8",
);

writeFileSync(
  resolve(FOLDER, "ringkasan.json"),
  JSON.stringify({ waktu: new Date().toISOString(), api: API, unit: unitMap.size, pelajaran: daftarPelajaran.length, skenario: skenario.length, kosakata: barisKosakata.length, kalimat: barisKalimat.length, temuan: { galat: hitungTingkat("Galat"), peringatan: hitungTingkat("Peringatan"), info: hitungTingkat("Info") }, daftarTemuan: temuan }, null, 2),
);

console.log(`\nTemuan otomatis: ${hitungTingkat("Galat")} galat, ${hitungTingkat("Peringatan")} peringatan, ${hitungTingkat("Info")} info.`);
for (const t of temuan.filter((x) => x.tingkat === "Galat").slice(0, 15)) console.log(`  [Galat] ${t.kode} ${t.tempat}: ${t.pesan}`);
console.log(`Hasil ada di: ${FOLDER}\n  konten.html, kosakata.csv, kalimat.csv, catatan-tata-bahasa.csv, pelajaran.csv, skenario.csv, temuan-otomatis.csv, ringkasan.json`);
process.exit(hitungTingkat("Galat") > 0 ? 1 : 0);
