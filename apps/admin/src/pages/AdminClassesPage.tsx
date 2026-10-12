import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { components } from "@elearning/api-client";
import { Button } from "@elearning/ui";
import { apiClient } from "../auth/api-client";

type ClassListItem = components["schemas"]["ClassListItemDto"];

/** Kelas (ADM-20) -- CRUD dasar: buat kelas + arsip/buka-arsip. Backend
 * sudah ada+teruji sejak Milestone 9. `targetLevelId` SENGAJA tidak ada di
 * form buat-kelas -- tidak ada endpoint `GET /levels` untuk mengisi
 * dropdown-nya (field ini optional di backend, kelas tetap bisa dibuat
 * tanpa itu) -- gap yang diketahui, dicatat di docs/PLAN.md, bukan
 * di-hardcode di sini. Detail kelas (daftar murid per kelas) juga belum ada
 * di pass ini, cuma list+create+archive. */
export function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadClasses() {
    const { data, error: apiError } = await apiClient.GET("/admin/classes", { params: { query: {} } });
    if (apiError || !data) {
      setError("Gagal memuat daftar kelas.");
      return;
    }
    setClasses(data);
  }

  useEffect(() => {
    loadClasses();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const { error: apiError } = await apiClient.POST("/admin/classes", {
      body: { name, description: description || undefined },
    });
    setSubmitting(false);
    if (apiError) {
      setFormError("Gagal membuat kelas.");
      return;
    }
    setName("");
    setDescription("");
    await loadClasses();
  }

  async function toggleArchive(klass: ClassListItem) {
    const path = klass.status === "ACTIVE" ? "/admin/classes/{id}/archive" : "/admin/classes/{id}/unarchive";
    const { error: apiError } = await apiClient.PATCH(path, { params: { path: { id: klass.id } } });
    if (apiError) {
      setError(`Gagal ${klass.status === "ACTIVE" ? "mengarsipkan" : "membuka arsip"} kelas.`);
      return;
    }
    await loadClasses();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Buat Kelas Baru</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="class-name" className="block text-sm font-medium text-gray-700">
              Nama Kelas
            </label>
            <input
              id="class-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label htmlFor="class-desc" className="block text-sm font-medium text-gray-700">
              Deskripsi (opsional)
            </label>
            <input
              id="class-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Membuat..." : "Buat Kelas"}
          </Button>
        </div>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </form>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!classes ? (
        <div className="p-6 text-sm text-gray-500">Memuat...</div>
      ) : classes.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada kelas.</p>
      ) : (
        <table className="w-full rounded-lg border border-gray-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="p-3 font-normal">Nama</th>
              <th className="p-3 font-normal">Murid</th>
              <th className="p-3 font-normal">Status</th>
              <th className="p-3 font-normal">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((klass) => (
              <tr key={klass.id} className="border-b border-gray-50">
                <td className="p-3 text-gray-900">{klass.name}</td>
                <td className="p-3 text-gray-600">{klass._count.students}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${klass.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                  >
                    {klass.status === "ACTIVE" ? "Aktif" : "Diarsipkan"}
                  </span>
                </td>
                <td className="p-3">
                  <button className="text-sm text-blue-600 hover:underline" onClick={() => toggleArchive(klass)}>
                    {klass.status === "ACTIVE" ? "Arsipkan" : "Buka Arsip"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
