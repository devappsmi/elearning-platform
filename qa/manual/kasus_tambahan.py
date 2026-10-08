"""Kasus uji tambahan: email otomatis, checkpoint, fitur yang belum ada, dan alat impor konten."""
from kasus_dasar import A_AK, A_BT, A_KT, A_PL, K, LOG_TAUTAN

KASUS = [
    K("TC-AK-31", A_AK, "Semua", "P1", "Email undangan dan reset password belum terkirim otomatis: tautan hanya ada di log server",
      "Akses ke log API (docker compose logs api) dan sebuah kotak email uji.",
      ["Admin membuat undangan untuk email uji, lalu minta tautan reset password untuk murid uji.",
       "Periksa kotak masuk email penerima (juga folder spam).",
       "Periksa log API: cari baris yang diawali \"[STUB]\"."],
      "Kondisi saat ini (sudah diketahui): TIDAK ada email yang masuk; di log tercatat \"[STUB] Undangan ke ... <tautan>\" dan \"[STUB] Reset password ke ... <tautan>\". "
      "Sebelum dipakai murid sungguhan, tim harus memutuskan: menyambungkan penyedia email, atau menyalin tautan dari log lalu mengirimnya secara manual.",
      "AK-10, UD-01, UD-03, AK-06", "Temuan diketahui, bukan bug baru. Item terkait ada di lembar QC Rilis. " + LOG_TAUTAN),
    K("TC-PL-21", A_PL, "Murid", "P3", "Pelajaran checkpoint (bila ada di data)",
      "Data berisi pelajaran bertanda checkpoint (saat kit ini dibuat belum ada).",
      ["Cari bulatan pelajaran berikon piala di Beranda.", "Lulus pelajaran itu untuk pertama kali dan baca XP di layar hasil."],
      "Bulatan checkpoint tampil lebih besar dengan ikon piala dan memberi 50 XP pada kelulusan pertama (berapa pun bintangnya). Bila data tidak punya checkpoint, kasus ini dilewati.",
      "PL-07, NL-03", "Belum teruji dengan materi sungguhan (dokumen fitur PL-07: Sebagian)."),
    K("TC-BT-01", A_BT, "Murid", "P2", "Fitur yang belum dibangun tidak tampil atau menjanjikan sesuatu",
      "Sudah masuk sebagai murid.",
      ["Telusuri semua layar murid mencari: tes penempatan level, kuis harian, ujian akhir unit, jenis soal selain pilih dan susun, saran mengulang pelajaran terlemah, penilaian pengucapan, "
       "kartu koreksi atau terjemahan balasan AI, riwayat percakapan, pembekuan streak, lencana, materi Katakana/N5, pilihan peran di skenario, flashcard mode tes.",
       "Baca juga teks bantuan dan pesan di tiap layar."],
      "Tidak ada tombol, tautan, atau kalimat yang menjanjikan fitur-fitur itu atau membuka halaman setengah jadi. Satu-satunya pengecualian yang diketahui: kalimat di layar \"Cek Emailmu\" (lihat TC-AK-16).",
      "AK-11, PL-08, PL-10, PL-11, MT-05, MT-06, PC-07, PC-08, AI-15, AI-16, AI-17, FC-05, GM-06, GM-07"),
    K("TC-KT-11", A_KT, "Semua", "P3", "Alat impor unit dari dokumen Word dapat diulang dan hasilnya sama",
      "Komputer pengembang dengan repositori dan pnpm; dijalankan tim teknis, bukan murid.",
      ["pnpm --filter api run unit:import  (daftar unit yang punya sumber Word).",
       "pnpm --filter api run unit:import unit_kerja_3 --check  (tanpa menulis).",
       "Baca peringatan impor (romaji yang tidak cocok, kalimat tanpa potongan) dan periksa apakah masih ada yang belum ditinjau."],
      "Perintah kedua berakhir dengan kode keluar 0 (JSON yang tersimpan sama dengan hasil impor ulang). Peringatan yang tampil sudah tercatat sebagai diterima atau diperbaiki di sumbernya; bahasa Jepangnya sendiri tetap perlu ditinjau pengajar (TC-KT-02).",
      "KN-01, KN-02"),
]
