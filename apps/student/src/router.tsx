import { createBrowserRouter } from "react-router-dom";
import { AuthGuard } from "./auth/AuthGuard";
import { RootLayout } from "./components/RootLayout";
import { HomePage } from "./pages/HomePage";
import { LessonPage } from "./pages/LessonPage";
import { LessonResultPage } from "./pages/LessonResultPage";
import { LoginPage } from "./pages/LoginPage";
import { StubPage } from "./pages/StubPage";

/**
 * Route skeleton -- inti alur belajar (Beranda/Belajar/Hasil Belajar) dan
 * /login sekarang sungguhan (Fase 1 lanjutan, lihat docs/PLAN.md bagian 7c);
 * rute lain (Percakapan/Kamus/Flashcard/Leaderboard/Profil/admin) masih
 * StubPage, plan Fase 1 terpisah berikutnya.
 *
 * Public routes (no AuthGuard): /invite/:token, /login, /forgot-password,
 * /reset-password/:token. Everything else is wrapped in AuthGuard + the
 * shared AppShell-based RootLayout.
 */
export const router = createBrowserRouter([
  { path: "/invite/:token", element: <StubPage title="Terima Undangan" /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <StubPage title="Lupa Password" /> },
  { path: "/reset-password/:token", element: <StubPage title="Reset Password" /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { path: "/welcome", element: <StubPage title="Selamat Datang" /> },
          { path: "/", element: <HomePage /> },
          { path: "/learn/:lessonId", element: <LessonPage /> },
          { path: "/learn/:lessonId/result", element: <LessonResultPage /> },
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
