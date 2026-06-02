"use client";

import React, { Suspense, useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmail, signInWithGoogle } from "@/services/auth";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // Show errors forwarded from /auth/callback (e.g. expired OTP link)
  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) setError(urlError);
  }, [searchParams]);

  async function handleEmailLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) { setError(error.message); setLoading(false); }
  }

  return (
    <AuthShell title="Welcome back." subtitle="Sign in to your planner.">
      <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="EMAIL">
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />
        </Field>

        <Field label="PASSWORD">
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>

        {error && <ErrorBanner message={error} />}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link href="/reset-password" style={linkStyle}>Forgot password?</Link>
        </div>

        <PrimaryBtn type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </PrimaryBtn>
      </form>

      <Divider />

      <GoogleBtn onClick={handleGoogleLogin} disabled={loading} label="Continue with Google" />

      <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-ui)" }}>
        No account?{" "}
        <Link href="/signup" style={linkStyle}>Create one</Link>
      </p>
    </AuthShell>
  );
}

// ── Shared auth UI atoms ──────────────────────────────────────────────────────

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div suppressHydrationWarning style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 24px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ marginBottom: 36, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em",
            color: "var(--accent)",
          }}>
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)",
            letterSpacing: "var(--display-tracking)", fontSize: 30, lineHeight: 1.1,
            marginTop: 16, color: "var(--fg)",
          }}>{title}</div>
          <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 6, fontFamily: "var(--font-ui)" }}>
            {subtitle}
          </div>
        </div>

        <div style={{
          background: "var(--bg-1)", border: "1px solid var(--line)",
          borderRadius: "var(--radius)", padding: "32px 32px 28px",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.07em",
        color: "var(--fg-3)", textTransform: "uppercase",
      }}>{label}</span>
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      padding: "9px 12px", background: "rgba(168,68,43,0.08)",
      border: "1px solid rgba(168,68,43,0.25)", borderRadius: "var(--radius-sm)",
      fontSize: 12, color: "var(--warn)", fontFamily: "var(--font-ui)", lineHeight: 1.4,
    }}>{message}</div>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em" }}>OR</span>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

function PrimaryBtn({ children, type, disabled, onClick }: {
  children: React.ReactNode;
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%", padding: "11px 0",
        background: disabled ? "var(--bg-3)" : "var(--accent)",
        color: disabled ? "var(--fg-3)" : "var(--accent-fg)",
        border: `1px solid ${disabled ? "var(--line)" : "var(--accent)"}`,
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all .15s",
      }}
    >{children}</button>
  );
}

function GoogleBtn({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: "11px 0",
        background: "var(--bg-2)", color: "var(--fg)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        transition: "background .15s",
      }}
    >
      <GoogleIcon />
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "var(--bg-2)", border: "1px solid var(--line-2)",
  borderRadius: "var(--radius-sm)", color: "var(--fg)",
  fontFamily: "var(--font-ui)", fontSize: 13, outline: "none",
  boxSizing: "border-box",
};

const linkStyle: React.CSSProperties = {
  color: "var(--accent)", fontFamily: "var(--font-ui)", fontSize: 13, textDecoration: "none",
};
