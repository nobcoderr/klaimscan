import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "KLAIMSCAN AI — Verifikasi klaim dari screenshot",
  description:
    "Membaca headline dan caption pada screenshot, lalu membandingkannya dengan sumber terbuka. Keaslian foto sampul tidak diperiksa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/25 selection:text-foreground">
        {children}
        <Toaster position="bottom-right" richColors theme="dark" />
      </body>
    </html>
  );
}
