import React from "react";
import { Card } from "@/components/ui/card";

export function ConnectUsFeedSkeleton() {
  return (
    <div className="space-y-4 w-full animate-fade-in">
      {[1, 2, 3].map((index) => (
        <Card
          key={index}
          className="p-5 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4 overflow-hidden"
        >
          {/* Header Skeleton (Avatar + Name + Badge) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-slate-200 animate-pulse shrink-0" />
              <div className="space-y-1.5 min-w-0">
                <div className="h-3.5 w-32 bg-slate-200 rounded-md animate-pulse" />
                <div className="h-2.5 w-20 bg-slate-150 rounded-md animate-pulse" />
              </div>
            </div>
            <div className="h-7 w-20 rounded-full bg-slate-200 animate-pulse" />
          </div>

          {/* Text Content Skeleton */}
          <div className="space-y-2 py-1">
            <div className="h-3 w-5/6 bg-slate-200 rounded-md animate-pulse" />
            <div className="h-3 w-4/6 bg-slate-200 rounded-md animate-pulse" />
          </div>

          {/* Media Block Skeleton (Image/Video placeholder) */}
          {index % 2 === 1 && (
            <div className="h-56 w-full rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
          )}

          {/* Footer Actions Skeleton (Like, Comment, Share) */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <div className="h-8 w-16 rounded-full bg-slate-150 animate-pulse" />
              <div className="h-8 w-20 rounded-full bg-slate-150 animate-pulse" />
            </div>
            <div className="h-8 w-16 rounded-full bg-slate-150 animate-pulse" />
          </div>
        </Card>
      ))}
    </div>
  );
}
