import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "",
  }),
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — Mays Secret" }] }),
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: redirect || "/account" });
    }
  }, [user, loading, redirect, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate({ to: redirect || "/account" });
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-5 py-20 md:py-28">
        <p className="text-xs uppercase tracking-luxe text-muted-foreground">Welcome back</p>
        <h1 className="mt-3 font-display text-4xl">Sign in</h1>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
          <Field label="Password" type="password" value={password} onChange={setPassword} required autoComplete="current-password" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary px-6 py-3 text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" search={{ redirect }} className="text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
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
