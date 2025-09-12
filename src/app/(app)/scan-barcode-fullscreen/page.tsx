
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { useAuth } from "@/hooks/use-auth";
import { getRecordByBarcode } from "@/services/record-service";
import { searchDiscogsByBarcode } from "@/services/discogs-service";
import { X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const BARCODE_READER_ID = "fullscreen-barcode-scanner";

export default function FullscreenScanBarcodePage() {
    const { user, activeDistributor } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const stopScanner = useCallback(() => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(err => {
                console.warn("Could not stop barcode scanner, it might have already been stopped:", err);
            });
        }
    }, []);

    const processBarcode = useCallback(async (barcode: string) => {
        if (!user || isProcessing) return;
        
        setIsProcessing(true);
        toast({ title: "Barcode Scanned", description: `Searching for: ${barcode}` });

        try {
            const existingRecord = await getRecordByBarcode(barcode, user, activeDistributor?.id);
            if (existingRecord) {
                toast({ title: "Record Found in Inventory", description: "Redirecting to the existing record..." });
                const redirectUrl = `/records/${existingRecord.id}?action=adjustStock`;
                router.push(redirectUrl);
                return;
            }

            const discogsResults = await searchDiscogsByBarcode(barcode, activeDistributor?.id);
            if (discogsResults && discogsResults.length > 0) {
                toast({ title: "Match Found on Discogs", description: "Redirecting to add the new record..." });
                const params = new URLSearchParams();
                params.set('discogs_id', discogsResults[0].id.toString());
                params.set('barcode', barcode);
                router.push(`/records/add?${params.toString()}`);
            } else {
                 toast({ title: "Not Found", description: `No match found for barcode "${barcode}". Redirecting to manual entry...`, duration: 5000 });
                 router.push(`/records/add?barcode=${barcode}`);
            }
        } catch (error) {
            toast({ title: "Search Error", description: `An error occurred: ${(error as Error).message}`, variant: "destructive" });
            setIsProcessing(false); 
        }
    }, [user, isProcessing, activeDistributor, router, toast]);

    const startScan = useCallback(async () => {
        setScanError(null);
        setIsProcessing(false);

        if (!html5QrCodeRef.current) {
            html5QrCodeRef.current = new Html5Qrcode(BARCODE_READER_ID, { verbose: false });
        }

        if (html5QrCodeRef.current.isScanning) {
            return;
        }

        try {
            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) {
                throw new Error("No cameras found on this device.");
            }

            const rearCamera = cameras.find(camera => camera.label.toLowerCase().includes('back'));
            const cameraId = rearCamera ? rearCamera.id : cameras[0].id;
            
            await html5QrCodeRef.current.start(
                cameraId,
                { fps: 10, qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                    const qrboxSize = Math.floor(minEdge * 0.9);
                    return { width: qrboxSize, height: qrboxSize / 2 };
                  } 
                },
                (decodedText) => {
                    if (html5QrCodeRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
                        stopScanner();
                        processBarcode(decodedText);
                    }
                },
                (errorMessage) => { /* ignore */ }
            );
        } catch (err: any) {
            setScanError(err.message || "Could not start the camera.");
        }
    }, [processBarcode, stopScanner]);

    useEffect(() => {
        startScan();
        return () => {
            stopScanner();
        };
    }, [startScan, stopScanner]);

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white">
            <div id={BARCODE_READER_ID} className="w-full h-full"></div>
            
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <Button variant="secondary" size="icon" onClick={startScan} disabled={isProcessing}>
                    <RefreshCw className="h-5 w-5" />
                </Button>
                <Button variant="destructive" size="icon" onClick={() => router.back()}>
                    <X className="h-6 w-6" />
                </Button>
            </div>

            <div className="absolute inset-0 border-[20px] sm:border-[40px] border-black/50 pointer-events-none" />

            {isProcessing && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg font-medium">Processing Barcode...</p>
                </div>
            )}
            
            {scanError && (
                 <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-4 text-center p-4">
                    <p className="text-xl font-semibold text-destructive">Camera Error</p>
                    <p className="text-red-300">{scanError}</p>
                    <Button onClick={startScan} variant="secondary">Try Again</Button>
                </div>
            )}
        </div>
    );
}
