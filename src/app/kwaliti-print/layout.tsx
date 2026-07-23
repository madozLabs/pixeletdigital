import type { Metadata } from "next";
import { Baloo_2, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { KwalitiFooter } from "./_components/kwaliti-footer";
import { KwalitiHeader } from "./_components/kwaliti-header";

export const metadata: Metadata = {
  title: {
    template: "%s — Kwaliti Print",
    default: "Kwaliti Print",
  },
};

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

export default function KwalitiPrintLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div
      data-brand="kwaliti-print"
      className={`kwaliti-scope ${manrope.variable} ${baloo.variable}`}
    >
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <KwalitiHeader />
      {children}
      <KwalitiFooter />
    </div>
  );
}
