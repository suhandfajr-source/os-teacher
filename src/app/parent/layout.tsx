import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { ParentLogoutButton } from "./ParentLogoutButton";
import { HeartHandshake } from "lucide-react";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (err) {
    console.warn("ParentLayout session lookup error:", err);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Parent Header */}
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/parent" className="flex items-center gap-2.5 font-bold text-lg text-slate-900 hover:opacity-90">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <span className="text-emerald-700 font-extrabold">Portal</span> Orang Tua
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-800">{session.user.name}</span>
                  <span className="text-xs text-slate-500 font-mono">{session.user.email}</span>
                </div>
                <ParentLogoutButton />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Link
                  href="/parent/login"
                  className="px-3 py-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 font-medium"
                >
                  Masuk
                </Link>
                <Link
                  href="/parent/register"
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                >
                  Daftar
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>

      {/* Parent Footer */}
      <footer className="border-t bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} AI Teacher Assistant &mdash; Portal Pembelajaran Siswa</span>
          <span className="text-slate-400">Akses Mandiri & Terbatas untuk Orang Tua / Wali</span>
        </div>
      </footer>
    </div>
  );
}
