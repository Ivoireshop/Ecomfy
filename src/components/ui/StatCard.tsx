import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  description?: string;
  className?: string;
  variant?: "default" | "emerald" | "slate" | "amber";
}

export function StatCard({
  title,
  value,
  change,
  isPositive = true,
  icon: Icon,
  description,
  className,
  variant = "default",
}: StatCardProps) {
  const variantStyles = {
    default: "border-border/60 bg-card hover:border-emerald-500/30",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-50 hover:border-emerald-500/50",
    slate: "border-slate-800/20 bg-slate-900/5 dark:bg-slate-900/40 hover:border-slate-700/40",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-50 hover:border-amber-500/50",
  };

  const iconBgStyles = {
    default: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    emerald: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    slate: "bg-slate-900/10 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    amber: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  };

  return (
    <Card
      className={cn(
        "p-5 card-interactive relative overflow-hidden group shadow-sm hover:shadow-md transition-all duration-300",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {value}
            </h3>
            {change && (
              <span
                className={cn(
                  "inline-flex items-center text-xs font-semibold rounded-full px-1.5 py-0.5",
                  isPositive
                    ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "text-rose-700 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-400"
                )}
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {change}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>
        <div
          className={cn(
            "p-3 rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-110",
            iconBgStyles[variant]
          )}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
    </Card>
  );
}
