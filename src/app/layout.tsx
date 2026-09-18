import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { NavigationProgressBar } from "@/components/layout/NavigationProgressBar";

export const metadata: Metadata = {
  title: "AI Teacher Assistant",
  description: "Teacher-first web application",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased font-sans">
      <body className="flex h-full bg-background overflow-hidden font-sans">
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
