"use client";
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { KlassaLogo } from "@/components/brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      setError(error.message || "Invalid credentials");
      setLoading(false);
    } else {
      toast.success("Login berhasil");
      router.push("/");
      router.refresh();
    }
  };

  return (
    <Card className="border-slate-200/80 shadow-md">
      <CardHeader className="items-center text-center space-y-3 pb-4">
        <KlassaLogo variant="vertical" size="sm" priority />
        <div>
          <CardTitle className="text-xl font-bold text-slate-900">Masuk ke KLASSA</CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Ruang kerja cerdas untuk guru Indonesia yang berdaya
          </CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Email</label>
            <Input 
              type="email" 
              placeholder="nama@sekolah.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Password</label>
            <Input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Memproses..." : "Masuk"}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Belum punya akun? <Link href="/register" className="text-primary hover:underline">Daftar sekarang</Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
