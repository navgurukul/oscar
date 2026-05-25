"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { useRazorpayCheckout } from "@/components/subscription/RazorpayCheckout";
import {
  PRICING,
  PRICING_USD,
  SUBSCRIPTION_CONFIG,
  type Currency,
} from "@/lib/constants";
import type { BillingCycle } from "@/lib/types/subscription.types";
import {
  v2,
  v2Serif,
  v2Mono,
  V2Caps,
  V2Mono,
  V2MarketingHeader,
} from "@/components/v2/V2Primitives";

type Tier = {
  key: "free" | "pro" | "teams";
  name: string;
  tag: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  featured: boolean;
};

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { tier: currentTier, refetch } = useSubscriptionContext();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [currency, setCurrency] = useState<Currency>("INR");

  const { initiateCheckout, isLoading: isCheckoutLoading } = useRazorpayCheckout({
    billingCycle,
    userEmail: user?.email || undefined,
    onSuccess: () => refetch(),
  });

  const pricingConfig = currency === "USD" ? PRICING_USD : PRICING;
  const proPrice = billingCycle === "monthly" ? pricingConfig.MONTHLY : pricingConfig.YEARLY;
  const symbol = currency === "USD" ? "$" : "₹";

  const tiers: Tier[] = [
    {
      key: "free",
      name: "Free",
      tag: "For trying it on",
      price: `${symbol}0`,
      cadence: "forever",
      blurb: "Enough to feel the difference. Not enough to live on it.",
      features: [
        `${SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS} Scribble recordings per month`,
        `Up to ${SUBSCRIPTION_CONFIG.FREE_MAX_SCRIBBLES} total Scribbles`,
        `Custom vocabulary (up to ${SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY} entries)`,
        "AI-powered formatting",
        "Basic voice-to-text",
      ],
      cta: currentTier === "free" ? "Current plan" : "Start free",
      featured: false,
    },
    {
      key: "pro",
      name: "Pro",
      tag: "For people who type too much",
      price: `${symbol}${proPrice}`,
      cadence:
        billingCycle === "monthly"
          ? "per month"
          : `billed annually · save ${pricingConfig.YEARLY_SAVINGS_PERCENT}%`,
      blurb: "Everything. Unlimited minutes, all surfaces, the whole archive.",
      features: [
        "Unlimited Scribble recordings",
        "Unlimited Scribbles + Minutes",
        "Web + desktop + mobile",
        "Context-aware dictation",
        "Vocabulary & folders",
        "Custom transforms & translations",
        "Priority support",
      ],
      cta:
        currentTier === "pro"
          ? "Current plan"
          : isCheckoutLoading
          ? "Loading…"
          : "Start 14-day trial",
      featured: true,
    },
    {
      key: "teams",
      name: "Teams",
      tag: "For working with people",
      price: `${symbol}${Math.round(proPrice * 0.85)}`,
      cadence: "per seat · billed annually",
      blurb: "Shared workspace, shared vocabulary, shared Minutes.",
      features: [
        "Everything in Pro",
        "Shared workspace + folders",
        "Team vocabulary",
        "Posted Minutes to Slack / Notion",
        "SSO",
        "Admin controls",
      ],
      cta: "Talk to us",
      featured: false,
    },
  ];

  const handleSelect = (tier: Tier) => {
    if (tier.key === "free") {
      if (!user) router.push("/auth?redirectTo=/recording");
      else router.push("/recording");
      return;
    }
    if (tier.key === "pro") {
      if (!user) router.push("/auth?redirectTo=/pricing");
      else if (currentTier !== "pro") initiateCheckout();
      return;
    }
    // teams — contact
    window.location.href = "mailto:hello@oscar.ai?subject=Oscar%20Teams%20inquiry";
  };

  return (
    <main style={{ background: v2.cream, color: v2.ink, fontFamily: "var(--font-figtree), system-ui" }}>
      <V2MarketingHeader active="PRICING" />

      <section className="px-6 md:px-14 pt-16 md:pt-24 pb-12 md:pb-16 text-center">
        <V2Caps>PRICING · TWO TIERS, NO TRICKS</V2Caps>
        <h1
          className="mt-5 mx-auto"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(48px, 9vw, 96px)",
            lineHeight: 0.96,
            letterSpacing: "-0.03em",
            fontWeight: 500,
            maxWidth: 900,
          }}
        >
          Free to try.<br />
          <em style={{ fontStyle: "italic", color: v2.accent }}>Pro</em> when you&rsquo;re hooked.
        </h1>
        <p className="mt-7 mx-auto max-w-lg text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Most people upgrade within a week. We&rsquo;re fine with that.
        </p>

        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          <div
            className="inline-flex items-center rounded-full p-1"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
          >
            {(["INR", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className="rounded-full px-4 py-1.5 text-[12px] font-medium transition"
                style={{
                  background: currency === c ? v2.ink : "transparent",
                  color: currency === c ? v2.cream : v2.inkSoft,
                }}
              >
                {c === "INR" ? "₹ INR" : "$ USD"}
              </button>
            ))}
          </div>
          <div
            className="inline-flex items-center rounded-full p-1"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
          >
            {(["monthly", "yearly"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBillingCycle(b)}
                className="rounded-full px-4 py-1.5 text-[12px] font-medium transition flex items-center gap-2"
                style={{
                  background: billingCycle === b ? v2.ink : "transparent",
                  color: billingCycle === b ? v2.cream : v2.inkSoft,
                }}
              >
                {b === "monthly" ? "Monthly" : "Yearly"}
                {b === "yearly" && (
                  <span
                    style={{
                      fontFamily: v2Mono,
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      color: billingCycle === "yearly" ? v2.accent : v2.inkFaint,
                    }}
                  >
                    SAVE {pricingConfig.YEARLY_SAVINGS_PERCENT}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 md:px-14 pb-20 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {tiers.map((t) => (
            <div
              key={t.key}
              className="rounded-lg p-7 md:p-9 flex flex-col"
              style={{
                background: t.featured ? v2.ink : v2.cream2,
                color: t.featured ? v2.cream : v2.ink,
                border: t.featured ? "none" : `1px solid ${v2.rule}`,
              }}
            >
              <V2Caps color={t.featured ? v2.accent : v2.inkFaint}>{t.tag.toUpperCase()}</V2Caps>
              <h3
                className="mt-3"
                style={{
                  fontFamily: v2Serif,
                  fontSize: 40,
                  lineHeight: 1.0,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                {t.name}
              </h3>
              <div className="mt-7 flex items-baseline gap-3">
                <span
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 56,
                    fontWeight: 500,
                    lineHeight: 1.0,
                    letterSpacing: "-0.025em",
                  }}
                >
                  {t.price}
                </span>
                <V2Mono
                  style={{
                    fontSize: 11,
                    color: t.featured ? "#a8a39a" : v2.inkFaint,
                    letterSpacing: "0.04em",
                  }}
                >
                  {t.cadence}
                </V2Mono>
              </div>
              <p
                className="mt-5 text-[14px] leading-relaxed"
                style={{ color: t.featured ? "#cfc9bd" : v2.inkSoft }}
              >
                {t.blurb}
              </p>
              <button
                onClick={() => handleSelect(t)}
                disabled={t.cta === "Current plan"}
                className="mt-7 w-full rounded-full py-3 text-[14px] font-medium transition disabled:opacity-60"
                style={{
                  background: t.featured ? v2.accent : v2.ink,
                  color: t.featured ? v2.ink : v2.cream,
                }}
              >
                {t.cta}
              </button>
              <ul className="mt-9 space-y-3 text-[13px] leading-relaxed flex-1">
                {t.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      style={{ marginTop: 5, flexShrink: 0 }}
                    >
                      <path
                        d="M5 12l5 5L20 7"
                        stroke={v2.accent}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span style={{ color: t.featured ? v2.cream : v2.ink }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-14 py-16 md:py-20" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <div className="grid grid-cols-12 gap-6 md:gap-10 max-w-6xl mx-auto">
          <div className="col-span-12 md:col-span-3">
            <V2Caps>QUESTIONS · ANSWERED</V2Caps>
          </div>
          <div className="col-span-12 md:col-span-9">
            {[
              [
                "Can I cancel anytime?",
                "Yes. Cancel from settings, no questions asked. Your data stays available for 30 days.",
              ],
              [
                "Is my audio private?",
                "Audio is processed and discarded. We keep the transcript, not the recording.",
              ],
              [
                "Does it work offline?",
                "The desktop app falls back to local Whisper when offline — slower, but it works.",
              ],
              [
                "Is there a team plan?",
                "Yes — Teams. Shared workspace, vocabulary, Minutes. Talk to us.",
              ],
            ].map(([q, a], i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-6 md:gap-8 py-6"
                style={{ borderBottom: `1px solid ${v2.rule}` }}
              >
                <div
                  className="col-span-12 md:col-span-4"
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 19,
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {q}
                </div>
                <div
                  className="col-span-12 md:col-span-8 text-[14px] leading-relaxed"
                  style={{ color: v2.inkSoft }}
                >
                  {a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
