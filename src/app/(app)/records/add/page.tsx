
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RecordForm, { createFormDefaults, RecordFormValues, RecordFormInputData } from '@/components/records/record-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { addRecord } from '@/services/record-service';
import type { VinylRecord } from '@/types';
import { prepareRecord } from '@/ai/flows/prepare-record-flow';
import Image from "next/image";

export default function AddRecordPage() {
  const { user, activeDistributor } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<RecordFormInputData>(() => {
    // Initialize with barcode from URL if present
    const barcode = searchParams.get('barcode');
    const artist = searchParams.get('artist');
    const title = searchParams.get('title');
    const defaults = createFormDefaults();
    if (barcode) defaults.barcode = barcode;
    if (artist) defaults.artist = artist;
    if (title) defaults.title = title;
    return defaults;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInitialRecordData = useCallback(async () => {
    if (!user || !activeDistributor) return;
    
    const discogsIdParam = searchParams.get('discogs_id');
    const discogsId = discogsIdParam ? parseInt(discogsIdParam, 10) : undefined;
    
    if (!discogsId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const result = await prepareRecord({
          discogsId: discogsId,
          distributorId: activeDistributor.id,
          allowAiFeatures: activeDistributor.subscription?.allowAiFeatures || false,
      });

      if (result) {
        setInitialData(createFormDefaults(result));
      } else {
        throw new Error("Could not prepare record data.");
      }
    } catch (e: any) {
      console.error("Error preparing record:", e);
      setError(`Error fetching record details: ${e.message}`);
      toast({
        title: "Error Loading Details",
        description: e.message || "An unknown error occurred while fetching details from Discogs.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchParams, user, activeDistributor, toast]);

  useEffect(() => {
    fetchInitialRecordData();
  }, [fetchInitialRecordData]);
  
  const handleSubmit = async (values: RecordFormValues, andScanNext: boolean = false) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const recordData = {
      ...initialData,
      ...values,
      discogs_id: initialData.discogs_id,
      barcode: initialData.barcode,
      dataAiHint: initialData.dataAiHint,
      cover_url: values.cover_url,
      tracklist: initialData.tracklist,
      artistBio: initialData.artistBio,
      albumInfo: initialData.albumInfo,
    };

    try {
      const newRecord = await addRecord(recordData, user);
      toast({
        title: "Record Added",
        description: `"${values.title}" has been successfully added to your inventory.`,
      });
      if (andScanNext) {
        router.push('/scan');
      } else {
        router.push(`/records/${newRecord.id}`);
      }
    } catch (error: any) {
      toast({
        title: "Error Adding Record",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6">
       <Button onClick={() => router.back()} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Scan
       </Button>
       <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Add New Record</CardTitle>
                <CardDescription>
                  Enter the details for this record. Information from Discogs has been pre-filled where possible.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                     <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground">Fetching details from Discogs...</p>
                     </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <AlertTriangle className="h-12 w-12 text-destructive" />
                        <p className="mt-4 text-destructive font-semibold">Could not load record details</p>
                        <p className="mt-2 text-muted-foreground">{error}</p>
                    </div>
                ) : (
                    <RecordForm
                        initialData={initialData}
                        onSubmitForm={handleSubmit}
                        onSubmitAndScanNext={(values) => handleSubmit(values, true)}
                        isSubmittingForm={isSubmitting}
                        user={user!}
                        submitButtonText="Add Record to Inventory"
                        disableDiscogsFields={!!initialData.discogs_id}
                        shelfLocations={activeDistributor?.shelfLocations}
                        storageLocations={activeDistributor?.storageLocations}
                        suppliers={activeDistributor?.suppliers}
                    />
                )}
            </CardContent>
       </Card>
    </div>
  )
}
