"use client";

import * as React from "react";
import { Search, X, Calendar as CalendarIcon, Download, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Badge } from "./badge";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export type DateRangePreset = "today" | "7days" | "30days" | "90days" | "custom" | "all";

interface DataTableToolbarProps {
  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  // Date Range
  showDateFilter?: boolean;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  datePreset?: DateRangePreset;
  onDatePresetChange?: (preset: DateRangePreset) => void;

  // Export
  showExport?: boolean;
  onExport?: () => void;
  exportLabel?: string;

  // Selected items
  selectedCount?: number;
  onClearSelection?: () => void;

  // Additional actions slot
  children?: React.ReactNode;

  className?: string;
}

const datePresetOptions: { value: DateRangePreset; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "90days", label: "Last 90 Days" },
  { value: "custom", label: "Custom Range" },
];

function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7days":
      return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    case "30days":
      return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    case "90days":
      return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
    case "all":
    case "custom":
    default:
      return { from: undefined, to: undefined };
  }
}

export function DataTableToolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  showDateFilter = false,
  dateRange,
  onDateRangeChange,
  datePreset = "all",
  onDatePresetChange,
  showExport = false,
  onExport,
  exportLabel = "Export CSV",
  selectedCount = 0,
  onClearSelection,
  children,
  className,
}: DataTableToolbarProps) {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  const handlePresetChange = (preset: DateRangePreset) => {
    onDatePresetChange?.(preset);
    if (preset !== "custom") {
      onDateRangeChange?.(getDateRangeFromPreset(preset));
      setIsCalendarOpen(false);
    } else {
      setIsCalendarOpen(true);
    }
  };

  const formatDateRange = () => {
    if (datePreset === "all") return "All Time";
    if (datePreset !== "custom") {
      return datePresetOptions.find(o => o.value === datePreset)?.label || "All Time";
    }
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;
    }
    if (dateRange?.from) {
      return `From ${format(dateRange.from, "MMM d, yyyy")}`;
    }
    return "Select dates";
  };

  const hasActiveFilters = searchValue || (datePreset !== "all" && datePreset !== undefined);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          {/* Search */}
          {onSearchChange && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-9"
              />
              {searchValue && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Date Filter */}
          {showDateFilter && onDateRangeChange && (
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal min-w-[180px]",
                    datePreset !== "all" && "border-primary"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span className="truncate">{formatDateRange()}</span>
                  <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex">
                  <div className="border-r p-2 space-y-1">
                    {datePresetOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handlePresetChange(option.value)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted",
                          datePreset === option.value && "bg-muted font-medium"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {datePreset === "custom" && (
                    <div className="p-2">
                      <Calendar
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={{
                          from: dateRange?.from,
                          to: dateRange?.to,
                        }}
                        onSelect={(range) => {
                          onDateRangeChange({
                            from: range?.from,
                            to: range?.to,
                          });
                        }}
                        numberOfMonths={2}
                      />
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export Button */}
          {showExport && onExport && (
            <Button variant="outline" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              {exportLabel}
            </Button>
          )}

          {/* Additional Actions */}
          {children}
        </div>
      </div>

      {/* Selected Items Indicator */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{selectedCount} selected</Badge>
          {onClearSelection && (
            <button
              onClick={onClearSelection}
              className="text-primary hover:underline"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { getDateRangeFromPreset, datePresetOptions };
