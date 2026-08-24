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

export default function ParentLoginPage({ searchParams }: PageProps) {
  const router = useRouter();
  const params = use(searchParams);
  const callbackUrl = validateSafeInternalPath(params.callbackUrl, "/parent");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setError(error.message || "Email atau password salah");
      setLoading(false);
    } else {
      toast.success("Berhasil masuk");
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
          <CardTitle className="text-2xl font-bold text-slate-800">Masuk Portal Orang Tua</CardTitle>
          <CardDescription>
            Akses ringkasan kehadiran dan hasil pembelajaran putra/putri Anda
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={loading}
            >
              {loading ? "Memproses..." : "Masuk"}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Belum memiliki akun?{" "}
              <Link
                href={`/parent/register${callbackUrl !== "/parent" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
                className="text-emerald-700 font-semibold hover:underline"
              >
                Daftar di sini
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
