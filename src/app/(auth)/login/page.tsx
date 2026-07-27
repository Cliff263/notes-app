import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { googleEnabled } from "@/auth.config";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Return to your ideas and keep your thinking moving."
    >
      <AuthForm mode="login" googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
