"use client";
import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export default function LampDemo() {
  return (
    <LampContainer>
      <motion.h1
        initial={{ opacity: 0.5, y: 100 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: "easeInOut",
        }}
        className="mt-8 bg-gradient-to-br from-slate-300 to-slate-500 py-4 bg-clip-text text-center text-4xl font-medium tracking-tight text-transparent md:text-7xl"
      >
        Build lamps <br /> the right way
      </motion.h1>
    </LampContainer>
  );
}

export const LampContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 w-full rounded-md z-0",
        className
      )}
    >
      <div className="relative flex w-full flex-1 scale-y-125 items-center justify-center isolate z-0 pt-24 md:pt-32">
        {/* Left conic gradient */}
        <motion.div
          initial={{ opacity: 0.5, width: "6rem" }}
          whileInView={{ opacity: 1, width: "100%" }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          style={{
            backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))`,
          }}
          className="absolute inset-auto right-1/2 h-40 md:h-56 overflow-visible w-full max-w-[18rem] md:max-w-[30rem] bg-gradient-conic from-cyan-500 via-transparent to-transparent text-white [--conic-position:from_70deg_at_center_top]"
        >
          <div className="absolute w-[100%] left-0 bg-slate-950 h-28 md:h-40 bottom-0 z-20 [mask-image:linear-gradient(to_top,white,transparent)]" />
          <div className="absolute w-24 md:w-40 h-[100%] left-0 bg-slate-950 bottom-0 z-20 [mask-image:linear-gradient(to_right,white,transparent)]" />
        </motion.div>
        {/* Right conic gradient */}
        <motion.div
          initial={{ opacity: 0.5, width: "6rem" }}
          whileInView={{ opacity: 1, width: "100%" }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          style={{
            backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))`,
          }}
          className="absolute inset-auto left-1/2 h-40 md:h-56 w-full max-w-[18rem] md:max-w-[30rem] bg-gradient-conic from-transparent via-transparent to-cyan-500 text-white [--conic-position:from_290deg_at_center_top]"
        >
          <div className="absolute w-24 md:w-40 h-[100%] right-0 bg-slate-950 bottom-0 z-20 [mask-image:linear-gradient(to_left,white,transparent)]" />
          <div className="absolute w-[100%] right-0 bg-slate-950 h-28 md:h-40 bottom-0 z-20 [mask-image:linear-gradient(to_top,white,transparent)]" />
        </motion.div>
        {/* Background blur elements */}
        <div className="absolute top-1/2 h-32 md:h-48 w-full translate-y-12 scale-x-150 bg-slate-950 blur-2xl"></div>
        <div className="absolute top-1/2 z-50 h-32 md:h-48 w-full bg-transparent opacity-10 backdrop-blur-md"></div>
        {/* Main glow */}
        <div className="absolute inset-auto z-50 h-24 md:h-36 w-full max-w-[16rem] md:max-w-[28rem] -translate-y-1/2 rounded-full bg-cyan-500 opacity-50 blur-3xl"></div>
        {/* Inner glow */}
        <motion.div
          initial={{ width: "4rem" }}
          whileInView={{ width: "100%" }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="absolute inset-auto z-30 h-24 md:h-36 w-full max-w-40 md:max-w-64 -translate-y-[4rem] md:-translate-y-[6rem] rounded-full bg-cyan-400 blur-2xl"
        ></motion.div>
        {/* Horizontal line */}
        <motion.div
          initial={{ width: "6rem" }}
          whileInView={{ width: "100%" }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="absolute inset-auto z-50 h-0.5 w-full max-w-[18rem] md:max-w-[30rem] -translate-y-[5rem] md:-translate-y-[7rem] bg-cyan-400"
        ></motion.div>
        {/* Top cover */}
        <div className="absolute inset-auto z-40 h-32 md:h-44 w-full -translate-y-[9rem] md:-translate-y-[12.5rem] bg-slate-950"></div>
      </div>
      <div className="relative z-50 flex -translate-y-60 md:-translate-y-60 flex-col items-center px-5">
        {children}
      </div>
    </div>
  );
};
