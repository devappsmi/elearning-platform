import { createBrowserRouter } from "react-router-dom";
import { AuthGuard } from "./auth/AuthGuard";
import { RootLayout } from "./components/RootLayout";
import { StubPage } from "./pages/StubPage";

/**
 * Route skeleton for Milestone 10 — every route resolves to a stub page.
 * Real per-screen UI is a separate Fase 1 plan.
 *
 * Public routes (no AuthGuard): /invite/:token, /login, /forgot-password,
 * /reset-password/:token. Everything else is wrapped in AuthGuard + the
 * shared AppShell-based RootLayout.
 */
export const router = createBrowserRouter([
  { path: "/invite/:token", element: <StubPage title="Terima Undangan" /> },
  { path: "/login", element: <StubPage title="Login" /> },
  { path: "/forgot-password", element: <StubPage title="Lupa Password" /> },
  { path: "/reset-password/:token", element: <StubPage title="Reset Password" /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { path: "/welcome", element: <StubPage title="Selamat Datang" /> },
          { path: "/", element: <StubPage title="Beranda" /> },
          { path: "/learn/:lessonId", element: <StubPage title="Belajar" /> },
          { path: "/learn/:lessonId/result", element: <StubPage title="Hasil Belajar" /> },
          { path: "/conversation", element: <StubPage title="Percakapan" /> },
          { path: "/conversation/:id", element: <StubPage title="Detail Percakapan" /> },
          {
            path: "/conversation/:id/result",
            element: <StubPage title="Hasil Percakapan" />,
          },
          { path: "/dictionary", element: <StubPage title="Kamus" /> },
          { path: "/flashcards", element: <StubPage title="Flashcard" /> },
          { path: "/leaderboard", element: <StubPage title="Leaderboard" /> },
          { path: "/profile", element: <StubPage title="Profil" /> },
        ],
      },
    ],
  },
]);
