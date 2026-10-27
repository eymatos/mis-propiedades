import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const font = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Mis Propiedades", template: "%s · Mis Propiedades" },
  description: "Administración de propiedades, inquilinos y cobros.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Propiedades", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b6e69",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-DO" className={font.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
