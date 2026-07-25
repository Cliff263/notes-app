import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { googleEnabled } from "@/auth.config";

export const metadata: Metadata = { title: "Sign in · Square Notes" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where your notes left off."
    >
      <AuthForm mode="login" googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
