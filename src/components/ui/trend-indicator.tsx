"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendIndicatorProps {
  value: number; // Percentage change
  showIcon?: boolean;
  showValue?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function TrendIndicator({
  value,
  showIcon = true,
  showValue = true,
  prefix = "",
  suffix = "%",
  className,
  size = "md",
}: TrendIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        sizeClasses[size],
        isPositive && "text-green-600 dark:text-green-400",
        isNegative && "text-red-600 dark:text-red-400",
        isNeutral && "text-muted-foreground",
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {showValue && (
        <span>
          {prefix}
          {isPositive && "+"}
          {value.toFixed(1)}
          {suffix}
        </span>
      )}
    </span>
  );
}

// Helper function to calculate percentage change
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}
