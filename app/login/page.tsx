"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }

      // Redirect based on role
      const role = data.data?.role;
      if (role === "admin") {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/atlas";
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/60 via-white to-amber-50/40" />
      <div className="absolute inset-0 bg-dots opacity-30" />

      <div className="relative w-full max-w-md animate-fade-in-scale">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white text-2xl font-black mb-4 shadow-lg animate-float">
            G
          </div>
          <h1 className="text-2xl font-heading font-extrabold text-foreground">
            <span className="text-orange-600">Geo</span>
            <span className="text-amber-600">Harmonize</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="glass-card rounded-2xl p-7 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold font-label text-muted-foreground mb-1.5 block uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@geoharmonize.gov.in"
                required
                className="input-premium font-label"
              />
            </div>

            <div>
              <label className="text-xs font-semibold font-label text-muted-foreground mb-1.5 block uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="input-premium"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 animate-fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Sign In
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-5 p-3.5 rounded-xl bg-orange-50/50 border border-orange-200/50">
            <p className="section-label text-orange-700 mb-2">Demo Credentials</p>
            <div className="space-y-1 text-xs text-orange-800/80">
              <p><span className="font-bold font-label">Admin:</span> admin@geoharmonize.gov.in / admin123</p>
              <p><span className="font-bold font-label">Reviewer:</span> reviewer@geoharmonize.gov.in / admin123</p>
            </div>
          </div>
        </div>

        {/* Register Link */}
        <p className="text-center text-sm text-muted-foreground mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2 transition-colors">
            Register as Reviewer
          </Link>
        </p>
      </div>
    </div>
  );
}
