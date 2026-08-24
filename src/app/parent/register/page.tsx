"use client";

import React, { useState, use } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { HeartHandshake } from "lucide-react";
import { validateSafeInternalPath } from "@/modules/parent/parent.utils";

interface PageProps {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
}

export default function ParentRegisterPage({ searchParams }: PageProps) {
  const router = useRouter();
  const params = use(searchParams);
  const callbackUrl = validateSafeInternalPath(params.callbackUrl, "/parent");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setError(error.message || "Pendaftaran akun orang tua gagal");
      setLoading(false);
    } else {
      toast.success("Pendaftaran berhasil");
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <Card className="shadow-md border-slate-200">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">Daftar Akun Orang Tua</CardTitle>
          <CardDescription>
            Buat akun untuk memantau kehadiran dan hasil pembelajaran putra/putri Anda
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nama Lengkap Orang Tua / Wali</label>
              <Input
                type="text"
                placeholder="Contoh: Rina Kusumastuti"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Gunakan email yang sama dengan yang didaftarkan pada undangan guru.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <Input
                type="password"
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Konfirmasi Password</label>
              <Input
                type="password"
                placeholder="Ulangi password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={loading}
            >
              {loading ? "Mendaftarkan..." : "Daftar Akun Orang Tua"}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Sudah memiliki akun?{" "}
              <Link
                href={`/parent/login${callbackUrl !== "/parent" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
                className="text-emerald-700 font-semibold hover:underline"
              >
                Masuk di sini
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
