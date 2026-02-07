"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { X, Loader2, type LucideIcon } from "lucide-react";

export interface BulkAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void | Promise<void>;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}

interface BulkActionsBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
  isProcessing?: boolean;
  processingLabel?: string;
  className?: string;
}

export function BulkActionsBar({
  selectedCount,
  actions,
  onClearSelection,
  isProcessing = false,
  processingLabel = "Processing...",
  className,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-3",
        "bg-background border rounded-lg shadow-lg",
        "animate-in slide-in-from-bottom-4 duration-200",
        className
      )}
    >
      {isProcessing ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{processingLabel}</span>
        </div>
      ) : (
        <>
          <span className="text-sm font-medium">
            {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
          </span>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant={action.variant || "outline"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled || isProcessing}
                >
                  {Icon && <Icon className="mr-1.5 h-4 w-4" />}
                  {action.label}
                </Button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
