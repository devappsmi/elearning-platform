import { createBrowserRouter } from "react-router-dom";
import { AuthGuard } from "./auth/AuthGuard";
import { RootLayout } from "./components/RootLayout";
import { HomePage } from "./pages/HomePage";
import { LessonPage } from "./pages/LessonPage";
import { LessonResultPage } from "./pages/LessonResultPage";
import { LoginPage } from "./pages/LoginPage";
import { StubPage } from "./pages/StubPage";
import { KamusPage } from "./pages/KamusPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { ProfilePage } from "./pages/ProfilePage";

/**
 * Route skeleton -- inti alur belajar (Beranda/Belajar/Hasil Belajar, bagian
 * 7c), /login, dan sekarang Kamus/Leaderboard/Profil (bagian 7f) sudah
 * sungguhan. Percakapan (3 rute) dan Flashcard masih StubPage, lihat
 * docs/PLAN.md.
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
          { path: "/dictionary", element: <KamusPage /> },
          { path: "/flashcards", element: <StubPage title="Flashcard" /> },
          { path: "/leaderboard", element: <LeaderboardPage /> },
          { path: "/profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
]);
