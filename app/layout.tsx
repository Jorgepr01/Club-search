import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

const body = Atkinson_Hyperlegible_Next({
  variable: "--font-body",
  subsets: ["latin"],
  // next/font no tiene métricas de respaldo para esta familia todavía.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Encuentra tu comunidad en ESPOL",
  description:
    "Demo para descubrir clubes y organizaciones estudiantiles de ESPOL a partir de tus intereses, objetivos y disponibilidad.",
};

export const viewport: Viewport = {
  themeColor: "#F7F6FA",
  // En Android, el teclado virtual reduce el área de la página y el composer del chat queda visible.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
