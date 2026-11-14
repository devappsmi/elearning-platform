"""Gabungan semua kasus uji, dengan pemeriksaan dasar (ID unik, area dikenal)."""
import collections

from kasus_akun import KASUS as AKUN
from kasus_admin import KASUS as ADMIN
from kasus_belajar import KASUS as BELAJAR
from kasus_dasar import URUTAN_AREA
from kasus_fitur import KASUS as FITUR
from kasus_sistem import KASUS as SISTEM
from kasus_tambahan import KASUS as TAMBAHAN
from kasus_tampilan import KASUS as TAMPILAN

SEMUA = AKUN + BELAJAR + FITUR + TAMPILAN + ADMIN + SISTEM + TAMBAHAN

_dobel = [i for i, n in collections.Counter(k.id for k in SEMUA).items() if n > 1]
assert not _dobel, f"ID kasus uji ganda: {_dobel}"
_asing = {k.area for k in SEMUA} - set(URUTAN_AREA)
assert not _asing, f"Area tidak dikenal: {_asing}"


def urut():
    """Kasus diurutkan menurut urutan area lalu ID."""
    indeks = {a: i for i, a in enumerate(URUTAN_AREA)}
    return sorted(SEMUA, key=lambda k: (indeks[k.area], k.id.split("-")[1], int(k.id.split("-")[2])))
