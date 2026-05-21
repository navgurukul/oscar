"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { v2 } from "@/components/v2/V2Primitives";

export function ScribbleEditorSkeleton() {
  const bar = { background: v2.rule };

  return (
    <div className="w-full max-w-[650px]">
      <Card
        className="rounded-t-2xl overflow-hidden"
        style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
      >
        <CardHeader>
          <div className="flex gap-6 justify-between items-center">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <div className="h-7 w-48 rounded animate-pulse" style={bar} />
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <div className="h-8 w-8 rounded animate-pulse" style={bar} />
              <div className="h-8 w-8 rounded animate-pulse" style={bar} />
              <div className="h-8 w-8 rounded animate-pulse" style={bar} />
            </div>
          </div>
          <Separator className="w-24 h-0.5" style={{ background: v2.accent, opacity: 0.5 }} />
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            <div className="h-4 w-full rounded animate-pulse" style={bar} />
            <div className="h-4 w-full rounded animate-pulse" style={bar} />
            <div className="h-4 w-3/4 rounded animate-pulse" style={bar} />
            <div className="h-4 w-full rounded animate-pulse" style={bar} />
            <div className="h-4 w-5/6 rounded animate-pulse" style={bar} />
            <div className="h-4 w-full rounded animate-pulse" style={bar} />
            <div className="h-4 w-2/3 rounded animate-pulse" style={bar} />
          </div>

          <div
            className="flex md:hidden justify-center items-center mt-6 pt-6"
            style={{ borderTop: `1px solid ${v2.rule}` }}
          >
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded animate-pulse" style={bar} />
              <div className="h-12 w-12 rounded animate-pulse" style={bar} />
              <div className="h-12 w-12 rounded animate-pulse" style={bar} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <div
          className="h-10 w-48 rounded-b-2xl animate-pulse"
          style={{ background: v2.accentSoft }}
        />
      </div>
    </div>
  );
}
