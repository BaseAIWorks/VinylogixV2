"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Package, ShoppingCart, Settings, Trash2, AlertCircle, Info, Users, CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
import { format, parseISO, formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import { formatPriceForDisplay } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { markAllNotificationsAsRead, deleteNotification } from "@/services/notification-service";
import { EmptyState } from "@/components/ui/empty-state";

type NotificationCategory = "all" | "orders" | "inventory" | "system";

const categoryConfig: Record<NotificationCategory, { label: string; icon: React.ElementType }> = {
  all: { label: "All", icon: Bell },
  orders: { label: "Orders", icon: ShoppingCart },
  inventory: { label: "Inventory", icon: Package },
  system: { label: "System", icon: Info },
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "new_order":
      return ShoppingCart;
    case "low_stock":
      return Package;
    default:
      return Info;
  }
};

const getNotificationCategory = (type: string): NotificationCategory => {
  if (type === "new_order") return "orders";
  if (type === "low_stock") return "inventory";
  return "system";
};

interface GroupedNotifications {
  today: AppNotification[];
  yesterday: AppNotification[];
  thisWeek: AppNotification[];
  older: AppNotification[];
}

function NotificationsPageContent() {
  const { user, notifications, markNotificationRead, refreshNotifications } = useAuth();
  const { toast } = useToast();

  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory>("all");
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  // Filter notifications by category
  const filteredNotifications = useMemo(() => {
    if (categoryFilter === "all") return notifications;
    return notifications.filter(n => getNotificationCategory(n.type) === categoryFilter);
  }, [notifications, categoryFilter]);

  // Group notifications by date
  const groupedNotifications: GroupedNotifications = useMemo(() => {
    const groups: GroupedNotifications = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    filteredNotifications.forEach(notification => {
      const date = parseISO(notification.createdAt);
      if (isToday(date)) {
        groups.today.push(notification);
      } else if (isYesterday(date)) {
        groups.yesterday.push(notification);
      } else if (isThisWeek(date)) {
        groups.thisWeek.push(notification);
      } else {
        groups.older.push(notification);
      }
    });

    return groups;
  }, [filteredNotifications]);

  // Count stats
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const categoryCount = {
    all: notifications.length,
    orders: notifications.filter(n => getNotificationCategory(n.type) === "orders").length,
    inventory: notifications.filter(n => getNotificationCategory(n.type) === "inventory").length,
    system: notifications.filter(n => getNotificationCategory(n.type) === "system").length,
  };

  const handleMarkAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    setIsMarkingAllRead(true);
    try {
      await markAllNotificationsAsRead(user);
      toast({ title: "Done", description: "All notifications marked as read." });
      refreshNotifications?.();
    } catch (error) {
      toast({ title: "Error", description: "Could not mark all as read.", variant: "destructive" });
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      toast({ title: "Deleted", description: "Notification removed." });
      refreshNotifications?.();
    } catch (error) {
      toast({ title: "Error", description: "Could not delete notification.", variant: "destructive" });
    }
  };

  const renderNotificationContent = (notification: AppNotification) => {
    const Icon = getNotificationIcon(notification.type);

    switch (notification.type) {
      case 'new_order':
        return (
          <div className="flex items-start gap-4 flex-1">
            <div className={cn(
              "p-2 rounded-full mt-0.5 shrink-0",
              !notification.isRead ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
            )}>
              <ShoppingCart className="h-4 w-4"/>
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", !notification.isRead && "font-semibold")}>
                {notification.message}
              </p>
              <p className="text-sm text-muted-foreground">
                New order <Link href={`/orders/${notification.orderId}`} className="font-medium underline hover:text-primary">#{notification.orderId?.slice(0,8)}...</Link> for € {formatPriceForDisplay(notification.orderTotal || 0)}.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      case 'low_stock':
      default:
        return (
          <div className="flex items-start gap-4 flex-1">
            <div className={cn(
              "p-2 rounded-full mt-0.5 shrink-0",
              !notification.isRead ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Package className="h-4 w-4"/>
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", !notification.isRead && "font-semibold")}>
                {notification.message}
              </p>
              <p className="text-sm text-muted-foreground">
                Only {notification.remainingStock} units of <Link href={`/records/${notification.recordId}`} className="font-medium underline hover:text-primary">{notification.recordTitle}</Link> left.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
    }
  };

  const renderNotificationGroup = (title: string, items: AppNotification[]) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-2">{title}</h3>
        {items.map(notification => (
          <div
            key={notification.id}
            className={cn(
              "flex items-start justify-between gap-4 p-4 rounded-lg border transition-colors",
              notification.isRead ? "bg-muted/30" : "bg-card border-l-2 border-l-primary"
            )}
          >
            {renderNotificationContent(notification)}
            <div className="flex items-center gap-1 shrink-0">
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => markNotificationRead(notification.id)}
                >
                  <Check className="h-4 w-4"/>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(notification.id)}
              >
                <Trash2 className="h-4 w-4"/>
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-primary"/>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Notifications
                  {unreadCount > 0 && (
                    <Badge variant="default">{unreadCount} new</Badge>
                  )}
                </CardTitle>
                <CardDescription>Alerts for new orders, low stock, and other important events.</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAllRead}
                  className="flex-1 sm:flex-none"
                >
                  {isMarkingAllRead ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-2" />
                  )}
                  Mark All Read
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Preferences
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(categoryConfig) as NotificationCategory[]).map(category => {
              const config = categoryConfig[category];
              const Icon = config.icon;
              const count = categoryCount[category];
              return (
                <Button
                  key={category}
                  variant={categoryFilter === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(category)}
                  className="gap-1.5"
                >
                  <Icon className="h-4 w-4" />
                  {config.label}
                  {count > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs h-5 min-w-[20px] px-1.5">
                      {count}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>

          {/* Notifications List */}
          {filteredNotifications.length > 0 ? (
            <div className="space-y-6">
              {renderNotificationGroup("Today", groupedNotifications.today)}
              {renderNotificationGroup("Yesterday", groupedNotifications.yesterday)}
              {renderNotificationGroup("This Week", groupedNotifications.thisWeek)}
              {renderNotificationGroup("Older", groupedNotifications.older)}
            </div>
          ) : (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description={
                categoryFilter !== "all"
                  ? "No notifications in this category."
                  : "You're all caught up!"
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function NotificationsPage() {
  return <NotificationsPageContent />;
}
