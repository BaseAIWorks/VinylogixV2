"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, AlertTriangle, PlusCircle, ArrowLeft, MoreVertical, Edit, Trash2, Eye, Mail, Building2, ShoppingCart, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { format, parseISO, subDays, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User, Order } from "@/types";
import { getClientsByDistributorId } from "@/services/user-service";
import { getOrders } from "@/services/order-service";
import { inviteClient, removeClientAccess } from "@/services/client-user-service";
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

interface ClientWithStats extends User {
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  isActive: boolean;
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

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // State for Invite Dialog
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'master' || !user.distributorId) {
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    try {
      const [fetchedClients, fetchedOrders] = await Promise.all([
        getClientsByDistributorId(user.distributorId),
        getOrders(user),
      ]);
      setClients(fetchedClients);
      setOrders(fetchedOrders);
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

      return {
        ...client,
        totalOrders: clientOrders.length,
        totalSpent,
        lastOrderDate,
        isActive,
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
    if (statusFilter === "active") {
      result = result.filter(client => client.isActive);
    } else if (statusFilter === "inactive") {
      result = result.filter(client => !client.isActive);
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

  const handleRemoveClient = async () => {
    if (!clientToDelete || !user?.distributorId || !user.uid) return;
    try {
      await removeClientAccess(clientToDelete.uid, user.distributorId, user.uid);
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
      const result = await inviteClient(inviteEmail, user.distributorId, user.uid);
      toast({
        title: "Success!",
        description: result.message,
      });
      setIsInviteDialogOpen(false);
      setInviteEmail("");
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
        removeClientAccess(clientId, user.distributorId!, user.uid)
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
  const activeCount = clientsWithStats.filter(c => c.isActive).length;
  const inactiveCount = clientsWithStats.filter(c => !c.isActive).length;

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
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Your Clients</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {clientsWithStats.length} total · {activeCount} active · {inactiveCount} inactive
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
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Client's Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="client@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInviteClient()}
                  />
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
              <Button
                variant={statusFilter === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("active")}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Active
              </Button>
              <Button
                variant={statusFilter === "inactive" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("inactive")}
              >
                <XCircle className="mr-1 h-4 w-4" />
                Inactive
              </Button>
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
                    <TableHead className="hidden md:table-cell text-center">Status</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Orders</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Total Spent</TableHead>
                    <TableHead className="hidden xl:table-cell">Last Order</TableHead>
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
                      <TableCell className="hidden md:table-cell text-center" onClick={() => router.push(`/clients/${client.uid}`)}>
                        {client.isActive ? (
                          <Badge variant="outline" className="bg-green-500/20 text-green-600 border-green-500/30">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-500/20 text-gray-500 border-gray-500/30">
                            Inactive
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
