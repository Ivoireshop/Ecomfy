import * as React from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLink?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-border/80 bg-card/40 backdrop-blur-sm animate-fade-in",
        className
      )}
    >
      <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 transition-transform duration-300 hover:scale-110">
        <Icon className="w-8 h-8 sm:w-10 sm:h-10" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2 text-foreground">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="btn-interactive shadow-md hover:shadow-emerald-500/20"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
