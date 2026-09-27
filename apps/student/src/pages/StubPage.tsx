import { useParams, useLocation } from "react-router-dom";

export interface StubPageProps {
  title: string;
}

/**
 * Generic stub rendered for every route in this pass — just the route's
 * name/path and a "not yet implemented" note. Real per-screen UI is a
 * separate Fase 1 plan; this milestone is router/shell/tooling only.
 */
export function StubPage({ title }: StubPageProps) {
  const params = useParams();
  const location = useLocation();
  const hasParams = Object.keys(params).length > 0;

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">Route: {location.pathname}</p>
      {hasParams && (
        <pre className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-600">
          {JSON.stringify(params, null, 2)}
        </pre>
      )}
      <p className="mt-4 text-sm text-gray-700">Halaman ini belum diimplementasikan.</p>
    </div>
  );
}
