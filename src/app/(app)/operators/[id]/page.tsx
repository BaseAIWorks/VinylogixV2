
"use client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, Loader2, AlertTriangle, KeyRound, HardHat, Package, Mail, History, LogIn, FilePenLine, ShieldCheck, ShieldOff } from "lucide-react";
import type { User, UserRole, VinylRecord, WorkerPermissions, UserStatus } from "@/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getUserById } from "@/services/user-service";
import { getAllInventoryRecords } from "@/services/record-service";
import { useParams, useRouter } from "next/navigation";
import { format, subDays, formatDistanceToNow } from 'date-fns';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";


const roleDisplayNames: Record<UserRole, string> = {
  master: 'Master',
  worker: 'Operator',
  viewer: 'Client',
  superadmin: 'Super Admin',
};

const profileFormSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['worker', 'master']),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

const permissionsFormSchema = z.object({
    canViewPurchasingPrice: z.boolean().default(false),
    canEditPurchasingPrice: z.boolean().default(false),
    canViewSellingPrice: z.boolean().default(false),
    canEditSellingPrice: z.boolean().default(false),
    canEditSuppliers: z.boolean().default(false),
    canManageOrders: z.boolean().default(false),
    canManageLocations: z.boolean().default(false),
});
type PermissionsFormValues = z.infer<typeof permissionsFormSchema>;


const StatCard = ({ title, value, subtext, icon: Icon }: { title: string, value: string | number, subtext: string, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-3xl font-bold text-primary">{value}</div>
            <p className="text-xs text-muted-foreground">{subtext}</p>
        </CardContent>
    </Card>
);

interface ActivityItem {
    date: Date;
    type: 'login' | 'add' | 'edit';
    message: React.ReactNode;
}

export default function OperatorDetailPage() {
    const { user: currentUser, updateUserProfile, deleteUser: deleteUserService, sendPasswordReset: sendPasswordResetService } = useAuth();
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const operatorId = typeof params.id === 'string' ? params.id : '';

    const [operator, setOperator] = useState<User | null>(null);
    const [records, setRecords] = useState<VinylRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
    });

     const permissionsForm = useForm<PermissionsFormValues>({
        resolver: zodResolver(permissionsFormSchema),
    });

    const fetchData = useCallback(async () => {
        if (!currentUser || !operatorId || currentUser.role !== 'master') {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [opResult, recResult] = await Promise.allSettled([
                getUserById(operatorId),
                getAllInventoryRecords(currentUser, currentUser.distributorId)
            ]);

            if (opResult.status === 'rejected' || !opResult.value || (opResult.value.role !== 'master' && opResult.value.role !== 'worker')) {
                toast({ title: "Not Found", description: "This operator could not be found.", variant: "destructive" });
                router.push("/operators");
                return;
            }
            setOperator(opResult.value);
            form.reset({
                firstName: opResult.value.firstName || "",
                lastName: opResult.value.lastName || "",
                role: opResult.value.role as 'master' | 'worker',
            });

            permissionsForm.reset({
                canViewPurchasingPrice: opResult.value.permissions?.canViewPurchasingPrice || false,
                canEditPurchasingPrice: opResult.value.permissions?.canEditPurchasingPrice || false,
                canViewSellingPrice: opResult.value.permissions?.canViewSellingPrice || false,
                canEditSellingPrice: opResult.value.permissions?.canEditSellingPrice || false,
                canEditSuppliers: opResult.value.permissions?.canEditSuppliers || false,
                canManageOrders: opResult.value.permissions?.canManageOrders || false,
                canManageLocations: opResult.value.permissions?.canManageLocations || false,
            });

            if (recResult.status === 'fulfilled') setRecords(recResult.value);
            else console.error("Failed to fetch records:", recResult.reason);

        } catch (error) {
            toast({ title: "Error", description: `Could not load data for this operator.`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, operatorId, toast, router, form, permissionsForm]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const stats = useMemo(() => {
        if (!operator || !operator.email) return { recordsAdded: 0 };
        return {
            recordsAdded: records.filter(r => r.added_by_email === operator.email).length
        }
    }, [records, operator]);

    const recentActivity = useMemo((): ActivityItem[] => {
        if (!operator || !operator.email) return [];
        
        const oneWeekAgo = subDays(new Date(), 7);
        const activities: ActivityItem[] = [];

        // Check last login
        if (operator.lastLoginAt && new Date(operator.lastLoginAt) > oneWeekAgo) {
            activities.push({
                date: new Date(operator.lastLoginAt),
                type: 'login',
                message: "Logged in to the application."
            });
        }

        // Check record additions
        records.forEach(r => {
            const addedAt = new Date(r.added_at);
            if (r.added_by_email === operator.email && addedAt > oneWeekAgo) {
                activities.push({
                    date: addedAt,
                    type: 'add',
                    message: <>Added record <Link href={`/records/${r.id}`} className="font-medium hover:underline text-primary">{r.title}</Link></>
                });
            }
        });

        // Check record edits
        records.forEach(r => {
            const modifiedAt = r.last_modified_at ? new Date(r.last_modified_at) : null;
            if (r.last_modified_by_email === operator.email && modifiedAt && modifiedAt > oneWeekAgo && r.last_modified_at !== r.added_at) {
                 activities.push({
                    date: modifiedAt,
                    type: 'edit',
                    message: <>Edited record <Link href={`/records/${r.id}`} className="font-medium hover:underline text-primary">{r.title}</Link></>
                });
            }
        });
        
        return activities.sort((a,b) => b.date.getTime() - a.date.getTime());

    }, [records, operator]);

    const handleDelete = async () => {
        if (!operator || !currentUser || currentUser.uid === operator.uid) return;
        setIsDeleting(true);
        try {
            await deleteUserService(operator.uid);
            toast({ title: "Operator Deleted", description: `"${operator.email}"'s user document has been removed.`});
            router.push('/operators');
        } catch(error) {
            toast({ title: "Error", description: `Could not delete operator. ${(error as Error).message}`, variant: "destructive"});
            setIsDeleting(false);
        }
    }

    const handleUpdateDetails = async (values: ProfileFormValues) => {
        if (!operator || !currentUser) return;
        try {
            await updateUserProfile(values, operator.uid);
            toast({ title: "Operator Updated", description: "The operator's details have been saved." });
            setIsEditDialogOpen(false);
            fetchData();
        } catch (error) {
            toast({ title: "Update Failed", description: "Could not save details.", variant: "destructive" });
        }
    };

    const handlePermissionsUpdate = async (values: PermissionsFormValues) => {
        if (!operator || !currentUser || operator.role !== 'worker') return;
        try {
            await updateUserProfile({ permissions: values }, operator.uid);
            toast({ title: "Permissions Updated", description: "The operator's permissions have been saved." });
            fetchData();
        } catch (error) {
            toast({ title: "Update Failed", description: "Could not save permissions.", variant: "destructive" });
        }
    };
    
    const handleSendPasswordReset = async () => {
        if (!operator?.email) return;
        try {
            await sendPasswordResetService(operator.email);
            toast({ title: "Email Sent", description: "A password reset link has been sent." });
        } catch (error) {
            toast({ title: "Error", description: `Could not send reset email. ${(error as Error).message}`, variant: "destructive" });
        }
    }
    
    const handleStatusUpdate = async (newStatus: UserStatus) => {
        if (!operator || !currentUser || currentUser.uid === operator.uid) return;
        try {
            await updateUserProfile({ status: newStatus }, operator.uid);
            toast({ title: "Status Updated", description: `${operator.email}'s status set to ${newStatus}.` });
            fetchData();
        } catch (error) {
            toast({ title: "Update Failed", description: `Could not update status. ${(error as Error).message}`, variant: "destructive" });
        }
    }

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (!operator) {
         return <div className="text-center p-8"><AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" /><h2 className="text-xl font-semibold">Operator not found.</h2></div>;
    }


    return (
        
        <div className="space-y-8">
            <div>
                <Button onClick={() => router.push('/operators')} variant="outline" size="sm" className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Operators
                </Button>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3"><HardHat className="h-8 w-8 text-primary"/>{`${operator.firstName || ''} ${operator.lastName || ''}`.trim() || operator.email}</h2>
                        <p className="text-muted-foreground">{operator.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setIsEditDialogOpen(true)} variant="outline">
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeleting || operator.uid === currentUser?.uid}>
                                    <Trash2 className="mr-2 h-4 w-4"/> Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the operator "{operator.email}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Delete'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                <StatCard title="Records Added" value={stats.recordsAdded} subtext="Total records added by this user" icon={Package} />
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Account Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground"/>{operator.email}</div>
                        <div className="flex items-center gap-2 text-sm"><Badge variant={operator.role === 'master' ? 'default' : 'secondary'} className="capitalize">{operator.role}</Badge></div>
                        {operator.lastLoginAt && <p className="text-xs text-muted-foreground">Last Login: {format(new Date(operator.lastLoginAt), 'PPp')}</p>}
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Account Status & Access</CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="on-hold-switch" className="text-base font-medium">
                                Account Status
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                {operator.status === 'on_hold' 
                                    ? "This user's access is suspended. They cannot log in." 
                                    : "This user has active access to the system."
                                }
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                             <Badge variant={operator.status === 'on_hold' ? 'destructive' : 'default'} className="capitalize">{operator.status?.replace('_', ' ') || 'Active'}</Badge>
                             <Switch
                                id="on-hold-switch"
                                checked={operator.status !== 'on_hold'}
                                onCheckedChange={(checked) => handleStatusUpdate(checked ? 'active' : 'on_hold')}
                                disabled={operator.uid === currentUser?.uid}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>


            {operator.role === 'worker' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Worker Permissions</CardTitle>
                        <CardDescription>Configure what this operator is allowed to do.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...permissionsForm}>
                            <form onSubmit={permissionsForm.handleSubmit(handlePermissionsUpdate)} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                                    <FormField control={permissionsForm.control} name="canViewPurchasingPrice" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>View Purchasing Price</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                                    <FormField control={permissionsForm.control} name="canEditPurchasingPrice" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Edit Purchasing Price</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                                    <FormField control={permissionsForm.control} name="canViewSellingPrice" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>View Selling Price</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                                    <FormField control={permissionsForm.control} name="canEditSellingPrice" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Edit Selling Price</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                                    <FormField control={permissionsForm.control} name="canEditSuppliers" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Manage Suppliers on Records</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                                    <FormField control={permissionsForm.control} name="canManageOrders" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Manage Orders</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                                    <FormField control={permissionsForm.control} name="canManageLocations" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Manage Storage Locations</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={permissionsForm.formState.isSubmitting}>
                                        {permissionsForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                        Save Permissions
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary"/>Recent Activity (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                    {recentActivity.length > 0 ? (
                        <Table>
                            <TableBody>
                                {recentActivity.map((activity, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="w-12 py-2">
                                            <div className="bg-muted p-2 rounded-full flex items-center justify-center">
                                                {activity.type === 'login' && <LogIn className="h-5 w-5 text-muted-foreground"/>}
                                                {activity.type === 'add' && <Package className="h-5 w-5 text-muted-foreground"/>}
                                                {activity.type === 'edit' && <FilePenLine className="h-5 w-5 text-muted-foreground"/>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium py-2">{activity.message}</TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground py-2">{formatDistanceToNow(activity.date, { addSuffix: true })}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No activity recorded in the last 7 days.</p>
                    )}
                </CardContent>
            </Card>
        
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Operator</DialogTitle>
                        <DialogDescription>Update details for {operator.email}.</DialogDescription>
                    </DialogHeader>
                        <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleUpdateDetails)} className="space-y-6 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="firstName" render={({ field }) => (
                                    <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="First Name" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="lastName" render={({ field }) => (
                                    <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Last Name" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="role" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={operator.uid === currentUser?.uid || operator.role === 'master'}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {operator.role === 'master' && <SelectItem value="master">Master</SelectItem>}
                                            <SelectItem value="worker">Worker</SelectItem>
                                        </SelectContent>
                                    </Select>
                                        {(operator.uid === currentUser?.uid || operator.role === 'master') && (
                                        <FormDescription>The Master role cannot be changed or assigned here. You cannot change your own role.</FormDescription>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <DialogFooter className="pt-4 border-t">
                                <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                    <DialogFooter className="sm:justify-start border-t pt-4">
                        <Button variant="outline" onClick={handleSendPasswordReset}><KeyRound className="mr-2 h-4 w-4"/>Send Password Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        
    );
}
