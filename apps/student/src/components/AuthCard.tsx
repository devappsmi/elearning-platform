import type { ReactNode } from "react";

const WIDTH = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" } as const;

export interface AuthCardProps {
  title: string;
  children: ReactNode;
  /** Tautan/teks pendukung di bawah kartu (mis. "Kembali ke halaman masuk"). */
  footer?: ReactNode;
  width?: keyof typeof WIDTH;
}

/** Bingkai halaman publik murid (masuk, undangan, lupa/reset password,
 * onboarding): kartu di tengah layar, judul sebagai satu-satunya `h1`. */
export function AuthCard({ title, children, footer, width = "sm" }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className={`w-full ${WIDTH[width]} space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm`}>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {children}
        {footer && <div className="border-t border-gray-100 pt-3 text-sm text-gray-600">{footer}</div>}
      </div>
    </div>
  );
}
