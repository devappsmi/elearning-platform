import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/invitations", label: "Undangan" },
  { to: "/classes", label: "Kelas" },
  { to: "/students", label: "Murid" },
  { to: "/settings", label: "Pengaturan" },
];

/** Basic admin nav — intentionally plain, real visual design is Fase 1. */
export function AdminNav() {
  return (
    <nav className="flex flex-col gap-1 p-4">
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
    </nav>
  );
}
