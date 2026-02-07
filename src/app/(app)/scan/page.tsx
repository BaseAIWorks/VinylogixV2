
"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Camera, Search, Loader2, XCircle, Barcode, VideoOff, ScanLine, Keyboard, Image as ImageIcon, FilePlus2, Music, User, Clock, Trash2, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { useAuth } from "@/hooks/use-auth";
import { getRecordByBarcode } from "@/services/record-service";
import { analyzeCover } from "@/ai/flows/analyze-cover-flow";
import { cn } from "@/lib/utils";
import { searchDiscogsByBarcode, searchDiscogsByArtistTitle } from "@/services/discogs-service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DiscogsReleaseSearchResult } from "@/types";
import NextImage from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";

interface RecentScan {
  barcode: string;
  title?: string;
  artist?: string;
  timestamp: string;
  type: 'barcode' | 'ai' | 'manual';
}

const RECENT_SCANS_KEY = 'vinylogix_recent_scans';
const MAX_RECENT_SCANS = 5;

type ScanMode = "idle" | "barcode" | "ai";
type ScanStatus = "idle" | "requesting_permission" | "scanning" | "analyzing" | "success" | "error" | "manual_lookup" | "not_found";

const BARCODE_READER_ID = "barcode-scanner-region";

export default function ScanPage() {
  const { user, activeDistributor } = useAuth();
  const [manualInput, setManualInput] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>("idle");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [lastSearchedBarcode, setLastSearchedBarcode] = useState<string | null>(null);
  const [isHandheldDialogOpen, setIsHandheldDialogOpen] = useState(false);
  const [textSearchResults, setTextSearchResults] = useState<DiscogsReleaseSearchResult[]>([]);
  const [isTextSearching, setIsTextSearching] = useState(false);
  const [artistSearch, setArtistSearch] = useState("");
  const [titleSearch, setTitleSearch] = useState("");
  const [barcodeSearchResults, setBarcodeSearchResults] = useState<DiscogsReleaseSearchResult[]>([]);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Load recent scans from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SCANS_KEY);
      if (stored) {
        setRecentScans(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recent scans:', error);
    }
  }, []);

  // Add to recent scans
  const addToRecentScans = useCallback((scan: Omit<RecentScan, 'timestamp'>) => {
    setRecentScans(prev => {
      const newScan = { ...scan, timestamp: new Date().toISOString() };
      const filtered = prev.filter(s => s.barcode !== scan.barcode);
      const updated = [newScan, ...filtered].slice(0, MAX_RECENT_SCANS);
      try {
        localStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving recent scans:', error);
      }
      return updated;
    });
  }, []);

  // Clear recent scans
  const clearRecentScans = useCallback(() => {
    setRecentScans([]);
    localStorage.removeItem(RECENT_SCANS_KEY);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'b' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        startBarcodeScan();
      } else if (e.key === 'a' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        startAiScan();
      } else if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        manualInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        resetScanner();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handheldInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const stopAllScanners = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => {
            console.warn("Could not stop barcode scanner, it might have already been stopped:", err);
        });
    }
  }, []);

  const resetScanner = useCallback(() => {
    stopAllScanners();
    setScanMode("idle");
    setScanStatus("idle");
    setLastSearchedBarcode(null);
    setBarcodeSearchResults([]); // Clear barcode results as well
  }, [stopAllScanners]);

  const handleCameraError = useCallback((err: any, context: string) => {
    let description = `Could not start the camera for ${context}. Please ensure permissions are granted.`;
    if (err instanceof Error || typeof err === 'object' && err !== null && 'name' in err) {
      switch (err.name) {
        case "NotAllowedError": description = "Camera access was denied. Please enable it in your browser/OS settings."; break;
        case "NotFoundError": case "DevicesNotFoundError": description = "No camera found. Please ensure a camera is connected."; break;
        case "NotReadableError": case "TrackStartError": description = "Camera is already in use by another application or a hardware error occurred."; break;
      }
    }
    toast({ variant: "destructive", title: "Camera Error", description, duration: 7000 });
    setScanStatus("error");
    setScanMode("idle");
  }, [toast]);
  
  const handleSelectSearchResult = (result: DiscogsReleaseSearchResult) => {
      const params = new URLSearchParams();
      params.set('discogs_id', result.id.toString());
      if (result.barcode && result.barcode.length > 0) {
          params.set('barcode', result.barcode[0].replace(/[\s-]/g, ''));
      }
      router.push(`/records/add?${params.toString()}`);
  };

  const processBarcode = useCallback(async (barcode: string, scanType: 'barcode' | 'manual' = 'manual') => {
    if (!user) { toast({ title: "Error", description: "User not logged in.", variant: "destructive" }); return; }

    const normalizedBarcode = barcode.replace(/\D/g, '');
    if (!normalizedBarcode) {
        toast({ title: "Invalid Barcode", description: "Please enter only numbers.", variant: "destructive" });
        return;
    }

    setScanStatus("manual_lookup");
    setLastSearchedBarcode(normalizedBarcode);
    setBarcodeSearchResults([]); // Clear previous results

    try {
      const existingRecord = await getRecordByBarcode(normalizedBarcode, user, activeDistributor?.id);
      if (existingRecord) {
        addToRecentScans({
          barcode: normalizedBarcode,
          title: existingRecord.title,
          artist: existingRecord.artist,
          type: scanType
        });
        toast({ title: "Record Found in Inventory", description: "Redirecting to the existing record..." });
        const redirectUrl = user.role !== 'viewer' ? `/records/${existingRecord.id}?action=adjustStock` : `/records/${existingRecord.id}`;
        router.push(redirectUrl);
        return;
      }

      const discogsResults = await searchDiscogsByBarcode(normalizedBarcode, activeDistributor?.id);
      if (discogsResults && discogsResults.length > 0) {
        if (discogsResults.length === 1) {
            addToRecentScans({
              barcode: normalizedBarcode,
              title: discogsResults[0].title,
              type: scanType
            });
            toast({ title: "Match Found on Discogs", description: "Redirecting to add the new record..." });
            handleSelectSearchResult(discogsResults[0]);
        } else {
            toast({ title: "Multiple Matches Found", description: "Please select the correct release from the list below." });
            setBarcodeSearchResults(discogsResults);
            setScanStatus("success");
        }
      } else {
        addToRecentScans({ barcode: normalizedBarcode, type: scanType });
        setScanStatus("not_found");
      }
    } catch (error) {
      toast({ title: "Search Error", description: `An error occurred: ${(error as Error).message}`, variant: "destructive"});
      setScanStatus("idle");
    }
  }, [user, router, toast, activeDistributor, addToRecentScans]);
  
  const startBarcodeScan = async () => {
    resetScanner();
    setScanMode('barcode');
    setScanStatus('requesting_permission');
    
    const element = document.getElementById(BARCODE_READER_ID);
    if (!element) {
      console.error("Scanner element not found");
      setScanStatus('error');
      return;
    }
  
    html5QrCodeRef.current = new Html5Qrcode(BARCODE_READER_ID, { verbose: false });
  
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error("No cameras found on this device.");
      }
  
      const rearCamera = cameras.find(camera => camera.label.toLowerCase().includes('back'));
      const cameraId = rearCamera ? rearCamera.id : cameras[cameras.length - 1].id;
  
      setScanStatus("scanning");
  
      const config = {
        fps: 10,
        qrbox: { width: 350, height: 200 },
        videoConstraints: {
          deviceId: cameraId,
          focusMode: 'continuous',
          zoom: 1.5,
        }
      };
  
      await html5QrCodeRef.current.start(
        cameraId,
        config,
        (decodedText) => {
          if (html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
            html5QrCodeRef.current.stop();
            processBarcode(decodedText, 'barcode');
          }
        },
        (errorMessage) => { /* Ignore errors */ }
      );
    } catch (err) {
      handleCameraError(err, 'barcode scanner');
    }
  };

  const startAiScan = async () => {
      resetScanner();
      setScanMode('ai');
      setScanStatus("requesting_permission");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanStatus("scanning");
        }
      } catch (err) {
        handleCameraError(err, 'AI cover scanner');
      }
  };


  const handleAiCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanStatus("analyzing");
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    
    if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg');
        stopAllScanners();
        try {
            const result = await analyzeCover({ photoDataUri: dataUri, distributorId: activeDistributor?.id });
            if (result.artist && result.title) {
                toast({ title: "Cover Identified", description: `${result.artist} - ${result.title}` });
                router.push(`/records/add?artist=${encodeURIComponent(result.artist)}&title=${encodeURIComponent(result.title)}`);
            } else {
                toast({ title: "Could Not Identify", description: "AI could not identify the record. Please try manual entry.", variant: "destructive" });
                resetScanner();
            }
        } catch (error) {
            toast({ title: "AI Analysis Failed", description: (error as Error).message, variant: "destructive" });
            resetScanner();
        }
    }
  };

  const handleManualSubmit = () => {
    const trimmedInput = manualInput.trim();
    if (!trimmedInput) { toast({ title: "Input Error", description: "Please enter a Barcode, Discogs ID, or Catalog Number.", variant: "destructive" }); return; }
    stopAllScanners();
    processBarcode(trimmedInput, 'manual');
  };
  
  const handleTextSearch = async () => {
      if (!artistSearch && !titleSearch) {
          toast({ title: "Input Required", description: "Please enter an artist and/or title to search.", variant: "destructive" });
          return;
      }
      setIsTextSearching(true);
      setTextSearchResults([]);
      try {
          const results = await searchDiscogsByArtistTitle(artistSearch, titleSearch, activeDistributor?.id);
          setTextSearchResults(results || []);
          if (!results || results.length === 0) {
              toast({ title: "No Results", description: "No releases found on Discogs for your search." });
          }
      } catch (error) {
          toast({ title: "Search Error", description: `An error occurred: ${(error as Error).message}`, variant: "destructive" });
      } finally {
          setIsTextSearching(false);
      }
  };

  useEffect(() => { if (isHandheldDialogOpen) { setTimeout(() => { handheldInputRef.current?.focus(); }, 100); } }, [isHandheldDialogOpen]);
  useEffect(() => { if (searchParams.get('action') === 'handheld') { setIsHandheldDialogOpen(true); } }, [searchParams]);

  useEffect(() => {
    return () => {
      stopAllScanners();
    }
  }, [stopAllScanners]);

  const isLoading = ["requesting_permission", "manual_lookup", "analyzing"].includes(scanStatus);
  const isScanning = scanStatus === "scanning";
  
  const searchResults = barcodeSearchResults.length > 0 ? barcodeSearchResults : textSearchResults;
  const isSearching = isTextSearching || scanStatus === 'manual_lookup';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ScanLine className="h-6 w-6 text-primary"/>
              <div>
                <CardTitle>Scan Vinyl</CardTitle>
                <CardDescription>Scan a barcode or album cover, or search manually.</CardDescription>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">B</kbd>
              <span>Barcode</span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">A</kbd>
              <span>AI</span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">M</kbd>
              <span>Manual</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="flex items-center space-x-2">
            <div className="relative flex-grow">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <Input
                ref={manualInputRef}
                type="text"
                placeholder="Barcode, Discogs ID, or Catalog No."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                className="py-5 pl-10"
                disabled={isLoading || isScanning}
              />
            </div>
             <Button onClick={handleManualSubmit} variant="secondary" disabled={isLoading || isScanning || !manualInput.trim()}>
                  {scanStatus === "manual_lookup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="hidden sm:inline ml-2">Search</span>
              </Button>
          </div>

          {scanStatus === 'not_found' && (
              <Alert>
                  <AlertTitle>No Match Found</AlertTitle>
                  <AlertDescription>
                      We couldn&apos;t find a record for barcode &quot;{lastSearchedBarcode}&quot; in your inventory or on Discogs. You can try searching by artist and title in the search fields below or add it manually.
                  </AlertDescription>
                  <div className="mt-4 flex gap-2">
                      <Button variant="outline" onClick={resetScanner}>Try Again</Button>
                      <Button onClick={() => router.push(`/records/add?barcode=${lastSearchedBarcode}`)}>Add Manually</Button>
                  </div>
              </Alert>
          )}

          <div className={cn(
              "w-full bg-muted rounded-md overflow-hidden flex items-center justify-center relative transition-all duration-300 ease-in-out aspect-[4/5]",
               scanMode === 'idle' && 'hidden'
          )}>
            <div id={BARCODE_READER_ID} className={cn('w-full h-full flex justify-center items-center', scanMode === 'barcode' ? 'block' : 'hidden')} />
            <video 
              ref={videoRef} 
              className={cn('w-full h-full object-cover', scanMode === 'ai' ? 'block' : 'hidden')} 
              autoPlay 
              playsInline 
              muted 
            />
            
            {scanMode === 'idle' && scanStatus !== 'error' && <ImageIcon className="h-24 w-24 text-muted-foreground/30" />}
            {scanStatus === 'error' && <VideoOff className="h-24 w-24 text-destructive/50" />}
            {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 gap-2"><Loader2 className="h-8 w-8 animate-spin text-primary"/><p className="text-muted-foreground capitalize">{scanStatus.replace('_', ' ')}...</p></div>}

            {isScanning && scanMode === 'ai' && (
              <div className="absolute inset-0 flex items-end justify-center p-4 bg-black/20">
                  <Button onClick={handleAiCapture} className="w-full"><Camera className="mr-2"/>Take Photo of Cover</Button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button onClick={startBarcodeScan} className="w-full" disabled={isLoading || isScanning}><Barcode className="mr-2"/> Scan Barcode</Button>
              <Button onClick={startAiScan} variant="secondary" className="w-full" disabled={isLoading || isScanning}><ImageIcon className="mr-2"/> Scan Cover (AI)</Button>
              <Button onClick={() => router.push('/records/add')} variant="outline" className="w-full" disabled={isLoading || isScanning}><FilePlus2 className="mr-2"/> Add Manually</Button>
          </div>
           <Dialog open={isHandheldDialogOpen} onOpenChange={setIsHandheldDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full"><Keyboard className="mr-2"/>Use Handheld Scanner</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Handheld Scanner Input</DialogTitle>
                    <DialogDescription>Click the input field below to activate it, then scan a barcode with your handheld device. The result will be processed automatically.</DialogDescription>
                </DialogHeader>
                <Input
                  ref={handheldInputRef}
                  placeholder="Waiting for scan..."
                  onKeyDown={(e) => { if (e.key === 'Enter') { processBarcode((e.target as HTMLInputElement).value, 'barcode'); (e.target as HTMLInputElement).value = ''; } }}
                />
            </DialogContent>
          </Dialog>
          {scanMode !== "idle" && <Button onClick={resetScanner} variant="outline" className="w-full"><XCircle className="mr-2"/> Stop Scan</Button>}
          
          <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div></div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-center font-semibold text-foreground">Manual Search</h3>
             <div className="space-y-2">
                <Label htmlFor="artist-search">Artist</Label>
                <Input id="artist-search" value={artistSearch} onChange={(e) => setArtistSearch(e.target.value)} placeholder="e.g. The Beatles" disabled={isTextSearching}/>
             </div>
              <div className="space-y-2">
                <Label htmlFor="title-search">Title</Label>
                <Input id="title-search" value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} placeholder="e.g. Abbey Road" disabled={isTextSearching}/>
             </div>
             <Button onClick={handleTextSearch} className="w-full" disabled={isTextSearching}>
                {isTextSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
                Search by Text
             </Button>
          </div>
        </CardContent>
      </Card>
      
      {(isSearching || searchResults.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
                {barcodeSearchResults.length > 0 ? `Multiple results found for barcode: ${lastSearchedBarcode}` : 'Results from your text search.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSearching ? (
              <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
            ) : (
              <ScrollArea className="h-[400px]">
                <ul className="space-y-4">
                  {searchResults.map(result => (
                    <li key={result.id}>
                      <button onClick={() => handleSelectSearchResult(result)} className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-4">
                         <NextImage src={result.thumb || 'https://placehold.co/64x64.png'} alt={result.title} width={64} height={64} className="rounded-md aspect-square object-cover bg-secondary" />
                         <div className="flex-1">
                           <p className="font-semibold text-foreground">{result.title}</p>
                           <p className="text-sm text-muted-foreground">{result.year} &bull; {result.country}</p>
                           <p className="text-xs text-muted-foreground">{result.format?.join(', ')}</p>
                         </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Scans</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={clearRecentScans}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {recentScans.map((scan, index) => (
                <li key={`${scan.barcode}-${index}`}>
                  <button
                    onClick={() => processBarcode(scan.barcode, 'manual')}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
                  >
                    <div className={cn(
                      "p-2 rounded-full",
                      scan.type === 'barcode' ? "bg-blue-100 dark:bg-blue-950/30" :
                      scan.type === 'ai' ? "bg-purple-100 dark:bg-purple-950/30" :
                      "bg-gray-100 dark:bg-gray-800"
                    )}>
                      {scan.type === 'barcode' ? (
                        <Barcode className="h-4 w-4 text-blue-600" />
                      ) : scan.type === 'ai' ? (
                        <ImageIcon className="h-4 w-4 text-purple-600" />
                      ) : (
                        <Search className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {scan.title || scan.artist ? (
                        <>
                          <p className="font-medium text-sm truncate">{scan.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{scan.artist}</p>
                        </>
                      ) : (
                        <p className="font-mono text-sm">{scan.barcode}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(scan.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} id="qr-canvas" className="hidden"></canvas>
    </div>
  );
}

    