import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@elearning/ui";
import { apiClient } from "../auth/api-client";
import { useAuth } from "../auth/AuthContext";
import { XP_GOAL_OPTIONS, isXpGoal, type XpGoal } from "../lib/xp-goal";

/** Profil (GAM-01 "murid bisa ubah target XP harian" + info akun dasar) --
 * GET /me sudah divalidasi AuthGuard sebelum halaman ini bisa dibuka sama
 * sekali (lihat AuthContext), jadi dibaca langsung dari situ, tidak fetch
 * ulang. Setelah PATCH /me sukses, `setMe()` (BARU ditambahkan ke
 * AuthContext sesi ini) meng-update context -- nav ("Halo, {nama}") ikut
 * konsisten seketika, bukan cuma halaman ini, tanpa perlu reload. */
export function ProfilePage() {
  const { me, setMe } = useAuth();
  const [name, setName] = useState(me.name);
  const [dailyXpGoal, setDailyXpGoal] = useState<XpGoal>(isXpGoal(me.dailyXpGoal) ? me.dailyXpGoal : 10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    // Server menolak nama kosong SETELAH dipangkas (`required` bawaan browser
    // meloloskan "   "), jadi dipangkas dan dicek di sini supaya murid dapat
    // pesan yang jelas, bukan "Gagal menyimpan" dari request yang pasti 400.
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError("Nama tidak boleh kosong.");
      return;
    }
    setSubmitting(true);
    const { data, error: apiError } = await apiClient.PATCH("/me", { body: { name: trimmedName, dailyXpGoal } });
    setSubmitting(false);
    if (apiError || !data) {
      setError("Gagal menyimpan perubahan.");
      return;
    }
    setMe(data);
    setName(data.name); // tampilkan nama yang benar-benar tersimpan (sudah terpangkas)
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Info Akun</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-900">{me.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Kelas</dt>
            <dd className="text-gray-900" data-testid="profile-class">
              {me.className}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Bergabung</dt>
            <dd className="text-gray-900">{new Date(me.createdAt).toLocaleDateString("id-ID")}</dd>
          </div>
        </dl>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Edit Profil</h2>
        <div className="mt-3 space-y-4">
          <div className="space-y-1">
            <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700">
              Nama
            </label>
            <input
              id="profile-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="profile-xp-goal" className="block text-sm font-medium text-gray-700">
              Target XP Harian
            </label>
            <select
              id="profile-xp-goal"
              value={dailyXpGoal}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (isXpGoal(value)) setDailyXpGoal(value);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {XP_GOAL_OPTIONS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal} XP/hari
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {saved && <p className="mt-2 text-sm text-green-700">Perubahan tersimpan.</p>}
      </form>
    </div>
  );
}
