"use client";

import { useState } from "react";
import { FileText, ExternalLink, Download, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function DataPrivacySection() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExportData = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    setIsExporting(true);
    try {
      const res = await fetch("/api/user/export-data");
      if (!res.ok) {
        throw new Error("Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oscar-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: "Your data has been downloaded." });
    } catch {
      toast({ title: "Export failed", description: "Could not export your data. Please try again.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearData = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch("/api/user/clear-data", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Clear failed");
      }
      toast({ title: "Data cleared", description: "All your Scribbles and vocabulary have been permanently deleted." });
      setShowClearConfirm(false);
    } catch {
      toast({ title: "Clear failed", description: "Could not clear your data. Please try again.", variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Controls */}
      <Card className="bg-slate-900 border-cyan-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-cyan-500" />
            Your Data
          </CardTitle>
          <CardDescription className="text-gray-400">
            Export or permanently delete your stored data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="flex items-center justify-between w-full p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >              <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-cyan-400" />
              <div className="text-left">
                <p className="text-gray-300 text-sm font-medium">Export my data</p>
                <p className="text-gray-500 text-xs">Download all your Scribbles and vocabulary as JSON</p>
              </div>
            </div>
            {isExporting && (
              <span className="text-xs text-gray-500 animate-pulse">Exporting…</span>
            )}
          </button>

          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center justify-between w-full p-3 rounded-lg bg-slate-800 hover:bg-red-900/20 transition-colors border border-transparent hover:border-red-700/30"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-red-400" />
                <div className="text-left">
                  <p className="text-red-400 text-sm font-medium">Clear all data</p>
                  <p className="text-gray-500 text-xs">Permanently delete all Scribbles and vocabulary</p>
                </div>
              </div>
            </button>
          ) : (
            <div className="p-3 rounded-lg bg-red-900/20 border border-red-700/40 space-y-3">
              <p className="text-red-300 text-sm font-medium">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleClearData}
                  disabled={isClearing}
                  className="flex-1 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClearing ? "Clearing…" : "Yes, delete everything"}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legal Documents */}
      <Card className="bg-slate-900 border-cyan-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-500" />
            Legal & Compliance
          </CardTitle>
          <CardDescription className="text-gray-400">
            Review our terms and policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <span className="text-gray-300">Privacy Policy</span>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <span className="text-gray-300">Terms of Service</span>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
          <a
            href="/refund-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <span className="text-gray-300">Refund Policy</span>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
