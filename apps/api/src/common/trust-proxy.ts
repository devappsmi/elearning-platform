/** Nilai `trust proxy` Express dari env `TRUST_PROXY` -- menentukan dari mana
 * `req.ip` dibaca, dan `req.ip` adalah kunci pembatas per-IP (ThrottlerGuard:
 * login, `/auth/forgot`, permintaan undangan ulang).
 *
 * - kosong / "0" / "false" -> `false`: tidak ada proxy, `req.ip` = alamat socket
 *   (dev lokal).
 * - bilangan bulat N -> N: percaya N hop proxy terdekat (mis. 1 = satu load
 *   balancer/Nginx di depan API).
 * - string lain -> diteruskan apa adanya ke Express (daftar subnet, mis.
 *   "loopback, 10.0.0.0/8"); alamat yang tidak valid membuat boot gagal, bukan
 *   diam-diam tak berfungsi.
 *
 * Tanpa setelan ini di belakang reverse proxy, SEMUA klien tampak berasal dari IP
 * proxy: pembatas per-IP menjadi SATU jatah bersama untuk seluruh pengguna (mis.
 * 30 permintaan lupa-password per jam untuk seluruh lembaga). "true" DITOLAK:
 * itu mempercayai setiap header `X-Forwarded-For`, yang bisa dipalsukan klien
 * untuk melewati semua pembatas. */
export function parseTrustProxy(value: string | undefined): false | number | string {
  const raw = (value ?? "").trim();
  if (raw === "" || raw === "0" || raw.toLowerCase() === "false") return false;
  if (raw.toLowerCase() === "true") {
    throw new Error(
      'TRUST_PROXY="true" mempercayai semua header X-Forwarded-For (bisa dipalsukan klien untuk melewati pembatas per-IP). ' +
        "Isi jumlah proxy tepercaya (mis. 1) atau daftar subnet (mis. \"loopback, 10.0.0.0/8\").",
    );
  }
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}
