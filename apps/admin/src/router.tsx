import { createBrowserRouter } from "react-router-dom";
import { AuthGuard } from "./auth/AuthGuard";
import { RootLayout } from "./components/RootLayout";
import { LoginPage } from "./pages/LoginPage";
import { StubPage } from "./pages/StubPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminClassesPage } from "./pages/AdminClassesPage";
import { AdminInvitationsPage } from "./pages/AdminInvitationsPage";
import { AdminStudentsPage } from "./pages/AdminStudentsPage";
import { AdminStudentDetailPage } from "./pages/AdminStudentDetailPage";

/**
 * Route skeleton for Milestone 10 — /login, / (ADM-30), /classes (ADM-20),
 * /invitations (ADM-10/11/12), /students and /students/:id (ADM-21/31) are
 * now real; only /settings still resolves to a stub page. See docs/PLAN.md.
 *
 * `/content` (A7) and `/reports` (A8) are Fase 2 features and are
 * deliberately NOT registered here — the router stays honest about what
 * actually exists rather than shipping placeholder routes for unbuilt
 * features.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { path: "/", element: <AdminDashboardPage /> },
          { path: "/invitations", element: <AdminInvitationsPage /> },
          { path: "/classes", element: <AdminClassesPage /> },
          { path: "/students", element: <AdminStudentsPage /> },
          { path: "/students/:id", element: <AdminStudentDetailPage /> },
          { path: "/settings", element: <StubPage title="Pengaturan" /> },
        ],
      },
    ],
  },
]);
