"use client";

import { motion } from "framer-motion";
import { CalendarDays, FileText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

const HIGHLIGHTS = [
  {
    icon: FileText,
    title: "Three panes, no clutter",
    body: "Categories on the left, your notes in the middle, a focused editor on the right.",
  },
  {
    icon: CalendarDays,
    title: "A calendar that looks ahead",
    body: "Scheduled events and everything upcoming, in one glowing month view.",
  },
  {
    icon: Sparkles,
    title: "Pin, favorite, find",
    body: "Search hits titles, content and tags in a single pass.",
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh bg-background">
      {/* Left: the pitch, only on wide screens */}
      <div className="relative hidden w-1/2 overflow-hidden border-r border-line lg:block">
        <div className="absolute inset-0 aurora" />
        <div className="absolute inset-0 grid-bg opacity-40" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
          className="scan-line absolute left-0 right-0 top-1/3 h-px"
        />

        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-card">
              <FileText className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Square Notes</span>
          </div>

          <div>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="glow-text max-w-[420px] text-[40px] font-semibold leading-[1.1] tracking-tight"
            >
              Everything you meant to write down.
            </motion.h2>

            <div className="mt-10 space-y-5">
              {HIGHLIGHTS.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + index * 0.1 }}
                  className="flex gap-3"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-card/60 backdrop-blur">
                    <item.icon className="size-4 text-muted" />
                  </span>
                  <span className="max-w-[320px]">
                    <span className="block text-[13px] font-medium">{item.title}</span>
                    <span className="block text-[12px] leading-relaxed text-muted-2">
                      {item.body}
                    </span>
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-2">
            Built with Next.js, Neon and a fondness for dark interfaces.
          </p>
        </div>
      </div>

      {/* Right: the form */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[380px]"
        >
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-card">
              <FileText className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Square Notes</span>
          </div>

          <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </main>
  );
}
