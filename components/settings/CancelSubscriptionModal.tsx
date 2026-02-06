"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  periodEnd: string | null;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  periodEnd,
}: CancelSubscriptionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Cancel Subscription?</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 mb-6">
            Are you sure you want to cancel? You&apos;ll lose access to Pro features at the end of
            your billing period on{" "}
            <span className="text-white">{formatDate(periodEnd)}</span>.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-700"
              disabled={isLoading}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, Cancel"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
