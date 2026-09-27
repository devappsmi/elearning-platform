import { Outlet } from "react-router-dom";
import { AppShell } from "@elearning/ui";
import { AdminNav } from "./AdminNav";

export function RootLayout() {
  return (
    <AppShell nav={<AdminNav />}>
      <Outlet />
    </AppShell>
  );
}
