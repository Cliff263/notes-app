"use client";

import {
  motion,
  useInView,
  useReducedMotion,
  useSpring,
  useTransform,
  type Transition,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Shared motion vocabulary. Everything animates on the same two curves so the
 * app feels like one product rather than a pile of one-off transitions, and
 * `MotionConfig reducedMotion="user"` in the provider collapses all of it for
 * anyone who asked the OS for less movement.
 */
export const EASE_OUT: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };
export const SPRING: Transition = { type: "spring", stiffness: 380, damping: 34 };

const OFFSET = {
  up: { x: 0, y: 12 },
  down: { x: 0, y: -12 },
  left: { x: 16, y: 0 },
  right: { x: -16, y: 0 },
} as const;

type Direction = keyof typeof OFFSET;

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...EASE_OUT, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlideIn({
  children,
  from = "up",
  delay = 0,
  className,
}: {
  children: ReactNode;
  from?: Direction;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const offset = reduced ? { x: 0, y: 0 } : OFFSET[from];

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ ...EASE_OUT, delay: reduced ? 0 : delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: EASE_OUT },
};

/** Wrap a list; each `StaggerItem` child arrives just after the previous one. */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      variants={reduced ? { hidden: {}, shown: {} } : staggerParent}
      initial="hidden"
      animate="shown"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerChild} className={className}>
      {children}
    </motion.div>
  );
}

/** Animates the first time it scrolls into view, then stays put. */
export function Reveal({
  children,
  from = "up",
  className,
}: {
  children: ReactNode;
  from?: Direction;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const offset = reduced ? { x: 0, y: 0 } : OFFSET[from];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...offset }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : undefined}
      transition={EASE_OUT}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Counts to its value on a spring — used for note and tag totals. */
export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const spring = useSpring(value, { stiffness: 140, damping: 22 });
  const text = useTransform(spring, (current) =>
    Math.round(current).toLocaleString(),
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={className}>{text}</motion.span>;
}

/**
 * Slides a heading in word by word. Deliberately short and subtle: it reads as
 * the page settling, not as an animation demanding attention.
 */
export function TextReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const words = text.split(" ");

  /*
   * Framer's reducedMotion setting disables transforms but keeps opacity, so a
   * stagger would still make the heading arrive late for someone who asked for
   * less motion. Here it simply appears.
   */
  if (reduced) return <span className={className}>{text}</span>;

  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.035, delayChildren: delay } },
      }}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block whitespace-pre"
          variants={{
            hidden: { opacity: 0, y: "0.4em", filter: "blur(4px)" },
            shown: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          {word}
          {index < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </motion.span>
  );
}

/** Standard press feedback, so every control responds the same way. */
export const tap = { whileTap: { scale: 0.96 }, transition: SPRING } as const;
