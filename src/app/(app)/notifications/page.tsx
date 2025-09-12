"use client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, Package, XCircle, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import { formatPriceForDisplay } from "@/lib/utils";

function NotificationsPageContent() {
    const { notifications, markNotificationRead } = useAuth();

    const renderNotificationContent = (notification: AppNotification) => {
        switch (notification.type) {
            case 'new_order':
                return (
                    <div className="flex items-start gap-4">
                        <div className="bg-blue-500/10 text-blue-500 p-2 rounded-full mt-1">
                            <ShoppingCart className="h-5 w-5"/>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">{notification.message}</p>
                            <p className="text-sm">
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
                    <div className="flex items-start gap-4">
                        <div className="bg-primary/10 text-primary p-2 rounded-full mt-1">
                            <Package className="h-5 w-5"/>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">{notification.message}</p>
                            <p className="text-sm">
                                Only {notification.remainingStock} units of <Link href={`/records/${notification.recordId}`} className="font-medium underline hover:text-primary">{notification.recordTitle}</Link> left.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                        </div>
                    </div>
                )
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Bell className="h-7 w-7 text-primary"/>
                        <div>
                            <CardTitle className="text-xl">Notifications</CardTitle>
                            <CardDescription>Alerts for new orders, low stock, and other important events.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {notifications.length > 0 ? (
                        <ul className="space-y-4">
                            {notifications.map(notification => (
                                <li 
                                    key={notification.id} 
                                    className={cn(
                                        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border",
                                        notification.isRead ? "bg-muted/50 text-muted-foreground" : "bg-card"
                                    )}
                                >
                                    {renderNotificationContent(notification)}
                                    {!notification.isRead && (
                                        <Button variant="ghost" size="sm" onClick={() => markNotificationRead(notification.id)}>
                                            <Check className="mr-2 h-4 w-4"/>
                                            Mark as read
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <XCircle className="mx-auto h-12 w-12 mb-4" />
                            <h3 className="text-lg font-semibold">No notifications</h3>
                            <p>You're all caught up!</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}


export default function NotificationsPage() {
    return (
        <NotificationsPageContent />
    )
}
