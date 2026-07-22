import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s — Pixel&Digital",
    default: "Pixel&Digital",
  },
  description:
    "Studio créatif spécialisé dans la communication visuelle, le marketing digital, la création de contenus, l'audiovisuel, le développement web et l'impression.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    siteName: "Pixel&Digital",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body>{children}</body>
    </html>
  );
}
