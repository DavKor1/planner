"use client";

import React, { Suspense, useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPassword, updatePassword } from "@/services/auth";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  // When coming from the email link, Supabase sets a session via the URL hash.
  // We detect this by checking for an active session after mount.
  const [hasSession, setHasSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setCheckingSession(false);
    });
  }, []);

  if (checkingSession) {
    return <LoadingShell />;
  }

  return hasSession ? (
    <SetNewPasswordForm onSuccess={() => { router.push("/"); router.refresh(); }} />
  ) : (
    <RequestResetForm />
  );
}

// ── Request reset (enter email) ───────────────────────────────────────────────

function RequestResetForm() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [sent, setSent]       = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="Check your email." subtitle="Password reset link sent.">
        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✉</div>
          <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6, fontFamily: "var(--font-ui)" }}>
            We sent a reset link to <strong style={{ color: "var(--fg)" }}>{email}</strong>.
            Click it to set a new password.
          </p>
        </div>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/login" style={linkStyle}>Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset password." subtitle="Enter your email and we'll send a link.">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

        {error && <ErrorBanner message={error} />}

        <PrimaryBtn type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </PrimaryBtn>
      </form>

      <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-ui)" }}>
        <Link href="/login" style={linkStyle}>Back to sign in</Link>
      </p>
    </AuthShell>
  );
}

// ── Set new password (arrived from email link) ────────────────────────────────

function SetNewPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) { setError(error.message); return; }
    onSuccess();
  }

  return (
    <AuthShell title="New password." subtitle="Choose a strong password.">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="NEW PASSWORD">
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            required
            minLength={8}
            autoFocus
          />
        </Field>

        <Field label="CONFIRM PASSWORD">
          <input
            style={inputStyle}
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat new password"
            required
          />
        </Field>

        {error && <ErrorBanner message={error} />}

        <PrimaryBtn type="submit" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </PrimaryBtn>
      </form>
    </AuthShell>
  );
}

function LoadingShell() {
  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.06em" }}>
        LOADING…
      </span>
    </div>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────────────────

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
            <span style={{ fontSize: 16 }}>●</span> BONE
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

function PrimaryBtn({ children, type, disabled }: {
  children: React.ReactNode;
  type?: "submit" | "button";
  disabled?: boolean;
}) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
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
