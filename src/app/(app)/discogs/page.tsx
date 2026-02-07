
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Disc3, Loader2, Link as LinkIcon, XCircle, AlertTriangle, ExternalLink, Star, Euro, Search, X, Package, Heart } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { DiscogsCollectionRelease, DiscogsWant, DiscogsBasicInformation, DiscogsListing } from "@/types";
import { getDiscogsCollectionPage, getDiscogsWantlistPage, getRequestOptions, getDiscogsInventoryPage } from "@/services/discogs-user-service";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";

interface UnifiedDisplayItem {
  id: number; // release id
  listingId?: number; // only for inventory items
  date_added: string;
  basic_information: {
      id: number;
      thumb?: string;
      title: string;
      artists: { name: string }[];
      year?: number;
  };
  rating?: number;
  price?: { value: number; currency: string };
  quantity?: number;
}

type DataType = 'collection' | 'wantlist' | 'inventory';

const DiscogsDataView = ({ fetchFunction, username, dataType, distributorId }: {
    fetchFunction: (username: string, page: number, distributorId?: string) => Promise<any>,
    username: string,
    dataType: DataType,
    distributorId?: string
}) => {
    const [items, setItems] = useState<UnifiedDisplayItem[]>([]);
    const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Filter items by search query
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items;
        const query = searchQuery.toLowerCase();
        return items.filter(item =>
            item.basic_information.title.toLowerCase().includes(query) ||
            item.basic_information.artists.some(a => a.name.toLowerCase().includes(query))
        );
    }, [items, searchQuery]);

    // Calculate stats
    const stats = useMemo(() => {
        const totalItems = items.length;
        const totalValue = items.reduce((sum, item) => {
            if (item.price) {
                return sum + (item.price.value * (item.quantity || 1));
            }
            return sum;
        }, 0);
        const uniqueArtists = new Set(items.flatMap(i => i.basic_information.artists.map(a => a.name))).size;
        return { totalItems, totalValue, uniqueArtists };
    }, [items]);

    const mapDataToUnifiedItems = useCallback((data: any): UnifiedDisplayItem[] => {
        if (dataType === 'collection' && data.releases) {
            return data.releases.map((r: DiscogsCollectionRelease) => ({
                id: r.basic_information.id,
                date_added: r.date_added,
                basic_information: r.basic_information,
                rating: r.rating,
            }));
        }
        if (dataType === 'wantlist' && data.wants) {
            return data.wants.map((w: DiscogsWant) => ({
                id: w.basic_information.id,
                date_added: w.date_added,
                basic_information: w.basic_information,
                rating: w.rating,
            }));
        }
        if (dataType === 'inventory' && data.listings) {
            const grouped = data.listings.reduce((acc: Record<string, UnifiedDisplayItem>, l: DiscogsListing) => {
                const releaseId = l.release.id.toString();
                if (acc[releaseId]) {
                    acc[releaseId].quantity = (acc[releaseId].quantity || 1) + 1;
                } else {
                    acc[releaseId] = {
                        id: l.release.id,
                        listingId: l.id,
                        date_added: l.posted,
                        basic_information: {
                            id: l.release.id,
                            title: l.release.title,
                            artists: [{ name: l.release.artist }],
                            year: l.release.year,
                            thumb: l.release.thumbnail,
                        },
                        price: l.price,
                        quantity: 1,
                    };
                }
                return acc;
            }, {});

            const getArtistName = (item: UnifiedDisplayItem) => item.basic_information.artists?.[0]?.name || '';
            return Object.values(grouped).sort((a, b) => {
                const artistCompare = getArtistName(a).localeCompare(getArtistName(b));
                if (artistCompare !== 0) return artistCompare;
                return a.basic_information.title.localeCompare(b.basic_information.title);
            });
        }
        return [];
    }, [dataType]);


    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            setError(null);
            setItems([]);
            setNextPageUrl(null);
            try {
                const data = await fetchFunction(username, 1, distributorId);
                if (data) {
                     setItems(mapDataToUnifiedItems(data));
                    setNextPageUrl(data.pagination?.urls?.next || null);
                }
            } catch (err) {
                setError((err as Error).message || "An unknown error occurred.");
                setItems([]);
                setNextPageUrl(null);
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [username, fetchFunction, dataType, mapDataToUnifiedItems, distributorId]);

    const handleLoadMore = async () => {
        if (!nextPageUrl || isLoadingMore) return;

        setIsLoadingMore(true);
        setError(null);
        try {
            const response = await fetch(nextPageUrl, getRequestOptions());
             if (!response.ok) {
                 await handleDiscogsError(response, `loading more for ${username}`);
            }
            const data = await response.json();
            
            // For inventory, we need to merge new items with existing grouped items
            if (dataType === 'inventory' && data.listings) {
                const newItems = mapDataToUnifiedItems(data);
                setItems(prevItems => {
                    const combined = [...prevItems];
                    newItems.forEach(newItem => {
                        const existingIndex = combined.findIndex(i => i.id === newItem.id);
                        if (existingIndex > -1) {
                            combined[existingIndex].quantity = (combined[existingIndex].quantity || 1) + (newItem.quantity || 1);
                        } else {
                            combined.push(newItem);
                        }
                    });
                    const getArtistName = (item: UnifiedDisplayItem) => item.basic_information.artists?.[0]?.name || '';
                    return combined.sort((a, b) => {
                        const artistCompare = getArtistName(a).localeCompare(getArtistName(b));
                        if (artistCompare !== 0) return artistCompare;
                        return a.basic_information.title.localeCompare(b.basic_information.title);
                    });
                });
            } else {
                setItems(prevItems => [...prevItems, ...mapDataToUnifiedItems(data)]);
            }

            setNextPageUrl(data.pagination?.urls?.next || null);

        } catch (err) {
            setError((err as Error).message || "An unknown error occurred while loading more.");
        } finally {
            setIsLoadingMore(false);
        }
    }
    
    async function handleDiscogsError(response: Response, context: string): Promise<never> {
        const errorBody = await response.text();
        console.error(`Discogs API error (${context}): ${response.status} ${response.statusText}`, errorBody);
        let message: string;
        switch(response.status) {
            case 401: message = "Discogs API authentication failed. Your token is likely invalid or expired."; break;
            case 403: message = "Access denied by Discogs. This usually means your API token is invalid/missing OR the user's collection is private. Please double-check your .env.local file and the user's privacy settings on Discogs. Also, ensure your server has been restarted after changing the .env.local file."; break;
            case 404: message = "The requested resource was not found on Discogs."; break;
            case 429: message = "Discogs API rate limit exceeded. Please wait a few minutes before trying again."; break;
            default: message = `Discogs API returned status ${response.status}. Check console for details.`;
        }
        throw new Error(message);
    }

    if (isLoading) {
        return <div className="flex items-center justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return (
            <Alert variant="destructive" className="my-8">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Data</AlertTitle>
                <AlertDescription>
                    {error}
                </AlertDescription>
            </Alert>
        );
    }

    if (items.length === 0) {
        return (
            <EmptyState
                icon={Disc3}
                title="No items found"
                description={`Your Discogs ${dataType} appears to be empty.`}
            />
        );
    }

    return (
        <div className="space-y-4">
            {/* Stats and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-sm">
                        {stats.totalItems} {dataType === 'inventory' ? 'listings' : 'items'}
                    </Badge>
                    {stats.uniqueArtists > 0 && (
                        <Badge variant="outline" className="text-sm">
                            {stats.uniqueArtists} artists
                        </Badge>
                    )}
                    {dataType === 'inventory' && stats.totalValue > 0 && (
                        <Badge variant="outline" className="text-sm">
                            <Euro className="h-3 w-3 mr-1" />
                            {stats.totalValue.toFixed(2)} total
                        </Badge>
                    )}
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter by artist or title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                            onClick={() => setSearchQuery("")}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </div>

            {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <p>No items match your search.</p>
                    <Button variant="link" onClick={() => setSearchQuery("")}>Clear filter</Button>
                </div>
            ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px]"></TableHead>
                        <TableHead>Release</TableHead>
                        <TableHead className="hidden sm:table-cell">Year</TableHead>
                        <TableHead className="hidden sm:table-cell">Added</TableHead>
                        {dataType === 'inventory' && <TableHead className="text-center">Quantity</TableHead>}
                        <TableHead className="text-right">{dataType === 'inventory' ? 'Price' : 'Rating'}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredItems.map(item => (
                        <TableRow 
                            key={`${item.listingId || item.id}-${item.date_added}`} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                                const url = dataType === 'inventory' && item.listingId
                                    ? `https://www.discogs.com/sell/item/${item.listingId}`
                                    : `https://discogs.com/release/${item.basic_information.id}`;
                                window.open(url, '_blank');
                            }}
                        >
                            <TableCell>
                                <Image src={item.basic_information.thumb || 'https://placehold.co/64x64.png'} alt="Cover" width={64} height={64} className="rounded-md aspect-square object-cover" />
                            </TableCell>
                            <TableCell>
                                <p className="font-semibold">{item.basic_information.title}</p>
                                <p className="text-sm text-muted-foreground">{item.basic_information.artists.map(a => a.name).join(', ')}</p>
                            </TableCell>
                             <TableCell className="hidden sm:table-cell">{item.basic_information.year}</TableCell>
                            <TableCell className="hidden sm:table-cell">{format(new Date(item.date_added), 'dd MMM yyyy')}</TableCell>
                            {dataType === 'inventory' && <TableCell className="text-center">{item.quantity || 1}</TableCell>}
                            <TableCell className="text-right flex items-center justify-end gap-1">
                                {item.price ? (
                                    <>
                                        <Euro className="h-4 w-4 text-muted-foreground" />
                                        {item.price.value.toFixed(2)}
                                    </>
                                ) : item.rating !== undefined && item.rating > 0 ? (
                                    <>
                                        <Star className="h-4 w-4 text-yellow-500" /> {item.rating}
                                    </>
                                ) : (
                                    <span>-</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            )}
            {nextPageUrl && (
                <div className="flex justify-center mt-6">
                    <Button onClick={handleLoadMore} disabled={isLoadingMore} className="w-40">
                        {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isLoadingMore ? 'Loading...' : 'Load More'}
                    </Button>
                </div>
            )}
        </div>
    );
};


function DiscogsPageContent() {
    const { user, connectToDiscogs, disconnectFromDiscogs } = useAuth();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [usernameInput, setUsernameInput] = useState("");
    
    if (!user) {
        return <Loader2 className="h-12 w-12 animate-spin text-primary" />;
    }

    const isOperator = user.role === 'master' || user.role === 'worker';
    const mainTabLabel = isOperator ? 'Inventory' : 'Collection';
    const mainTabFetchFunction: (username: string, page: number, distributorId?: string) => Promise<any> = isOperator ? getDiscogsInventoryPage : getDiscogsCollectionPage;
    const mainTabDataType: DataType = isOperator ? 'inventory' : 'collection';
    
    const handleConnect = async () => {
        if (!usernameInput.trim()) {
            return;
        }
        await connectToDiscogs(usernameInput);
        setIsDialogOpen(false); 
    };
    
    if (!user.discogsUsername) {
        return (
            <Card className="max-w-xl mx-auto">
                <CardHeader className="text-center">
                    <Disc3 className="mx-auto h-16 w-16 text-primary mb-4" />
                    <CardTitle className="text-2xl">Connect your Discogs Account</CardTitle>
                    <CardDescription>
                        View your Discogs {mainTabLabel.toLowerCase()} and wantlist directly within Vinylogix.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                    <Alert>
                        <LinkIcon className="h-4 w-4" />
                        <AlertTitle>How it works</AlertTitle>
                        <AlertDescription>
                            {isOperator
                                ? "This will connect your Vinylogix account to your Discogs seller account. We will read your inventory (for sale items) and wantlist."
                                : "This will connect your Vinylogix account to your Discogs account. We will read your public profile, collection, and wantlist."
                            }
                        </AlertDescription>
                    </Alert>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="lg">
                                <LinkIcon className="mr-2 h-5 w-5" />
                                Connect Discogs Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Connect to Discogs</DialogTitle>
                                <DialogDescription>
                                    Enter your public Discogs username to connect your account.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="username" className="text-right">Username</Label>
                                    <Input
                                        id="username"
                                        value={usernameInput}
                                        onChange={(e) => setUsernameInput(e.target.value)}
                                        className="col-span-3"
                                        placeholder="YourDiscogsUsername"
                                        onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">Cancel</Button>
                                </DialogClose>
                                <Button type="button" onClick={handleConnect}>Connect</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <Disc3 className="h-8 w-8 text-primary" />
                                <span>Discogs Integration</span>
                            </CardTitle>
                            <CardDescription>
                                Connected as: <span className="font-semibold text-foreground">{user.discogsUsername}</span>
                            </CardDescription>
                        </div>
                        <Button onClick={disconnectFromDiscogs} variant="destructive">
                            <XCircle className="mr-2 h-4 w-4" />
                            Disconnect
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="main">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="main">{mainTabLabel}</TabsTrigger>
                            <TabsTrigger value="wantlist">Wantlist</TabsTrigger>
                        </TabsList>
                        <TabsContent value="main" className="pt-4">
                           <DiscogsDataView fetchFunction={mainTabFetchFunction} username={user.discogsUsername} dataType={mainTabDataType} distributorId={user.distributorId} />
                        </TabsContent>
                        <TabsContent value="wantlist" className="pt-4">
                           <DiscogsDataView fetchFunction={getDiscogsWantlistPage} username={user.discogsUsername} dataType="wantlist" distributorId={user.distributorId} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

export default function DiscogsPage() {
    return (
        <DiscogsPageContent />
    )
}
