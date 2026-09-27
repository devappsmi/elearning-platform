import type { ReactNode } from "react";

export interface AppShellProps {
  /** Nav content — student and admin each render their own nav here; this
   * component stays generic/unopinionated about what that nav contains. */
  nav: ReactNode;
  children: ReactNode;
}

/**
 * Sidebar-nav-friendly app shell shared by `apps/student` and `apps/admin`.
 * Real visual design is Fase 1 — this pass just needs a layout primitive
 * both apps can render their (differing) nav bars into.
 */
export function AppShell({ nav, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-gray-200 bg-white md:w-64 md:border-b-0 md:border-r">
        {nav}
      </aside>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
