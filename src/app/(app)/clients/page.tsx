
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, AlertTriangle, PlusCircle, ArrowLeft, MoreVertical, Edit, Trash2, Eye, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/types";
import { getClientsByDistributorId } from "@/services/user-service";
import { inviteClient } from "@/services/client-user-service"; // Corrected import
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function ClientsPage() {
    const { user, loading: authLoading, deleteUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [clients, setClients] = useState<User[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [clientToDelete, setClientToDelete] = useState<User | null>(null);
    
    // State for Invite Dialog
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviting, setIsInviting] = useState(false);

    const fetchClients = useCallback(async () => {
        if (!user || user.role !== 'master' || !user.distributorId) {
            setIsLoadingData(false);
            return;
        }
        setIsLoadingData(true);
        try {
            const fetchedClients = await getClientsByDistributorId(user.distributorId);
            setClients(fetchedClients);
        } catch (error) {
            toast({ title: "Error", description: "Could not fetch clients.", variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchClients();
        }
    }, [user, authLoading, fetchClients]);

    const formatDateSafe = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return format(parseISO(dateString), 'dd MMM yyyy');
        } catch (e) {
            return 'Invalid Date';
        }
    };
    
    const handleDeleteClient = async () => {
        if (!clientToDelete) return;
        try {
            await deleteUser(clientToDelete.uid);
            toast({ title: "Client Deleted", description: `"${clientToDelete.email}" has been deleted.` });
            fetchClients();
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
            await fetchClients(); // Refresh the client list
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
                        <CardTitle>Your Clients</CardTitle>
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
                                        {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
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
                <CardContent>
                   {clients.length > 0 ? (
                       <div className="overflow-x-auto">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Name</TableHead>
                                       <TableHead>Email</TableHead>
                                       <TableHead className="hidden sm:table-cell">Client Since</TableHead>
                                       <TableHead className="text-right">Actions</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {clients.map(client => (
                                       <TableRow key={client.uid} className="border-b">
                                           <TableCell className="font-medium cursor-pointer" onClick={() => router.push(`/clients/${client.uid}`)}>
                                             {`${client.firstName || ''} ${client.lastName || ''}`.trim() || '-'}
                                           </TableCell>
                                           <TableCell className="cursor-pointer" onClick={() => router.push(`/clients/${client.uid}`)}>{client.email}</TableCell>
                                           <TableCell className="hidden sm:table-cell cursor-pointer" onClick={() => router.push(`/clients/${client.uid}`)}>{formatDateSafe(client.createdAt)}</TableCell>
                                           <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => router.push(`/clients/${client.uid}`)}><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => router.push(`/clients/${client.uid}`)}><Edit className="mr-2 h-4 w-4" />Edit Client</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setClientToDelete(client)}><Trash2 className="mr-2 h-4 w-4" />Delete Client</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                           </TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                       </div>
                   ) : (
                       <div className="text-center py-12 text-muted-foreground">
                            <p className="text-lg">No clients found.</p>
                            <p className="text-sm">Click "Invite Client" or "Add Manually" to get started.</p>
                       </div>
                   )}
                </CardContent>
            </Card>
             <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the client "{clientToDelete?.email}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
