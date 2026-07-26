"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

/**
 * `reducedMotion="user"` makes every animation in the app honour the OS
 * setting without each component checking, and LazyMotion keeps the animation
 * feature set out of the initial bundle until something actually animates.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict={false}>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
