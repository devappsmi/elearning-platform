import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";

type StudentListItem = components["schemas"]["StudentListItemDto"];
type ClassListItem = components["schemas"]["ClassListItemDto"];

/** Murid (ADM-21) -- list semua murid dengan filter kelas, XP total+streak
 * per baris, link ke detail (ADM-31, AdminStudentDetailPage). Backend sudah
 * ada+teruji sejak Milestone 9; UI baru sesi ini. Tidak ada aksi di
 * halaman list ini SENGAJA -- pindah kelas/nonaktifkan/reset password
 * semuanya di halaman detail (satu murid dalam fokus, bukan aksi massal
 * dari tabel -- lebih aman dari klik salah baris). */
export function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentListItem[] | null>(null);
  const [classes, setClasses] = useState<ClassListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("");

  useEffect(() => {
    apiClient.GET("/admin/classes", { params: { query: {} } }).then(({ data }) => {
      if (data) setClasses(data);
    });
  }, []);

  useEffect(() => {
    apiClient.GET("/admin/students", { params: { query: { classId: classFilter || undefined } } }).then(({ data, error: apiError }) => {
      if (apiError || !data) {
        setError("Gagal memuat daftar murid.");
        return;
      }
      setError(null);
      setStudents(data);
    });
  }, [classFilter]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <label htmlFor="filter-class" className="block text-sm font-medium text-gray-700">
          Filter Kelas
        </label>
        <select
          id="filter-class"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Semua</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!students ? (
        <div className="p-6 text-sm text-gray-500">Memuat...</div>
      ) : students.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada murid.</p>
      ) : (
        <table className="w-full rounded-lg border border-gray-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="p-3 font-normal">Nama</th>
              <th className="p-3 font-normal">Email</th>
              <th className="p-3 font-normal">Kelas</th>
              <th className="p-3 font-normal">Status</th>
              <th className="p-3 font-normal">XP</th>
              <th className="p-3 font-normal">Streak</th>
              <th className="p-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-gray-50">
                <td className="p-3 text-gray-900">{s.name}</td>
                <td className="p-3 text-gray-600">{s.email}</td>
                <td className="p-3 text-gray-600">{s.class.name}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${s.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                  >
                    {s.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="p-3 text-gray-600">{s.totalXp}</td>
                <td className="p-3 text-gray-600">{s.streak}</td>
                <td className="p-3">
                  <Link to={`/students/${s.id}`} className="text-sm text-blue-600 hover:underline">
                    Lihat detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
