"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, HardHat, AlertTriangle, PlusCircle, MoreVertical, Edit, Trash2, Eye, Shield, ShieldCheck, ShieldAlert, Package, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User, VinylRecord, WorkerPermissions } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { getUsersByDistributorId } from "@/services/user-service";
import { getAllInventoryRecords } from "@/services/record-service";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OperatorWithStats extends User {
  recordsAdded: number;
  permissionSummary: string;
  permissionLevel: "full" | "partial" | "limited";
}

const defaultPermissions: WorkerPermissions = {
  canViewPurchasingPrice: false,
  canEditPurchasingPrice: false,
  canViewSellingPrice: true,
  canEditSellingPrice: false,
  canEditSuppliers: false,
  canManageOrders: false,
  canManageLocations: false,
};

function getPermissionSummary(permissions?: WorkerPermissions, role?: string): { summary: string; level: "full" | "partial" | "limited" } {
  if (role === 'master') {
    return { summary: "Full Access", level: "full" };
  }
  if (!permissions) {
    return { summary: "View Only", level: "limited" };
  }

  const perms = [];
  if (permissions.canManageOrders) perms.push("Orders");
  if (permissions.canEditPurchasingPrice || permissions.canEditSellingPrice) perms.push("Prices");
  if (permissions.canEditSuppliers) perms.push("Suppliers");
  if (permissions.canManageLocations) perms.push("Locations");

  if (perms.length === 0) {
    if (permissions.canViewPurchasingPrice || permissions.canViewSellingPrice) {
      return { summary: "View Prices", level: "limited" };
    }
    return { summary: "View Only", level: "limited" };
  }

  if (perms.length >= 3) {
    return { summary: "Extended Access", level: "partial" };
  }

  return { summary: perms.join(", "), level: "partial" };
}

export default function OperatorsPage() {
  const { user, loading: authLoading, addUser, deleteUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [operators, setOperators] = useState<User[]>([]);
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddingOperator, setIsAddingOperator] = useState(false);

  const [newOperatorEmail, setNewOperatorEmail] = useState("");
  const [newOperatorPassword, setNewOperatorPassword] = useState("");
  const [newOperatorFirstName, setNewOperatorFirstName] = useState("");
  const [newOperatorLastName, setNewOperatorLastName] = useState("");
  const [newOperatorPermissions, setNewOperatorPermissions] = useState<WorkerPermissions>(defaultPermissions);

  const [operatorToDelete, setOperatorToDelete] = useState<User | null>(null);

  // Filter
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'master' || !user.distributorId) {
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    try {
      const [fetchedOperators, fetchedRecords] = await Promise.all([
        getUsersByDistributorId(user.distributorId),
        getAllInventoryRecords(user, user.distributorId),
      ]);
      setOperators(fetchedOperators);
      setRecords(fetchedRecords);
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch operators.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [user, authLoading, fetchData]);

  // Compute operator stats
  const operatorsWithStats: OperatorWithStats[] = useMemo(() => {
    const recordCountsByEmail: Record<string, number> = {};
    records.forEach(record => {
      if (record.added_by_email) {
        recordCountsByEmail[record.added_by_email] = (recordCountsByEmail[record.added_by_email] || 0) + 1;
      }
    });

    return operators.map(operator => {
      const { summary, level } = getPermissionSummary(operator.permissions, operator.role);
      return {
        ...operator,
        recordsAdded: recordCountsByEmail[operator.email || ''] || 0,
        permissionSummary: summary,
        permissionLevel: level,
      };
    });
  }, [operators, records]);

  // Filtered operators
  const filteredOperators = useMemo(() => {
    if (!searchQuery.trim()) return operatorsWithStats;
    const query = searchQuery.toLowerCase();
    return operatorsWithStats.filter(operator =>
      (operator.email?.toLowerCase() || '').includes(query) ||
      (`${operator.firstName || ''} ${operator.lastName || ''}`.toLowerCase()).includes(query)
    );
  }, [operatorsWithStats, searchQuery]);

  const formatDateSafe = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      return format(parseISO(dateString), 'dd MMM yyyy, HH:mm');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const getActivityStatus = (lastLoginAt?: string) => {
    if (!lastLoginAt) return { text: "Never logged in", color: "text-muted-foreground" };
    try {
      const lastLogin = parseISO(lastLoginAt);
      const now = new Date();
      const diffHours = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);

      if (diffHours < 1) {
        return { text: "Active now", color: "text-green-500" };
      } else if (diffHours < 24) {
        return { text: `Active ${formatDistanceToNow(lastLogin, { addSuffix: true })}`, color: "text-green-500" };
      } else if (diffHours < 168) { // 7 days
        return { text: `Seen ${formatDistanceToNow(lastLogin, { addSuffix: true })}`, color: "text-yellow-500" };
      } else {
        return { text: `Inactive for ${formatDistanceToNow(lastLogin)}`, color: "text-muted-foreground" };
      }
    } catch {
      return { text: "Unknown", color: "text-muted-foreground" };
    }
  };

  const handleAddDialogOpening = (open: boolean) => {
    if (open) {
      setNewOperatorEmail("");
      setNewOperatorPassword("");
      setNewOperatorFirstName("");
      setNewOperatorLastName("");
      setNewOperatorPermissions(defaultPermissions);
    }
    setIsAddDialogOpen(open);
  };

  const handlePermissionChange = (key: keyof WorkerPermissions, value: boolean) => {
    setNewOperatorPermissions(prev => ({ ...prev, [key]: value }));
  };

  const handleAddOperator = async () => {
    if (!newOperatorEmail.includes('@') || !newOperatorPassword) {
      toast({ title: "Invalid Input", description: "Please enter a valid email and a temporary password.", variant: "destructive" });
      return;
    }
    setIsAddingOperator(true);
    try {
      await addUser(newOperatorEmail, newOperatorPassword, 'worker', undefined, {
        firstName: newOperatorFirstName,
        lastName: newOperatorLastName,
        permissions: newOperatorPermissions,
      });
      handleAddDialogOpening(false);
      toast({ title: "Operator Added", description: `An account has been created for ${newOperatorEmail}.` });
      fetchData();
    } catch (error) {
      toast({ title: "Failed to Add Operator", description: (error as Error).message, variant: "destructive" });
    }
    setIsAddingOperator(false);
  };

  const handleDeleteOperator = async () => {
    if (!operatorToDelete) return;
    try {
      const success = await deleteUser(operatorToDelete.uid);
      if (success) {
        toast({ title: "Operator Deleted", description: `"${operatorToDelete.email}" has been deleted.` });
        fetchData();
      }
    } catch (error) {
      // Error is already handled inside the deleteUser function in useAuth
    } finally {
      setOperatorToDelete(null);
    }
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
        <p className="text-muted-foreground mt-2">Only Master users can view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HardHat className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Your Operators</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {operatorsWithStats.length} operator{operatorsWithStats.length !== 1 ? 's' : ''} in your team
              </p>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpening}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Operator
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Operator</DialogTitle>
                <DialogDescription>
                  Create a new account for a worker in your organization.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                <div className="space-y-2">
                  <Label htmlFor="newOperatorEmail">Operator Email *</Label>
                  <Input
                    id="newOperatorEmail"
                    type="email"
                    placeholder="operator@example.com"
                    value={newOperatorEmail}
                    onChange={(e) => setNewOperatorEmail(e.target.value)}
                    disabled={isAddingOperator}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newOperatorPassword">Temporary Password *</Label>
                  <Input
                    id="newOperatorPassword"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={newOperatorPassword}
                    onChange={(e) => setNewOperatorPassword(e.target.value)}
                    disabled={isAddingOperator}
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newOperatorFirstName">First Name</Label>
                    <Input
                      id="newOperatorFirstName"
                      value={newOperatorFirstName}
                      onChange={e => setNewOperatorFirstName(e.target.value)}
                      disabled={isAddingOperator}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newOperatorLastName">Last Name</Label>
                    <Input
                      id="newOperatorLastName"
                      value={newOperatorLastName}
                      onChange={e => setNewOperatorLastName(e.target.value)}
                      disabled={isAddingOperator}
                    />
                  </div>
                </div>

                {/* Permissions Section */}
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-base font-semibold">Permissions</Label>
                  <p className="text-sm text-muted-foreground">Configure what this operator can access and modify.</p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Manage Orders</p>
                        <p className="text-xs text-muted-foreground">View and update order statuses</p>
                      </div>
                      <Switch
                        checked={newOperatorPermissions.canManageOrders}
                        onCheckedChange={(checked) => handlePermissionChange('canManageOrders', checked)}
                        disabled={isAddingOperator}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">View Purchasing Prices</p>
                        <p className="text-xs text-muted-foreground">See cost/purchase prices on records</p>
                      </div>
                      <Switch
                        checked={newOperatorPermissions.canViewPurchasingPrice}
                        onCheckedChange={(checked) => handlePermissionChange('canViewPurchasingPrice', checked)}
                        disabled={isAddingOperator}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Edit Purchasing Prices</p>
                        <p className="text-xs text-muted-foreground">Modify cost/purchase prices</p>
                      </div>
                      <Switch
                        checked={newOperatorPermissions.canEditPurchasingPrice}
                        onCheckedChange={(checked) => handlePermissionChange('canEditPurchasingPrice', checked)}
                        disabled={isAddingOperator}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">View Selling Prices</p>
                        <p className="text-xs text-muted-foreground">See selling prices on records</p>
                      </div>
                      <Switch
                        checked={newOperatorPermissions.canViewSellingPrice}
                        onCheckedChange={(checked) => handlePermissionChange('canViewSellingPrice', checked)}
                        disabled={isAddingOperator}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Edit Selling Prices</p>
                        <p className="text-xs text-muted-foreground">Modify selling prices</p>
                      </div>
                      <Switch
                        checked={newOperatorPermissions.canEditSellingPrice}
                        onCheckedChange={(checked) => handlePermissionChange('canEditSellingPrice', checked)}
                        disabled={isAddingOperator}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Manage Suppliers</p>
                        <p className="text-xs text-muted-foreground">Add and edit suppliers</p>
                      </div>
                      <Switch
                        checked={newOperatorPermissions.canEditSuppliers}
                        onCheckedChange={(checked) => handlePermissionChange('canEditSuppliers', checked)}
                        disabled={isAddingOperator}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Manage Locations</p>
                        <p className="text-xs text-muted-foreground">Edit shelf and storage locations</p>
                      </div>
                      <Switch
                        checked={newOperatorPermissions.canManageLocations}
                        onCheckedChange={(checked) => handlePermissionChange('canManageLocations', checked)}
                        disabled={isAddingOperator}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="button" onClick={handleAddOperator} disabled={isAddingOperator || !newOperatorEmail || !newOperatorPassword}>
                  {isAddingOperator && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Operator
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <DataTableToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name or email..."
          />

          {filteredOperators.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Role</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Permissions</TableHead>
                    <TableHead className="hidden xl:table-cell text-center">Records Added</TableHead>
                    <TableHead className="hidden md:table-cell">Activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOperators.map(operator => {
                    const activity = getActivityStatus(operator.lastLoginAt);
                    return (
                      <TableRow
                        key={operator.uid}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/operators/${operator.uid}`)}
                      >
                        <TableCell className="font-medium">
                          {`${operator.firstName || ''} ${operator.lastName || ''}`.trim() || '-'}
                          {operator.uid === user?.uid && (
                            <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{operator.email}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={operator.role === 'master' ? 'default' : 'secondary'} className="capitalize">
                            {operator.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className={`cursor-help ${
                                    operator.permissionLevel === 'full'
                                      ? 'bg-green-500/20 text-green-600 border-green-500/30'
                                      : operator.permissionLevel === 'partial'
                                      ? 'bg-blue-500/20 text-blue-600 border-blue-500/30'
                                      : 'bg-gray-500/20 text-gray-500 border-gray-500/30'
                                  }`}
                                >
                                  {operator.permissionLevel === 'full' && <ShieldCheck className="h-3 w-3 mr-1" />}
                                  {operator.permissionLevel === 'partial' && <Shield className="h-3 w-3 mr-1" />}
                                  {operator.permissionLevel === 'limited' && <ShieldAlert className="h-3 w-3 mr-1" />}
                                  {operator.permissionSummary}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <div className="space-y-1 text-xs">
                                  <p className="font-semibold">Permissions:</p>
                                  {operator.role === 'master' ? (
                                    <p>Full administrative access to all features.</p>
                                  ) : operator.permissions ? (
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {operator.permissions.canManageOrders && <li>Manage orders</li>}
                                      {operator.permissions.canViewPurchasingPrice && <li>View purchasing prices</li>}
                                      {operator.permissions.canEditPurchasingPrice && <li>Edit purchasing prices</li>}
                                      {operator.permissions.canViewSellingPrice && <li>View selling prices</li>}
                                      {operator.permissions.canEditSellingPrice && <li>Edit selling prices</li>}
                                      {operator.permissions.canEditSuppliers && <li>Manage suppliers</li>}
                                      {operator.permissions.canManageLocations && <li>Manage locations</li>}
                                    </ul>
                                  ) : (
                                    <p>Basic view-only access.</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span>{operator.recordsAdded}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <Clock className={`h-4 w-4 ${activity.color}`} />
                            <span className={`text-sm ${activity.color}`}>{activity.text}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => router.push(`/operators/${operator.uid}`)}>
                                <Eye className="mr-2 h-4 w-4" />View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/operators/${operator.uid}`)}>
                                <Edit className="mr-2 h-4 w-4" />Edit Operator
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setOperatorToDelete(operator)}
                                disabled={operator.uid === user?.uid}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />Delete Operator
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={HardHat}
              title="No operators found"
              description={
                searchQuery
                  ? "Try adjusting your search query."
                  : "You are the only operator. Click 'Add New Operator' to add more."
              }
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!operatorToDelete} onOpenChange={(open) => !open && setOperatorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the operator "{operatorToDelete?.email}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOperator} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
