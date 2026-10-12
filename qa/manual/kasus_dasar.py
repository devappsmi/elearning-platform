"""Bentuk data satu kasus uji dan pembantu penulisannya.

Setiap kasus punya ID tetap (TC-<AREA>-<NOMOR>). Kasus yang juga dijalankan skrip otomatis memakai ID yang sama dengan
yang tertulis di judul uji Playwright/skrip API ("[TC-AK-08] ..."); pembangun buku kasus uji memeriksa keduanya
saling cocok, sehingga tidak ada ID di skrip yang tidak punya baris di buku, dan sebaliknya untuk kolom "Otomatis".
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Kasus:
    id: str
    area: str
    app: str  # Murid | Admin | API | Semua
    prio: str  # P1 (kritis) | P2 (penting) | P3 (pelengkap)
    judul: str
    pra: str  # prasyarat
    langkah: tuple
    harap: str  # hasil yang diharapkan
    fitur: str = ""  # kode fitur di dokumen Daftar Fitur Rinci, mis. "AK-04, AK-05"
    catatan: str = ""  # mis. "Butuh akses log API", "Temuan diketahui: ..."


def K(id, area, app, prio, judul, pra, langkah, harap, fitur="", catatan=""):
    assert prio in ("P1", "P2", "P3"), id
    assert app in ("Murid", "Admin", "API", "Semua"), id
    assert isinstance(langkah, (list, tuple)) and langkah, id
    return Kasus(id, area, app, prio, judul, pra, tuple(langkah), harap, fitur, catatan)


# Nama area (dipakai di semua berkas kasus, dan di lembar Ringkasan).
A_AK = "Akun dan masuk"
A_BR = "Beranda dan jalur belajar"
A_PL = "Pelajaran dan soal"
A_NL = "Nilai, bintang, XP, streak"
A_PC = "Percakapan (skenario)"
A_AI = "Ngobrol dengan AI"
A_KM = "Kamus"
A_FC = "Flashcard"
A_LB = "Leaderboard"
A_PF = "Profil"
A_RS = "Tampilan ponsel dan layar"
A_AX = "Aksesibilitas"
A_AD = "Admin"
A_API = "API dan server"
A_KT = "Konten pelajaran"
A_NF = "Keamanan, kinerja, pemulihan"
A_BT = "Fitur yang belum tersedia"

URUTAN_AREA = [A_AK, A_BR, A_PL, A_NL, A_PC, A_AI, A_KM, A_FC, A_LB, A_PF, A_RS, A_AX, A_AD, A_BT, A_API, A_KT, A_NF]

# Cara menyiapkan tautan undangan/reset (email belum terkirim otomatis, tautan hanya ada di catatan server).
LOG_TAUTAN = "Tautan ada di catatan (log) API karena email belum terkirim otomatis; lihat qa/README.md bagian \"Mengambil tautan undangan dan reset password\"."
