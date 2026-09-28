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
import { ConversationCatalogPage } from "./pages/ConversationCatalogPage";
import { ConversationPage } from "./pages/ConversationPage";
import { ConversationResultPage } from "./pages/ConversationResultPage";
import { FlashcardsPage } from "./pages/FlashcardsPage";

/**
 * Route skeleton -- SEMUA rute murid sekarang sungguhan KECUALI /welcome,
 * /invite/:token, /forgot-password, /reset-password/:token (alur onboarding
 * terpisah, di luar scope Fase 1 ini). Inti alur belajar (7c),
 * Kamus/Leaderboard/Profil (7f), Percakapan (7g), dan sekarang Flashcard
 * (7h) sudah sungguhan -- lihat docs/PLAN.md.
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
          { path: "/conversation", element: <ConversationCatalogPage /> },
          { path: "/conversation/:id", element: <ConversationPage /> },
          {
            path: "/conversation/:id/result",
            element: <ConversationResultPage />,
          },
          { path: "/dictionary", element: <KamusPage /> },
          { path: "/flashcards", element: <FlashcardsPage /> },
          { path: "/leaderboard", element: <LeaderboardPage /> },
          { path: "/profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
]);
