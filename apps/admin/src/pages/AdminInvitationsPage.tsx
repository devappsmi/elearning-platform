import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { components } from "@elearning/api-client";
import { Button } from "@elearning/ui";
import { apiClient } from "../auth/api-client";

type InvitationListItem = components["schemas"]["InvitationListItemDto"];
type ClassListItem = components["schemas"]["ClassListItemDto"];
type InvitationStatus = InvitationListItem["status"];

const STATUS_LABEL: Record<InvitationStatus, string> = {
  PENDING: "Menunggu",
  ACCEPTED: "Diterima",
  EXPIRED: "Kedaluwarsa",
  REVOKED: "Dicabut",
};

const STATUS_BADGE: Record<InvitationStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-green-100 text-green-800",
  EXPIRED: "bg-gray-100 text-gray-600",
  REVOKED: "bg-red-100 text-red-700",
};

/** Undangan (ADM-10/11/12) -- list+filter (status/kelas), buat undangan
 * tunggal, kirim ulang, cabut. Backend sudah ada+teruji sejak Milestone 5.
 *
 * Upload CSV massal (ADM-11 "bulk", `POST /admin/invitations/bulk` +
 * `GET /admin/invitations/template`) SENGAJA belum ada UI-nya di pass ini --
 * endpoint-nya sudah ada+teruji, tapi file-upload dengan laporan
 * terkirim/gagal per baris butuh desain UI sendiri (progress, tabel hasil
 * per baris). Dicatat sebagai gap di docs/PLAN.md, bukan ditinggal diam-diam.
 *
 * Kelas yang sudah diarsipkan SENGAJA tidak muncul di dropdown buat-undangan
 * (backend menolaknya lewat assertActiveClass) tapi TETAP muncul di
 * filter-kelas, supaya admin masih bisa lihat undangan lama ke kelas yang
 * sekarang sudah diarsipkan. */
export function AdminInvitationsPage() {
  const [invitations, setInvitations] = useState<InvitationListItem[] | null>(null);
  const [classes, setClasses] = useState<ClassListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | "">("");
  const [classFilter, setClassFilter] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [classId, setClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  async function loadInvitations(status: InvitationStatus | "", klass: string) {
    const { data, error: apiError } = await apiClient.GET("/admin/invitations", {
      params: { query: { status: status || undefined, classId: klass || undefined } },
    });
    if (apiError || !data) {
      setError("Gagal memuat daftar undangan.");
      return;
    }
    setError(null);
    setInvitations(data);
  }

  useEffect(() => {
    apiClient.GET("/admin/classes", { params: { query: {} } }).then(({ data }) => {
      if (data) setClasses(data);
    });
  }, []);

  useEffect(() => {
    loadInvitations(statusFilter, classFilter);
  }, [statusFilter, classFilter]);

  const activeClasses = (classes ?? []).filter((c) => c.status === "ACTIVE");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const { error: apiError } = await apiClient.POST("/admin/invitations", { body: { name, email, classId } });
    setSubmitting(false);
    if (apiError) {
      setFormError("Gagal mengirim undangan -- pastikan email belum terdaftar/punya undangan aktif lain.");
      return;
    }
    setName("");
    setEmail("");
    setClassId("");
    await loadInvitations(statusFilter, classFilter);
  }

  async function handleResend(invitation: InvitationListItem) {
    setActionError(null);
    setActioningId(invitation.id);
    const { error: apiError } = await apiClient.POST("/admin/invitations/{id}/resend", {
      params: { path: { id: invitation.id } },
    });
    setActioningId(null);
    if (apiError) {
      setActionError("Gagal mengirim ulang undangan.");
      return;
    }
    await loadInvitations(statusFilter, classFilter);
  }

  async function handleRevoke(invitation: InvitationListItem) {
    if (!confirm(`Cabut undangan untuk ${invitation.email}?`)) return;
    setActionError(null);
    setActioningId(invitation.id);
    const { error: apiError } = await apiClient.DELETE("/admin/invitations/{id}", {
      params: { path: { id: invitation.id } },
    });
    setActioningId(null);
    if (apiError) {
      setActionError("Gagal mencabut undangan.");
      return;
    }
    await loadInvitations(statusFilter, classFilter);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Undang Murid Baru</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="inv-name" className="block text-sm font-medium text-gray-700">
              Nama
            </label>
            <input
              id="inv-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label htmlFor="inv-email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="inv-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label htmlFor="inv-class" className="block text-sm font-medium text-gray-700">
              Kelas
            </label>
            <select
              id="inv-class"
              required
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Pilih kelas
              </option>
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={submitting || activeClasses.length === 0}>
            {submitting ? "Mengirim..." : "Kirim Undangan"}
          </Button>
        </div>
        {classes !== null && activeClasses.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">Belum ada kelas aktif -- buat kelas dulu di halaman Kelas.</p>
        )}
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700">
            Filter Status
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvitationStatus | "")}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Semua</option>
            {(Object.keys(STATUS_LABEL) as InvitationStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
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
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {actionError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}

      {!invitations ? (
        <div className="p-6 text-sm text-gray-500">Memuat...</div>
      ) : invitations.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada undangan.</p>
      ) : (
        <table className="w-full rounded-lg border border-gray-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="p-3 font-normal">Nama</th>
              <th className="p-3 font-normal">Email</th>
              <th className="p-3 font-normal">Kelas</th>
              <th className="p-3 font-normal">Status</th>
              <th className="p-3 font-normal">Kedaluwarsa</th>
              <th className="p-3 font-normal">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50">
                <td className="p-3 text-gray-900">{inv.name}</td>
                <td className="p-3 text-gray-600">{inv.email}</td>
                <td className="p-3 text-gray-600">{inv.class.name}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
                </td>
                <td className="p-3 text-gray-600">{new Date(inv.expiresAt).toLocaleDateString("id-ID")}</td>
                <td className="p-3 space-x-3">
                  {(inv.status === "PENDING" || inv.status === "EXPIRED") && (
                    <button
                      className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                      disabled={actioningId === inv.id}
                      onClick={() => handleResend(inv)}
                    >
                      Kirim Ulang
                    </button>
                  )}
                  {inv.status !== "ACCEPTED" && inv.status !== "REVOKED" && (
                    <button
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                      disabled={actioningId === inv.id}
                      onClick={() => handleRevoke(inv)}
                    >
                      Cabut
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
