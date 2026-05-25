"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { v2 } from "@/components/v2/V2Primitives";

export function ScribbleListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card
          key={i}
          className="rounded-2xl overflow-hidden"
          style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
        >
          <CardHeader>
            <div className="flex gap-6 justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="mb-2">
                  <div
                    className="h-6 w-48 rounded animate-pulse mb-2"
                    style={{ background: v2.rule }}
                  />
                  <div
                    className="h-4 w-32 rounded animate-pulse"
                    style={{ background: v2.rule, opacity: 0.7 }}
                  />
                </div>
              </div>
              <div
                className="h-8 w-8 rounded animate-pulse"
                style={{ background: v2.rule, opacity: 0.6 }}
              />
            </div>
            <Separator className="w-24 h-0.5" style={{ background: v2.accent, opacity: 0.5 }} />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-4 w-full rounded animate-pulse" style={{ background: v2.rule }} />
              <div className="h-4 w-3/4 rounded animate-pulse" style={{ background: v2.rule }} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
