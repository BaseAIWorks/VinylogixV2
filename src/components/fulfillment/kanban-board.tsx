"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreditCard, Package, Truck, CheckCircle, Clock, ChevronRight, GripVertical } from "lucide-react";
import type { Order, OrderStatus } from "@/types";
import { format, parseISO, differenceInDays } from "date-fns";
import { formatPriceForDisplay } from "@/lib/utils";

interface KanbanColumn {
  id: OrderStatus;
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const columns: KanbanColumn[] = [
  {
    id: "paid",
    title: "Paid",
    icon: CreditCard,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
  {
    id: "processing",
    title: "Processing",
    icon: Package,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
  },
  {
    id: "shipped",
    title: "Shipped",
    icon: Truck,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
  },
];

interface KanbanCardProps {
  order: Order;
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  onViewOrder: (orderId: string) => void;
  isSelected?: boolean;
  onSelect?: (orderId: string) => void;
  showCheckbox?: boolean;
}

function KanbanCard({
  order,
  onStatusChange,
  onViewOrder,
  isSelected,
  onSelect,
  showCheckbox,
}: KanbanCardProps) {
  const orderAge = differenceInDays(new Date(), parseISO(order.createdAt));
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    switch (currentStatus) {
      case "paid":
        return "processing";
      case "processing":
        return "shipped";
      default:
        return null;
    }
  };

  const nextStatus = getNextStatus(order.status);

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onViewOrder(order.id)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {showCheckbox && onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(order.id)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div>
              <p className="font-mono text-sm font-medium">
                {order.orderNumber || order.id.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                {order.customerName}
              </p>
            </div>
          </div>
          {orderAge > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs shrink-0",
                      orderAge > 3
                        ? "bg-red-100 text-red-700 border-red-200"
                        : orderAge > 1
                        ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                        : ""
                    )}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {orderAge}d
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Order placed {orderAge} day{orderAge !== 1 ? "s" : ""} ago
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
          <span className="font-medium text-foreground">
            €{formatPriceForDisplay(order.totalAmount)}
          </span>
        </div>

        {nextStatus && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(order.id, nextStatus);
            }}
          >
            Move to{" "}
            {nextStatus === "processing" ? "Processing" : "Shipped"}
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface KanbanBoardProps {
  orders: Order[];
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  onViewOrder: (orderId: string) => void;
  selectedOrders?: Set<string>;
  onSelectOrder?: (orderId: string) => void;
  onSelectAll?: (columnStatus: OrderStatus) => void;
  showCheckboxes?: boolean;
}

export function KanbanBoard({
  orders,
  onStatusChange,
  onViewOrder,
  selectedOrders,
  onSelectOrder,
  onSelectAll,
  showCheckboxes = false,
}: KanbanBoardProps) {
  const ordersByStatus = React.useMemo(() => {
    const grouped: Record<OrderStatus, Order[]> = {
      pending: [],
      awaiting_payment: [],
      paid: [],
      processing: [],
      shipped: [],
      on_hold: [],
      cancelled: [],
    };

    orders.forEach((order) => {
      if (grouped[order.status]) {
        grouped[order.status].push(order);
      }
    });

    return grouped;
  }, [orders]);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {columns.map((column) => {
          const columnOrders = ordersByStatus[column.id];
          const Icon = column.icon;
          const allSelected =
            selectedOrders &&
            columnOrders.length > 0 &&
            columnOrders.every((o) => selectedOrders.has(o.id));

          return (
            <div
              key={column.id}
              className={cn(
                "w-[280px] shrink-0 rounded-lg p-3",
                column.bgColor
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", column.color)} />
                  <h3 className="font-semibold text-sm">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnOrders.length}
                  </Badge>
                </div>
                {showCheckboxes && onSelectAll && columnOrders.length > 0 && (
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => onSelectAll(column.id)}
                  />
                )}
              </div>

              <div className="space-y-2">
                {columnOrders.length > 0 ? (
                  columnOrders.map((order) => (
                    <KanbanCard
                      key={order.id}
                      order={order}
                      onStatusChange={onStatusChange}
                      onViewOrder={onViewOrder}
                      isSelected={selectedOrders?.has(order.id)}
                      onSelect={onSelectOrder}
                      showCheckbox={showCheckboxes}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No orders
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
