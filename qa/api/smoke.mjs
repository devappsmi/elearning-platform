#!/usr/bin/env node
/**
 * Uji asap (smoke test) API dan situs, tanpa browser. Cocok dijalankan tepat setelah deploy atau pembaruan server.
 *
 *   node api/smoke.mjs              pemeriksaan hanya-baca (aman kapan saja)
 *   node api/smoke.mjs --lengkap    ditambah pemeriksaan yang mengubah data uji lalu mengembalikannya
 *   node api/smoke.mjs --json=hasil.json   lokasi laporan JSON (bawaan: reports/api-smoke.json)
 *
 * Alamat dan akun dibaca dari qa/.env (lihat .env.example). Kode keluar 0 = semua lulus, 1 = ada yang gagal,
 * 2 = konfigurasi belum lengkap. Jangan dijalankan bersamaan dengan uji browser: keduanya berbagi batas 100 permintaan/menit.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---- Konfigurasi ---------------------------------------------------------------------------------------------------

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
const tanpaGaris = (nilai) => nilai.replace(/\/+$/, "");

const cfg = {
  api: tanpaGaris(baca("QA_API_URL", "http://localhost:3001")),
  murid: tanpaGaris(baca("QA_STUDENT_URL", "http://localhost:5173")),
  admin: tanpaGaris(baca("QA_ADMIN_URL", "http://localhost:5174")),
  akunMurid: { email: baca("QA_STUDENT_EMAIL"), password: baca("QA_STUDENT_PASSWORD") },
  akunMurid2: { email: baca("QA_STUDENT2_EMAIL"), password: baca("QA_STUDENT2_PASSWORD") },
  akunAdmin: { email: baca("QA_ADMIN_EMAIL"), password: baca("QA_ADMIN_PASSWORD") },
  pelajaran: baca("QA_LESSON_ID", "l1"),
  ambangMs: Number(baca("QA_LATENCY_MS", "1500")) || 1500,
};

const lengkap = process.argv.includes("--lengkap");
const argJson = process.argv.find((a) => a.startsWith("--json="));
const berkasLaporan = resolve(AKAR, argJson ? argJson.slice("--json=".length) : "reports/api-smoke.json");

if (process.argv.includes("--bantuan") || process.argv.includes("--help")) {
  console.log("Pemakaian: node api/smoke.mjs [--lengkap] [--json=berkas.json]\nLihat komentar di awal berkas ini dan qa/README.md.");
  process.exit(0);
}
if (!cfg.akunMurid.email || !cfg.akunMurid.password || !cfg.akunAdmin.email || !cfg.akunAdmin.password) {
  console.error("QA_STUDENT_EMAIL/PASSWORD dan QA_ADMIN_EMAIL/PASSWORD belum diisi. Salin qa/.env.example menjadi qa/.env lalu isi nilainya.");
  process.exit(2);
}

// ---- Alat bantu ----------------------------------------------------------------------------------------------------

const hasil = [];
const latensi = [];
let sedangDiuji = null;

class Gagal extends Error {}
class Lewati extends Error {}
const pastikan = (kondisi, pesan) => {
  if (!kondisi) throw new Gagal(pesan);
};
const lewati = (alasan) => {
  throw new Lewati(alasan);
};

/** Permintaan HTTP. Mengembalikan {status, headers, body (JSON bila bisa), teks, ms}. Tidak melempar untuk status non-2xx. */
async function minta(metode, url, { token, json, form, headers = {} } = {}) {
  const opsi = { method: metode, headers: { accept: "application/json", ...headers }, signal: AbortSignal.timeout(20_000) };
  if (token) opsi.headers.authorization = `Bearer ${token}`;
  if (json !== undefined) {
    opsi.headers["content-type"] = "application/json";
    opsi.body = JSON.stringify(json);
  }
  if (form) opsi.body = form;
  const mulai = performance.now();
  let res;
  try {
    res = await fetch(url, opsi);
  } catch (galat) {
    const sebab = galat.cause;
    throw new Gagal(`${metode} ${url} tidak bisa dihubungi: ${sebab?.code ?? sebab?.errors?.[0]?.code ?? sebab?.message ?? galat.message}`);
  }
  const teks = await res.text();
  const ms = Math.round(performance.now() - mulai);
  const label = `${metode} ${url.replace(cfg.api, "").replace(cfg.murid, "[murid]").replace(cfg.admin, "[admin]") || "/"}`.replace(/\?.*$/, "");
  latensi.push({ uji: sedangDiuji, permintaan: label, ms });
  let body = null;
  try {
    body = JSON.parse(teks);
  } catch {
    /* bukan JSON */
  }
  return { status: res.status, headers: res.headers, body, teks, ms };
}

async function uji(id, judul, fn) {
  sedangDiuji = id;
  const mulai = performance.now();
  let status = "lulus";
  let catatan = "";
  try {
    const hasilFn = await fn();
    if (typeof hasilFn === "string") catatan = hasilFn;
  } catch (galat) {
    if (galat instanceof Lewati) {
      status = "lewati";
      catatan = galat.message;
    } else {
      status = "gagal";
      catatan = galat instanceof Gagal ? galat.message : `Galat tak terduga: ${galat?.stack ?? galat}`;
    }
  }
  const ms = Math.round(performance.now() - mulai);
  hasil.push({ id, judul, status, catatan, ms });
  const tanda = status === "lulus" ? "✓" : status === "gagal" ? "✗" : "-";
  console.log(`${tanda} ${id}  ${judul}${catatan ? `\n      ${catatan}` : ""}  (${ms} ms)`);
}

const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const adaKunci = (obj, ...kunci) => obj && typeof obj === "object" && kunci.every((k) => k in obj);

// ---- Pemeriksaan ---------------------------------------------------------------------------------------------------

const sesi = { murid: null, admin: null, murid2: null };

console.log(`Uji asap API (${lengkap ? "lengkap" : "hanya-baca"})`);
console.log(`  API    : ${cfg.api}\n  Murid  : ${cfg.murid}\n  Admin  : ${cfg.admin}\n`);

await uji("TC-API-01", "Health API menjawab 200 dengan status ok", async () => {
  const r = await minta("GET", `${cfg.api}/health`);
  pastikan(r.status === 200, `GET /health menjawab ${r.status}, seharusnya 200`);
  pastikan(r.body?.status === "ok", `Isi /health bukan {"status":"ok"}: ${r.teks.slice(0, 120)}`);
});

await uji("TC-API-02", "Aplikasi murid terbuka (HTML dengan elemen root)", async () => {
  const r = await minta("GET", `${cfg.murid}/`, { headers: { accept: "text/html" } });
  pastikan(r.status === 200, `GET ${cfg.murid}/ menjawab ${r.status}`);
  pastikan(/id=["']root["']/.test(r.teks), "HTML aplikasi murid tidak memuat elemen #root (halaman kosong?)");
});

await uji("TC-API-03", "Aplikasi admin terbuka (HTML dengan elemen root)", async () => {
  const r = await minta("GET", `${cfg.admin}/`, { headers: { accept: "text/html" } });
  pastikan(r.status === 200, `GET ${cfg.admin}/ menjawab ${r.status}`);
  pastikan(/id=["']root["']/.test(r.teks), "HTML aplikasi admin tidak memuat elemen #root (halaman kosong?)");
});

await uji("TC-API-04", "Header keamanan dasar API terpasang", async () => {
  const r = await minta("GET", `${cfg.api}/health`);
  pastikan(r.headers.get("x-content-type-options") === "nosniff", "Header X-Content-Type-Options: nosniff tidak ada");
  pastikan(!r.headers.get("x-powered-by"), `Header X-Powered-By membocorkan teknologi server: ${r.headers.get("x-powered-by")}`);
  pastikan(r.headers.has("x-ratelimit-limit"), "Header batas laju (X-RateLimit-Limit) tidak ada: pembatas permintaan tidak aktif?");
  const peringatan = [];
  if (cfg.api.startsWith("https://") && !r.headers.get("strict-transport-security")) peringatan.push("HSTS belum ada");
  return peringatan.length ? `Catatan: ${peringatan.join("; ")}` : "";
});

await uji("TC-API-05", "Jam server tidak melenceng lebih dari 5 menit dari komputer ini", async () => {
  const r = await minta("GET", `${cfg.api}/health`);
  const tanggal = r.headers.get("date");
  if (!tanggal) lewati("Server tidak mengirim header Date.");
  const selisih = Math.abs(Date.now() - new Date(tanggal).getTime()) / 1000;
  pastikan(selisih <= 300, `Selisih jam server dengan komputer ini ${Math.round(selisih)} detik (token login bisa dianggap kedaluwarsa)`);
  return `selisih ${Math.round(selisih)} detik`;
});

await uji("TC-API-06", "Login murid memberi access token dan refresh token", async () => {
  const r = await minta("POST", `${cfg.api}/auth/login`, { json: cfg.akunMurid });
  pastikan([200, 201].includes(r.status), `POST /auth/login menjawab ${r.status}: ${r.teks.slice(0, 160)}`);
  pastikan(adaKunci(r.body, "accessToken", "refreshToken"), "Jawaban login tidak memuat accessToken dan refreshToken");
  sesi.murid = r.body;
});

await uji("TC-API-07", "Login salah ditolak 401 dan pesannya sama untuk email yang tidak dikenal", async () => {
  const asing = `qa-tidak-ada-${Date.now()}@example.com`;
  const r = await minta("POST", `${cfg.api}/auth/login`, { json: { email: asing, password: "PasswordSalah123" } });
  pastikan(r.status === 401, `Login email tak dikenal menjawab ${r.status}, seharusnya 401`);
  pastikan(/salah/i.test(r.body?.message ?? ""), `Pesan galat tidak jelas: ${r.teks.slice(0, 120)}`);
});

await uji("TC-API-08", "Rute murid tanpa token ditolak 401", async () => {
  const rute = ["/me", "/path", `/lessons/${cfg.pelajaran}`, "/scenarios", "/dictionary?q=a", "/flashcards/due", "/leaderboard", "/tutor/quota"];
  const bocor = [];
  for (const alamat of rute) {
    const r = await minta("GET", `${cfg.api}${alamat}`);
    if (r.status !== 401) bocor.push(`${alamat} -> ${r.status}`);
  }
  pastikan(bocor.length === 0, `Rute ini seharusnya 401 tanpa token: ${bocor.join(", ")}`);
});

await uji("TC-API-09", "GET /me mengembalikan akun murid uji", async () => {
  if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
  const r = await minta("GET", `${cfg.api}/me`, { token: sesi.murid.accessToken });
  pastikan(r.status === 200, `GET /me menjawab ${r.status}`);
  pastikan(r.body?.email === cfg.akunMurid.email.toLowerCase(), `Email di /me (${r.body?.email}) tidak sama dengan akun uji`);
  pastikan(adaKunci(r.body, "name", "className", "dailyXpGoal", "status"), "Jawaban /me kehilangan field (name/className/dailyXpGoal/status)");
  pastikan(r.body.status === "ACTIVE", `Status akun uji ${r.body.status}, seharusnya ACTIVE`);
});

await uji("TC-API-10", "GET /path berisi level, unit, dan pelajaran uji", async () => {
  if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
  const r = await minta("GET", `${cfg.api}/path`, { token: sesi.murid.accessToken });
  pastikan(r.status === 200, `GET /path menjawab ${r.status}`);
  pastikan(Array.isArray(r.body?.levels) && r.body.levels.length > 0, "Jalur belajar tidak memuat level (konten belum di-seed?)");
  const pelajaran = r.body.levels.flatMap((l) => l.units).flatMap((u) => u.lessons);
  pastikan(pelajaran.some((p) => p.id === cfg.pelajaran), `Pelajaran uji "${cfg.pelajaran}" tidak ada di jalur belajar`);
  pastikan(adaKunci(r.body, "streak"), "Jawaban /path tidak memuat streak");
  return `${r.body.levels.length} level, ${pelajaran.length} pelajaran`;
});

await uji("TC-API-11", "GET /lessons/{id} berisi unit dan soal pelajaran", async () => {
  if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
  const r = await minta("GET", `${cfg.api}/lessons/${cfg.pelajaran}`, { token: sesi.murid.accessToken });
  pastikan(r.status === 200, `GET /lessons/${cfg.pelajaran} menjawab ${r.status}`);
  pastikan(adaKunci(r.body, "unit", "lesson"), "Jawaban tidak memuat unit dan lesson");
  const soal = r.body.lesson?.exercises ?? r.body.lesson?.items ?? [];
  pastikan(Array.isArray(soal) ? soal.length > 0 : Object.keys(r.body.lesson).length > 3, "Pelajaran tidak memuat soal");
});

await uji("TC-API-12", "Daftar skenario percakapan dan detailnya", async () => {
  if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
  const daftar = await minta("GET", `${cfg.api}/scenarios`, { token: sesi.murid.accessToken });
  pastikan(daftar.status === 200 && Array.isArray(daftar.body), `GET /scenarios menjawab ${daftar.status}`);
  pastikan(daftar.body.length > 0, "Belum ada skenario percakapan yang terbit");
  const detail = await minta("GET", `${cfg.api}/scenarios/${daftar.body[0].id}`, { token: sesi.murid.accessToken });
  pastikan(detail.status === 200, `GET /scenarios/${daftar.body[0].id} menjawab ${detail.status}`);
  pastikan(Array.isArray(detail.body?.content?.lines) && detail.body.content.lines.length > 0, "Detail skenario tidak memuat baris dialog");
  return `${daftar.body.length} skenario`;
});

await uji("TC-API-13", "Kamus mencari kata dan menolak pencarian kosong", async () => {
  if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
  const r = await minta("GET", `${cfg.api}/dictionary?q=a`, { token: sesi.murid.accessToken });
  pastikan(r.status === 200 && Array.isArray(r.body), `GET /dictionary?q=a menjawab ${r.status}`);
  pastikan(r.body.length > 0, "Pencarian 'a' tidak menemukan apa pun (kamus kosong?)");
  pastikan(adaKunci(r.body[0], "surface", "reading", "romaji", "meaning"), "Entri kamus kehilangan field");
  const kosong = await minta("GET", `${cfg.api}/dictionary?q=`, { token: sesi.murid.accessToken });
  pastikan(kosong.status === 400, `Pencarian kosong menjawab ${kosong.status}, seharusnya 400`);
  return `${r.body.length} hasil untuk 'a'`;
});

await uji("TC-API-14", "Kartu flashcard jatuh tempo dapat dibaca", async () => {
  if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
  const r = await minta("GET", `${cfg.api}/flashcards/due`, { token: sesi.murid.accessToken });
  pastikan(r.status === 200 && Array.isArray(r.body), `GET /flashcards/due menjawab ${r.status}`);
  return `${r.body.length} kartu jatuh tempo`;
});

await uji("TC-API-15", "Leaderboard mingguan dapat dibaca dan dimulai hari Senin", async () => {
  if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
  const r = await minta("GET", `${cfg.api}/leaderboard`, { token: sesi.murid.accessToken });
  pastikan(r.status === 200 && adaKunci(r.body, "weekOf", "entries"), `GET /leaderboard menjawab ${r.status} tanpa weekOf/entries`);
  pastikan(Array.isArray(r.body.entries), "entries bukan daftar");
  const hari = new Date(`${r.body.weekOf}T00:00:00Z`).getUTCDay();
  pastikan(hari === 1, `Awal minggu ${r.body.weekOf} bukan hari Senin`);
  for (let i = 1; i < r.body.entries.length; i++) pastikan(r.body.entries[i - 1].xp >= r.body.entries[i].xp, "Urutan XP di leaderboard tidak menurun");
  return `${r.body.entries.length} murid di peringkat`;
});

await uji("TC-API-16", "Katalog dan jatah Ngobrol dengan AI dapat dibaca", async () => {
  if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
  const katalog = await minta("GET", `${cfg.api}/tutor/scenarios`, { token: sesi.murid.accessToken });
  pastikan(katalog.status === 200 && katalog.body?.scenarios?.length > 0 && katalog.body?.characters?.length > 0, `GET /tutor/scenarios menjawab ${katalog.status} tanpa situasi/karakter`);
  const jatah = await minta("GET", `${cfg.api}/tutor/quota`, { token: sesi.murid.accessToken });
  pastikan(jatah.status === 200 && adaKunci(jatah.body, "limit", "used", "remaining", "resetsAt"), `GET /tutor/quota menjawab ${jatah.status} tanpa limit/used/remaining/resetsAt`);
  pastikan(jatah.body.used + jatah.body.remaining === jatah.body.limit, "used + remaining tidak sama dengan limit");
  return `jatah ${jatah.body.remaining}/${jatah.body.limit}`;
});

await uji("TC-API-17", "Login admin memberi token dan /admin/auth/me benar", async () => {
  const r = await minta("POST", `${cfg.api}/admin/auth/login`, { json: cfg.akunAdmin });
  pastikan([200, 201].includes(r.status), `POST /admin/auth/login menjawab ${r.status}: ${r.teks.slice(0, 160)}`);
  pastikan(adaKunci(r.body, "accessToken", "refreshToken"), "Jawaban login admin tidak memuat token");
  sesi.admin = r.body;
  const saya = await minta("GET", `${cfg.api}/admin/auth/me`, { token: sesi.admin.accessToken });
  pastikan(saya.status === 200 && saya.body?.email === cfg.akunAdmin.email.toLowerCase(), `GET /admin/auth/me menjawab ${saya.status} / email berbeda`);
});

await uji("TC-API-18", "Endpoint admin: dashboard, kelas, murid, undangan", async () => {
  if (!sesi.admin) lewati("Login admin gagal (TC-API-17).");
  const ringkas = [];
  for (const alamat of ["/admin/dashboard", "/admin/classes", "/admin/students", "/admin/invitations"]) {
    const r = await minta("GET", `${cfg.api}${alamat}`, { token: sesi.admin.accessToken });
    pastikan(r.status === 200, `GET ${alamat} menjawab ${r.status}`);
    ringkas.push(`${alamat.replace("/admin/", "")}=${Array.isArray(r.body) ? r.body.length : "ok"}`);
  }
  const dash = await minta("GET", `${cfg.api}/admin/dashboard`, { token: sesi.admin.accessToken });
  pastikan(adaKunci(dash.body, "activeStudentsThisWeek", "totalActiveStudents", "averageXp", "streakDistribution"), "Dashboard kehilangan field ringkasan");
  return ringkas.join(", ");
});

await uji("TC-API-19", "Pemisahan hak akses: token murid ditolak di rute admin dan token admin ditolak di rute murid", async () => {
  if (!sesi.murid || !sesi.admin) lewati("Login murid/admin gagal.");
  const salah = [];
  for (const alamat of ["/admin/dashboard", "/admin/students", "/admin/classes"]) {
    const r = await minta("GET", `${cfg.api}${alamat}`, { token: sesi.murid.accessToken });
    if (![401, 403].includes(r.status)) salah.push(`token murid di ${alamat} -> ${r.status}`);
  }
  for (const alamat of ["/me", "/path"]) {
    const r = await minta("GET", `${cfg.api}${alamat}`, { token: sesi.admin.accessToken });
    if (![401, 403].includes(r.status)) salah.push(`token admin di ${alamat} -> ${r.status}`);
  }
  const tanpa = await minta("GET", `${cfg.api}/admin/dashboard`);
  if (tanpa.status !== 401) salah.push(`tanpa token di /admin/dashboard -> ${tanpa.status}`);
  pastikan(salah.length === 0, `Akses lintas peran seharusnya ditolak: ${salah.join("; ")}`);
});

await uji("TC-API-20", `Waktu respons tiap permintaan di bawah ${cfg.ambangMs} ms`, async () => {
  const lambat = latensi.filter((l) => l.ms > cfg.ambangMs);
  const urut = [...latensi].map((l) => l.ms).sort((a, b) => a - b);
  const p = (q) => urut[Math.min(urut.length - 1, Math.floor(q * urut.length))] ?? 0;
  const ringkasan = `${latensi.length} permintaan, median ${p(0.5)} ms, p95 ${p(0.95)} ms, terlama ${urut.at(-1) ?? 0} ms`;
  pastikan(lambat.length === 0, `${lambat.length} permintaan melewati ${cfg.ambangMs} ms: ${lambat.map((l) => `${l.permintaan} ${l.ms}ms`).slice(0, 5).join(", ")}. ${ringkasan}`);
  return ringkasan;
});

// ---- Pemeriksaan lengkap (mengubah data uji lalu mengembalikannya) ------------------------------------------------

if (lengkap) {
  await uji("TC-API-21", "PATCH /me menolak target XP tidak sah dan menyimpan target sah (lalu dikembalikan)", async () => {
    if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
    const t = sesi.murid.accessToken;
    const awal = (await minta("GET", `${cfg.api}/me`, { token: t })).body;
    const tidakSah = await minta("PATCH", `${cfg.api}/me`, { token: t, json: { dailyXpGoal: 25 } });
    pastikan(tidakSah.status === 400, `Target 25 XP menjawab ${tidakSah.status}, seharusnya 400`);
    const nama = await minta("PATCH", `${cfg.api}/me`, { token: t, json: { name: "   " } });
    pastikan(nama.status === 400, `Nama hanya spasi menjawab ${nama.status}, seharusnya 400`);
    const baru = awal.dailyXpGoal === 50 ? 10 : 50;
    try {
      const ubah = await minta("PATCH", `${cfg.api}/me`, { token: t, json: { dailyXpGoal: baru } });
      pastikan(ubah.status === 200 && ubah.body?.dailyXpGoal === baru, `Menyimpan target ${baru} gagal (${ubah.status})`);
      const baca = await minta("GET", `${cfg.api}/me`, { token: t });
      pastikan(baca.body?.dailyXpGoal === baru, "Target baru tidak bertahan saat dibaca ulang");
    } finally {
      await minta("PATCH", `${cfg.api}/me`, { token: t, json: { dailyXpGoal: awal.dailyXpGoal } });
    }
  });

  await uji("TC-API-22", "Pengiriman hasil pelajaran: payload kosong ditolak 400, pelajaran terkunci ditolak 403", async () => {
    if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
    const t = sesi.murid.accessToken;
    const kosong = await minta("POST", `${cfg.api}/lessons/${cfg.pelajaran}/attempts`, { token: t, json: { answers: [] } });
    pastikan([400, 403].includes(kosong.status), `Hasil tanpa jawaban menjawab ${kosong.status}, seharusnya 400 (bukan 200/500)`);
    const tanpaBody = await minta("POST", `${cfg.api}/lessons/${cfg.pelajaran}/attempts`, { token: t, json: {} });
    pastikan(tanpaBody.status === 400, `Badan tanpa answers menjawab ${tanpaBody.status}, seharusnya 400`);
    const path = await minta("GET", `${cfg.api}/path`, { token: t });
    const terkunci = path.body?.levels?.flatMap((l) => l.units).flatMap((u) => u.lessons).find((p) => p.state === "locked");
    if (!terkunci) return "Tidak ada pelajaran terkunci di akun ini; pemeriksaan 403 dilewati.";
    const ditolak = await minta("POST", `${cfg.api}/lessons/${terkunci.id}/attempts`, { token: t, json: { answers: [] } });
    pastikan([400, 403].includes(ditolak.status), `Hasil pelajaran terkunci (${terkunci.id}) menjawab ${ditolak.status}, seharusnya 403`);
    return `pelajaran terkunci diuji: ${terkunci.id} -> ${ditolak.status}`;
  });

  await uji("TC-API-23", "Validasi input: email login salah format dan badan kosong ditolak 400", async () => {
    const a = await minta("POST", `${cfg.api}/auth/login`, { json: { email: "bukan-email", password: "x" } });
    pastikan(a.status === 400, `Email berformat salah menjawab ${a.status}, seharusnya 400`);
    const b = await minta("POST", `${cfg.api}/auth/login`, { json: {} });
    pastikan(b.status === 400, `Badan kosong menjawab ${b.status}, seharusnya 400`);
    const c = await minta("POST", `${cfg.api}/auth/login`, { headers: { "content-type": "application/json" }, form: "{bukan json" });
    pastikan(c.status === 400, `JSON rusak menjawab ${c.status}, seharusnya 400 (bukan 500)`);
  });

  await uji("TC-API-24", "Lupa password: jawaban sama untuk email terdaftar dan tidak terdaftar", async () => {
    const asing = await minta("POST", `${cfg.api}/auth/forgot`, { json: { email: `qa-tidak-ada-${Date.now()}@example.com` } });
    pastikan(asing.status === 200 || asing.status === 201, `Email tak dikenal menjawab ${asing.status}`);
    const terdaftar = await minta("POST", `${cfg.api}/auth/forgot`, { json: { email: cfg.akunMurid2.email || `qa-tidak-ada-${Date.now() + 1}@example.com` } });
    pastikan(terdaftar.status === asing.status, `Status berbeda untuk email terdaftar (${terdaftar.status}) dan tidak (${asing.status}): membocorkan siapa yang terdaftar`);
    pastikan(sama(terdaftar.body, asing.body), "Isi jawaban berbeda untuk email terdaftar dan tidak: membocorkan siapa yang terdaftar");
  });

  await uji("TC-API-25", "Refresh token berputar, dan pemakaian ulang token lama ditolak (memakai murid uji kedua)", async () => {
    if (!cfg.akunMurid2.email) lewati("QA_STUDENT2_EMAIL belum diisi (pemakaian ulang token mencabut seluruh sesi akun, jadi tidak dites pada murid uji utama).");
    const masuk = await minta("POST", `${cfg.api}/auth/login`, { json: cfg.akunMurid2 });
    pastikan([200, 201].includes(masuk.status), `Login murid uji kedua gagal (${masuk.status})`);
    const lama = masuk.body.refreshToken;
    const putar = await minta("POST", `${cfg.api}/auth/refresh`, { json: { refreshToken: lama } });
    pastikan([200, 201].includes(putar.status) && adaKunci(putar.body, "accessToken", "refreshToken"), `Refresh menjawab ${putar.status}`);
    pastikan(putar.body.refreshToken !== lama, "Refresh token tidak berganti setelah dipakai");
    const ulang = await minta("POST", `${cfg.api}/auth/refresh`, { json: { refreshToken: lama } });
    pastikan(ulang.status === 401, `Token lama dipakai ulang menjawab ${ulang.status}, seharusnya 401`);
    const turunan = await minta("POST", `${cfg.api}/auth/refresh`, { json: { refreshToken: putar.body.refreshToken } });
    pastikan(turunan.status === 401, `Setelah pemakaian ulang, token turunannya seharusnya ikut dicabut (menjawab ${turunan.status})`);
  });

  await uji("TC-API-26", "Ngobrol dengan AI: permintaan tidak sah ditolak 400/415 tanpa memakai jatah", async () => {
    if (!sesi.murid) lewati("Login murid gagal (TC-API-06).");
    const t = sesi.murid.accessToken;
    const sebelum = (await minta("GET", `${cfg.api}/tutor/quota`, { token: t })).body;
    const a = await minta("POST", `${cfg.api}/tutor/reply`, { token: t, json: { scenarioId: "tidak-ada", history: [{ role: "user", text: "こんにちは" }] } });
    pastikan(a.status === 400, `Situasi tak dikenal menjawab ${a.status}, seharusnya 400`);
    const b = await minta("POST", `${cfg.api}/tutor/reply`, { token: t, json: { scenarioId: "perkenalan", history: [{ role: "assistant", text: "はい" }] } });
    pastikan(b.status === 400, `Riwayat yang diakhiri giliran AI menjawab ${b.status}, seharusnya 400`);
    const c = await minta("POST", `${cfg.api}/tutor/reply`, { token: t, json: { scenarioId: "perkenalan", history: [{ role: "user", text: "あ".repeat(501) }] } });
    pastikan(c.status === 400, `Pesan 501 karakter menjawab ${c.status}, seharusnya 400`);
    const form = new FormData();
    form.append("file", new Blob(["bukan audio"], { type: "text/plain" }), "x.txt");
    const d = await minta("POST", `${cfg.api}/tutor/transcribe`, { token: t, form });
    pastikan([400, 415].includes(d.status), `Unggahan bukan audio menjawab ${d.status}, seharusnya 415/400`);
    const sesudah = (await minta("GET", `${cfg.api}/tutor/quota`, { token: t })).body;
    pastikan(sesudah.used === sebelum.used, `Jatah berkurang (${sebelum.used} -> ${sesudah.used}) padahal semua permintaan tidak sah`);
  });
}

// ---- Laporan -------------------------------------------------------------------------------------------------------

const jumlah = (status) => hasil.filter((h) => h.status === status).length;
console.log(`\nRingkasan: ${jumlah("lulus")} lulus, ${jumlah("gagal")} gagal, ${jumlah("lewati")} dilewati dari ${hasil.length} pemeriksaan.`);

mkdirSync(dirname(berkasLaporan), { recursive: true });
writeFileSync(
  berkasLaporan,
  JSON.stringify(
    { waktu: new Date().toISOString(), mode: lengkap ? "lengkap" : "hanya-baca", alamat: { api: cfg.api, murid: cfg.murid, admin: cfg.admin }, ringkasan: { lulus: jumlah("lulus"), gagal: jumlah("gagal"), dilewati: jumlah("lewati") }, hasil, latensi },
    null,
    2,
  ),
);
console.log(`Laporan JSON: ${berkasLaporan}`);
process.exit(jumlah("gagal") > 0 ? 1 : 0);
