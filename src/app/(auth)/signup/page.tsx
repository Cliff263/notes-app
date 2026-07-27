import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { googleEnabled } from "@/auth.config";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Create your intelligent workspace and give every idea room to evolve."
    >
      <AuthForm mode="signup" googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
