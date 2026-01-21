"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { PricingCard } from "@/components/subscription/PricingCard";
import { useRazorpayCheckout } from "@/components/subscription/RazorpayCheckout";
import { PRICING, SUBSCRIPTION_CONFIG } from "@/lib/constants";
import { Check } from "lucide-react";
import type { BillingCycle } from "@/lib/types/subscription.types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FREE_FEATURES = [
  `${SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS} recordings per month`,
  `Up to ${SUBSCRIPTION_CONFIG.FREE_MAX_NOTES} total notes`,
  "AI-powered text formatting",
  "Basic voice-to-text",
  "Download and copy notes",
];

const PRO_FEATURES = [
  "Unlimited recordings",
  "Unlimited notes",
  "AI-powered text formatting",
  "Priority processing",
  "Download and copy notes",
  "Priority support",
];

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { tier, refetch } = useSubscriptionContext();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const { initiateCheckout, isLoading } = useRazorpayCheckout({
    billingCycle,
    userEmail: user?.email || undefined,
    onSuccess: () => {
      refetch();
    },
  });

  const handleFreePlan = () => {
    if (!user) {
      router.push("/auth?redirectTo=/recording");
    } else {
      router.push("/recording");
    }
  };

  const handleProPlan = () => {
    if (!user) {
      router.push("/auth?redirectTo=/pricing");
    } else {
      initiateCheckout();
    }
  };

  const price = billingCycle === "monthly" ? PRICING.MONTHLY : PRICING.YEARLY;

  return (
    <main className="min-h-screen py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent <span className="text-cyan-500">Pricing</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Start free and upgrade when you need more. No hidden fees, cancel
            anytime.
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
          <PricingCard
            tier="free"
            price={0}
            billingCycle={billingCycle}
            features={FREE_FEATURES}
            currentTier={tier}
            onSelect={handleFreePlan}
          />
          <PricingCard
            tier="pro"
            price={price}
            billingCycle={billingCycle}
            features={PRO_FEATURES}
            highlighted
            currentTier={tier}
            onSelect={handleProPlan}
            isLoading={isLoading}
          />
        </div>

        {/* Feature comparison table */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Compare Plans
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full max-w-2xl mx-auto">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-4 text-gray-400 font-medium">
                    Feature
                  </th>
                  <th className="text-center py-4 text-gray-400 font-medium">
                    Free
                  </th>
                  <th className="text-center py-4 text-cyan-400 font-medium">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-gray-800/50">
                  <td className="py-4 text-gray-300">Recordings per month</td>
                  <td className="py-4 text-center text-gray-400">
                    {SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS}
                  </td>
                  <td className="py-4 text-center text-cyan-400">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-4 text-gray-300">Total notes</td>
                  <td className="py-4 text-center text-gray-400">
                    {SUBSCRIPTION_CONFIG.FREE_MAX_NOTES}
                  </td>
                  <td className="py-4 text-center text-cyan-400">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-4 text-gray-300">AI formatting</td>
                  <td className="py-4 text-center">
                    <Check className="w-5 h-5 text-gray-400 mx-auto" />
                  </td>
                  <td className="py-4 text-center">
                    <Check className="w-5 h-5 text-cyan-400 mx-auto" />
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-4 text-gray-300">Voice-to-text</td>
                  <td className="py-4 text-center">
                    <Check className="w-5 h-5 text-gray-400 mx-auto" />
                  </td>
                  <td className="py-4 text-center">
                    <Check className="w-5 h-5 text-cyan-400 mx-auto" />
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-4 text-gray-300">Export notes</td>
                  <td className="py-4 text-center">
                    <Check className="w-5 h-5 text-gray-400 mx-auto" />
                  </td>
                  <td className="py-4 text-center">
                    <Check className="w-5 h-5 text-cyan-400 mx-auto" />
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-4 text-gray-300">Priority processing</td>
                  <td className="py-4 text-center text-gray-500">-</td>
                  <td className="py-4 text-center">
                    <Check className="w-5 h-5 text-cyan-400 mx-auto" />
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-4 text-gray-300">Priority support</td>
                  <td className="py-4 text-center text-gray-500">-</td>
                  <td className="py-4 text-center">
                    <Check className="w-5 h-5 text-cyan-400 mx-auto" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <Accordion
            type="single"
            collapsible
            className="bg-slate-900/50 border border-gray-800 rounded-lg"
          >
            <AccordionItem value="item-1" className="border-gray-800">
              <AccordionTrigger className="px-6 text-lg font-medium text-white hover:no-underline">
                Can I cancel anytime?
              </AccordionTrigger>
              <AccordionContent className="px-6 text-gray-400">
                Yes! You can cancel your subscription at any time. You&apos;ll
                continue to have access until the end of your billing period.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-gray-800">
              <AccordionTrigger className="px-6 text-lg font-medium text-white hover:no-underline">
                What happens to my notes if I downgrade?
              </AccordionTrigger>
              <AccordionContent className="px-6 text-gray-400">
                Your existing notes are safe! You&apos;ll keep all your notes,
                but new recording limits will apply.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem
              value="item-3"
              className="border-gray-800 border-b-0"
            >
              <AccordionTrigger className="px-6 text-lg font-medium text-white hover:no-underline">
                Is my payment secure?
              </AccordionTrigger>
              <AccordionContent className="px-6 text-gray-400">
                Absolutely. We use Razorpay, India&apos;s most trusted payment
                gateway, to process all payments securely.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </main>
  );
}
