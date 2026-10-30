import type { BranchId } from "@/lib/types";

// Pictogramas propios por rama. Son la alternativa gráfica mientras no haya logos ni fotos autorizados.
const PATHS: Record<BranchId, React.ReactNode> = {
  programacion: <path d="M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16" />,
  robotica: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 7V3M14 7V3M10 21v-4M14 21v-4M7 10H3M7 14H3M21 10h-4M21 14h-4" />
      <circle cx="12" cy="12" r="1.6" />
    </>
  ),
  tierra: <path d="M2 19 9 7l4 7 3-4 6 9ZM7.2 10.2 9 12l1.6-1.6" />,
  industria: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  arte: (
    <>
      <path d="M3 8h3.5l2-2.5h7l2 2.5H21v11H3Z" />
      <circle cx="12" cy="13.2" r="3.6" />
    </>
  ),
  cultura: <path d="M9 3h6M10 3c0 3-4.5 4.5-4.5 9.5S8.5 21 12 21s6.5-3.5 6.5-8.5S14 6 14 3M6 12h12" />,
  comunidad: (
    <path d="M3 5h11v7H8l-3 3v-3H3ZM10 15v1.5h6l3 3v-3h2V9.5h-4" />
  ),
  otras: (
    <>
      <circle cx="6" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
    </>
  ),
};

export function BranchGlyph({ id, className }: { id: BranchId; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[id]}
    </svg>
  );
}
