"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ArrowLeft, Activity, CheckCircle, XCircle, AlertCircle, Shield, RefreshCw } from "lucide-react";
import type { SystemLog } from "@/types";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getRecentSystemLogs, getSystemHealth, getActiveAlerts, resolveAlert } from "@/services/system-log-service";
import { useRouter } from "next/navigation";
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusColors: Record<string, string> = {
  success: 'bg-green-500/10 text-green-600 border-green-500/30',
  error: 'bg-red-500/10 text-red-600 border-red-500/30',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

const sourceLabels: Record<string, string> = {
  stripe_webhook: 'Stripe Webhook',
  paypal_webhook: 'PayPal Webhook',
  stripe_checkout: 'Stripe Checkout',
  paypal_checkout: 'PayPal Checkout',
  email_service: 'Email Service',
  vies_api: 'VIES VAT API',
  system: 'System',
};

export default function AdminSystemPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [alerts, setAlerts] = useState<SystemLog[]>([]);
  const [health, setHealth] = useState<{
    totalEvents: number;
    successCount: number;
    errorCount: number;
    warningCount: number;
    bySource: Record<string, { success: number; error: number }>;
    activeAlertCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'superadmin') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [logsData, healthData, alertsData] = await Promise.all([
        getRecentSystemLogs(100),
        getSystemHealth(),
        getActiveAlerts(),
      ]);
      setLogs(logsData);
      setHealth(healthData);
      setAlerts(alertsData);
    } catch (error) {
      toast({ title: "Error", description: "Could not load system data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && user?.role === 'superadmin') fetchData();
    else if (!authLoading) setIsLoading(false);
  }, [user, authLoading, fetchData]);

  const handleResolveAlert = async (alertId: string) => {
    await resolveAlert(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    toast({ title: "Alert resolved" });
  };

  const filteredLogs = sourceFilter === 'all' ? logs : logs.filter(l => l.source === sourceFilter);
  const errorRate = health && health.totalEvents > 0 ? ((health.errorCount / health.totalEvents) * 100).toFixed(1) : '0';

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (user?.role !== 'superadmin') {
    return <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h2 className="text-2xl font-semibold text-destructive">Access Denied</h2><Button onClick={() => router.push('/dashboard')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard</Button></div>;
  }

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="border-red-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="h-5 w-5" />Active Alerts ({alerts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                <div>
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-muted-foreground">{sourceLabels[alert.source] || alert.source} — {formatDistanceToNow(parseISO(alert.createdAt), { addSuffix: true })}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleResolveAlert(alert.id)}>
                  <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Health Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-green-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events (24h)</CardTitle>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{health?.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">{health?.successCount || 0} success</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-red-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors (24h)</CardTitle>
            <XCircle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(health?.errorCount || 0) > 0 ? 'text-red-600' : 'text-primary'}`}>{health?.errorCount || 0}</div>
            <p className="text-xs text-muted-foreground">{errorRate}% error rate</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings (24h)</CardTitle>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{health?.warningCount || 0}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-primary" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Shield className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(health?.activeAlertCount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{health?.activeAlertCount || 0}</div>
            <p className="text-xs text-muted-foreground">{(health?.activeAlertCount || 0) === 0 ? 'All systems normal' : 'Needs resolution'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Health by Source */}
      {health && Object.keys(health.bySource).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Health by Source (24h)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(health.bySource).map(([source, counts]) => (
                <div key={source} className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">{sourceLabels[source] || source}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-medium text-green-600">{counts.success}</span>
                    <span className="text-xs text-muted-foreground">/</span>
                    <span className={`text-sm font-medium ${counts.error > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{counts.error}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">ok / err</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />System Logs</CardTitle>
              <CardDescription>Recent 100 events</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {Object.entries(sourceLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden md:table-cell">Page</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div>{format(parseISO(log.createdAt), 'dd MMM, HH:mm:ss')}</div>
                        <div className="text-muted-foreground">{formatDistanceToNow(parseISO(log.createdAt), { addSuffix: true })}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">{sourceLabels[log.source] || log.source}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[log.status] || ''}`}>{log.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.userEmail ? (
                          <div className="flex flex-col">
                            <span className="text-foreground truncate max-w-[160px]" title={log.userEmail}>{log.userEmail}</span>
                            {log.userRole && <span className="text-muted-foreground capitalize">{log.userRole}</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">system</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {log.page ? <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{log.page}</code> : '-'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[400px] truncate" title={log.message}>{log.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No system logs yet. Events will appear as API calls and webhooks are processed.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
