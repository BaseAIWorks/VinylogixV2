
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Newspaper, Edit, Trash2, CalendarIcon, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { ChangelogEntry } from "@/types";
import { getChangelogs, addChangelog, updateChangelog, deleteChangelog } from "@/services/changelog-service";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';


const emptyFormState: Omit<ChangelogEntry, 'id'> = {
    version: "",
    title: "",
    notes: "",
    createdAt: new Date().toISOString(),
};

export default function AdminChangelogPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    
    const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);
    const [formState, setFormState] = useState(emptyFormState);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<ChangelogEntry | null>(null);
    const [isSeeding, setIsSeeding] = useState(false);

    const seedChangelogEntries = [
        {
            version: "2.4.0",
            title: "Enhanced Dashboard Experience",
            notes: `We've completely revamped the main dashboard with powerful new features:

• **Date Range Selector** - View your stats for Today, Last 7 days, Last 30 days, or All Time
• **Trend Indicators** - See how your metrics compare to the previous period with +/- percentage changes
• **Low Stock Alerts** - Quick access card showing items that need restocking
• **Improved Quick Links** - Better visual hierarchy for faster navigation
• **Role-Specific Views** - Tailored dashboard experience for Masters, Workers, and Clients`,
            createdAt: new Date('2025-02-07T10:00:00Z').toISOString(),
        },
        {
            version: "2.3.0",
            title: "New Fulfillment Kanban Board",
            notes: `Introducing a visual workflow for order fulfillment:

• **Kanban View** - Drag-and-drop cards between Paid → Processing → Ready → Shipped columns
• **Bulk Actions** - Mark multiple orders as Processing or Shipped with one click
• **Order Age Indicator** - See how long orders have been waiting since payment
• **Quick Status Changes** - Click to advance orders through your workflow
• **Filtering** - Focus on specific order states or search by order number`,
            createdAt: new Date('2025-02-07T09:30:00Z').toISOString(),
        },
        {
            version: "2.2.0",
            title: "Orders Page Improvements",
            notes: `Managing orders is now faster and more intuitive:

• **Status Tabs** - Quickly filter by All, Pending, Awaiting Payment, Paid, Shipped, or Cancelled
• **Bulk Actions** - Select multiple orders and update their status at once
• **Export to CSV** - Download your order data for accounting or analysis
• **Date Range Filters** - Find orders from specific time periods
• **Enhanced Search** - Search by order number, client name, or email`,
            createdAt: new Date('2025-02-07T09:00:00Z').toISOString(),
        },
        {
            version: "2.1.0",
            title: "Improved Inventory Management",
            notes: `New features to help you manage your vinyl collection more efficiently:

• **Saved Filter Presets** - Save your favorite filter combinations for quick access
• **Keyboard Shortcuts** - Press / to search, N to add new records, G/L to switch views
• **Bulk Edit Mode** - Edit multiple records at once with visual highlighting of changes
• **Revert Changes** - Undo individual edits or revert all changes before saving
• **Quick Stock Updates** - Increment stock directly from the record card`,
            createdAt: new Date('2025-02-07T08:30:00Z').toISOString(),
        },
        {
            version: "2.0.0",
            title: "Barcode Scanner Enhancements",
            notes: `Scanning vinyls is now faster and more convenient:

• **Keyboard Shortcuts** - Press B for barcode, A for AI scan, M for manual entry
• **Recent Scans History** - Access your last 5 scans with one click
• **Scan Type Indicators** - Visual badges show how each record was added
• **Improved Camera Detection** - Better automatic camera selection for mobile devices`,
            createdAt: new Date('2025-02-07T08:00:00Z').toISOString(),
        },
        {
            version: "1.9.0",
            title: "Client & Operator Management Updates",
            notes: `Better tools for managing your team and customers:

• **Client Statistics** - See total orders and spending for each client
• **Activity Indicators** - Know which clients have been active recently
• **Operator Permissions** - View permission summaries at a glance
• **Bulk Actions** - Remove multiple clients or operators at once
• **Enhanced Search** - Find people quickly by name or email`,
            createdAt: new Date('2025-02-06T16:00:00Z').toISOString(),
        },
        {
            version: "1.8.0",
            title: "Improved Import & Export",
            notes: `Streamlined data import process:

• **Drag & Drop Upload** - Simply drag your CSV file onto the page
• **Sample CSV Download** - Get a template with the correct column format
• **Enhanced Preview** - See status badges for each row before importing
• **Better Error Handling** - Clear messages when something goes wrong
• **Progress Indicators** - Track your import progress in real-time`,
            createdAt: new Date('2025-02-06T14:00:00Z').toISOString(),
        },
        {
            version: "1.7.0",
            title: "Statistics & Reporting Upgrade",
            notes: `More powerful analytics for your business:

• **Global Date Range Picker** - Apply date filters to all charts at once
• **Period Comparison** - Compare current stats to previous periods
• **Export Reports** - Download your data as CSV for further analysis
• **Improved Charts** - Better visualizations for sales and inventory trends`,
            createdAt: new Date('2025-02-06T12:00:00Z').toISOString(),
        },
        {
            version: "1.6.0",
            title: "Subscription Page Enhancements",
            notes: `Improved visibility into your subscription usage:

• **Usage Progress Bars** - Visual indicators for Records and Users limits
• **Color-Coded Warnings** - Orange when approaching limits, red when at capacity
• **Unlimited Tier Support** - Clear display for plans with no limits
• **Quick Plan Management** - Easy access to billing portal and plan changes`,
            createdAt: new Date('2025-02-06T10:00:00Z').toISOString(),
        },
        {
            version: "1.5.0",
            title: "Notification System Improvements",
            notes: `Stay on top of what matters:

• **Mark All as Read** - Clear all notifications with one click
• **Type Filters** - Filter notifications by type (orders, stock alerts, etc.)
• **Grouped by Date** - Notifications organized by when they occurred
• **Improved Layout** - Cleaner, more scannable notification list`,
            createdAt: new Date('2025-02-05T16:00:00Z').toISOString(),
        },
    ];

    const handleSeedChangelog = async () => {
        setIsSeeding(true);
        try {
            for (const entry of seedChangelogEntries) {
                await addChangelog(entry);
            }
            toast({ title: "Success", description: `Added ${seedChangelogEntries.length} changelog entries.` });
            fetchChangelogs();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSeeding(false);
        }
    };

    const fetchChangelogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedChangelogs = await getChangelogs();
            const sortedChangelogs = fetchedChangelogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setChangelogs(sortedChangelogs);
        } catch (error) {
            toast({ title: "Error", description: "Could not fetch changelog entries.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (user?.role === 'superadmin') {
            fetchChangelogs();
        }
    }, [user, fetchChangelogs]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormState(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setFormState(prev => ({...prev, createdAt: date.toISOString()}));
        }
    }

    const openAddDialog = () => {
        setEditingEntry(null);
        setFormState(emptyFormState);
        setIsDialogOpen(true);
    };

    const openEditDialog = (entry: ChangelogEntry) => {
        setEditingEntry(entry);
        setFormState({
            version: entry.version,
            title: entry.title,
            notes: entry.notes,
            createdAt: entry.createdAt
        });
        setIsDialogOpen(true);
    };

    const handleFormSubmit = async () => {
        if (!formState.version || !formState.title || !formState.notes) {
            toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            if (editingEntry) {
                await updateChangelog(editingEntry.id, formState);
            } else {
                await addChangelog(formState);
            }
            toast({ title: `Entry ${editingEntry ? 'Updated' : 'Added'}`, description: `Version ${formState.version} has been saved.` });
            setIsDialogOpen(false);
            fetchChangelogs();
        } catch (error) {
            toast({ title: "Error", description: `Could not save the entry. ${(error as Error).message}`, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteEntry = async () => {
        if (!entryToDelete) return;
        setIsSaving(true);
        try {
            await deleteChangelog(entryToDelete.id);
            toast({ title: "Entry Deleted", description: `Version ${entryToDelete.version} has been deleted.` });
            fetchChangelogs();
        } catch (error) {
            toast({ title: "Error", description: `Failed to delete entry. ${(error as Error).message}`, variant: "destructive" });
        } finally {
            setEntryToDelete(null);
            setIsDeleteDialogOpen(false);
            setIsSaving(false);
        }
    };

    if (authLoading || isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    return (
        <>
            <div className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-3"><Newspaper className="h-6 w-6 text-primary"/>Changelog Management</CardTitle>
                            <CardDescription>Create, edit, and delete changelog entries for your application.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleSeedChangelog} disabled={isSeeding}>
                                {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                Seed Updates
                            </Button>
                            <Button onClick={openAddDialog}>
                                <PlusCircle className="mr-2 h-4 w-4"/> Add New Entry
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {changelogs.length > 0 ? (
                           <Accordion type="single" collapsible className="w-full">
                                {changelogs.map(entry => (
                                    <AccordionItem value={entry.id} key={entry.id}>
                                        <div className="flex justify-between items-center pr-4">
                                            <AccordionTrigger className="flex-1 text-left pr-4">
                                                <div>
                                                    <h3 className="text-lg font-semibold">{entry.title} <span className="text-base font-medium text-muted-foreground ml-2">(v{entry.version})</span></h3>
                                                    <p className="text-sm text-muted-foreground">{format(new Date(entry.createdAt), 'PPP')}</p>
                                                </div>
                                            </AccordionTrigger>
                                            <div className="flex gap-2 shrink-0">
                                                <Button variant="outline" size="icon" onClick={() => openEditDialog(entry)}><Edit className="h-4 w-4"/></Button>
                                                <Button variant="destructive" size="icon" onClick={() => {setEntryToDelete(entry); setIsDeleteDialogOpen(true);}}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        </div>
                                        <AccordionContent>
                                            <div className="prose prose-sm dark:prose-invert max-w-none pt-2 whitespace-pre-wrap">{entry.notes}</div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                             <div className="text-center py-12 text-muted-foreground">
                                <p className="text-lg">No changelog entries found.</p>
                                <p className="text-sm">Click "Add New Entry" to get started.</p>
                           </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingEntry ? 'Edit Entry' : 'Add New Entry'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2"><Label htmlFor="version">Version</Label><Input id="version" value={formState.version} onChange={handleFormChange} placeholder="e.g., 1.0.1" /></div>
                        <div className="space-y-2"><Label htmlFor="title">Title</Label><Input id="title" value={formState.title} onChange={handleFormChange} placeholder="e.g., New Feature Release" /></div>
                         <div className="space-y-2">
                             <Label htmlFor="createdAt">Date</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-left font-normal", !formState.createdAt && "text-muted-foreground")}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {formState.createdAt ? format(new Date(formState.createdAt), "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={formState.createdAt ? new Date(formState.createdAt) : undefined}
                                        onSelect={handleDateChange}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2"><Label htmlFor="notes">Content (Markdown supported)</Label><Textarea id="notes" value={formState.notes} onChange={handleFormChange} className="min-h-[200px]" placeholder="Describe the changes..."/></div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" onClick={handleFormSubmit} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {editingEntry ? 'Save Changes' : 'Add Entry'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete version {entryToDelete?.version}. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setEntryToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteEntry} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

    