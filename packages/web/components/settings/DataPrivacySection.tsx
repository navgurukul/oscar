"use client";

import { FileText, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DataPrivacySection() {
  useAuth();

  return (
    <div className="space-y-6">
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
