import { createBrowserRouter } from "react-router-dom";
import { AuthGuard } from "./auth/AuthGuard";
import { RootLayout } from "./components/RootLayout";
import { StubPage } from "./pages/StubPage";

/**
 * Route skeleton for Milestone 10 — every route resolves to a stub page.
 * Real per-screen UI (data tables etc.) is a separate Fase 1 plan.
 *
 * `/content` (A7) and `/reports` (A8) are Fase 2 features and are
 * deliberately NOT registered here — the router stays honest about what
 * actually exists rather than shipping placeholder routes for unbuilt
 * features.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <StubPage title="Login" /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { path: "/", element: <StubPage title="Dashboard" /> },
          { path: "/invitations", element: <StubPage title="Undangan" /> },
          { path: "/classes", element: <StubPage title="Kelas" /> },
          { path: "/students", element: <StubPage title="Murid" /> },
          { path: "/students/:id", element: <StubPage title="Detail Murid" /> },
          { path: "/settings", element: <StubPage title="Pengaturan" /> },
        ],
      },
    ],
  },
]);
