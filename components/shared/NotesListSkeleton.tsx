"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/**
 * Skeleton component for notes list - shows 3 card placeholders
 */
export function NotesListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card
          key={i}
          className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl overflow-hidden"
        >
          <CardHeader>
            <div className="flex gap-6 justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="mb-2">
                  {/* Title skeleton */}
                  <div className="h-6 w-48 bg-slate-700 rounded animate-pulse mb-2" />
                  {/* Date skeleton */}
                  <div className="h-4 w-32 bg-slate-700/60 rounded animate-pulse" />
                </div>
              </div>
              {/* Delete button skeleton */}
              <div className="h-8 w-8 bg-slate-700/40 rounded animate-pulse" />
            </div>
            <Separator className="w-24 h-0.5 bg-cyan-500/50" />
          </CardHeader>
          <CardContent>
            {/* Preview text skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-full bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-700 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
