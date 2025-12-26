
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import RecordForm, { createFormDefaults, RecordFormValues, RecordFormInputData, DetailItem } from '@/components/records/record-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, AlertTriangle, Disc3, Layers3, CalendarDays, Music, Paintbrush, Globe, Info, Barcode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getRecordById, updateRecord } from '@/services/record-service';
import type { VinylRecord } from '@/types';
import Image from "next/image";
import { Separator } from "@/components/ui/separator";

export default function EditRecordPage() {
  const { user, activeDistributor } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const recordId = typeof params.id === 'string' ? params.id : '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<RecordFormInputData>(createFormDefaults());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRecordData = useCallback(async () => {
    if (!recordId) {
      setError("No record ID provided.");
      setIsLoading(false);
      return;
    }

    try {
      const record = await getRecordById(recordId);
      if (record) {
        setInitialData(createFormDefaults(record));
      } else {
        setError("Record not found.");
      }
    } catch (e: any) {
      setError(`Error fetching record details: ${e.message}`);
    }
    setIsLoading(false);
  }, [recordId]);

  useEffect(() => {
    fetchRecordData();
  }, [fetchRecordData]);
  
  const handleSubmit = async (values: RecordFormValues) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!recordId) {
        toast({ title: "Error", description: "Record ID is missing.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const dataToUpdate = {
        ...values,
    };

    try {
      await updateRecord(recordId, dataToUpdate, user);
      toast({
        title: "Record Updated",
        description: `"${values.title}" has been successfully updated.`,
      });
      router.push(`/records/${recordId}`);
      router.refresh(); // To make sure data is fresh on the detail page
    } catch (error: any) {
      toast({
        title: "Error Updating Record",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6">
       <Button onClick={() => router.back()} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
       </Button>
       <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Edit Record</CardTitle>
                <CardDescription>
                  Update the details for this record. Data fetched from Discogs cannot be changed.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                     <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                     </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <AlertTriangle className="h-12 w-12 text-destructive" />
                        <p className="mt-4 text-destructive font-semibold">Could not load record</p>
                        <p className="mt-2 text-muted-foreground">{error}</p>
                    </div>
                ) : (
                   <div className="grid md:grid-cols-3 gap-8">
                        <div className="md:col-span-1 space-y-4">
                            <h3 className="text-lg font-semibold text-foreground tracking-tight">Record Details</h3>
                             <Image
                                src={initialData?.cover_url || `https://placehold.co/300x300.png`}
                                alt={`${initialData?.title || 'Record'} cover`}
                                width={300}
                                height={300}
                                className="rounded-md object-cover aspect-square w-full shadow-lg"
                                data-ai-hint={initialData?.dataAiHint || "album cover"}
                                unoptimized={!!initialData?.cover_url?.includes('discogs.com')}
                              />
                              {initialData.discogs_id && (
                                <div className="space-y-3 pt-3 text-sm">
                                    <DetailItem icon={Layers3} label="Label" value={initialData.label} />
                                    <DetailItem icon={CalendarDays} label="Released" value={initialData.releasedDate || initialData.year?.toString()} />
                                    <DetailItem icon={Music} label="Genre(s)" value={Array.isArray(initialData.genre) ? initialData.genre.join(', ') : initialData.genre} />
                                    <DetailItem icon={Paintbrush} label="Style(s)" value={Array.isArray(initialData.style) ? initialData.style.join(', ') : initialData.style} />
                                    <DetailItem icon={Globe} label="Country" value={initialData.country} />
                                    <DetailItem icon={Info} label="Format Details" value={initialData.formatDetails} />
                                    <DetailItem icon={Disc3} label="Discogs ID" value={initialData.discogs_id} />
                                    {initialData.barcode && <DetailItem icon={Barcode} label="Barcode" value={initialData.barcode} />}
                                </div>
                              )}
                        </div>
                        <div className="md:col-span-2">
                             <RecordForm
                                initialData={initialData}
                                onSubmitForm={handleSubmit}
                                isSubmittingForm={isSubmitting}
                                user={user!}
                                submitButtonText="Update Record"
                                disableDiscogsFields={!!initialData.discogs_id}
                                shelfLocations={activeDistributor?.shelfLocations}
                                storageLocations={activeDistributor?.storageLocations}
                                suppliers={activeDistributor?.suppliers}
                            />
                        </div>
                   </div>
                )}
            </CardContent>
       </Card>
    </div>
  )
}
