# Templat laporan bug

Salin templat ini ke tiket (GitHub Issues, Jira, WhatsApp, atau email) lalu isi. Satu laporan = satu masalah.
Di buku kasus uji, catat juga bug yang sama di lembar **Log Bug** dan tulis ID bug-nya di kasus uji terkait.

---

**Judul** (satu kalimat: apa yang rusak, di mana)
> Contoh: Layar hasil pelajaran 1 menampilkan 2 bintang padahal tidak ada jawaban salah

**ID kasus uji**: TC-XXX-NN _(kosongkan bila ditemukan di luar kasus uji)_

**Aplikasi**: Murid / Admin / API / Konten

**Keparahan**: Kritis / Tinggi / Sedang / Rendah
- Kritis: aplikasi tidak bisa dipakai, data hilang atau bocor, murid tidak bisa belajar.
- Tinggi: fitur utama rusak atau hasil salah (nilai, XP) tanpa jalan pintas.
- Sedang: fitur tidak sesuai harapan tetapi ada jalan pintas, atau berdampak ke sedikit pengguna.
- Rendah: kosmetik, salah ketik, gangguan kecil.

**Seberapa sering**: Selalu / Kadang-kadang (sekitar ... dari ... percobaan) / Sekali saja

**Lingkungan**
- Alamat aplikasi: https://...
- Versi (commit) atau tanggal deploy:
- Akun yang dipakai (email saja, jangan tulis password):
- Perangkat dan sistem operasi:
- Browser dan versinya:

**Langkah mereproduksi** (dari keadaan awal yang jelas)
1.
2.
3.

**Hasil yang seharusnya**

**Hasil yang terjadi**
_(salin pesan galat persis seperti tampil di layar)_

**Lampiran**
- [ ] Tangkapan layar (tampilkan seluruh layar termasuk alamat di bilah browser)
- [ ] Rekaman layar singkat bila terkait gerakan atau urutan
- [ ] Untuk uji otomatis yang gagal: berkas `reports/artefak/<nama-uji>/trace.zip` (buka dengan `npx playwright show-trace <berkas>`)
- [ ] Pesan di tab Console browser (F12 > Console) dan permintaan yang gagal di tab Network
- [ ] Potongan log server (`docker compose logs --no-color api | tail -100`) bila terkait server

**Catatan tambahan** (dugaan penyebab, jalan pintas, apakah terjadi juga di akun/perangkat lain)

---

## Tips menulis laporan yang cepat diperbaiki
- Jelaskan **apa yang Anda lihat**, bukan dugaan penyebabnya (taruh dugaan di Catatan tambahan).
- Cobalah mengulang dua kali; bila hanya terjadi sekali, tulis "sekali saja".
- Sebut jam kejadian (agar tim bisa mencari di log server).
- Jangan melampirkan password, token, atau data pribadi murid sungguhan. Tutup/blur bagian itu di tangkapan layar.
- Satu laporan satu masalah; bila menemukan dua masalah, buat dua laporan.
