"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

export interface StatusTab<T extends string> {
  value: T | "all";
  label: string;
  count?: number;
  color?: string;
}

interface StatusTabsProps<T extends string> {
  tabs: StatusTab<T>[];
  value: T | "all";
  onChange: (value: T | "all") => void;
  className?: string;
}

export function StatusTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: StatusTabsProps<T>) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 p-1 bg-muted rounded-lg",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
            value === tab.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <Badge
              variant="secondary"
              className={cn(
                "h-5 min-w-[20px] px-1.5 text-xs",
                value === tab.value && tab.color
              )}
            >
              {tab.count}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}
