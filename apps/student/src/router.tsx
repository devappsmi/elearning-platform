import { createBrowserRouter } from "react-router-dom";
import { AuthGuard } from "./auth/AuthGuard";
import { RootLayout } from "./components/RootLayout";
import { HomePage } from "./pages/HomePage";
import { LessonPage } from "./pages/LessonPage";
import { LessonResultPage } from "./pages/LessonResultPage";
import { LoginPage } from "./pages/LoginPage";
import { AcceptInvitationPage } from "./pages/AcceptInvitationPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { WelcomePage } from "./pages/WelcomePage";
import { KamusPage } from "./pages/KamusPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ConversationCatalogPage } from "./pages/ConversationCatalogPage";
import { ConversationPage } from "./pages/ConversationPage";
import { ConversationResultPage } from "./pages/ConversationResultPage";
import { FlashcardsPage } from "./pages/FlashcardsPage";

/**
 * SEMUA rute murid sungguhan (tidak ada lagi StubPage): alur belajar (7c),
 * Kamus/Leaderboard/Profil (7f), Percakapan (7g), Flashcard (7h), dan halaman
 * masuk-ke-produk -- undangan/registrasi, lupa + reset password, onboarding
 * (7i). Lihat docs/PLAN.md.
 *
 * Public routes (no AuthGuard): /invite/:token, /login, /forgot-password,
 * /reset-password/:token. /welcome (onboarding) butuh login tapi TANPA
 * RootLayout -- layar penuh 3 langkah, bukan halaman di dalam shell navigasi.
 * Sisanya dibungkus AuthGuard + RootLayout (sidebar berwarna di layar lebar, tab bawah di HP).
 */
export const router = createBrowserRouter([
  { path: "/invite/:token", element: <AcceptInvitationPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password/:token", element: <ResetPasswordPage /> },
  {
    element: <AuthGuard />,
    children: [
      { path: "/welcome", element: <WelcomePage /> },
      {
        element: <RootLayout />,
        children: [
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
