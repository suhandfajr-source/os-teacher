import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { NavigationProgressBar } from "@/components/layout/NavigationProgressBar";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "KLASSA — Naik Kelas Bersama",
  description: "Personal Workspace & AI Co-Pilot Guru Indonesia: Administrasi Tuntas, Mengajar Jadi Berkelas.",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased font-sans" suppressHydrationWarning>
      <body className="flex flex-col h-full w-full bg-background text-foreground font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <Suspense fallback={null}>
            <NavigationProgressBar />
          </Suspense>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
