import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./ui/Avatar";
import { Brand } from "./ui/Brand";
import { Icon } from "./ui/icons";
import type { IconName } from "./ui/icons";

type Hue = "amber" | "pink" | "emerald" | "sky" | "orange" | "violet";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  hue: Hue;
  /** `end`: hanya aktif di alamat persis ("/" tidak boleh ikut menyala di semua halaman). */
  end?: boolean;
}

// Tab bawah di HP hanya memuat 5 menu (6 kolom terlalu sempit untuk "Percakapan"/"Leaderboard"); Profil dibuka lewat avatar di bilah atas.
const PROFILE_PATH = "/profile";

const ITEMS: NavItem[] = [
  { to: "/", label: "Beranda", icon: "home", hue: "amber", end: true },
  { to: "/conversation", label: "Percakapan", icon: "chat", hue: "pink" },
  { to: "/dictionary", label: "Kamus", icon: "book", hue: "emerald" },
  { to: "/flashcards", label: "Flashcard", icon: "cards", hue: "sky" },
  { to: "/leaderboard", label: "Leaderboard", icon: "trophy", hue: "orange" },
  { to: PROFILE_PATH, label: "Profil", icon: "user", hue: "violet" },
];

const TAB_ITEMS = ITEMS.filter((item) => item.to !== PROFILE_PATH);

// Tiap menu punya warnanya sendiri. `idle`: ubin transparan di atas sidebar berwarna; `on`: ubin pastel saat menu aktif.
// Kelas ditulis utuh supaya terbaca pemindai Tailwind.
const HUE: Record<Hue, { idle: string; on: string }> = {
  amber: { idle: "bg-amber-300/25 text-amber-100", on: "from-amber-200 to-amber-300 text-amber-900" },
  pink: { idle: "bg-pink-300/25 text-pink-100", on: "from-pink-200 to-pink-300 text-pink-900" },
  emerald: { idle: "bg-emerald-300/25 text-emerald-100", on: "from-emerald-200 to-emerald-300 text-emerald-900" },
  sky: { idle: "bg-sky-300/25 text-sky-100", on: "from-sky-200 to-sky-300 text-sky-900" },
  orange: { idle: "bg-orange-300/25 text-orange-100", on: "from-orange-200 to-orange-300 text-orange-900" },
  violet: { idle: "bg-violet-300/25 text-violet-100", on: "from-violet-200 to-violet-300 text-violet-900" },
};

/** Navigasi murid: sidebar berwarna di layar lebar; di HP bilah atas (merek + keluar) dan tab bawah.
 * Dua tata letak itu dirender berdampingan dan dipilih dengan CSS (`md:`), jadi hanya satu yang tampil/terbaca.
 * Nama murid + tombol keluar SENGAJA ada di sini (bukan cuma tautan statis): bukti visual paling langsung
 * bahwa AuthGuard benar-benar memvalidasi token ke server (GET /me sungguhan), bukan cuma mengecek
 * localStorage kosong/tidak. */
export function StudentNav() {
  const { me, logout } = useAuth();

  return (
    <>
      {/* Layar lebar: sidebar tetap di kiri. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col gap-6 overflow-y-auto bg-gradient-to-b from-indigo-700 via-violet-700 to-fuchsia-700 px-5 py-6 text-white shadow-2xl shadow-indigo-900/30 md:flex">
        <Brand tone="dark" />
        <nav aria-label="Menu utama" className="flex flex-col gap-1.5">
          {ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-extrabold transition duration-150",
                  isActive
                    ? "bg-white text-indigo-800 shadow-lg shadow-indigo-950/25"
                    : "text-white hover:bg-white/15",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${
                      isActive ? `bg-gradient-to-br ${HUE[item.hue].on}` : HUE[item.hue].idle
                    }`}
                  >
                    <Icon name={item.icon} className="h-5 w-5" />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-3xl bg-black/20 p-3 ring-1 ring-white/25">
          <div className="flex items-center gap-3">
            <Avatar name={me.name} src={me.avatarUrl} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">Halo,</p>
              <p className="truncate font-extrabold text-white">{me.name}</p>
              <p className="truncate text-xs font-semibold text-white">{me.className}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-black/30 focus-visible:outline-white"
          >
            <Icon name="logout" className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* HP: bilah atas. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-violet-100 bg-white/90 px-4 backdrop-blur md:hidden">
        <Brand size="sm" />
        <div className="flex items-center gap-1.5">
          <NavLink
            to={PROFILE_PATH}
            aria-label="Profil"
            className={({ isActive }) =>
              `rounded-full p-0.5 transition ${isActive ? "bg-violet-200 ring-2 ring-violet-500" : "hover:bg-violet-100"}`
            }
          >
            <Avatar name={me.name} src={me.avatarUrl} size="sm" />
          </NavLink>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-100"
          >
            <Icon name="logout" className="h-4 w-4" />
            {/* Di HP sangat sempit (<360px) hanya ikon yang tampak; teksnya tetap dibaca pembaca layar. */}
            <span className="max-[359px]:sr-only">Keluar</span>
          </button>
        </div>
      </header>

      {/* HP: tab bawah. */}
      <nav
        aria-label="Menu utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_-14px_rgb(79_70_229_/_0.35)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1.5 py-1.5">
          {TAB_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex min-w-0 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1 text-[9.5px] font-extrabold tracking-tight min-[360px]:text-[11px] min-[360px]:tracking-normal"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-8 w-12 place-items-center rounded-xl transition ${
                      isActive ? `bg-gradient-to-br ${HUE[item.hue].on} shadow-sm` : "text-slate-500"
                    }`}
                  >
                    <Icon name={item.icon} className="h-5 w-5" />
                  </span>
                  <span className={`max-w-full truncate ${isActive ? "text-violet-800" : "text-slate-500"}`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
