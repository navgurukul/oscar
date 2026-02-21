"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { LampContainer } from "@/components/ui/lamp";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { PRICING, SUBSCRIPTION_CONFIG } from "@/lib/constants";
import type { BillingCycle } from "@/lib/types/subscription.types";

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
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const handleViewPricing = () => {
    router.push("/auth?redirectTo=/pricing");
  };

  const price = billingCycle === "monthly" ? PRICING.MONTHLY : PRICING.YEARLY;

  return (
    <main className="min-h-screen flex flex-col">
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
        <>
          {/* Pricing Section */}
          <section className="min-h-screen snap-start flex items-center justify-center py-16 px-4">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Simple, Transparent <span className="text-cyan-500">Pricing</span>
                </h2>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                  Start free and upgrade when you need more. No hidden fees, cancel anytime.
                </p>
              </div>

              {/* Billing toggle */}
              <div className="flex items-center justify-center mb-12">
                <Tabs
                  value={billingCycle}
                  onValueChange={(value) => setBillingCycle(value as BillingCycle)}
                  className="w-fit"
                >
                  <TabsList className="bg-gray-900">
                    <TabsTrigger
                      value="monthly"
                      className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white"
                    >
                      Monthly
                    </TabsTrigger>
                    <TabsTrigger
                      value="yearly"
                      className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white"
                    >
                      Yearly
                      <span className="ml-2 text-xs bg-white/80 text-cyan-700 px-2 py-0.5 rounded-full">
                        Save {PRICING.YEARLY_SAVINGS_PERCENT}%
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Pricing cards */}
              <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                {/* Free Plan */}
                <div className="relative bg-slate-900 border border-cyan-700/30 rounded-2xl shadow-xl p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">Free</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">₹0</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS} recordings per month</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Up to {SUBSCRIPTION_CONFIG.FREE_MAX_NOTES} total notes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Custom vocabulary (up to {SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY} entries)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">AI-powered text formatting</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Basic voice-to-text</span>
                    </li>
                  </ul>

                  <Button
                    onClick={handleViewPricing}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white"
                  >
                    Get Started
                  </Button>
                </div>

                {/* Pro Plan */}
                <div className="relative bg-slate-900 border border-cyan-500/50 ring-1 ring-cyan-500/50 rounded-2xl shadow-xl p-6">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-xs font-medium bg-cyan-500 text-white rounded-full">
                      Most Popular
                    </span>
                  </div>

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">₹{price}</span>
                      <span className="text-gray-400">
                        /{billingCycle === "monthly" ? "month" : "year"}
                      </span>
                    </div>
                    {billingCycle === "yearly" && (
                      <p className="text-sm text-cyan-400 mt-1">Save 33% vs monthly</p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Unlimited recordings</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Unlimited notes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Unlimited vocabulary entries</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">AI-powered text formatting</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Priority processing</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Priority support</span>
                    </li>
                  </ul>

                  <Button
                    onClick={handleViewPricing}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="min-h-screen snap-start flex items-center justify-center pb-16">
            <div className="w-full">
              <div className="mx-auto max-w-4xl px-4 md:px-8 lg:px-12 text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  What <span className="text-cyan-500">People Say</span>
                </h2>
                <p className="text-gray-400 text-lg">
                  Creators and teams using OSCAR to turn voice into clear notes.
                </p>
              </div>
              <AnimatedTestimonials testimonials={TESTIMONIALS} autoplay />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
