"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import type { BillingCycle } from "@/lib/types/subscription.types";

// Declare Razorpay global type
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutProps {
  billingCycle: BillingCycle;
  userEmail?: string;
  userName?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useRazorpayCheckout({
  billingCycle,
  userEmail,
  userName,
  onSuccess,
  onError,
}: RazorpayCheckoutProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => setIsScriptLoaded(true);
      script.onerror = () => {
        console.error("Failed to load Razorpay script");
        setIsScriptLoaded(false);
      };
      document.body.appendChild(script);
    } else {
      setIsScriptLoaded(true);
    }
  }, []);

  const initiateCheckout = useCallback(async () => {
    if (!isScriptLoaded) {
      toast({
        title: "Loading payment gateway",
        description: "Please wait while we initialize the payment...",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create subscription on server
      const response = await fetch("/api/razorpay/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planType: billingCycle }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create subscription");
      }

      const { subscriptionId, razorpayKeyId } = await response.json();

      // Open Razorpay checkout
      const options: RazorpayOptions = {
        key: razorpayKeyId,
        subscription_id: subscriptionId,
        name: "OSCAR Pro",
        description: `${
          billingCycle === "monthly" ? "Monthly" : "Yearly"
        } Subscription`,
        handler: async (razorpayResponse: RazorpayResponse) => {
          // Verify payment on server
          try {
            const verifyResponse = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_subscription_id:
                  razorpayResponse.razorpay_subscription_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
              }),
            });

            if (!verifyResponse.ok) {
              const data = await verifyResponse.json();
              throw new Error(data.error || "Payment verification failed");
            }

            toast({
              title: "Payment Successful!",
              description: "Welcome to OSCAR Pro. Enjoy unlimited access!",
            });

            onSuccess?.();
            router.push("/recording");
          } catch (verifyError) {
            console.error("Verification error:", verifyError);
            const errorMessage =
              verifyError instanceof Error
                ? verifyError.message
                : "Payment verification failed";
            toast({
              title: "Verification Failed",
              description: errorMessage,
              variant: "destructive",
            });
            onError?.(errorMessage);
          } finally {
            // Reset loading state after payment verification completes
            setIsLoading(false);
          }
        },
        prefill: {
          name: userName,
          email: userEmail,
        },
        theme: {
          color: "#06b6d4", // cyan-500
        },
        modal: {
          ondismiss: () => {
            // Reset loading state when user cancels/closes the payment modal
            setIsLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error("Checkout error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start checkout";
      toast({
        title: "Checkout Failed",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
      // Reset loading state on checkout initialization error
      setIsLoading(false);
    }
  }, [
    isScriptLoaded,
    billingCycle,
    userEmail,
    userName,
    toast,
    router,
    onSuccess,
    onError,
  ]);

  return {
    initiateCheckout,
    isLoading,
    isScriptLoaded,
  };
}
