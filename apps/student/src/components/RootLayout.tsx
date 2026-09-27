import { Outlet } from "react-router-dom";
import { AppShell } from "@elearning/ui";
import { StudentNav } from "./StudentNav";

export function RootLayout() {
  return (
    <AppShell nav={<StudentNav />}>
      <Outlet />
    </AppShell>
  );
}
