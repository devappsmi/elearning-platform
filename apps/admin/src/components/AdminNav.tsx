import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/invitations", label: "Undangan" },
  { to: "/classes", label: "Kelas" },
  { to: "/students", label: "Murid" },
  { to: "/settings", label: "Pengaturan" },
];

/** Basic admin nav — intentionally plain, real visual design is Fase 1.
 * Nama admin + tombol keluar SENGAJA ditambahkan (bukan cuma link statis)
 * di Milestone 10 lanjutan -- bukti visual paling langsung bahwa AuthGuard
 * benar-benar memvalidasi token ke server (GET /admin/auth/me sungguhan),
 * bukan cuma mengecek localStorage kosong/tidak. */
export function AdminNav() {
  const { me, logout } = useAuth();

  return (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-2 border-b border-gray-100 pb-3 text-sm text-gray-700">
        Halo, <span className="font-medium">{me.name}</span>
        <span className="ml-1 text-xs text-gray-400">({me.role})</span>
      </div>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) =>
            [
              "rounded-md px-3 py-2 text-sm font-medium",
              isActive ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100",
            ].join(" ")
          }
        >
          {link.label}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={logout}
        className="mt-auto rounded-md px-3 py-2 text-left text-sm font-medium text-gray-500 hover:bg-gray-100"
      >
        Keluar
      </button>
    </nav>
  );
}
