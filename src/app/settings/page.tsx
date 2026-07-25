"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, Loader2, LogOut, Moon, Sun, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { useNotesStore } from "@/store/notes-store";

type Account = {
  name: string | null;
  email: string;
  createdAt: string;
  hasPassword: boolean;
  noteCount: number;
  eventCount: number;
};

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const loadNotes = useNotesStore((state) => state.load);
  const notesStatus = useNotesStore((state) => state.status);
  const view = useNotesStore((state) => state.view);
  const setView = useNotesStore((state) => state.setView);
  const sidebarOpen = useNotesStore((state) => state.sidebarOpen);

  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    if (notesStatus === "idle") void loadNotes();
  }, [notesStatus, loadNotes]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/account");
      if (!response.ok) return;
      const data: Account = await response.json();
      setAccount(data);
      setName(data.name ?? "");
    })();
  }, []);

  async function saveName() {
    if (!name.trim() || name === account?.name) return;
    setSaveState("saving");
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (response.ok) {
      setAccount((current) => (current ? { ...current, name } : current));
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1600);
    } else {
      setSaveState("idle");
    }
  }

  async function deleteAccount() {
    await fetch("/api/account", { method: "DELETE" });
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-background">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 248, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="h-full shrink-0 overflow-hidden"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      <section className="relative min-w-0 flex-1 overflow-y-auto bg-surface scroll-thin">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 aurora opacity-50" />

        <div className="relative mx-auto w-full max-w-[640px] px-6 py-10">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glow-text text-[26px] font-semibold tracking-tight"
          >
            Settings
          </motion.h1>
          <p className="mt-1 text-[13px] text-muted">
            Your account, how the workspace looks, and what happens to your data.
          </p>

          <Card title="Profile" delay={0.05}>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted">Display name</span>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={saveName}
                  placeholder="Your name"
                  className="h-9 flex-1 rounded-lg border border-line bg-input px-3 text-[13px] transition focus:border-line-strong"
                />
                <button
                  type="button"
                  onClick={saveName}
                  disabled={saveState === "saving" || !name.trim()}
                  className="flex min-w-[76px] items-center justify-center gap-1.5 rounded-lg bg-btn px-3 text-[12px] font-medium text-btn-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {saveState === "saving" && <Loader2 className="size-3.5 animate-spin" />}
                  {saveState === "saved" && <Check className="size-3.5" />}
                  {saveState === "saved" ? "Saved" : "Save"}
                </button>
              </div>
            </label>

            <Row label="Email" value={account?.email ?? "—"} />
            <Row
              label="Sign-in method"
              value={account ? (account.hasPassword ? "Email and password" : "Google") : "—"}
            />
            <Row
              label="Member since"
              value={
                account
                  ? new Date(account.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"
              }
            />
          </Card>

          <Card title="Appearance" delay={0.1}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px]">Theme</p>
                <p className="text-[11px] text-muted-2">
                  Dark is the default. Light mode uses the same layout.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition hover:bg-card-hover hover:text-foreground"
              >
                {theme === "dark" ? (
                  <Moon className="size-3.5" />
                ) : (
                  <Sun className="size-3.5" />
                )}
                {theme === "dark" ? "Dark" : "Light"}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px]">Note layout</p>
                <p className="text-[11px] text-muted-2">
                  How the middle pane arranges your notes.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-line p-0.5">
                {(["list", "grid"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setView(option)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[12px] capitalize transition",
                      view === option
                        ? "bg-card text-foreground"
                        : "text-muted-2 hover:text-foreground",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Workspace" delay={0.15}>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Notes" value={account?.noteCount ?? 0} />
              <Stat label="Events" value={account?.eventCount ?? 0} />
            </div>

            <div className="border-t border-line pt-4">
              <p className="text-[13px]">Export every note</p>
              <p className="mt-0.5 text-[11px] text-muted-2">
                All your notes in one document, newest first. Archived notes are
                included only if you tick the box.
              </p>

              <label className="mt-2.5 flex items-center gap-2 text-[12px] text-muted">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => setIncludeArchived(event.target.checked)}
                  className="size-3.5 accent-[var(--glow-1)]"
                />
                Include archived notes
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["pdf", "PDF"],
                    ["docx", "Word"],
                    ["md", "Markdown"],
                    ["txt", "Text"],
                  ] as const
                ).map(([format, label]) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => {
                      window.location.href = `/api/notes/export?format=${format}&archived=${includeArchived}`;
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition hover:bg-card-hover hover:text-foreground"
                  >
                    <Download className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Account" delay={0.2}>
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/login" })}
              className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] text-muted transition hover:bg-card-hover hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>

            <div className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] p-3">
              <p className="text-[13px] text-foreground">Delete account</p>
              <p className="mt-0.5 text-[11px] text-muted-2">
                Permanently removes your account along with every note and event. This
                cannot be undone.
              </p>

              {confirmingDelete ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={deleteAccount}
                    className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-[12px] font-medium text-white transition hover:opacity-90"
                  >
                    <Trash2 className="size-3.5" />
                    Yes, delete everything
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="mt-3 rounded-lg border border-line px-3 py-1.5 text-[12px] text-danger transition hover:bg-card-hover"
                >
                  Delete account
                </button>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

function Card({
  title,
  delay,
  children,
}: {
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="mt-6 rounded-xl border border-line bg-card p-4"
    >
      <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </motion.section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-line pt-3">
      <span className="text-[12px] text-muted-2">{label}</span>
      <span className="text-[12px]">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <p className="text-[22px] font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-2">{label}</p>
    </div>
  );
}
