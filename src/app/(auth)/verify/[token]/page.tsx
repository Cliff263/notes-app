"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { api } from "@/lib/api";

export default function VerifyPage() {
  const params = useParams<{ token: string }>();

  const { isPending, isError, error } = useQuery({
    queryKey: ["verify", params.token],
    queryFn: () =>
      api<{ ok: true }>(`/api/auth/verify?token=${encodeURIComponent(params.token)}`),
    retry: false,
    staleTime: Infinity,
  });

  return (
    <AuthShell
      title="Confirming your email"
      subtitle="This only takes a moment."
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded-xl border border-line bg-card p-4"
      >
        {isPending ? (
          <>
            <Loader2 className="mt-0.5 size-5 animate-spin text-muted-2" />
            <p className="text-[13px] text-muted">Checking the link…</p>
          </>
        ) : isError ? (
          <>
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="text-[13px] font-medium">That link didn&apos;t work</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
                {(error as Error).message}. You can request a fresh one from
                Settings once you&apos;re signed in.
              </p>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-glow-2" />
            <div>
              <p className="text-[13px] font-medium">Email confirmed</p>
              <p className="mt-1 text-[12px] text-muted-2">
                Thanks — your account is fully set up.
              </p>
            </div>
          </>
        )}
      </motion.div>

      <Link
        href="/"
        className="mt-6 flex h-10 w-full items-center justify-center rounded-lg bg-btn text-[13px] font-medium text-btn-foreground transition hover:opacity-90"
      >
        Go to my notes
      </Link>
    </AuthShell>
  );
}
