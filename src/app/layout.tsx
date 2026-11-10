import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "KLAIMSCAN AI — Evidence-Based Disinformation Intelligence Platform",
  description:
    "Platform Threat Intelligence Dashboard untuk menganalisis klaim media sosial berbasis bukti resmi dan penelusuran fakta terbuka.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-[#07111E] text-[#F3F8FF] antialiased selection:bg-[#45DDEB]/25 selection:text-[#F3F8FF]">
        {children}
        <Toaster position="bottom-right" richColors theme="dark" />
      </body>
    </html>
  );
}
