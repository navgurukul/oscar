"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center cursor-pointer justify-center whitespace-nowrap rounded-md text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 disabled:pointer-events-none disabled:opacity-50 gap-2",
  {
    variants: {
      variant: {
        default: "bg-cyan-700 text-white hover:bg-cyan-700",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border text-white hover:bg-gray-700",
        ghost: "bg-transparent",
        // New design variants
        glow: "relative bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:from-cyan-500 hover:to-blue-500 ring-1 ring-cyan-400/30",
        soft: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25",
        outlineDark:
          "border border-cyan-700/40 text-cyan-300 hover:bg-cyan-700/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        lg: "h-11 px-2",
        sm: "h-9 px-3",
        icon: "h-10 w-10",
        xl: "h-12 px-6",
      },
      // Basic spacing controls
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
