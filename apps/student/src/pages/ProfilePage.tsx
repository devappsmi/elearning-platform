import { useState } from "react";
import type { FormEvent } from "react";
import { apiClient } from "../auth/api-client";
import { useAuth } from "../auth/AuthContext";
import { NETWORK_ERROR_TEXT, failureText, readFailure } from "../auth/api-errors";
import { fieldClasses, TextField } from "../components/TextField";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { Notice } from "../components/ui/Feedback";
import { Icon } from "../components/ui/icons";
import { PageHeader } from "../components/ui/PageHeader";
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
    try {
      const { data, error: apiError, response } = await apiClient.PATCH("/me", { body: { name: trimmedName, dailyXpGoal } });
      if (!data) {
        setError(failureText(readFailure(response, apiError), "Gagal menyimpan perubahan."));
        return;
      }
      setMe(data);
      setName(data.name); // tampilkan nama yang benar-benar tersimpan (sudah terpangkas)
      setSaved(true);
    } catch {
      // Gangguan jaringan melempar (bukan `{ error }`) -- tanpa ini tombol macet di "Menyimpan..."
      // dan murid tidak diberi tahu apa pun.
      setError(NETWORK_ERROR_TEXT);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profil" subtitle="Kelola akun dan target belajarmu." emoji="🧑‍🎓" tone="secondary" />

      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-600 via-secondary-600 to-tertiary-600 p-6 text-white shadow-glow">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-3 -top-8 select-none text-[9rem] font-black leading-none text-white/10"
          >
            あ
          </span>
          <div className="relative flex flex-wrap items-center gap-4">
            <Avatar name={me.name} src={me.avatarUrl} size="xl" />
            <div className="min-w-0">
              <p className="truncate text-2xl font-black text-white">{me.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip tone="white">
                  <Icon name="user" className="h-4 w-4" />
                  {me.className}
                </Chip>
                <Chip tone="white">
                  <Icon name="bolt" className="h-4 w-4" />
                  {me.dailyXpGoal} XP/hari
                </Chip>
              </div>
            </div>
          </div>
        </section>

        <Card tone="sky">
          <h2 className="text-lg font-black text-slate-900">Info Akun</h2>
          <dl className="mt-3 divide-y divide-sky-100 text-sm">
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="font-bold text-slate-600">Email</dt>
              <dd className="min-w-0 truncate font-extrabold text-slate-900">{me.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="font-bold text-slate-600">Kelas</dt>
              <dd className="font-extrabold text-slate-900" data-testid="profile-class">
                {me.className}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="font-bold text-slate-600">Bergabung</dt>
              <dd className="font-extrabold text-slate-900">{new Date(me.createdAt).toLocaleDateString("id-ID")}</dd>
            </div>
          </dl>
        </Card>

        <Card tone="pink">
          <form onSubmit={handleSubmit}>
            <h2 className="text-lg font-black text-slate-900">Edit Profil</h2>
            <div className="mt-4 space-y-4">
              <TextField id="profile-name" label="Nama" required value={name} onChange={(e) => setName(e.target.value)} />
              <div className="space-y-1.5">
                <label htmlFor="profile-xp-goal" className="block text-sm font-extrabold text-slate-800">
                  Target XP Harian
                </label>
                <select
                  id="profile-xp-goal"
                  value={dailyXpGoal}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (isXpGoal(value)) setDailyXpGoal(value);
                  }}
                  className={fieldClasses}
                >
                  {XP_GOAL_OPTIONS.map((goal) => (
                    <option key={goal} value={goal}>
                      {goal} XP/hari
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={submitting} size="lg">
                {submitting ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
            {error && (
              <Notice tone="error" role="alert" className="mt-4">
                {error}
              </Notice>
            )}
            {saved && (
              <Notice tone="success" role="status" className="mt-4">
                Perubahan tersimpan.
              </Notice>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
