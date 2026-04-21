"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CreditCard,
  Package,
  PackageCheck,
  Truck,
  Clock,
  ChevronRight,
  User as UserIcon,
  CheckCircle2,
} from "lucide-react";
import type { Order, OrderStatus } from "@/types";
import { parseISO, differenceInDays } from "date-fns";
import { formatPriceForDisplay } from "@/lib/utils";

// The 4 fulfillment lanes. `delivered` is intentionally not a lane — it's a
// terminal state that falls off the board so workers focus on what still
// needs to happen today.
interface KanbanColumn {
  id: OrderStatus;
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const columns: KanbanColumn[] = [
  { id: "paid", title: "Paid", icon: CreditCard, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/20" },
  { id: "processing", title: "Processing", icon: Package, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/20" },
  { id: "ready_to_ship", title: "Ready to Ship", icon: PackageCheck, color: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950/20" },
  { id: "shipped", title: "Shipped", icon: Truck, color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-950/20" },
];

// Deterministic colour from an email so the same collaborator is always the
// same swatch — no DB write, no profile picture needed. Keeps the chip
// recognisable at a glance.
function assigneeInitials(email: string | undefined | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] || email;
  const bits = local.split(/[._-]/).filter(Boolean);
  if (bits.length === 0) return local.slice(0, 2).toUpperCase();
  if (bits.length === 1) return bits[0].slice(0, 2).toUpperCase();
  return (bits[0][0] + bits[1][0]).toUpperCase();
}

function assigneeTone(email: string | undefined | null): string {
  if (!email) return "bg-muted text-muted-foreground";
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) & 0xffffffff;
  const palette = [
    "bg-rose-100 text-rose-700",
    "bg-orange-100 text-orange-700",
    "bg-amber-100 text-amber-700",
    "bg-lime-100 text-lime-700",
    "bg-emerald-100 text-emerald-700",
    "bg-teal-100 text-teal-700",
    "bg-sky-100 text-sky-700",
    "bg-indigo-100 text-indigo-700",
    "bg-fuchsia-100 text-fuchsia-700",
    "bg-pink-100 text-pink-700",
  ];
  return palette[Math.abs(hash) % palette.length];
}

function AssigneeChip({ email, isMe }: { email?: string | null; isMe: boolean }) {
  if (!email) {
    return (
      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground gap-1">
        <UserIcon className="h-3 w-3" />
        Unassigned
      </Badge>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-semibold shrink-0",
              assigneeTone(email),
              isMe && "ring-2 ring-primary ring-offset-1"
            )}
          >
            {assigneeInitials(email)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isMe ? "You" : email}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface KanbanCardProps {
  order: Order;
  currentUserUid: string;
  onClaim: (orderId: string) => void;
  onMarkPacked: (orderId: string) => void;
  onMarkShipped: (orderId: string) => void;
  onMarkDelivered: (orderId: string) => void;
  onViewOrder: (orderId: string) => void;
  isSelected?: boolean;
  onSelect?: (orderId: string) => void;
  showCheckbox?: boolean;
}

function KanbanCard({
  order,
  currentUserUid,
  onClaim,
  onMarkPacked,
  onMarkShipped,
  onMarkDelivered,
  onViewOrder,
  isSelected,
  onSelect,
  showCheckbox,
}: KanbanCardProps) {
  const orderAge = differenceInDays(new Date(), parseISO(order.createdAt));
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const assigneeEmail = order.assigneeEmail;
  const assigneeUid = order.assigneeUid;
  const isMine = !!assigneeUid && assigneeUid === currentUserUid;
  const isOthers = !!assigneeUid && !isMine;

  // Primary action label per status. "Take over" is a separate small button
  // whenever someone else is the current assignee — it's never the primary.
  const primary: { label: string; onClick: () => void } | null = (() => {
    switch (order.status) {
      case "paid":
        return {
          label: assigneeUid ? "Continue" : "Claim & start",
          onClick: () => onClaim(order.id),
        };
      case "processing":
        return { label: "Mark packed", onClick: () => onMarkPacked(order.id) };
      case "ready_to_ship":
        return { label: "Mark shipped", onClick: () => onMarkShipped(order.id) };
      case "shipped":
        return { label: "Mark delivered", onClick: () => onMarkDelivered(order.id) };
      default:
        return null;
    }
  })();

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
          <div className="flex items-center gap-2 min-w-0">
            {showCheckbox && onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(order.id)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="min-w-0">
              <p className="font-mono text-sm font-medium truncate">
                {order.orderNumber || order.id.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                {order.customerName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <AssigneeChip email={assigneeEmail} isMe={isMine} />
            {orderAge > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
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
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
          <span className="font-medium text-foreground">
            €{formatPriceForDisplay(order.totalAmount)}
          </span>
        </div>

        {/* Shipped-lane extra context: who shipped it + tracking hint */}
        {order.status === "shipped" && (order.shippedByEmail || order.trackingNumber) && (
          <div className="text-[11px] text-muted-foreground pt-1 border-t space-y-0.5">
            {order.shippedByEmail && (
              <div className="truncate">
                <CheckCircle2 className="h-3 w-3 inline mr-1 text-indigo-600" />
                Shipped by {order.shippedByEmail}
              </div>
            )}
            {order.trackingNumber && (
              <div className="truncate font-mono">
                {order.carrier?.toUpperCase()} · {order.trackingNumber}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1 pt-1">
          {primary && (
            <Button
              variant="default"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                primary.onClick();
              }}
            >
              {primary.label}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}

          {/* Shipped cards get a secondary "Edit tracking" button so you can
              fix a typo'd tracking number without un-shipping the order. The
              same dialog handles first-time and edit; markOrderShipped is
              idempotent and skips the customer email on subsequent calls. */}
          {order.status === "shipped" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onMarkShipped(order.id);
              }}
            >
              Edit tracking
            </Button>
          )}

          {/* Take-over is only rendered when someone else currently owns it,
              and only on lanes where claiming makes sense (i.e. pre-shipped). */}
          {isOthers && order.status !== "shipped" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  Take over
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Take over this order?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {assigneeEmail} is currently on order{" "}
                    <span className="font-mono">{order.orderNumber || order.id.slice(0, 8)}</span>.
                    Taking over will make you the active assignee. The previous
                    owner stays recorded in the order's handover history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onClaim(order.id)}>
                    Take over
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface KanbanBoardProps {
  orders: Order[];
  currentUserUid: string;
  onClaim: (orderId: string) => void;
  onMarkPacked: (orderId: string) => void;
  onMarkShipped: (orderId: string) => void;
  onMarkDelivered: (orderId: string) => void;
  onViewOrder: (orderId: string) => void;
  selectedOrders?: Set<string>;
  onSelectOrder?: (orderId: string) => void;
  onSelectAll?: (columnStatus: OrderStatus) => void;
  showCheckboxes?: boolean;
}

export function KanbanBoard({
  orders,
  currentUserUid,
  onClaim,
  onMarkPacked,
  onMarkShipped,
  onMarkDelivered,
  onViewOrder,
  selectedOrders,
  onSelectOrder,
  onSelectAll,
  showCheckboxes = false,
}: KanbanBoardProps) {
  const ordersByStatus = React.useMemo(() => {
    // Every OrderStatus gets an empty array so the Record<> type is satisfied.
    // Only the four fulfillment lanes in `columns` above actually render.
    const grouped: Record<OrderStatus, Order[]> = {
      awaiting_approval: [],
      pending: [],
      awaiting_payment: [],
      paid: [],
      processing: [],
      ready_to_ship: [],
      shipped: [],
      delivered: [],
      on_hold: [],
      cancelled: [],
    };

    orders.forEach((order) => {
      if (grouped[order.status]) {
        grouped[order.status].push(order);
      }
    });

    // FIFO on the paid lane — oldest first. Stops fresh orders from jumping
    // the queue and starving the ones that arrived earlier in the day.
    grouped.paid.sort((a, b) => parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime());
    // Same FIFO ordering for processing + ready_to_ship so time-in-lane is visible.
    grouped.processing.sort((a, b) => parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime());
    grouped.ready_to_ship.sort((a, b) => parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime());
    // Shipped: most recently shipped first — it's the "just done" lane.
    grouped.shipped.sort((a, b) => {
      const aAt = a.shippedAt ? parseISO(a.shippedAt).getTime() : 0;
      const bAt = b.shippedAt ? parseISO(b.shippedAt).getTime() : 0;
      return bAt - aAt;
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
              className={cn("w-[280px] shrink-0 rounded-lg p-3", column.bgColor)}
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
                      currentUserUid={currentUserUid}
                      onClaim={onClaim}
                      onMarkPacked={onMarkPacked}
                      onMarkShipped={onMarkShipped}
                      onMarkDelivered={onMarkDelivered}
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
