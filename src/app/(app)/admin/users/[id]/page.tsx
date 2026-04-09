"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, AlertTriangle, UserCircle, Mail, Phone, Home, Briefcase, CalendarPlus, Clock, ShoppingCart, Settings, Package, Users, LogIn, Eye, Send, FileText, ShieldCheck } from "lucide-react";
import type { User, UserActivity } from "@/types";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getUserById } from "@/services/user-service";
import { getUserActivities } from "@/services/activity-service";
import { useParams, useRouter } from "next/navigation";
import { format, formatDistanceToNow, parseISO } from 'date-fns';

const activityIcons: Record<string, React.ElementType> = {
  session_start: LogIn,
  collection_browse: Eye,
  cart_update: ShoppingCart,
  order_placed: Package,
  order_status_change: FileText,
  settings_update: Settings,
  record_added: Package,
  record_edited: FileText,
  client_invited: Send,
  access_request: Users,
  import_completed: FileText,
};

const activityColors: Record<string, string> = {
  session_start: 'bg-blue-500',
  collection_browse: 'bg-purple-500',
  cart_update: 'bg-yellow-500',
  order_placed: 'bg-green-500',
  order_status_change: 'bg-indigo-500',
  settings_update: 'bg-gray-500',
  record_added: 'bg-primary',
  record_edited: 'bg-primary',
  client_invited: 'bg-pink-500',
  access_request: 'bg-amber-500',
  import_completed: 'bg-teal-500',
};

const originLabels: Record<string, { label: string; color: string }> = {
  invited: { label: 'Invited by Distributor', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  access_request: { label: 'Access Request', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  self_signup: { label: 'Self Signup', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  admin_created: { label: 'Created by Admin', color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
};

export default function AdminUserDetailPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const userId = typeof params.id === 'string' ? params.id : '';

  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!authUser || authUser.role !== 'superadmin' || !userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [userData, activityData] = await Promise.all([
        getUserById(userId),
        getUserActivities(userId, 50),
      ]);
      setTargetUser(userData);
      setActivities(activityData);
    } catch (error) {
      toast({ title: "Error", description: "Could not load user data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, userId, toast]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (authUser?.role !== 'superadmin') {
    return <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h2 className="text-2xl font-semibold text-destructive">Access Denied</h2></div>;
  }

  if (!targetUser) {
    return <div className="text-center p-8"><AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" /><h2 className="text-xl font-semibold">User not found.</h2><Button onClick={() => router.back()} variant="outline" className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" />Go Back</Button></div>;
  }

  const origin = targetUser.originType ? originLabels[targetUser.originType] : null;
  const fullName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || targetUser.email || 'Unknown';
  const fullAddress = [targetUser.addressLine1, targetUser.addressLine2, `${targetUser.postcode || ''} ${targetUser.city || ''}`.trim(), targetUser.country].filter(Boolean).join('\n');

  // Group activities by date
  const groupedActivities: Record<string, UserActivity[]> = {};
  activities.forEach(a => {
    const dateKey = format(parseISO(a.createdAt), 'yyyy-MM-dd');
    if (!groupedActivities[dateKey]) groupedActivities[dateKey] = [];
    groupedActivities[dateKey].push(a);
  });

  return (
    <div className="space-y-6">
      <Button onClick={() => router.back()} variant="outline" size="sm">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <UserCircle className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <Badge variant="outline" className="capitalize">{targetUser.role}</Badge>
            {origin && (
              <Badge variant="outline" className={`text-xs ${origin.color}`}>{origin.label}{targetUser.originDistributorName ? ` — ${targetUser.originDistributorName}` : ''}</Badge>
            )}
            {targetUser.vatValidated && (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30"><ShieldCheck className="h-3 w-3 mr-1" />VAT Verified</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">{targetUser.email}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: User Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">User Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {targetUser.companyName && <div className="flex items-start gap-2"><Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Company</p><p className="font-medium">{targetUser.companyName}</p></div></div>}
              <div className="flex items-start gap-2"><Mail className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Email</p><p>{targetUser.email}</p></div></div>
              {targetUser.phoneNumber && <div className="flex items-start gap-2"><Phone className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Phone</p><p>{targetUser.phoneNumber}</p></div></div>}
              {fullAddress && <div className="flex items-start gap-2"><Home className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Address</p><p className="whitespace-pre-wrap">{fullAddress}</p></div></div>}
              {targetUser.createdAt && <div className="flex items-start gap-2"><CalendarPlus className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Account Created</p><p>{format(parseISO(targetUser.createdAt), 'dd MMM yyyy, HH:mm')}</p></div></div>}
              {targetUser.lastLoginAt && <div className="flex items-start gap-2"><Clock className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Last Login</p><p>{format(parseISO(targetUser.lastLoginAt), 'dd MMM yyyy, HH:mm')}</p><p className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(targetUser.lastLoginAt), { addSuffix: true })}</p></div></div>}
            </CardContent>
          </Card>

          {/* Login History */}
          {targetUser.loginHistory && targetUser.loginHistory.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Login History</CardTitle><CardDescription>Last {targetUser.loginHistory.length} logins</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {targetUser.loginHistory.map((login, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{format(parseISO(login), 'dd MMM yyyy, HH:mm')}</span>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(login), { addSuffix: true })}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Activity Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Activity Timeline</CardTitle>
              <CardDescription>Recent activity on the platform ({activities.length} events)</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No activity recorded yet.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedActivities).map(([dateKey, dayActivities]) => (
                    <div key={dateKey}>
                      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                        {format(parseISO(dateKey), 'EEEE, dd MMMM yyyy')}
                      </p>
                      <div className="space-y-3">
                        {dayActivities.map((activity) => {
                          const Icon = activityIcons[activity.action] || FileText;
                          const color = activityColors[activity.action] || 'bg-gray-500';
                          return (
                            <div key={activity.id} className="flex items-start gap-3">
                              <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full ${color} flex items-center justify-center`}>
                                <Icon className="h-3.5 w-3.5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{activity.details || activity.action.replace('_', ' ')}</p>
                                {activity.metadata?.distributorName && (
                                  <p className="text-xs text-muted-foreground">{activity.metadata.distributorName}</p>
                                )}
                                <p className="text-xs text-muted-foreground">{format(parseISO(activity.createdAt), 'HH:mm')}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
