"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// v2 cream/ink/terracotta system.
// Tailwind tokens used here resolve via tailwind.config.js (cream, ink, terracotta)
// and via globals.css HSL vars (--primary, --secondary, --destructive, --ring, etc.)
// remapped to the same palette. New code should default to these variants and
// avoid raw hex.
const buttonVariants = cva(
  "inline-flex items-center cursor-pointer justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-50 gap-2",
  {
    variants: {
      variant: {
        // Primary CTA — ink pill on cream. Matches the design pattern used on every page.
        default: "bg-ink text-cream hover:opacity-90",
        // Destructive — oxblood danger token from globals.css.
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        // Outlined — rule border on cream. Hover lifts to cream2 for subtle feedback.
        outline: "border border-input bg-transparent text-ink hover:bg-cream-200",
        // Quiet — text on transparent, cream2 hover. Used for icon buttons and menus.
        ghost: "text-ink hover:bg-cream-200",
        // Link — terracotta inline link styling.
        link: "text-terracotta underline-offset-4 hover:underline",
        // Soft surface — cream2 hover. Cousin of ghost with a default surface.
        secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
        // Brand-tinted accent — terracotta-soft fill, used sparingly for affirmative actions.
        soft: "bg-terracotta-100 text-ink border border-terracotta-500/30 hover:bg-terracotta-50",
        // Back-compat aliases — earlier accent variants now collapse to the
        // editorial system. Kept so legacy call sites compile; treat as deprecated.
        glow: "bg-ink text-cream hover:opacity-90",
        outlineDark: "border border-input bg-transparent text-ink hover:bg-cream-200",
      },
      size: {
        default: "h-10 px-4 py-2",
        lg: "h-11 px-2",
        sm: "h-9 px-3",
        icon: "h-10 w-10",
        xl: "h-12 px-6",
      },
      margin: {
        none: "m-0",
        sm: "m-2",
        md: "m-4",
        lg: "m-6",
      },
      padding: {
        none: "px-0 py-0",
        sm: "px-2 py-1",
        md: "px-4 py-2",
        lg: "px-6 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      margin: "none",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  margin,
  padding,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // Order matters: padding after size to override px/py if provided
        buttonVariants({ variant, size, padding, margin }),
        className
      )}
      {...props}
    />
  );
}

export { buttonVariants };
