import type { Metadata } from "next";
import "./globals.css";
import { Baloo_2, JetBrains_Mono, Nunito } from "next/font/google";
import { cn } from "@/lib/utils";

// Body text, headings/big numbers, and serial/technical readouts. All three carry the Vietnamese subset.
const nunito = Nunito({ subsets: ["latin", "vietnamese"], variable: "--font-nunito", display: "swap" });
const baloo = Baloo_2({ subsets: ["latin", "vietnamese"], variable: "--font-baloo", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "vietnamese"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "SnapLab",
  description: "Học STEAM tương tác cùng mạch điện thật",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={cn("font-sans", nunito.variable, baloo.variable, jetbrains.variable)}>
      <body>{children}</body>
    </html>
  );
}
