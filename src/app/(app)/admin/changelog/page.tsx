
"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Loader2,
    PlusCircle,
    Newspaper,
    Edit,
    Trash2,
    CalendarIcon,
    Search,
    X,
    Sparkles,
    Zap,
    Bug,
    Wrench,
    FileText,
    Clock,
    ChevronDown,
    ChevronUp,
    AlertTriangle
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { ChangelogEntry } from "@/types";
import { getChangelogs, addChangelog, updateChangelog, deleteChangelog } from "@/services/changelog-service";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

type ChangeType = "feature" | "improvement" | "fix" | "other";

const changeTypeConfig: Record<ChangeType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
    feature: { label: "New Feature", icon: Sparkles, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
    improvement: { label: "Improvement", icon: Zap, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
    fix: { label: "Bug Fix", icon: Bug, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
    other: { label: "Update", icon: Wrench, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-800/50" },
};

const detectChangeType = (title: string, notes: string): ChangeType => {
    const combined = `${title} ${notes}`.toLowerCase();
    if (combined.includes("new feature") || combined.includes("introducing") || combined.includes("added") || combined.includes("new")) return "feature";
    if (combined.includes("fix") || combined.includes("bug") || combined.includes("resolved") || combined.includes("patch")) return "fix";
    if (combined.includes("improve") || combined.includes("enhance") || combined.includes("update") || combined.includes("better")) return "improvement";
    return "other";
};

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
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<ChangeType | "all">("all");
    const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
    const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);
    const [formState, setFormState] = useState(emptyFormState);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<ChangelogEntry | null>(null);
    const [isBulkDelete, setIsBulkDelete] = useState(false);

    const fetchChangelogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedChangelogs = await getChangelogs();
            const sortedChangelogs = fetchedChangelogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setChangelogs(sortedChangelogs);
            // Auto-expand latest entry
            if (sortedChangelogs.length > 0) {
                setExpandedEntries(new Set([sortedChangelogs[0].id]));
            }
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

    const filteredChangelogs = useMemo(() => {
        return changelogs.filter(entry => {
            const matchesSearch = searchQuery === "" ||
                entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.version.toLowerCase().includes(searchQuery.toLowerCase());

            const entryType = detectChangeType(entry.title, entry.notes);
            const matchesType = typeFilter === "all" || entryType === typeFilter;

            return matchesSearch && matchesType;
        });
    }, [changelogs, searchQuery, typeFilter]);

    const stats = useMemo(() => {
        const total = changelogs.length;
        const latestVersion = changelogs[0]?.version || "N/A";
        const typeCounts = changelogs.reduce((acc, entry) => {
            const type = detectChangeType(entry.title, entry.notes);
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {} as Record<ChangeType, number>);

        return { total, latestVersion, typeCounts };
    }, [changelogs]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormState(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setFormState(prev => ({...prev, createdAt: date.toISOString()}));
        }
    };

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
        if (isBulkDelete) {
            // Bulk delete
            setIsSaving(true);
            try {
                for (const id of selectedEntries) {
                    await deleteChangelog(id);
                }
                toast({ title: "Entries Deleted", description: `${selectedEntries.size} entries have been deleted.` });
                setSelectedEntries(new Set());
                fetchChangelogs();
            } catch (error) {
                toast({ title: "Error", description: `Failed to delete entries. ${(error as Error).message}`, variant: "destructive" });
            } finally {
                setIsBulkDelete(false);
                setIsDeleteDialogOpen(false);
                setIsSaving(false);
            }
        } else if (entryToDelete) {
            // Single delete
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
        }
    };

    const toggleEntry = (id: string) => {
        setExpandedEntries(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectEntry = (id: string) => {
        setSelectedEntries(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedEntries.size === filteredChangelogs.length) {
            setSelectedEntries(new Set());
        } else {
            setSelectedEntries(new Set(filteredChangelogs.map(e => e.id)));
        }
    };

    const expandAll = () => setExpandedEntries(new Set(filteredChangelogs.map(e => e.id)));
    const collapseAll = () => setExpandedEntries(new Set());

    if (authLoading || isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (user?.role !== 'superadmin') {
        return (
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[400px]">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
                <p className="text-muted-foreground mt-2">Only superadmins can manage changelog entries.</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-primary/10">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                    <p className="text-xs text-muted-foreground">Total Entries</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                                    <Clock className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">v{stats.latestVersion}</p>
                                    <p className="text-xs text-muted-foreground">Latest Version</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                                    <Sparkles className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.typeCounts.feature || 0}</p>
                                    <p className="text-xs text-muted-foreground">Features</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                                    <Bug className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.typeCounts.fix || 0}</p>
                                    <p className="text-xs text-muted-foreground">Bug Fixes</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Newspaper className="h-6 w-6 text-primary"/>
                                <div>
                                    <CardTitle>Changelog Management</CardTitle>
                                    <CardDescription>Create, edit, and delete changelog entries visible to users.</CardDescription>
                                </div>
                            </div>
                            <Button onClick={openAddDialog}>
                                <PlusCircle className="mr-2 h-4 w-4"/> Add New Entry
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Search and Filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by title, version, or content..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                                {searchQuery && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                        onClick={() => setSearchQuery("")}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ChangeType | "all")}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Filter by type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="feature">Features</SelectItem>
                                    <SelectItem value="improvement">Improvements</SelectItem>
                                    <SelectItem value="fix">Bug Fixes</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Bulk Actions & Expand/Collapse */}
                        {filteredChangelogs.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={selectedEntries.size === filteredChangelogs.length && filteredChangelogs.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        {selectedEntries.size > 0 ? `${selectedEntries.size} selected` : "Select all"}
                                    </span>
                                    {selectedEntries.size > 0 && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => { setIsBulkDelete(true); setIsDeleteDialogOpen(true); }}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            Delete Selected
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={expandAll}>
                                        <ChevronDown className="h-4 w-4 mr-1" />
                                        Expand All
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={collapseAll}>
                                        <ChevronUp className="h-4 w-4 mr-1" />
                                        Collapse All
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Changelog Entries */}
                        {filteredChangelogs.length > 0 ? (
                            <div className="space-y-3">
                                {filteredChangelogs.map((entry, index) => {
                                    const changeType = detectChangeType(entry.title, entry.notes);
                                    const config = changeTypeConfig[changeType];
                                    const Icon = config.icon;
                                    const isExpanded = expandedEntries.has(entry.id);
                                    const isSelected = selectedEntries.has(entry.id);
                                    const isLatest = index === 0;

                                    return (
                                        <Card
                                            key={entry.id}
                                            className={cn(
                                                "transition-all",
                                                isSelected && "ring-2 ring-primary",
                                                isLatest && !isSelected && "ring-1 ring-primary/30"
                                            )}
                                        >
                                            <div className="p-4">
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelectEntry(entry.id)}
                                                        className="mt-1"
                                                    />
                                                    <div
                                                        className="flex-1 cursor-pointer"
                                                        onClick={() => toggleEntry(entry.id)}
                                                    >
                                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                                            <Badge variant="outline" className="font-mono text-xs">
                                                                v{entry.version}
                                                            </Badge>
                                                            <Badge className={cn("text-xs", config.bgColor, config.color)}>
                                                                <Icon className="h-3 w-3 mr-1" />
                                                                {config.label}
                                                            </Badge>
                                                            {isLatest && (
                                                                <Badge variant="default" className="text-xs">Latest</Badge>
                                                            )}
                                                        </div>
                                                        <h3 className="font-semibold text-foreground">{entry.title}</h3>
                                                        <p className="text-sm text-muted-foreground">
                                                            {format(new Date(entry.createdAt), 'PPP')} · {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => toggleEntry(entry.id)}
                                                        >
                                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => openEditDialog(entry)}
                                                        >
                                                            <Edit className="h-4 w-4"/>
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => { setEntryToDelete(entry); setIsBulkDelete(false); setIsDeleteDialogOpen(true); }}
                                                        >
                                                            <Trash2 className="h-4 w-4"/>
                                                        </Button>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="mt-4 pt-4 border-t ml-7">
                                                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                                            {entry.notes}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyState
                                icon={Newspaper}
                                title={searchQuery || typeFilter !== "all" ? "No matching entries" : "No changelog entries yet"}
                                description={
                                    searchQuery || typeFilter !== "all"
                                        ? "Try adjusting your search or filter criteria."
                                        : "Click 'Add New Entry' to create your first changelog."
                                }
                                action={
                                    searchQuery || typeFilter !== "all" ? (
                                        <Button variant="outline" onClick={() => { setSearchQuery(""); setTypeFilter("all"); }}>
                                            Clear Filters
                                        </Button>
                                    ) : (
                                        <Button onClick={openAddDialog}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add New Entry
                                        </Button>
                                    )
                                }
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingEntry ? 'Edit Entry' : 'Add New Entry'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="version">Version</Label>
                                <Input id="version" value={formState.version} onChange={handleFormChange} placeholder="e.g., 2.5.0" />
                            </div>
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
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" value={formState.title} onChange={handleFormChange} placeholder="e.g., New Wishlist Feature" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes">Content</Label>
                            <p className="text-xs text-muted-foreground">Use bullet points (•) and **bold** for formatting</p>
                            <Textarea
                                id="notes"
                                value={formState.notes}
                                onChange={handleFormChange}
                                className="min-h-[200px] font-mono text-sm"
                                placeholder="Describe the changes...

• **Feature Name** - Description of what it does
• **Another Feature** - More details here"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" onClick={handleFormSubmit} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {editingEntry ? 'Save Changes' : 'Add Entry'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isBulkDelete
                                ? `This will permanently delete ${selectedEntries.size} selected entries. This action cannot be undone.`
                                : `This will permanently delete version ${entryToDelete?.version}. This action cannot be undone.`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setEntryToDelete(null); setIsBulkDelete(false); }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteEntry} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Delete {isBulkDelete ? `${selectedEntries.size} Entries` : "Entry"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
