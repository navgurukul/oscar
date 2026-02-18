"use client";

import { motion } from "motion/react";
import { LampContainer } from "@/components/ui/lamp";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";
import { useAuth } from "@/lib/contexts/AuthContext";

const TESTIMONIALS = [
  {
    quote:
      "OSCAR turns my messy voice notes into clean summaries I can drop straight into my docs.",
    name: "Product Manager",
    designation: "Plans sprints on the go",
    src: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=800&q=80",
  },
  {
    quote:
      "I record tasks while walking between meetings and review a polished checklist later.",
    name: "Engineering Lead",
    designation: "Keeps projects moving",
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
  },
  {
    quote:
      "Speaking ideas out loud is faster; OSCAR makes them look like I sat and wrote them.",
    name: "Founder",
    designation: "Captures ideas in motion",
    src: "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=800&q=80",
  },
];

export default function Home() {
  const { session } = useAuth();

  return (
    <main className="min-h-screen flex flex-col overflow-hidden">
      {/* Lamp Effect Header */}
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
          <LayoutTextFlip
            text="Bring your ideas to light."
            words={[
              "Let AI write.",
              "Let AI refine.",
              "Let AI transform.",
              "Create effortlessly.",
            ]}
            duration={3000}
          />
        </motion.h1>
      </LampContainer>

      {!session && (
        <section className="pb-16">
          <div className="mx-auto max-w-4xl px-4 md:px-8 lg:px-12 text-center">
            <h2 className="text-sm font-semibold tracking-wide text-cyan-400">
              What people say
            </h2>
            <p className="mt-2 text-lg text-slate-200">
              Creators and teams using OSCAR to turn voice into clear notes.
            </p>
          </div>
          <AnimatedTestimonials testimonials={TESTIMONIALS} autoplay />
        </section>
      )}
    </main>
  );
}
