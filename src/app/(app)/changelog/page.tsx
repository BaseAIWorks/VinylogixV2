
"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Newspaper, Search, Sparkles, Wrench, Bug, Zap, ChevronDown, ChevronUp, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { ChangelogEntry } from "@/types";
import { getChangelogs } from "@/services/changelog-service";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type ChangeType = "feature" | "improvement" | "fix" | "other";

const changeTypeConfig: Record<ChangeType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
    feature: { label: "New Feature", icon: Sparkles, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
    improvement: { label: "Improvement", icon: Zap, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
    fix: { label: "Bug Fix", icon: Bug, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
    other: { label: "Update", icon: Wrench, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-800/50" },
};

const detectChangeType = (title: string, notes: string): ChangeType => {
    const combined = `${title} ${notes}`.toLowerCase();
    if (combined.includes("new feature") || combined.includes("introducing") || combined.includes("added")) return "feature";
    if (combined.includes("fix") || combined.includes("bug") || combined.includes("resolved") || combined.includes("patch")) return "fix";
    if (combined.includes("improve") || combined.includes("enhance") || combined.includes("update") || combined.includes("better")) return "improvement";
    return "other";
};

export default function ChangelogPage() {
    const { user, loading: authLoading, markChangelogsAsRead } = useAuth();
    const { toast } = useToast();

    const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<ChangeType | "all">("all");
    const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

    const fetchChangelogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedChangelogs = await getChangelogs();
            const sortedChangelogs = fetchedChangelogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setChangelogs(sortedChangelogs);

            // Auto-expand the first entry
            if (sortedChangelogs.length > 0) {
                setExpandedEntries(new Set([sortedChangelogs[0].id]));
            }

            if (user?.unreadChangelogs) {
                markChangelogsAsRead();
            }
        } catch (error) {
            toast({ title: "Error", description: "Could not fetch changelog entries.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, user, markChangelogsAsRead]);

    useEffect(() => {
        if (!authLoading) {
            fetchChangelogs();
        }
    }, [authLoading, fetchChangelogs]);

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

    const expandAll = () => {
        setExpandedEntries(new Set(filteredChangelogs.map(e => e.id)));
    };

    const collapseAll = () => {
        setExpandedEntries(new Set());
    };

    if (authLoading || isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Newspaper className="h-6 w-6 text-primary"/>
                            <div>
                                <CardTitle>Application Changelog</CardTitle>
                                <CardDescription>Stay up to date with the latest features, improvements, and bug fixes.</CardDescription>
                            </div>
                        </div>
                        {changelogs.length > 0 && (
                            <Badge variant="secondary" className="text-sm">
                                {changelogs.length} update{changelogs.length !== 1 ? 's' : ''}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Search and Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search updates..."
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
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={typeFilter === "all" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setTypeFilter("all")}
                            >
                                All
                            </Button>
                            {(Object.keys(changeTypeConfig) as ChangeType[]).map(type => {
                                const config = changeTypeConfig[type];
                                const Icon = config.icon;
                                return (
                                    <Button
                                        key={type}
                                        variant={typeFilter === type ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setTypeFilter(type)}
                                        className="gap-1.5"
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {config.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Expand/Collapse Controls */}
                    {filteredChangelogs.length > 1 && (
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={expandAll}>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Expand All
                            </Button>
                            <Button variant="ghost" size="sm" onClick={collapseAll}>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Collapse All
                            </Button>
                        </div>
                    )}

                    {/* Timeline */}
                    {filteredChangelogs.length > 0 ? (
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border hidden sm:block" />

                            <div className="space-y-4">
                                {filteredChangelogs.map((entry, index) => {
                                    const changeType = detectChangeType(entry.title, entry.notes);
                                    const config = changeTypeConfig[changeType];
                                    const Icon = config.icon;
                                    const isExpanded = expandedEntries.has(entry.id);
                                    const isLatest = index === 0;

                                    return (
                                        <div key={entry.id} className="relative flex gap-4">
                                            {/* Timeline dot */}
                                            <div className={cn(
                                                "hidden sm:flex shrink-0 w-10 h-10 rounded-full items-center justify-center z-10",
                                                config.bgColor
                                            )}>
                                                <Icon className={cn("h-5 w-5", config.color)} />
                                            </div>

                                            {/* Card */}
                                            <Card className={cn(
                                                "flex-1 cursor-pointer transition-shadow hover:shadow-md",
                                                isLatest && "ring-2 ring-primary/20"
                                            )}>
                                                <div
                                                    className="p-4"
                                                    onClick={() => toggleEntry(entry.id)}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                <Badge variant="outline" className="font-mono text-xs">
                                                                    v{entry.version}
                                                                </Badge>
                                                                <Badge className={cn(
                                                                    "text-xs",
                                                                    config.bgColor,
                                                                    config.color
                                                                )}>
                                                                    <Icon className="h-3 w-3 mr-1" />
                                                                    {config.label}
                                                                </Badge>
                                                                {isLatest && (
                                                                    <Badge variant="default" className="text-xs">
                                                                        Latest
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <h3 className="font-semibold text-foreground">{entry.title}</h3>
                                                            <p className="text-sm text-muted-foreground">
                                                                {format(new Date(entry.createdAt), 'PPP')} · {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                                                            </p>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="shrink-0">
                                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="mt-4 pt-4 border-t">
                                                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                                                {entry.notes}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <EmptyState
                            icon={Newspaper}
                            title={searchQuery || typeFilter !== "all" ? "No matching updates" : "No changelog entries yet"}
                            description={
                                searchQuery || typeFilter !== "all"
                                    ? "Try adjusting your search or filter criteria."
                                    : "Check back later for updates!"
                            }
                            action={
                                (searchQuery || typeFilter !== "all") ? (
                                    <Button variant="outline" onClick={() => { setSearchQuery(""); setTypeFilter("all"); }}>
                                        Clear Filters
                                    </Button>
                                ) : undefined
                            }
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

    