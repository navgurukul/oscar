"use client";

/**
 * Lightweight scroll-reveal utilities.
 *
 * Uses `motion/react` (already installed) with whileInView so elements
 * animate once as they enter the viewport.  Only `opacity` and `transform`
 * are animated — both GPU-composited, no layout reflow.
 *
 * Usage:
 *   <FadeIn>…content…</FadeIn>
 *   <FadeIn delay={0.1} direction="left">…</FadeIn>
 *
 * For staggered lists use the exported variants directly:
 *   <motion.ul variants={listVariants} initial="hidden" whileInView="show" viewport={{ once: true }}>
 *     {items.map(i => <motion.li key={i} variants={itemVariants}>…</motion.li>)}
 *   </motion.ul>
 */

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

// Shared easing curves — smooth deceleration, consistent across all animations
const EASE_SMOOTH = [0.25, 0.46, 0.45, 0.94] as const;

// ─── FadeIn ─────────────────────────────────────────────────────────────────

interface FadeInProps {
  children: ReactNode;
  /** Stagger offset in seconds (default 0) */
  delay?: number;
  /** Animation duration in seconds (default 0.5) */
  duration?: number;
  /** Initial translate direction (default "up") */
  direction?: "up" | "left" | "none";
  className?: string;
}

const OFFSETS = {
  up:   { y: 22 },
  left: { x: 14 },
  none: {},
} as const;

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  direction = "up",
  className,
}: FadeInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...OFFSETS[direction] }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration, delay, ease: EASE_SMOOTH }}
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger list variants ───────────────────────────────────────────────────

/** Parent container: staggers children by 70 ms with a 100 ms base delay */
export const listVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

/** Each list item: slides in 10 px from the left and fades up */
export const itemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};
