"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Package, ShoppingCart, Users, Bell, HardHat, Briefcase, FileText, type LucideIcon } from "lucide-react";
import { Button } from "./button";

// action accepts either a ReactNode (callers render their own button/JSX,
// e.g. a ternary switching between "Clear Filters" and "Add New") or the
// simple object shape for single-CTA cases.
type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode | EmptyStateAction;
  className?: string;
}

function isActionObject(a: unknown): a is EmptyStateAction {
  return typeof a === 'object' && a !== null && 'label' in a && typeof (a as any).label === 'string';
}

const defaultIcons: Record<string, LucideIcon> = {
  records: Package,
  orders: ShoppingCart,
  clients: Users,
  operators: HardHat,
  suppliers: Briefcase,
  notifications: Bell,
  default: FileText,
};

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4",
        className
      )}
    >
      <div className="bg-muted rounded-full p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        isActionObject(action) ? (
          action.href ? (
            <Button asChild>
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )
        ) : (
          action
        )
      )}
    </div>
  );
}

export { defaultIcons as emptyStateIcons };
