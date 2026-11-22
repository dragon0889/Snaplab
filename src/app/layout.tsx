import type { Metadata } from "next";
import "./globals.css";
import { Nunito } from "next/font/google";
import { cn } from "@/lib/utils";

const nunito = Nunito({ subsets: ["latin", "vietnamese"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SnapLab",
  description: "Học STEAM tương tác cùng mạch điện thật",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={cn("font-sans", nunito.variable)}>
      <body>{children}</body>
    </html>
  );
}
