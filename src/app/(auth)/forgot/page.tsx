"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ROUTES } from "@/lib/routes";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);

    const response = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (response.ok) {
      setState("sent");
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setState("idle");
    }
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your address and we'll send a link to choose a new one."
    >
      <AnimatePresence mode="wait">
        {state === "sent" ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-line bg-card p-4"
          >
            <MailCheck className="size-5 text-glow-2" />
            <p className="mt-2 text-[13px] font-medium">Check your inbox</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
              If that address has an account, a reset link is on its way. It
              expires in an hour and can only be used once.
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="space-y-3.5"
          >
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted">Email</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="field h-10 w-full rounded-lg border border-line bg-input px-3 transition focus:border-line-strong"
              />
            </label>

            {error && <p className="text-[12px] text-danger">{error}</p>}

            <button
              type="submit"
              disabled={state === "sending"}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-btn text-[13px] font-medium text-btn-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {state === "sending" && <Loader2 className="size-4 animate-spin" />}
              Send reset link
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <Link
        href={ROUTES.all === "/" ? "/login" : "/login"}
        className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-muted-2 transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to sign in
      </Link>
    </AuthShell>
  );
}
