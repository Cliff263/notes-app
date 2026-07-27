"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BrainCircuit, FileText, Network, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const PHRASES = [
  "Futuristic note-taking",
  "Built for ideas",
  "Powered by AI",
  "Knowledge, organized",
  "Ideas, evolved",
];

const CAPABILITIES = [
  { icon: FileText, label: "Capture", detail: "Write without friction" },
  { icon: Network, label: "Organize", detail: "Connect what you know" },
  { icon: BrainCircuit, label: "Evolve", detail: "Think beyond the page" },
];

function NexoraMark() {
  return (
    <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] shadow-[0_0_24px_rgba(139,92,246,0.12)]">
      <span className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-400/20" />
      <Sparkles className="relative size-[17px] text-violet-200" />
    </span>
  );
}

function PhraseLoop() {
  const [activePhrase, setActivePhrase] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    const interval = window.setInterval(() => {
      setActivePhrase((current) => (current + 1) % PHRASES.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  return (
    <>
      <span className="sr-only">Futuristic note-taking for modern minds.</span>
      <div
        className="flex h-7 items-center font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-200/80 sm:text-xs"
        aria-hidden="true"
      >
        <span className="mr-3 h-px w-6 bg-gradient-to-r from-cyan-400 to-violet-400" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={PHRASES[activePhrase]}
            initial={reduceMotion ? false : { opacity: 0, y: 7, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -7, filter: "blur(4px)" }}
            transition={{ duration: 0.32, ease: "easeOut" }}
          >
            {PHRASES[activePhrase]}
          </motion.span>
        </AnimatePresence>
      </div>
    </>
  );
}

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
    <main className="relative min-h-dvh overflow-hidden bg-[#070810] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(124,58,237,0.18),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(8,145,178,0.12),transparent_32%),linear-gradient(135deg,#090814_0%,#070910_48%,#080b12_100%)]" />
      <div className="pointer-events-none absolute -left-[18%] top-[52%] h-40 w-[70%] -rotate-12 rounded-full bg-violet-500/[0.055] blur-[90px]" />
      <div className="pointer-events-none absolute -right-[12%] top-[18%] h-32 w-[55%] rotate-12 rounded-full bg-cyan-300/[0.035] blur-[100px]" />
      <div className="pointer-events-none absolute inset-x-[8%] top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1600px] lg:grid-cols-[minmax(0,1.15fr)_minmax(430px,0.85fr)]">
        <section className="relative flex min-h-[390px] flex-col overflow-hidden border-white/10 px-6 pb-10 pt-6 sm:px-10 sm:pt-8 lg:min-h-dvh lg:border-r lg:px-14 lg:pb-12 lg:pt-10 xl:px-20">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex items-center gap-3"
          >
            <NexoraMark />
            <span className="text-base font-semibold tracking-[-0.02em]">Nexora</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">
              Intelligent workspace
            </span>
          </motion.div>

          <div className="my-auto max-w-3xl py-12 sm:py-16 lg:py-20">
            <PhraseLoop />

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
              className="mt-5 max-w-[760px] text-[clamp(3.25rem,8vw,7.5rem)] font-semibold leading-[0.88] tracking-[-0.075em]"
            >
              Ideas,
              <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text pb-2 text-transparent">
                evolved.
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-6 max-w-xl"
            >
              <p className="text-lg font-medium tracking-[-0.02em] text-white/90 sm:text-xl">
                Futuristic note-taking for modern minds.
              </p>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/48 sm:text-[15px]">
                Capture ideas, organize knowledge, and think with AI in one intelligent
                workspace.
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="hidden grid-cols-3 gap-3 sm:grid"
          >
            {CAPABILITIES.map((item) => (
              <div
                key={item.label}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 backdrop-blur-sm transition-colors hover:border-violet-400/20 hover:bg-white/[0.045]"
              >
                <item.icon className="size-4 text-violet-300/80 transition-colors group-hover:text-cyan-200" />
                <p className="mt-5 text-xs font-medium text-white/85">{item.label}</p>
                <p className="mt-1 text-[11px] text-white/35">{item.detail}</p>
              </div>
            ))}
          </motion.div>
        </section>

        <section className="relative flex items-center justify-center border-t border-white/10 px-5 py-12 sm:px-8 lg:min-h-dvh lg:border-t-0 lg:px-12">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-500/[0.025] to-transparent" />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.12, ease: "easeOut" }}
            className="relative w-full max-w-[420px] rounded-[28px] border border-white/[0.09] bg-[#0d0d12]/80 p-6 shadow-[0_24px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8"
          >
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-violet-300/65">
                  Enter Nexora
                </p>
                <h2 className="mt-2 text-[27px] font-semibold tracking-[-0.04em]">
                  {title}
                </h2>
                <p className="mt-1.5 max-w-xs text-[13px] leading-5 text-white/45">
                  {subtitle}
                </p>
              </div>
              <span className="hidden size-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)] sm:block" />
            </div>

            {children}

            <p className="mt-7 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-white/20">
              Your thoughts. Your space. Your next idea.
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
