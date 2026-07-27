"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";

export default function ResetPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Those passwords don't match");
      return;
    }

    setState("saving");
    const response = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token, password }),
    });

    if (response.ok) {
      setState("done");
      setTimeout(() => router.push("/login"), 1800);
      return;
    }

    const body = await response.json().catch(() => ({}));
    setError(body.error ?? "Could not reset that password");
    setState("idle");
  }

  if (state === "done") {
    return (
      <AuthShell title="Password changed" subtitle="Taking you to sign in…">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2.5 rounded-xl border border-line bg-card p-4"
        >
          <CheckCircle2 className="size-5 text-glow-2" />
          <p className="text-[13px]">You can sign in with your new password.</p>
        </motion.div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something you haven't used elsewhere."
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          autoFocus
        />

        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Type it again"
          autoComplete="new-password"
        />

        {error && <p className="text-[12px] text-danger">{error}</p>}

        <button
          type="submit"
          disabled={state === "saving"}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-btn text-[13px] font-medium text-btn-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {state === "saving" && <Loader2 className="size-4 animate-spin" />}
          Save new password
        </button>
      </form>

      <p className="mt-6 text-center text-[12px] text-muted-2">
        Link expired?{" "}
        <Link href="/forgot" className="text-foreground underline-offset-4 hover:underline">
          Request another
        </Link>
      </p>
    </AuthShell>
  );
}
