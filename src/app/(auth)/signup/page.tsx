import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { googleEnabled } from "@/auth.config";

export const metadata: Metadata = { title: "Create account · Square Notes" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Your account starts with a set of notes and a calendar already filled in."
    >
      <AuthForm mode="signup" googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
