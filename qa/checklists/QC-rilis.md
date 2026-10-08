# Daftar periksa QC sebelum rilis

> Berkas ini dibuat otomatis oleh `manual/build_workbook.py` dari daftar yang sama dengan lembar **QC Rilis** di `manual/Buku-Kasus-Uji-QA.xlsx`. Jangan diedit tangan: ubah daftarnya di skrip lalu jalankan ulang.
> Item **Wajib** harus lulus (atau tidak berlaku dengan alasan tertulis) sebelum rilis. Hitungan otomatisnya ada di lembar Ringkasan buku Excel.

Rilis / versi: ____________________   Tanggal: ____________   Penguji utama: ____________________   Penyetuju: ____________________


## Lingkungan dan rilis

- [ ] 1. Versi (commit) yang diuji tercatat di lembar Lingkungan dan sama dengan yang akan dirilis (**Wajib**) _(rujukan: git rev-parse --short HEAD)_
- [ ] 2. Migrasi database berhasil dijalankan tanpa galat dan tidak ada perubahan skema yang belum dimigrasi (**Wajib**) _(rujukan: docs/DEPLOY.md; CI memeriksa migrasi)_
- [ ] 3. Seluruh variabel lingkungan wajib terisi dan rahasia kuat (JWT, database, CORS_ORIGIN_*), tidak memakai contoh bawaan (**Wajib**) _(rujukan: docs/DEPLOY.md bagian konfigurasi)_
- [ ] 4. HTTPS aktif, HTTP dialihkan, sertifikat sah (**Wajib**) _(rujukan: TC-NF-01)_
- [ ] 5. Jam server benar dan zona waktu (TZ) sesuai kebutuhan (**Wajib**) _(rujukan: TC-API-05, TC-NF-15)_
- [ ] 6. Cadangan database terbaru ada dan pernah berhasil dipulihkan di lingkungan uji (**Wajib**) _(rujukan: TC-NF-14)_
- [ ] 7. Alamat di tautan undangan dan reset password menunjuk ke aplikasi murid yang benar (**Wajib**) _(rujukan: TC-AD-30)_

## Pengujian

- [ ] 8. Semua kasus uji prioritas P1 sudah dijalankan dan lulus (tidak ada Gagal atau Belum diuji) (**Wajib**) _(rujukan: Lembar Ringkasan (otomatis))_
- [ ] 9. Tidak ada bug Kritis atau Tinggi yang masih terbuka (**Wajib**) _(rujukan: Lembar Ringkasan (otomatis))_
- [ ] 10. Uji asap API lulus penuh (npm run test:api, dan --lengkap di lingkungan uji) (**Wajib**) _(rujukan: TC-API-01 sampai TC-API-26)_
- [ ] 11. Uji browser otomatis lulus tanpa kegagalan baru (npm test) (**Wajib**) _(rujukan: qa/README.md)_
- [ ] 12. Pemindaian aksesibilitas otomatis tidak melaporkan pelanggaran serius/kritis baru (**Wajib**) _(rujukan: TC-AX-01 sampai TC-AX-03)_

## Alur inti manual

- [ ] 13. Undangan dibuat admin, murid mendaftar, lulus pelajaran pertama, XP dan Leaderboard benar (**Wajib**) _(rujukan: TC-AK-01, TC-PL-10, TC-NL-02, TC-AD-14)_
- [ ] 14. Lupa password sampai bisa masuk dengan password baru (**Wajib**) _(rujukan: TC-AK-18)_
- [ ] 15. Percakapan skenario mode Latihan dan Tes, termasuk XP satu kali (**Wajib**) _(rujukan: TC-PC-04 sampai TC-PC-08)_
- [ ] 16. Ngobrol dengan AI: kirim pesan, jatah berkurang, pesan galat jelas bila AI mati atau jatah habis (pilihan) _(rujukan: TC-AI-09, TC-AI-14, TC-AI-15 (hanya bila AI dipakai di rilis ini))_
- [ ] 17. Admin: kelas, undangan, murid, pindah kelas, nonaktifkan/aktifkan (**Wajib**) _(rujukan: TC-AD-10 sampai TC-AD-28)_

## Keamanan

- [ ] 18. Pemisahan hak akses murid/admin, field terlarang ditolak, data pribadi tidak bocor (**Wajib**) _(rujukan: TC-API-19, TC-NF-06 sampai TC-NF-08)_
- [ ] 19. Dokumentasi API tidak terbuka ke publik; CORS hanya untuk asal resmi; header keamanan terpasang (**Wajib**) _(rujukan: TC-NF-02 sampai TC-NF-04)_
- [ ] 20. Pembatas permintaan aktif dan pengguna di jaringan bersama tidak terkunci sia-sia (**Wajib**) _(rujukan: TC-NF-05)_
- [ ] 21. Keputusan atas temuan awal: Keluar tidak mencabut sesi, murid nonaktif tetap punya sesi, XP Tes pada percobaan gagal (**Wajib**) _(rujukan: Lembar Temuan Awal; TC-AK-24, TC-AD-27, TC-PC-08)_

## Email

- [ ] 22. Keputusan pengiriman email undangan dan reset password (disambungkan, atau tautan disalin dari log dengan prosedur tertulis) (**Wajib**) _(rujukan: TC-AK-31)_

## Konten

- [ ] 23. Pengajar sudah meninjau isi Hiragana, Unit 3, dan skenario (berkas reports/konten); temuan konten tercatat (**Wajib**) _(rujukan: TC-KT-01 sampai TC-KT-04)_
- [ ] 24. npm run konten tidak melaporkan temuan tingkat Galat (**Wajib**) _(rujukan: TC-KT-01)_
- [ ] 25. Audio sudah dibuat dan diperiksa (bila suara dipakai di rilis ini) (pilihan) _(rujukan: TC-KT-07)_

## Perangkat

- [ ] 26. Alur inti lulus di Chrome desktop, Android Chrome, dan iPhone Safari (**Wajib**) _(rujukan: Lembar Perangkat; TC-RS-08, TC-RS-09)_
- [ ] 27. Tampilan ponsel dan layar sempit diperiksa tanpa gulir ke samping (pilihan) _(rujukan: TC-RS-01 sampai TC-RS-11)_

## Kinerja

- [ ] 28. Beranda termuat wajar di jaringan seluler dan beban ringan tidak menimbulkan galat (pilihan) _(rujukan: TC-NF-10, TC-NF-11)_

## Dokumentasi

- [ ] 29. Catatan rilis, daftar bug terbuka yang diketahui, dan perubahan penting sudah ditulis dan dibagikan (**Wajib**)
- [ ] 30. Panduan pengguna/admin dan docs/DEPLOY.md sesuai dengan versi yang dirilis (pilihan) _(rujukan: docs/DEPLOY.md, README.md)_

## Keputusan akhir

- [ ] Layak rilis
- [ ] Layak dengan catatan: ______________________________________
- [ ] Tidak layak: ______________________________________
