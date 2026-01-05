
"use client";

import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import type { User, UserRole, Supplier, Track, WeightOption, MediaCondition } from "@/types";
import { MediaConditions } from "@/types";
import React, { useEffect, useState, useCallback } from "react";
import { formatPriceForDisplay, parsePriceFromUserInput } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Save, Loader2, Disc3, Tag, Package, Euro, AlignLeft, Briefcase, ScanLine, X, PlusCircle, Weight as WeightIcon, Layers3, CalendarDays, Music, Paintbrush, Globe, Info, Barcode, UserCircle, ImageIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import ImageUploader from "./image-uploader";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  artist: z.string().min(1, "Artist is required"),
  label: z.string().optional(),
  year: z.string().optional().refine(val => val === "" || val === undefined || /^\d*$/.test(val), { message: "Year must be a number or empty" }).transform(val => (val && val.trim() !== "" ? Number(val) : undefined)),
  genre: z.string().optional().transform(v => v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined),
  style: z.string().optional().transform(v => v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined),
  country: z.string().optional(),
  formatDetails: z.string().optional(),
  media_condition: z.enum(MediaConditions, { required_error: "Media condition is required" }) as z.ZodType<MediaCondition>,
  sleeve_condition: z.enum(MediaConditions, { required_error: "Sleeve condition is required" }) as z.ZodType<MediaCondition>,
  notes: z.string().optional(),
  weight: z.string().optional().refine(val => val === "" || val === undefined || /^\d*$/.test(val), { message: "Weight must be a number or empty" }).transform(val => (val && val.trim() !== "" ? Number(val) : undefined)),
  weightOptionId: z.string().optional(),
  purchasingPrice: z.string().optional()
    .transform((val, ctx) => {
      if (!val || val.trim() === "") return undefined;
      const parsed = parsePriceFromUserInput(val);
      if (parsed === undefined) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid price format."});
        return z.NEVER;
      }
      return parsed;
    }),
  sellingPrice: z.string().optional()
    .transform((val, ctx) => {
      if (!val || val.trim() === "") return undefined;
      const parsed = parsePriceFromUserInput(val);
      if (parsed === undefined) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid price format."});
        return z.NEVER;
      }
      return parsed;
    }),
  stock_shelves: z.string().optional().transform(val => (val && val.trim() !== "" ? Number(val) : 0)),
  shelf_locations: z.array(z.string()).optional(),
  stock_storage: z.string().optional().transform(val => (val && val.trim() !== "" ? Number(val) : 0)),
  storage_locations: z.array(z.string()).optional(),
  supplierId: z.string().optional(),
  discogs_id: z.number().optional(),
  barcode: z.string().optional(),
  tracklist: z.array(z.object({
    position: z.string(),
    type_: z.string(),
    title: z.string(),
    duration: z.string().optional(),
    previewUrl: z.string().optional(),
  })).optional(),
  cover_url: z.string().optional(),
});


export type RecordFormValues = z.infer<typeof formSchema>;
export type RecordFormInputData = {
  title?: string;
  artist?: string;
  label?: string;
  year?: string | number;
  genre?: string | string[];
  style?: string | string[];
  country?: string;
  formatDetails?: string;
  media_condition?: MediaCondition;
  sleeve_condition?: MediaCondition;
  notes?: string;
  purchasingPrice?: string | number;
  sellingPrice?: string | number;
  stock_shelves?: string | number; 
  shelf_location?: string;
  shelf_locations?: string | string[];
  stock_storage?: string | number; 
  storage_location?: string;
  storage_locations?: string | string[];
  supplierId?: string;
  releasedDate?: string;
  discogs_id?: number;
  barcode?: string;
  tracklist?: Track[];
  weight?: string | number;
  weightOptionId?: string;
  cover_url?: string;
  dataAiHint?: string;
};

export const createFormDefaults = (data?: RecordFormInputData): RecordFormInputData => {
  const getCombinedLocations = (arr?: string | string[], str?: string): string[] => {
    const locations = new Set<string>();
    if (Array.isArray(arr)) {
        arr.forEach(loc => { if (loc && typeof loc === 'string') locations.add(loc.trim()) });
    } else if (typeof arr === 'string' && arr.trim()) {
        arr.split(',').forEach(loc => { if (loc.trim()) locations.add(loc.trim()) });
    }
    if (typeof str === 'string' && str.trim()) {
        str.split(',').forEach(loc => { if (loc.trim()) locations.add(loc.trim()) });
    }
    return Array.from(locations);
  };

  const parseAndFormatPrice = (price?: string | number): string => {
    if (price === undefined || price === null) return "";
    if (typeof price === 'string') {
        const parsed = parsePriceFromUserInput(price);
        return parsed !== undefined ? formatPriceForDisplay(parsed) : "";
    }
    return formatPriceForDisplay(price);
  };


  return {
    title: data?.title || "",
    artist: data?.artist || "",
    label: data?.label || "",
    year: data?.year?.toString() ?? "",
    genre: Array.isArray(data?.genre) ? data.genre.join(', ') : (data?.genre || ""),
    style: Array.isArray(data?.style) ? data.style.join(', ') : (data?.style || ""),
    country: data?.country || "",
    formatDetails: data?.formatDetails || "",
    media_condition: data?.media_condition || "Mint (M)",
    sleeve_condition: data?.sleeve_condition || "Mint (M)",
    notes: data?.notes || "",
    weight: data?.weight?.toString() ?? "",
    weightOptionId: data?.weightOptionId || "custom",
    purchasingPrice: parseAndFormatPrice(data?.purchasingPrice),
    sellingPrice: parseAndFormatPrice(data?.sellingPrice),
    stock_shelves: data?.stock_shelves?.toString() ?? "",
    shelf_locations: getCombinedLocations(data?.shelf_locations, data?.shelf_location),
    stock_storage: data?.stock_storage?.toString() ?? "",
    storage_locations: getCombinedLocations(data?.storage_locations, data?.storage_location),
    supplierId: data?.supplierId || "",
    releasedDate: data?.releasedDate,
    discogs_id: data?.discogs_id,
    barcode: data?.barcode || "",
    tracklist: data?.tracklist,
    cover_url: data?.cover_url,
    dataAiHint: data?.dataAiHint,
  };
};

const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType, title: string }) => (
    <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
    </div>
);



const LocationSelector = ({
  control,
  name,
  label,
  onUpdateAvailableLocations,
}: {
  control: any;
  name: "shelf_locations" | "storage_locations";
  label: string;
  onUpdateAvailableLocations: (newLocations: string[]) => void;
}) => {
  const { activeDistributor } = useAuth();
  const availableLocations = name === 'shelf_locations' ? activeDistributor?.shelfLocations || [] : activeDistributor?.storageLocations || [];
  const canManageLocations = useAuth().user?.role === 'master';

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selectedLocations = Array.isArray(field.value) ? field.value : [];
        const [open, setOpen] = useState(false);
        const [search, setSearch] = useState("");

        const handleCreate = () => {
          if (!canManageLocations || !search || availableLocations.includes(search)) return;
          const newLocations = [...availableLocations, search].sort();
          onUpdateAvailableLocations(newLocations);
          field.onChange([...selectedLocations, search]);
          setSearch("");
          setOpen(false);
        };
        
        const filteredOptions = availableLocations.filter(loc => 
            !selectedLocations.includes(loc) && loc.toLowerCase().includes(search.toLowerCase())
        );

        return (
            <div className="space-y-2">
                <FormLabel>{label}</FormLabel>
                <div className="rounded-md border p-2 min-h-[40px] flex flex-wrap gap-1">
                    {selectedLocations.length > 0 ? selectedLocations.map((loc) => (
                        <Badge key={loc} variant="secondary" className="flex items-center gap-1">
                            {loc}
                            <button type="button" onClick={() => field.onChange(selectedLocations.filter(l => l !== loc))} className="rounded-full hover:bg-destructive/20 text-destructive/80 hover:text-destructive"><X className="h-3 w-3"/></button>
                        </Badge>
                    )) : <span className="text-xs text-muted-foreground px-2">No locations selected.</span>}
                </div>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Location
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                            <CommandInput
                                placeholder="Search locations..."
                                value={search}
                                onValueChange={setSearch}
                            />
                            <CommandList>
                                <CommandEmpty>
                                    {canManageLocations ? (
                                        <Button type="button" variant="ghost" className="w-full" onClick={handleCreate}>
                                            Create and add &quot;{search}&quot;
                                        </Button>
                                    ) : (
                                        "No locations found."
                                    )}
                                </CommandEmpty>
                                <CommandGroup>
                                    {filteredOptions.map((loc) => (
                                        <CommandItem
                                            key={loc}
                                            onSelect={() => {
                                                field.onChange([...selectedLocations, loc]);
                                                setOpen(false);
                                            }}
                                        >
                                            {loc}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        );
      }}
    />
  );
};

interface RecordFormProps {
  initialData?: RecordFormInputData;
  onSubmitForm: (values: RecordFormValues) => Promise<void>;
  onSubmitAndScanNext?: (values: RecordFormValues) => Promise<void>;
  isSubmittingForm?: boolean;
  user: User;
  submitButtonText?: string;
  disableDiscogsFields?: boolean;
  shelfLocations?: string[];
  storageLocations?: string[];
  suppliers?: Supplier[];
}

export const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | number | React.ReactNode | null }) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return null;
  return (
    <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
        <div className="flex flex-col">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="text-sm font-medium text-foreground break-words">{value}</div>
        </div>
    </div>
  );
};

export default function RecordForm({ initialData, onSubmitForm, onSubmitAndScanNext, isSubmittingForm = false, user, submitButtonText = "Save", disableDiscogsFields = false, suppliers }: RecordFormProps) {
  const { activeDistributor, updateMyDistributorSettings } = useAuth();
  const form = useForm<RecordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: createFormDefaults(initialData) as any,
  });
  
  const { setValue, watch, control, reset } = form;
  const weightOptions = activeDistributor?.weightOptions || [];
  const selectedWeightOptionId = watch('weightOptionId');

  useEffect(() => {
    reset(createFormDefaults(initialData) as any);
  }, [initialData, reset]);

  const isWeightInputDisabled = () => {
      if (!selectedWeightOptionId || selectedWeightOptionId === 'custom') return false;
      const selectedOption = weightOptions.find(opt => opt.id === selectedWeightOptionId);
      return selectedOption ? selectedOption.isFixed : false;
  };

  const isMaster = user.role === 'master';
  const isWorker = user.role === 'worker';
  const isOperator = isMaster || isWorker;

  const perms = user.permissions || {};
  const canEditPurchasing = isMaster || (isWorker && !!perms.canEditPurchasingPrice);
  const canViewPurchasing = isMaster || (isWorker && (!!perms.canViewPurchasingPrice || !!perms.canEditPurchasingPrice));
  const canEditSelling = isMaster || (isWorker && !!perms.canEditSellingPrice);
  const canViewSelling = isMaster || (isWorker && (!!perms.canViewSellingPrice || !!perms.canEditSellingPrice));
  const canEditSuppliers = isMaster || (isWorker && !!perms.canEditSuppliers);
  const canManageLocations = isMaster || (isWorker && !!perms.canManageLocations);
  

  return (
    <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmitForm)} className="space-y-8">
      
      {initialData?.discogs_id && (
        <div className="space-y-6">
             <div className="mb-8 p-4 border rounded-lg bg-muted/50 flex flex-col md:flex-row gap-6 items-start">
                <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0">
                     <Image
                        src={initialData?.cover_url || `https://placehold.co/300x300.png`}
                        alt={`${initialData?.title || 'Record'} cover`}
                        width={300}
                        height={300}
                        className="rounded-md object-cover aspect-square w-full shadow-lg"
                        data-ai-hint={initialData?.dataAiHint || "album cover"}
                        unoptimized={!!initialData?.cover_url?.includes('discogs.com')}
                      />
                </div>
                <div className="flex-grow">
                    <h3 className="text-2xl font-bold tracking-tight text-primary">{initialData?.title}</h3>
                    <p className="text-xl text-muted-foreground mb-4">{initialData?.artist}</p>
                    <Separator className="mb-4"/>
                    <h4 className="text-lg font-semibold text-foreground tracking-tight mb-4">Record Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                        <DetailItem icon={Layers3} label="Label" value={initialData.label} />
                        <DetailItem icon={CalendarDays} label="Released" value={initialData.releasedDate || initialData.year?.toString()} />
                        <DetailItem icon={Music} label="Genre(s)" value={Array.isArray(initialData.genre) ? initialData.genre.join(', ') : initialData.genre} />
                        <DetailItem icon={Paintbrush} label="Style(s)" value={Array.isArray(initialData.style) ? initialData.style.join(', ') : initialData.style} />
                        <DetailItem icon={Globe} label="Country" value={initialData.country} />
                        <DetailItem icon={Info} label="Format Details" value={initialData.formatDetails} />
                        <DetailItem icon={Disc3} label="Discogs ID" value={initialData.discogs_id} />
                        {initialData.barcode && <DetailItem icon={Barcode} label="Barcode" value={initialData.barcode} />}
                    </div>
                </div>
            </div>
            <Separator />
        </div>
      )}

      {!initialData?.discogs_id && (
        <div className="space-y-6">
          <SectionHeader icon={ImageIcon} title="Album Cover" />
          <FormField
            control={control}
            name="cover_url"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                   <ImageUploader 
                        onUploadComplete={(url) => field.onChange(url)} 
                        initialImageUrl={field.value} 
                    />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Separator />
          <SectionHeader icon={Disc3} title="Record Details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FormField control={control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="e.g. Abbey Road" /></FormControl><FormMessage/></FormItem>)} />
          <FormField control={control} name="artist" render={({ field }) => (<FormItem><FormLabel>Artist</FormLabel><FormControl><Input {...field} placeholder="e.g. The Beatles" /></FormControl><FormMessage/></FormItem>)} />
          <FormField control={control} name="label" render={({ field }) => (<FormItem><FormLabel>Label</FormLabel><FormControl><Input {...field} placeholder="e.g. Apple Records" /></FormControl><FormMessage/></FormItem>)} />
          <FormField control={control} name="year" render={({ field }) => (<FormItem><FormLabel>Year</FormLabel><FormControl><Input {...field} placeholder="e.g. 1969" /></FormControl><FormMessage/></FormItem>)} />
          <FormField control={control} name="genre" render={({ field }) => (<FormItem><FormLabel>Genre (comma-separated)</FormLabel><FormControl><Input {...field} placeholder="e.g. Rock, Pop" /></FormControl><FormMessage/></FormItem>)} />
          <FormField control={control} name="style" render={({ field }) => (<FormItem><FormLabel>Style (comma-separated)</FormLabel><FormControl><Input {...field} placeholder="e.g. Psychedelic Rock, Pop Rock" /></FormControl><FormMessage/></FormItem>)} />
          <FormField control={control} name="country" render={({ field }) => (<FormItem><FormLabel>Country</FormLabel><FormControl><Input {...field} placeholder="e.g. UK" /></FormControl><FormMessage/></FormItem>)} />
          <FormField control={control} name="formatDetails" render={({ field }) => (<FormItem><FormLabel>Format Details</FormLabel><FormControl><Input {...field} placeholder="e.g. Vinyl, LP, Album" /></FormControl><FormMessage/></FormItem>)} />
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        <SectionHeader icon={Tag} title="Condition" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FormField control={control} name="media_condition" render={({ field }) => (<FormItem><FormLabel>Media Condition</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{MediaConditions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)} />
            <FormField control={control} name="sleeve_condition" render={({ field }) => (<FormItem><FormLabel>Sleeve Condition</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{MediaConditions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)} />
        </div>
      </div>

      {isOperator && (
        <>
          <div className="space-y-6">
            <SectionHeader icon={Package} title="Inventory" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField control={control} name="stock_shelves" render={({ field }) => (<FormItem><FormLabel>Stock (Shelves)</FormLabel><FormControl><Input {...field} type="number" placeholder="e.g. 10" /></FormControl><FormMessage/></FormItem>)} />
                <LocationSelector 
                  control={control} 
                  name="shelf_locations" 
                  label="Shelf Locations" 
                  onUpdateAvailableLocations={async (newLocs) => { 
                    await updateMyDistributorSettings({ shelfLocations: newLocs }); 
                  }} 
                />
                <FormField control={control} name="stock_storage" render={({ field }) => (<FormItem><FormLabel>Stock (Storage)</FormLabel><FormControl><Input {...field} type="number" placeholder="e.g. 50" /></FormControl><FormMessage/></FormItem>)} />
                <LocationSelector 
                  control={control} 
                  name="storage_locations" 
                  label="Storage Locations" 
                  onUpdateAvailableLocations={async (newLocs) => { 
                    await updateMyDistributorSettings({ storageLocations: newLocs }); 
                  }} 
                />
              <div className="sm:col-span-2">
                 <FormField
                    control={control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                          <FormLabel>Weight (grams)</FormLabel>
                          <div className="flex gap-2">
                              <Controller
                                control={control}
                                name="weightOptionId"
                                render={({ field: selectField }) => (
                                  <Select
                                    value={selectField.value || "custom"}
                                    onValueChange={(value) => {
                                      selectField.onChange(value === "custom" ? undefined : value);
                                      const selectedOption = weightOptions.find(opt => opt.id === value);
                                      if (selectedOption) {
                                          setValue('weight', selectedOption.weight.toString(), { shouldValidate: true });
                                      }
                                    }}
                                  >
                                      <SelectTrigger className="w-2/3"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                          <SelectItem value="custom">Custom</SelectItem>
                                          {weightOptions.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label} {!opt.isFixed ? "(template)" : `(${opt.weight}g)`}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                                )}
                              />
                              <FormControl>
                                  <Input
                                      {...field}
                                      value={field.value ?? ''}
                                      type="number"
                                      placeholder="e.g. 320"
                                      disabled={isWeightInputDisabled()}
                                      onFocus={() => setValue('weightOptionId', 'custom', { shouldValidate: true })}
                                  />
                              </FormControl>
                          </div>
                          <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <SectionHeader icon={Euro} title="Pricing & Sourcing" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {canViewPurchasing && (
                <FormField control={control} name="purchasingPrice" render={({ field }) => (<FormItem><FormLabel>Purchasing Price (€)</FormLabel><FormControl><Input {...field} placeholder="e.g. 15,50" disabled={!canEditPurchasing} onBlur={(e) => { const value = e.target.value; if (value) { const parsed = parsePriceFromUserInput(value); if (parsed !== undefined) { setValue("purchasingPrice", formatPriceForDisplay(parsed), { shouldValidate: true });}}}} /></FormControl><FormMessage/></FormItem>)} />
              )}
               {canViewSelling && (
                <FormField control={control} name="sellingPrice" render={({ field }) => (<FormItem><FormLabel>Selling Price (€)</FormLabel><FormControl><Input {...field} placeholder="e.g. 29,99" disabled={!canEditSelling} onBlur={(e) => { const value = e.target.value; if (value) { const parsed = parsePriceFromUserInput(value); if (parsed !== undefined) { setValue("sellingPrice", formatPriceForDisplay(parsed), { shouldValidate: true });}}}} /></FormControl><FormMessage/></FormItem>)} />
              )}
            </div>
            {canEditSuppliers && suppliers && suppliers.length > 0 && (
             <FormField control={control} name="supplierId" render={({ field }) => (<FormItem><FormLabel>Supplier</FormLabel><Select value={field.value} onValueChange={(value) => { field.onChange(value === "none" ? undefined : value); }}><FormControl><SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)} />
            )}
          </div>
        </>
      )}

      <div className="space-y-6">
        <SectionHeader icon={AlignLeft} title="Notes" />
         <FormField control={control} name="notes" render={({ field }) => (<FormItem><FormLabel></FormLabel><FormControl><Textarea {...field} className="min-h-[100px]" placeholder="Any specific details about this record..." /></FormControl><FormMessage/></FormItem>)} />
      </div>
      
      <div className="flex justify-end items-center gap-2 border-t pt-6 mt-8">
        {onSubmitAndScanNext && (
            <Button 
                type="button" 
                variant="outline" 
                onClick={form.handleSubmit(onSubmitAndScanNext)} 
                disabled={isSubmittingForm}
            >
              {isSubmittingForm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
              Add &amp; Scan Next
            </Button>
        )}
        <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground min-w-[150px]" disabled={isSubmittingForm}>
          <div className="flex items-center justify-center">
            {isSubmittingForm 
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Save className="mr-2 h-4 w-4" />
            }
            <span>{isSubmittingForm ? 'Saving...' : submitButtonText}</span>
          </div>
        </Button>
      </div>
    </form>
    </Form>
  );
}
