"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, AlertTriangle, PlusCircle, ArrowLeft, MoreVertical, Edit, Trash2, Eye, Mail, Building2, ShoppingCart, CheckCircle2, XCircle, Clock, RefreshCw, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { format, parseISO, subDays, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User, Order, AppNotification } from "@/types";
import { getClientsByDistributorId } from "@/services/user-service";
import { getOrders } from "@/services/order-service";
import { inviteClient, removeClientAccess } from "@/services/client-user-service";
import { getNotifications } from "@/services/notification-service";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { BulkActionsBar, type BulkAction } from "@/components/ui/bulk-actions-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPriceForDisplay } from "@/lib/utils";

type ClientStatus = 'pending' | 'active' | 'registered' | 'inactive';

interface ClientWithStats extends User {
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  isActive: boolean;
  clientStatus: ClientStatus;
  recentOrders: Order[];
}

export default function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [clients, setClients] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [clientToDelete, setClientToDelete] = useState<User | null>(null);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [accessRequests, setAccessRequests] = useState<AppNotification[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [verifyingVatId, setVerifyingVatId] = useState<string | null>(null);
  const [vatResults, setVatResults] = useState<Record<string, { valid: boolean; name?: string }>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "registered" | "inactive" | "pending">("active");

  // State for Invite Dialog
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'master' || !user.distributorId) {
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    try {
      const [fetchedClients, fetchedOrders, fetchedNotifications] = await Promise.all([
        getClientsByDistributorId(user.distributorId),
        getOrders(user),
        getNotifications(user),
      ]);
      setClients(fetchedClients);
      setOrders(fetchedOrders);
      setAccessRequests(
        fetchedNotifications.filter(
          (n) => n.type === 'access_request' && n.requestStatus === 'pending'
        )
      );
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch clients.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [user, authLoading, fetchData]);

  // Compute client stats from orders
  const clientsWithStats: ClientWithStats[] = useMemo(() => {
    const ninetyDaysAgo = subDays(new Date(), 90);

    return clients.map(client => {
      const clientOrders = orders.filter(o => o.viewerId === client.uid);
      const paidOrders = clientOrders.filter(o => o.status === 'paid' || o.status === 'shipped' || o.status === 'processing');
      const totalSpent = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const sortedOrders = [...clientOrders].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const lastOrderDate = sortedOrders[0]?.createdAt || null;
      const isActive = lastOrderDate ? isAfter(parseISO(lastOrderDate), ninetyDaysAgo) : false;

      // Determine client status
      const hasLoggedIn = client.lastLoginAt && client.createdAt &&
        Math.abs(new Date(client.lastLoginAt).getTime() - new Date(client.createdAt).getTime()) > 60000;
      let clientStatus: ClientStatus = 'inactive';
      if (!hasLoggedIn && client.profileComplete === false) {
        clientStatus = 'pending'; // Invite sent, not yet accepted/logged in
      } else if (isActive) {
        clientStatus = 'active'; // Has ordered in last 90 days
      } else if (hasLoggedIn && clientOrders.length === 0) {
        clientStatus = 'registered'; // Logged in but never ordered
      } else {
        clientStatus = 'inactive'; // Has ordered before but not in 90 days
      }

      return {
        ...client,
        totalOrders: clientOrders.length,
        totalSpent,
        lastOrderDate,
        isActive,
        clientStatus,
        recentOrders: sortedOrders.slice(0, 3),
      };
    });
  }, [clients, orders]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    let result = clientsWithStats;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(client =>
        (client.email?.toLowerCase() || '').includes(query) ||
        (`${client.firstName || ''} ${client.lastName || ''}`.toLowerCase()).includes(query) ||
        (client.companyName?.toLowerCase() || '').includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(client => client.clientStatus === statusFilter);
    }

    return result;
  }, [clientsWithStats, searchQuery, statusFilter]);

  const formatDateSafe = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    try {
      return format(parseISO(dateString), 'dd MMM yyyy');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const formatDateTimeSafe = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    try {
      return format(parseISO(dateString), 'dd MMM yyyy, HH:mm');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const handleRemoveClient = async () => {
    if (!clientToDelete || !user?.distributorId || !user.uid) return;
    try {
      await removeClientAccess(clientToDelete.uid, user.distributorId);
      toast({ title: "Client Removed", description: `"${clientToDelete.email}" has been removed from your client list.` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setClientToDelete(null);
    }
  };

  const handleInviteClient = async () => {
    if (!inviteEmail || !user?.distributorId || !user.uid) {
      toast({ title: "Invalid Input", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setIsInviting(true);
    try {
      const result = await inviteClient(inviteEmail, user.distributorId, inviteName || undefined);
      toast({
        title: "Success!",
        description: result.message,
      });
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteName("");
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Invitation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleAccessRequest = async (notificationId: string, action: 'approve' | 'deny', email?: string) => {
    if (!user?.distributorId) return;
    setProcessingRequestId(notificationId);
    try {
      const { auth: firebaseAuth } = await import('@/lib/firebase');
      const token = await firebaseAuth.currentUser?.getIdToken();
      const res = await fetch('/api/clients/access-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationId, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process request.');
      }
      setAccessRequests((prev) => prev.filter((r) => r.id !== notificationId));
      toast({
        title: action === 'approve' ? "Access Approved" : "Request Denied",
        description: action === 'approve'
          ? `${email} now has access to your catalog. They've been notified by email.`
          : "The request has been denied. The requester has been notified.",
      });
      if (action === 'approve') {
        fetchData();
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not process request.", variant: "destructive" });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleVerifyVat = async (requestId: string, vatNumber: string, country: string) => {
    setVerifyingVatId(requestId);
    try {
      const { auth: firebaseAuth } = await import('@/lib/firebase');
      const token = await firebaseAuth.currentUser?.getIdToken();
      const res = await fetch('/api/clients/verify-vat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vatNumber, country }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed.');
      setVatResults((prev) => ({ ...prev, [requestId]: { valid: data.valid, name: data.name } }));
      toast({
        title: data.valid ? "VAT Valid" : "VAT Invalid",
        description: data.valid
          ? `Verified: ${data.name || vatNumber}`
          : `The VAT number ${vatNumber} could not be validated.`,
        variant: data.valid ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    } finally {
      setVerifyingVatId(null);
    }
  };

  // Selection handlers
  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map(c => c.uid)));
    }
  };

  const clearSelection = () => {
    setSelectedClients(new Set());
  };

  // Bulk remove
  const handleBulkRemove = async () => {
    if (!user?.distributorId || !user.uid || selectedClients.size === 0) return;
    setIsProcessingBulk(true);
    try {
      const removePromises = Array.from(selectedClients).map(clientId =>
        removeClientAccess(clientId, user.distributorId!)
      );
      await Promise.all(removePromises);
      toast({
        title: "Clients Removed",
        description: `${selectedClients.size} client(s) have been removed.`,
      });
      setSelectedClients(new Set());
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Bulk actions configuration
  const bulkActions: BulkAction[] = [
    {
      id: "remove",
      label: "Remove Selected",
      icon: Trash2,
      onClick: handleBulkRemove,
      variant: "destructive",
    },
  ];

  // Count active/inactive for display
  const pendingCount = clientsWithStats.filter(c => c.clientStatus === 'pending').length;
  const activeCount = clientsWithStats.filter(c => c.clientStatus === 'active').length;
  const registeredCount = clientsWithStats.filter(c => c.clientStatus === 'registered').length;
  const inactiveCount = clientsWithStats.filter(c => c.clientStatus === 'inactive').length;

  const isNewClient = (client: ClientWithStats) => {
    // Only show "New" badge if the client has actually accepted the invite (logged in)
    if (client.clientStatus === 'pending') return false;
    const date = client.invitedAt || client.createdAt;
    if (!date) return false;
    return isAfter(parseISO(date), subDays(new Date(), 14));
  };

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== 'master') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only Master users can manage clients.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Access Requests */}
      {accessRequests.length > 0 && (
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Access Requests</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {accessRequests.length} pending request{accessRequests.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accessRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">
                      {request.requesterCompanyName || request.requesterName || request.requesterEmail}
                    </p>
                    {request.requesterCompanyName && request.requesterName && (
                      <p className="text-xs text-muted-foreground">{request.requesterName}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{request.requesterEmail}</p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {request.requesterPhone && <span>{request.requesterPhone}</span>}
                      {(request.requesterCity || request.requesterCountry) && (
                        <span>{[request.requesterCity, request.requesterCountry].filter(Boolean).join(', ')}</span>
                      )}
                      <span>Requested {formatDateSafe(request.createdAt)}</span>
                    </div>
                    {request.requesterVatNumber && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">VAT: {request.requesterVatNumber}</span>
                        {vatResults[request.id] ? (
                          vatResults[request.id].valid ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center gap-1 rounded-md bg-green-500/10 border border-green-500/30 px-2 py-0.5">
                                <ShieldCheck className="h-3 w-3 text-green-600" />
                                <span className="text-[10px] font-medium text-green-700">Verified{vatResults[request.id].name ? ` — ${vatResults[request.id].name}` : ''}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleVerifyVat(request.id, request.requesterVatNumber!, request.requesterCountry!)}
                                disabled={verifyingVatId === request.id}
                                title="Re-verify"
                              >
                                {verifyingVatId === request.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center gap-1 rounded-md bg-red-500/10 border border-red-500/30 px-2 py-0.5">
                                <ShieldX className="h-3 w-3 text-red-600" />
                                <span className="text-[10px] font-medium text-red-700">Invalid</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleVerifyVat(request.id, request.requesterVatNumber!, request.requesterCountry!)}
                                disabled={verifyingVatId === request.id}
                                title="Retry verification"
                              >
                                {verifyingVatId === request.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )
                        ) : request.requesterCountry ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-5 text-[10px] px-2"
                            onClick={() => handleVerifyVat(request.id, request.requesterVatNumber!, request.requesterCountry!)}
                            disabled={verifyingVatId === request.id}
                          >
                            {verifyingVatId === request.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="mr-1 h-3 w-3" />
                            )}
                            Verify
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAccessRequest(request.id, 'deny')}
                      disabled={processingRequestId === request.id}
                    >
                      {processingRequestId === request.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="mr-1 h-3 w-3" />
                      )}
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccessRequest(request.id, 'approve', request.requesterEmail)}
                      disabled={processingRequestId === request.id}
                    >
                      {processingRequestId === request.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      )}
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Your Clients</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {clientsWithStats.length} total · {activeCount} active · {registeredCount} registered · {inactiveCount} inactive{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Mail className="mr-2 h-5 w-5" />
                  Invite Client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a New Client</DialogTitle>
                  <DialogDescription>
                    Enter the client's email to send an invitation. If they don't have an account, one will be created for them with a temporary password.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Client's Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="client@email.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleInviteClient()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-name">Name <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Input
                      id="invite-name"
                      type="text"
                      placeholder="John Doe"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                  <Button onClick={handleInviteClient} disabled={isInviting}>
                    {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Invite
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button asChild className="flex-1">
              <Link href="/clients/add">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Manually
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar with search and status filter */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <DataTableToolbar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by name, email, or company..."
              selectedCount={selectedClients.size}
              onClearSelection={clearSelection}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button variant={statusFilter === "active" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("active")}>
                <CheckCircle2 className="mr-1 h-4 w-4" />Active ({activeCount})
              </Button>
              <Button variant={statusFilter === "registered" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("registered")}>
                <Users className="mr-1 h-4 w-4" />Registered ({registeredCount})
              </Button>
              <Button variant={statusFilter === "inactive" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("inactive")}>
                <XCircle className="mr-1 h-4 w-4" />No Recent Orders ({inactiveCount})
              </Button>
              {pendingCount > 0 && (
                <Button variant={statusFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("pending")}>
                  <Clock className="mr-1 h-4 w-4" />Pending Invite ({pendingCount})
                </Button>
              )}
            </div>
          </div>

          {filteredClients.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedClients.size === filteredClients.length && filteredClients.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    {statusFilter !== 'pending' && (
                      <>
                        <TableHead className="hidden md:table-cell text-center">Status</TableHead>
                        <TableHead className="hidden lg:table-cell text-center">Orders</TableHead>
                        <TableHead className="hidden lg:table-cell text-right">Total Spent</TableHead>
                        <TableHead className="hidden xl:table-cell">Last Order</TableHead>
                      </>
                    )}
                    <TableHead className={statusFilter === 'pending' ? 'hidden sm:table-cell' : 'hidden xl:table-cell'}>Invited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map(client => (
                    <TableRow
                      key={client.uid}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedClients.has(client.uid) ? 'bg-muted/30' : ''}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedClients.has(client.uid)}
                          onCheckedChange={() => toggleClientSelection(client.uid)}
                          aria-label={`Select ${client.email}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium" onClick={() => router.push(`/clients/${client.uid}`)}>
                        <div className="flex items-center gap-2">
                          {`${client.firstName || ''} ${client.lastName || ''}`.trim() || '-'}
                          {isNewClient(client) && (
                            <span className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">New</span>
                          )}
                          {(client.originType === 'invited' || (!client.originType && client.invitedByDistributorId)) && (
                            <span className="inline-flex items-center rounded-full bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600" title={client.originDistributorName ? `Invited by ${client.originDistributorName}` : 'Invited'}>Invited</span>
                          )}
                          {client.originType === 'access_request' && (
                            <span className="inline-flex items-center rounded-full bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">Request</span>
                          )}
                          {client.vatValidated && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/10 border border-green-500/30 px-1.5 py-0.5 text-[10px] font-medium text-green-700" title={`VAT verified${client.vatValidatedName ? `: ${client.vatValidatedName}` : ''}`}>
                              <ShieldCheck className="h-3 w-3" /> VAT
                            </span>
                          )}
                          {client.role === 'master' && (
                            <Badge variant="secondary" className="text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              Distributor
                            </Badge>
                          )}
                        </div>
                        {client.companyName && (
                          <p className="text-xs text-muted-foreground">{client.companyName}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell" onClick={() => router.push(`/clients/${client.uid}`)}>
                        {client.email}
                      </TableCell>
                      {statusFilter !== 'pending' && (
                        <>
                          <TableCell className="hidden md:table-cell text-center" onClick={() => router.push(`/clients/${client.uid}`)}>
                            {client.clientStatus === 'pending' ? (
                              <Badge variant="outline" className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]">
                                Invite Sent
                              </Badge>
                            ) : client.clientStatus === 'active' ? (
                              <Badge variant="outline" className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px]">
                                Active
                              </Badge>
                            ) : client.clientStatus === 'registered' ? (
                              <Badge variant="outline" className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">
                                Registered
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-500/20 text-gray-500 border-gray-500/30 text-[10px]">
                                No Recent Orders
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-center" onClick={() => router.push(`/clients/${client.uid}`)}>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-auto p-1" onClick={(e) => e.stopPropagation()}>
                                  <Badge variant="secondary" className="cursor-pointer">
                                    {client.totalOrders}
                                  </Badge>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80" align="center">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">Recent Orders</h4>
                                  {client.recentOrders.length > 0 ? (
                                    <div className="space-y-2">
                                      {client.recentOrders.map(order => (
                                        <Link
                                          key={order.id}
                                          href={`/orders/${order.id}`}
                                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted text-sm"
                                        >
                                          <div className="flex items-center gap-2">
                                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-mono">{order.orderNumber || order.id.slice(0, 8)}</span>
                                          </div>
                                          <span className="text-muted-foreground">
                                            € {formatPriceForDisplay(order.totalAmount)}
                                          </span>
                                        </Link>
                                      ))}
                                      {client.totalOrders > 3 && (
                                        <p className="text-xs text-muted-foreground text-center pt-1">
                                          +{client.totalOrders - 3} more orders
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No orders yet.</p>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-right font-medium" onClick={() => router.push(`/clients/${client.uid}`)}>
                            € {formatPriceForDisplay(client.totalSpent)}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell" onClick={() => router.push(`/clients/${client.uid}`)}>
                            {formatDateSafe(client.lastOrderDate)}
                          </TableCell>
                        </>
                      )}
                      <TableCell className={statusFilter === 'pending' ? 'hidden sm:table-cell text-sm' : 'hidden xl:table-cell text-sm text-muted-foreground'} onClick={() => router.push(`/clients/${client.uid}`)}>
                        {formatDateTimeSafe(client.invitedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => router.push(`/clients/${client.uid}`)}>
                              <Eye className="mr-2 h-4 w-4" />View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/clients/${client.uid}`)}>
                              <Edit className="mr-2 h-4 w-4" />Edit Client
                            </DropdownMenuItem>
                            {client.clientStatus === 'pending' && client.email && (
                              <DropdownMenuItem onClick={async () => {
                                try {
                                  await inviteClient(client.email!, user!.distributorId!);
                                  toast({ title: "Invitation Resent", description: `Invitation resent to ${client.email}.` });
                                } catch {
                                  toast({ title: "Error", description: "Could not resend invitation.", variant: "destructive" });
                                }
                              }}>
                                <RefreshCw className="mr-2 h-4 w-4" />Resend Invite
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => setClientToDelete(client)}>
                              <Trash2 className="mr-2 h-4 w-4" />Remove Client
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No clients found"
              description={
                searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filter."
                  : "Click 'Invite Client' or 'Add Manually' to get started."
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedClients.size}
        actions={bulkActions}
        onClearSelection={clearSelection}
        isProcessing={isProcessingBulk}
        processingLabel="Removing clients..."
      />

      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{clientToDelete?.email}" from your client list. They will no longer have access to your environment. This does not delete their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveClient} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
