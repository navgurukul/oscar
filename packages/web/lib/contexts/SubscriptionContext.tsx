"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import type {
  UsageStatsResponse,
  SubscriptionTier,
} from "@/lib/types/subscription.types";
import { SUBSCRIPTION_CONFIG } from "@/lib/constants";

interface SubscriptionContextType {
  // Subscription data
  tier: SubscriptionTier;
  status: string;
  billingCycle: string | null;
  currentPeriodEnd: string | null;

  // Usage data
  recordingsThisMonth: number;
  recordingsLimit: number | null;
  notesCount: number;
  notesLimit: number | null;

  // Computed values
  isProUser: boolean;
  canRecord: boolean;
  canCreateNote: boolean;
  remainingRecordings: number | null;
  remainingNotes: number | null;

  // State
  isLoading: boolean;
  error: string | null;

  // Actions
  refetch: () => Promise<void>;
  incrementUsage: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { user, isLoading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [status, setStatus] = useState("active");
  const [billingCycle, setBillingCycle] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);

  const [recordingsThisMonth, setRecordingsThisMonth] = useState(0);
  const [recordingsLimit, setRecordingsLimit] = useState<number | null>(
    SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS
  );
  const [notesCount, setNotesCount] = useState(0);
  const [notesLimit, setNotesLimit] = useState<number | null>(
    SUBSCRIPTION_CONFIG.FREE_MAX_NOTES
  );

  const [isProUser, setIsProUser] = useState(false);
  const [canRecord, setCanRecord] = useState(true);
  const [canCreateNote, setCanCreateNote] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) {
      // Reset to free tier defaults when not logged in
      setTier("free");
      setStatus("active");
      setBillingCycle(null);
      setCurrentPeriodEnd(null);
      setRecordingsThisMonth(0);
      setRecordingsLimit(SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS);
      setNotesCount(0);
      setNotesLimit(SUBSCRIPTION_CONFIG.FREE_MAX_NOTES);
      setIsProUser(false);
      setCanRecord(true);
      setCanCreateNote(true);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch("/api/usage/stats");

      if (!response.ok) {
        throw new Error("Failed to fetch subscription stats");
      }

      const data: UsageStatsResponse = await response.json();

      setTier(data.tier);
      setStatus(data.status);
      setBillingCycle(data.billingCycle);
      setCurrentPeriodEnd(data.currentPeriodEnd);
      setRecordingsThisMonth(data.recordingsThisMonth);
      setRecordingsLimit(data.recordingsLimit);
      setNotesCount(data.notesCount);
      setNotesLimit(data.notesLimit);
      setIsProUser(data.isProUser);
      setCanRecord(data.canRecord);
      setCanCreateNote(data.canCreateNote);
    } catch (err) {
      console.error("Error fetching subscription stats:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch when auth state changes
  useEffect(() => {
    if (!authLoading) {
      fetchStats();
    }
  }, [authLoading, fetchStats]);

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await fetch("/api/usage/increment", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 403) {
          setCanRecord(false);
          return false;
        }
        throw new Error(data.error || "Failed to increment usage");
      }

      const data = await response.json();
      setRecordingsThisMonth(data.recordingsThisMonth);
      setCanRecord(data.canRecord);

      return true;
    } catch (err) {
      console.error("Error incrementing usage:", err);
      return false;
    }
  }, [user]);

  // Calculate remaining
  const remainingRecordings =
    recordingsLimit !== null
      ? Math.max(0, recordingsLimit - recordingsThisMonth)
      : null;

  const remainingNotes =
    notesLimit !== null ? Math.max(0, notesLimit - notesCount) : null;

  const value: SubscriptionContextType = {
    tier,
    status,
    billingCycle,
    currentPeriodEnd,
    recordingsThisMonth,
    recordingsLimit,
    notesCount,
    notesLimit,
    isProUser,
    canRecord,
    canCreateNote,
    remainingRecordings,
    remainingNotes,
    isLoading,
    error,
    refetch: fetchStats,
    incrementUsage,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);

  if (context === undefined) {
    throw new Error(
      "useSubscriptionContext must be used within a SubscriptionProvider"
    );
  }

  return context;
}
