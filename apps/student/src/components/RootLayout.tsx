import { Outlet, useLocation } from "react-router-dom";
import { StudentNav } from "./StudentNav";

/** Kerangka halaman murid setelah masuk: navigasi (sidebar/tab) + isi halaman. Ruang di kiri (desktop) dan di bawah (HP)
 * disisakan untuk navigasi yang posisinya tetap. */
export function RootLayout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen md:pl-72">
      <StudentNav />
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-10 md:pb-14 md:pt-10">
        {/* key: animasi masuk diulang tiap pindah halaman. */}
        <div key={pathname} className="motion-safe:animate-slide-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
