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
  title: "Pixel&Digital",
  description:
    "Studio créatif spécialisé dans la communication visuelle, le marketing digital, la création de contenus, l'audiovisuel, le développement web et l'impression.",
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
