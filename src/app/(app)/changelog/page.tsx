
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Newspaper } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { ChangelogEntry } from "@/types";
import { getChangelogs } from "@/services/changelog-service";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function ChangelogPage() {
    const { user, loading: authLoading, markChangelogsAsRead } = useAuth();
    const { toast } = useToast();
    
    const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchChangelogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedChangelogs = await getChangelogs();
            const sortedChangelogs = fetchedChangelogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setChangelogs(sortedChangelogs);
            // Mark as read when the user visits the page
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

    if (authLoading || isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3"><Newspaper className="h-6 w-6 text-primary"/>Application Changelog</CardTitle>
                    <CardDescription>Stay up to date with the latest features, improvements, and bug fixes.</CardDescription>
                </CardHeader>
                <CardContent>
                    {changelogs.length > 0 ? (
                       <Accordion type="single" collapsible className="w-full">
                            {changelogs.map(entry => (
                                <AccordionItem value={entry.id} key={entry.id}>
                                    <AccordionTrigger>
                                        <div className="flex flex-1 justify-between items-center pr-4 text-left">
                                            <div>
                                                <h3 className="text-lg font-semibold">{entry.title} <span className="text-base font-medium text-muted-foreground ml-2">(v{entry.version})</span></h3>
                                                <p className="text-sm text-muted-foreground">{format(new Date(entry.createdAt), 'PPP')}</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="prose prose-sm dark:prose-invert max-w-none pt-2 whitespace-pre-wrap">{entry.notes}</div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                         <div className="text-center py-12 text-muted-foreground">
                            <p className="text-lg">No changelog entries found yet.</p>
                            <p className="text-sm">Check back later for updates!</p>
                       </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
