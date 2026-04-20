import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "",
  }),
  component: SignupPage,
  head: () => ({ meta: [{ title: "Create account — Mays Secret" }] }),
});

const signupSchema = z.object({
  email: z.string().trim().email("Valid email required").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function SignupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const [step, setStep] = useState<"details" | "verify">("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!loading && user && step === "details") {
      navigate({ to: redirect || "/account" });
    }
  }, [user, loading, redirect, navigate, step]);

  async function startSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = signupSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    // signUp creates the user and (since auto-confirm is OFF) sends a verification OTP/link to the email.
    // Supabase sends a 6-digit code by default with the confirmation email template.
    const { error: err } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep("verify");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const code = otp.trim();
    if (code.length < 6) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "signup",
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Verified — Supabase signs the user in automatically.
    navigate({ to: redirect || "/account" });
  }

  async function resend() {
    setResending(true);
    setError("");
    const { error: err } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    setResending(false);
    if (err) setError(err.message);
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-5 py-20 md:py-28">
        <p className="text-xs uppercase tracking-luxe text-muted-foreground">Join Mays Secret</p>
        <h1 className="mt-3 font-display text-4xl">
          {step === "details" ? "Create account" : "Verify email"}
        </h1>

        {step === "details" ? (
          <>
            <form onSubmit={startSignup} className="mt-8 space-y-5">
              <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
              <Field label="Password" type="password" value={password} onChange={setPassword} required autoComplete="new-password" />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary px-6 py-3 text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? "Sending code…" : "Continue"}
              </button>
            </form>
            <p className="mt-6 text-sm text-muted-foreground">
              Have an account?{" "}
              <Link to="/login" search={{ redirect }} className="text-foreground underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              We sent a 6-digit code to <span className="text-foreground">{email}</span>. Enter it below to verify your account.
            </p>
            <form onSubmit={verify} className="mt-8 space-y-5">
              <div>
                <label className="text-xs uppercase tracking-luxe text-muted-foreground">Verification code</label>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="mt-2 w-full border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] focus:border-foreground focus:outline-none"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary px-6 py-3 text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? "Verifying…" : "Verify & sign in"}
              </button>
            </form>
            <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
              <button onClick={() => setStep("details")} className="uppercase tracking-luxe hover:text-foreground">
                ← Change email
              </button>
              <button onClick={resend} disabled={resending} className="uppercase tracking-luxe hover:text-foreground disabled:opacity-50">
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </>
        )}
      </div>
    </SiteShell>
  );
}

function Field({
  label, value, onChange, type = "text", required, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-luxe text-muted-foreground">{label}</label>
      <input
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
      />
    </div>
  );
}
