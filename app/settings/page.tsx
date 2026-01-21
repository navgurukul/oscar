"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  BookOpen,
  CreditCard,
  Crown,
  Calendar,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { vocabularyService } from "@/lib/services/vocabulary.service";
import { UsageIndicator } from "@/components/subscription/UsageIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import type { DBVocabularyEntry } from "@/lib/types/vocabulary.types";
import { ROUTES, PRICING } from "@/lib/constants";

const MAX_VOCABULARY_ENTRIES = 50;

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const {
    status,
    billingCycle,
    currentPeriodEnd,
    recordingsThisMonth,
    recordingsLimit,
    notesCount,
    notesLimit,
    isProUser,
    isLoading: subscriptionLoading,
    refetch,
  } = useSubscriptionContext();

  const [activeTab, setActiveTab] = useState("vocabulary");

  const [vocabulary, setVocabulary] = useState<DBVocabularyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Form state for new entry
  const [newTerm, setNewTerm] = useState("");
  const [newPronunciation, setNewPronunciation] = useState("");
  const [newContext, setNewContext] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editPronunciation, setEditPronunciation] = useState("");
  const [editContext, setEditContext] = useState("");

  // Billing state
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.SETTINGS}`);
    }
  }, [user, authLoading, router]);

  // Load vocabulary on mount
  useEffect(() => {
    async function loadVocabulary() {
      if (!user) return;

      setIsLoading(true);
      const { data, error } = await vocabularyService.getVocabulary();

      if (error) {
        toast({
          title: "Failed to load vocabulary",
          description: "Please refresh the page to try again.",
          variant: "destructive",
        });
      } else {
        setVocabulary(data || []);
      }
      setIsLoading(false);
    }

    if (user) {
      loadVocabulary();
    }
  }, [user, toast]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTerm.trim()) {
      toast({
        title: "Term is required",
        description: "Please enter a term to add.",
        variant: "destructive",
      });
      return;
    }

    if (vocabulary.length >= MAX_VOCABULARY_ENTRIES) {
      toast({
        title: "Vocabulary limit reached",
        description: `You can only add up to ${MAX_VOCABULARY_ENTRIES} entries.`,
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    const { data, error } = await vocabularyService.addVocabularyEntry({
      user_id: user!.id,
      term: newTerm.trim(),
      pronunciation: newPronunciation.trim() || null,
      context: newContext.trim() || null,
    });

    if (error) {
      const isDuplicate = error.message?.includes("duplicate");
      toast({
        title: isDuplicate ? "Term already exists" : "Failed to add entry",
        description: isDuplicate
          ? "This term is already in your vocabulary."
          : "Please try again.",
        variant: "destructive",
      });
    } else if (data) {
      setVocabulary([data, ...vocabulary]);
      setNewTerm("");
      setNewPronunciation("");
      setNewContext("");
      toast({
        title: "Entry added",
        description: `"${data.term}" has been added to your vocabulary.`,
      });
    }
    setIsAdding(false);
  };

  const handleDeleteEntry = async (id: string, term: string) => {
    const { error } = await vocabularyService.deleteVocabularyEntry(id);

    if (error) {
      toast({
        title: "Failed to delete entry",
        description: "Please try again.",
        variant: "destructive",
      });
    } else {
      setVocabulary(vocabulary.filter((v) => v.id !== id));
      toast({
        title: "Entry deleted",
        description: `"${term}" has been removed from your vocabulary.`,
      });
    }
  };

  const startEditing = (entry: DBVocabularyEntry) => {
    setEditingId(entry.id);
    setEditTerm(entry.term);
    setEditPronunciation(entry.pronunciation || "");
    setEditContext(entry.context || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTerm("");
    setEditPronunciation("");
    setEditContext("");
  };

  const handleUpdateEntry = async (id: string) => {
    if (!editTerm.trim()) {
      toast({
        title: "Term is required",
        description: "Please enter a term.",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await vocabularyService.updateVocabularyEntry(id, {
      term: editTerm.trim(),
      pronunciation: editPronunciation.trim() || null,
      context: editContext.trim() || null,
    });

    if (error) {
      toast({
        title: "Failed to update entry",
        description: "Please try again.",
        variant: "destructive",
      });
    } else if (data) {
      setVocabulary(vocabulary.map((v) => (v.id === id ? data : v)));
      cancelEditing();
      toast({
        title: "Entry updated",
        description: `"${data.term}" has been updated.`,
      });
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);

    try {
      const response = await fetch("/api/razorpay/cancel", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel subscription");
      }

      toast({
        title: "Subscription Cancelled",
        description:
          "Your subscription will remain active until the end of the billing period.",
      });

      setShowCancelConfirm(false);
      refetch();
    } catch (error) {
      console.error("Cancel error:", error);
      toast({
        title: "Cancellation Failed",
        description:
          error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-4xl mt-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">
            Manage your vocabulary, subscription, and billing
          </p>
        </div>

        {/* Vertical Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          orientation="vertical"
          className="flex gap-6"
        >
          <TabsList className="flex flex-col h-fit w-48 bg-slate-900 border border-cyan-700/30 p-2">
            <TabsTrigger
              value="vocabulary"
              className="w-full justify-start data-[state=active]:bg-cyan-500 data-[state=active]:text-white"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Vocabulary
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="w-full justify-start data-[state=active]:bg-cyan-500 data-[state=active]:text-white"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Vocabulary Tab Content */}
          <TabsContent value="vocabulary" className="flex-1 mt-0">
            <div className="bg-slate-900 rounded-2xl border border-cyan-700/30 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-xl font-semibold text-white">
                    Custom Vocabulary
                  </h2>
                </div>
                <span className="text-sm text-gray-400">
                  {vocabulary.length}/{MAX_VOCABULARY_ENTRIES} entries
                </span>
              </div>

              <p className="text-gray-400 text-sm mb-6">
                Add names, technical terms, or abbreviations that are often
                misrecognized. These will be used to improve speech-to-text
                accuracy.
              </p>

              {/* Add Form */}
              <form onSubmit={handleAddEntry} className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="term" className="text-xs text-gray-400">
                      Term *
                    </Label>
                    <Input
                      id="term"
                      type="text"
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value)}
                      placeholder="e.g., Sourav"
                      maxLength={100}
                      className="bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus-visible:ring-cyan-500 focus-visible:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="pronunciation"
                      className="text-xs text-gray-400"
                    >
                      Sounds like
                    </Label>
                    <Input
                      id="pronunciation"
                      type="text"
                      value={newPronunciation}
                      onChange={(e) => setNewPronunciation(e.target.value)}
                      placeholder="e.g., Shourabh, Saurav"
                      maxLength={100}
                      className="bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus-visible:ring-cyan-500 focus-visible:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="context" className="text-xs text-gray-400">
                      Category
                    </Label>
                    <Input
                      id="context"
                      type="text"
                      value={newContext}
                      onChange={(e) => setNewContext(e.target.value)}
                      placeholder="e.g., Person, Tech Term"
                      maxLength={50}
                      className="bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus-visible:ring-cyan-500 focus-visible:border-cyan-500"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isAdding || !newTerm.trim()}
                    className="border-2 hover:bg-cyan-600 px-2 h-9"
                    variant="ghost"
                  >
                    {isAdding ? (
                      <Spinner className="w-5 h-5" strokeWidth={2.5} />
                    ) : (
                      <Plus className="w-5 h-5" strokeWidth={2.5} />
                    )}
                  </Button>
                </div>
              </form>

              {/* Vocabulary List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="text-cyan-500" />
                </div>
              ) : vocabulary.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg">
                  <BookOpen className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No custom vocabulary yet</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Start by adding frequently used names or technical terms.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {vocabulary.map((entry) => (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-slate-800 rounded-lg p-3 border border-slate-700"
                      >
                        {editingId === entry.id ? (
                          // Edit mode
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <Input
                                type="text"
                                value={editTerm}
                                onChange={(e) => setEditTerm(e.target.value)}
                                placeholder="Term"
                                maxLength={100}
                                className="bg-slate-900 border-slate-600 text-white text-sm h-8 focus-visible:ring-cyan-500"
                              />
                              <Input
                                type="text"
                                value={editPronunciation}
                                onChange={(e) =>
                                  setEditPronunciation(e.target.value)
                                }
                                placeholder="Sounds like"
                                maxLength={100}
                                className="bg-slate-900 border-slate-600 text-white text-sm h-8 focus-visible:ring-cyan-500"
                              />
                              <Input
                                type="text"
                                value={editContext}
                                onChange={(e) => setEditContext(e.target.value)}
                                placeholder="Category"
                                maxLength={50}
                                className="bg-slate-900 border-slate-600 text-white text-sm h-8 focus-visible:ring-cyan-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleUpdateEntry(entry.id)}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditing}
                                className="text-gray-400 hover:text-white"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // Display mode
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-medium">
                                  {entry.term}
                                </span>
                                {entry.context && (
                                  <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                                    {entry.context}
                                  </span>
                                )}
                              </div>
                              {entry.pronunciation && (
                                <p className="text-gray-400 text-sm mt-0.5">
                                  Sounds like: {entry.pronunciation}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={() => startEditing(entry)}
                                className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteEntry(entry.id, entry.term)
                                }
                                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Billing Tab Content */}
          <TabsContent value="billing" className="flex-1 mt-0">
            <div className="space-y-6">
              {subscriptionLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Current Plan Card */}
                  <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              isProUser ? "bg-cyan-500/20" : "bg-gray-800"
                            }`}
                          >
                            <Crown
                              className={`w-6 h-6 ${
                                isProUser ? "text-cyan-400" : "text-gray-400"
                              }`}
                            />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-white">
                              {isProUser ? "Pro Plan" : "Free Plan"}
                            </h2>
                            <p className="text-gray-400 text-sm">
                              {isProUser
                                ? `₹${
                                    billingCycle === "monthly"
                                      ? PRICING.MONTHLY
                                      : PRICING.YEARLY
                                  }/${
                                    billingCycle === "monthly"
                                      ? "month"
                                      : "year"
                                  }`
                                : "No payment required"}
                            </p>
                          </div>
                        </div>
                        {isProUser && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              status === "active"
                                ? "bg-green-500/20 text-green-400"
                                : status === "cancelled"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {status === "active"
                              ? "Active"
                              : status === "cancelled"
                              ? "Cancelling"
                              : status.charAt(0).toUpperCase() +
                                status.slice(1)}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Subscription Details */}
                      {isProUser && (
                        <div className="space-y-3 mb-6 pb-6 border-b border-gray-800">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              Billing cycle
                            </span>
                            <span className="text-white">
                              {billingCycle === "monthly"
                                ? "Monthly"
                                : "Yearly"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {status === "cancelled"
                                ? "Access until"
                                : "Next billing date"}
                            </span>
                            <span className="text-white">
                              {formatDate(currentPeriodEnd)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3">
                        {isProUser ? (
                          <>
                            {status !== "cancelled" && (
                              <Button
                                variant="outline"
                                onClick={() => setShowCancelConfirm(true)}
                                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                              >
                                Cancel Subscription
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            onClick={() => router.push("/pricing")}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white"
                          >
                            Upgrade to Pro
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Usage Stats */}
                  <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl">
                    <CardHeader>
                      <h2 className="text-lg font-bold text-white">Usage</h2>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <UsageIndicator
                          type="recordings"
                          current={recordingsThisMonth}
                          limit={recordingsLimit}
                          variant="full"
                        />
                        <UsageIndicator
                          type="notes"
                          current={notesCount}
                          limit={notesLimit}
                          variant="full"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pro Benefits (for free users) */}
                  {!isProUser && (
                    <Card className="bg-slate-900 border-cyan-500/50 rounded-2xl shadow-xl ring-1 ring-cyan-500/50">
                      <CardHeader>
                        <h2 className="text-lg font-bold text-white">
                          Why Upgrade to Pro?
                        </h2>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3 mb-6">
                          <li className="flex items-center gap-3 text-gray-300">
                            <Check className="w-5 h-5 text-cyan-400" />
                            Unlimited recordings every month
                          </li>
                          <li className="flex items-center gap-3 text-gray-300">
                            <Check className="w-5 h-5 text-cyan-400" />
                            Store unlimited notes forever
                          </li>
                          <li className="flex items-center gap-3 text-gray-300">
                            <Check className="w-5 h-5 text-cyan-400" />
                            Priority AI processing
                          </li>
                          <li className="flex items-center gap-3 text-gray-300">
                            <Check className="w-5 h-5 text-cyan-400" />
                            Priority customer support
                          </li>
                        </ul>
                        <Button
                          onClick={() => router.push("/pricing")}
                          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                        >
                          Upgrade Now - Starting at ₹{PRICING.MONTHLY}/month
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Cancel Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl max-w-md w-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Cancel Subscription?
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-6">
                  Are you sure you want to cancel? You&apos;ll lose access to
                  Pro features at the end of your billing period on{" "}
                  <span className="text-white">
                    {formatDate(currentPeriodEnd)}
                  </span>
                  .
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 border-gray-700"
                    disabled={isCancelling}
                  >
                    Keep Subscription
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelSubscription}
                    className="flex-1"
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Yes, Cancel"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
