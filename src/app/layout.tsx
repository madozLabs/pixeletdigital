import type { Metadata } from "next";
import { Baloo_2, Manrope, Outfit } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { getSiteUrl } from "./_lib/site-url";
import { WorldTransitionProvider } from "./_components/world-transition";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
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
    <html
      lang="fr"
      className={`${outfit.variable} ${manrope.variable} ${baloo.variable}`}
    >
      <body>
        <WorldTransitionProvider>{children}</WorldTransitionProvider>
      </body>
    </html>
  );
}
