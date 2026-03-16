"use client";

import { useState } from "react";
import { Shield, Download, FileText, Trash2, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function DataPrivacySection() {
  useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // TODO: Implement data export API
      toast({
        title: "Export requested",
        description: "Your data export is being prepared. You will receive an email when it's ready.",
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAllData = async () => {
    try {
      // TODO: Implement clear all data API
      toast({
        title: "Data cleared",
        description: "All your notes and vocabulary have been deleted.",
      });
    } catch {
      toast({
        title: "Failed to clear data",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <Card className="bg-slate-900 border-cyan-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-cyan-500" />
            Export Your Data
          </CardTitle>
          <CardDescription className="text-gray-400">
            Download a copy of all your personal data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-300 text-sm">
            You can request a copy of your personal data, including:
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
            <li>All your notes and transcriptions</li>
            <li>Your vocabulary entries</li>
            <li>Account information</li>
            <li>Usage history</li>
          </ul>
          <Button
            onClick={handleExportData}
            disabled={isExporting}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Preparing export..." : "Request Data Export"}
          </Button>
        </CardContent>
      </Card>

      {/* Privacy Preferences */}
      <Card className="bg-slate-900 border-cyan-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-500" />
            Privacy Preferences
          </CardTitle>
          <CardDescription className="text-gray-400">
            Manage your privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="analytics" className="text-gray-300">Analytics & Improvements</Label>
              <p className="text-gray-500 text-sm">
                Help us improve OSCAR by sharing anonymous usage data
              </p>
            </div>
            <Switch
              id="analytics"
              checked={analyticsEnabled}
              onCheckedChange={setAnalyticsEnabled}
            />
          </div>
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

      {/* Clear All Data */}
      <Card className="bg-slate-900 border-red-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Clear All Data
          </CardTitle>
          <CardDescription className="text-gray-400">
            Delete all your notes and vocabulary while keeping your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="bg-red-600/80 hover:bg-red-700">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All My Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-900 border-slate-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Clear all your data?</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-400">
                  This will permanently delete all your notes, transcriptions, and vocabulary entries.
                  Your account and subscription will remain active. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAllData}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Yes, clear all data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
