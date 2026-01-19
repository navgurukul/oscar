"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/**
 * Skeleton component for NoteEditor - matches the layout with pulsing placeholders
 */
export function NoteEditorSkeleton() {
  return (
    <div className="w-full max-w-[650px]">
      <Card className="bg-slate-900 border-cyan-700/30 rounded-t-2xl shadow-xl overflow-hidden">
        <CardHeader>
          {/* Title skeleton */}
          <div className="flex gap-6 justify-between items-center">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                {/* Title placeholder */}
                <div className="h-7 w-48 bg-slate-700 rounded animate-pulse" />
              </div>
            </div>

            {/* Action buttons skeleton */}
            <div className="hidden md:flex items-center gap-2">
              <div className="h-8 w-8 bg-slate-700 rounded animate-pulse" />
              <div className="h-8 w-8 bg-slate-700 rounded animate-pulse" />
              <div className="h-8 w-8 bg-slate-700 rounded animate-pulse" />
            </div>
          </div>
          <Separator className="w-24 h-0.5 bg-cyan-500/50" />
        </CardHeader>

        <CardContent>
          {/* Content skeleton - multiple lines */}
          <div className="space-y-3">
            <div className="h-4 w-full bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-full bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-full bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-full bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-slate-700 rounded animate-pulse" />
          </div>

          {/* Mobile action buttons skeleton */}
          <div className="flex md:hidden justify-center items-center mt-6 pt-6 border-t border-slate-700/50">
            <div className="flex gap-4">
              <div className="h-12 w-12 bg-slate-700 rounded animate-pulse" />
              <div className="h-12 w-12 bg-slate-700 rounded animate-pulse" />
              <div className="h-12 w-12 bg-slate-700 rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transcript toggle button skeleton */}
      <div className="flex justify-center">
        <div className="h-10 w-48 bg-cyan-700/30 rounded-b-2xl animate-pulse" />
      </div>
    </div>
  );
}
