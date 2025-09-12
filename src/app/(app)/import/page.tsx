
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { FileDown, FileUp, Info, Loader2, AlertTriangle, ArrowLeft, Disc3, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import type { VinylRecord } from "@/types";
import { searchDiscogsByBarcode, getDiscogsReleaseDetailsById } from "@/services/discogs-service";
import { addRecord, getAllInventoryRecords } from "@/services/record-service";
import { format, parseISO } from "date-fns";
import { formatPriceForDisplay } from "@/lib/utils";

type ImportStatus = "idle" | "parsing" | "preview" | "importing" | "complete";
type RecordPreview = {
  csvData: Record<string, any>;
  status: "ready" | "fetching" | "matched" | "no_match" | "error";
  discogsDetails: Partial<VinylRecord> | null;
  error?: string;
};

const recordHeaders = [
  'discogs_id', 'barcode', 'title', 'artist', 'year', 'label', 'genre', 'style', 'country', 'formatDetails', 'media_condition', 
  'sleeve_condition', 'notes', 'purchasingPrice', 'sellingPrice', 
  'stock_shelves', 'shelf_location', 'stock_storage', 'storage_location', 'supplierId'
];

const supplierHeaders = [
  'name', 'contactPerson', 'email', 'phone', 'address', 'website', 'notes'
];

const HeaderList = ({ headers }: { headers: string[] }) => (
  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
    {headers.map(h => <li key={h}><code className="font-mono text-xs bg-muted p-1 rounded-sm">{h}</code></li>)}
  </ul>
);

const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) {
      return "";
    }
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

export default function ImportPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
    const [previews, setPreviews] = useState<RecordPreview[]>([]);
    const [importProgress, setImportProgress] = useState(0);
    const [importResults, setImportResults] = useState<{success: number, failed: number}>({ success: 0, failed: 0 });
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportStatus("parsing");
        setPreviews([]);
        setImportProgress(0);
        setImportResults({ success: 0, failed: 0 });

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const initialPreviews = results.data.map((row: any) => ({
                    csvData: row,
                    status: "ready" as const,
                    discogsDetails: null,
                }));
                setPreviews(initialPreviews);
                setImportStatus("preview");
                processPreviews(initialPreviews);
            },
            error: (error) => {
                toast({ title: "CSV Parsing Error", description: error.message, variant: "destructive" });
                setImportStatus("idle");
            }
        });
    };

    const processPreviews = useCallback(async (initialPreviews: RecordPreview[]) => {
      for (let i = 0; i < initialPreviews.length; i++) {
          const preview = initialPreviews[i];
          setPreviews(prev => {
              const newPreviews = [...prev];
              newPreviews[i] = { ...newPreviews[i], status: "fetching" };
              return newPreviews;
          });

          try {
              let discogsId = preview.csvData.discogs_id;
              if (!discogsId && preview.csvData.barcode) {
                  const searchResults = await searchDiscogsByBarcode(preview.csvData.barcode);
                  if (searchResults && searchResults.length === 1) {
                      discogsId = searchResults[0].id.toString();
                  } else if (searchResults && searchResults.length > 1) {
                      throw new Error(`Multiple results for barcode ${preview.csvData.barcode}`);
                  }
              }

              if (discogsId) {
                  const details = await getDiscogsReleaseDetailsById(discogsId);
                  setPreviews(prev => {
                      const newPreviews = [...prev];
                      newPreviews[i] = { ...newPreviews[i], status: details ? "matched" : "no_match", discogsDetails: details };
                      return newPreviews;
                  });
              } else {
                   setPreviews(prev => {
                      const newPreviews = [...prev];
                      newPreviews[i] = { ...newPreviews[i], status: "no_match", error: "No Discogs ID or usable barcode provided." };
                      return newPreviews;
                  });
              }
          } catch (error) {
              setPreviews(prev => {
                  const newPreviews = [...prev];
                  newPreviews[i] = { ...newPreviews[i], status: "error", error: (error as Error).message };
                  return newPreviews;
              });
          }
           await new Promise(resolve => setTimeout(resolve, 1100)); // Rate limit Discogs API
      }
    }, []);

    const handleImport = async () => {
        if (!user) return;
        setImportStatus("importing");
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < previews.length; i++) {
            const preview = previews[i];
            try {
                const recordData = {
                    ...preview.discogsDetails,
                    ...preview.csvData,
                };
                await addRecord(recordData, user);
                successCount++;
            } catch (error) {
                console.error(`Failed to import row ${i + 1}:`, error);
                failedCount++;
            }
            setImportProgress(((i + 1) / previews.length) * 100);
        }

        setImportResults({ success: successCount, failed: failedCount });
        setImportStatus("complete");
        toast({ title: "Import Complete", description: `${successCount} records imported, ${failedCount} failed.`});
    };

    const handleExportCSV = async () => {
        if (!user || user.role !== 'master' || !user.distributorId) {
          toast({ title: "Permission Denied", description: "Only master users can export data.", variant: "destructive" });
          return;
        }
        setIsExportingCSV(true);
        toast({ title: "Exporting Data", description: "Preparing your CSV file..." });

        try {
          const records = await getAllInventoryRecords(user, user.distributorId);
          if (records.length === 0) {
            toast({ title: "No Data", description: "There are no records to export.", variant: "default" });
            setIsExportingCSV(false);
            return;
          }

          const totalRecords = records.length;
          const totalItems = records.reduce((sum, r) => {
            const shelves = Number(r.stock_shelves || 0);
            const storage = Number(r.stock_storage || 0);
            return sum + shelves + storage;
          }, 0);

          const totalPurchasingValue = records.reduce((sum, r) => {
            const totalStock = (r.stock_shelves || 0) + (r.stock_storage || 0);
            return sum + ((r.purchasingPrice || 0) * totalStock);
          }, 0);
          const totalSellingValue = records.reduce((sum, r) => {
            const totalStock = (r.stock_shelves || 0) + (r.stock_storage || 0);
            return sum + ((r.sellingPrice || 0) * totalStock);
          }, 0);
          const exportDateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

          const summaryLines = [
            `"Vinylogix Version:","v1.0.0"`,
            `"Export Date:","${exportDateTime}"`,
            `"Total Unique Records:","${totalRecords}"`,
            `"Total Items in Stock:","${totalItems}"`,
            `"Total Purchasing Value (EUR):","${formatPriceForDisplay(totalPurchasingValue)}"`,
            `"Total Selling Value (EUR):","${formatPriceForDisplay(totalSellingValue)}"`,
            ""
          ];

          const headers = [
            "ID", "Title", "Artist", "Label", "Year", "Genre", "Style", "Format Details", 
            "Media Condition", "Sleeve Condition", "Stock (Shelves)", "Shelf Location",
            "Stock (Storage)", "Storage Location", "Purchasing Price (EUR)", "Selling Price (EUR)",
            "Barcode", "Discogs ID", "Notes", "Added At", "Added By", "Last Modified At",
            "Last Modified By", "Cover URL", "Supplier ID", "Weight (g)", "Weight Option ID"
          ];

          const csvHeader = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');

          const csvRows = records.map(record => {
            const rowData = [
              record.id, record.title, record.artist, record.label, record.year,
              Array.isArray(record.genre) ? record.genre.join('; ') : '',
              Array.isArray(record.style) ? record.style.join('; ') : '',
              record.formatDetails, record.media_condition, record.sleeve_condition,
              record.stock_shelves, record.shelf_location, record.stock_storage,
              record.storage_location, formatPriceForDisplay(record.purchasingPrice),
              formatPriceForDisplay(record.sellingPrice), record.barcode, record.discogs_id,
              record.notes, record.added_at ? format(new Date(record.added_at), 'yyyy-MM-dd HH:mm:ss') : '',
              record.added_by_email,
              record.last_modified_at && record.last_modified_at !== record.added_at ? format(new Date(record.last_modified_at), 'yyyy-MM-dd HH:mm:ss') : '',
              record.last_modified_by_email, record.cover_url, record.supplierId,
              record.weight, record.weightOptionId
            ];
            return rowData.map(val => escapeCSVValue(val)).join(',');
          });

          const csvString = `${summaryLines.join('\n')}\n${csvHeader}\n${csvRows.join('\n')}`;
          const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); 
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', 'vinyl_collection_export.csv');
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          toast({ title: "Export Successful", description: "Your CSV file has been downloaded." });
        } catch (error) {
          console.error("Error exporting CSV:", error);
          toast({ title: "Export Failed", description: "Could not export data. Check console for details.", variant: "destructive" });
        } finally {
          setIsExportingCSV(false);
        }
      };


    if (loading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (user?.role !== 'master') {
         return (
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
                <p className="text-muted-foreground mt-2">Only Master users can import data.</p>
                 <Button onClick={() => router.push('/dashboard')} className="mt-6">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
                </Button>
            </div>
        );
    }
    
    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                       <FileUp className="h-6 w-6 text-primary"/>
                       Import / Export Data
                    </CardTitle>
                    <CardDescription>
                        Import or export your records in bulk using a CSV file.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <Tabs defaultValue="import">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="import">Import</TabsTrigger>
                            <TabsTrigger value="export">Export</TabsTrigger>
                        </TabsList>
                        <TabsContent value="import" className="pt-6">
                           <div className="space-y-4">
                                <Label htmlFor="csv-upload">CSV File for Import</Label>
                                <div className="flex gap-4">
                                   <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} disabled={importStatus === 'importing' || importStatus === 'parsing'} />
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="export" className="pt-6">
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">Export your entire vinyl collection to a CSV file. The file will include a summary of key statistics at the top.</p>
                                <Button variant="outline" onClick={handleExportCSV} disabled={isExportingCSV}>
                                {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                Export Inventory as CSV
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {importStatus === "preview" && previews.length > 0 && (
                <Card>
                    <CardHeader>
                       <div className="flex justify-between items-center">
                         <div>
                           <CardTitle>Import Preview</CardTitle>
                           <CardDescription>Review the records to be imported. Records with a green check are matched with Discogs.</CardDescription>
                         </div>
                         <Button onClick={handleImport} disabled={importStatus !== 'preview'}>
                            Confirm and Import {previews.length} Records
                         </Button>
                       </div>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[500px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]">Status</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Artist</TableHead>
                                        <TableHead>Barcode</TableHead>
                                        <TableHead>Discogs ID</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previews.map((p, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="text-center">
                                                {p.status === "fetching" && <Loader2 className="h-4 w-4 animate-spin"/>}
                                                {p.status === "matched" && <CheckCircle className="h-4 w-4 text-green-500"/>}
                                                {(p.status === "no_match" || p.status === "error") && <XCircle className="h-4 w-4 text-destructive"/>}
                                            </TableCell>
                                            <TableCell>{p.csvData.title}</TableCell>
                                            <TableCell>{p.csvData.artist}</TableCell>
                                            <TableCell>{p.csvData.barcode}</TableCell>
                                            <TableCell>{p.discogsDetails?.discogs_id || p.csvData.discogs_id || "N/A"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            {importStatus === "importing" && (
                <Card>
                    <CardHeader><CardTitle>Importing...</CardTitle></CardHeader>
                    <CardContent><Progress value={importProgress} className="w-full" /></CardContent>
                </Card>
            )}
            
            {importStatus === "complete" && (
                <Card>
                    <CardHeader><CardTitle>Import Complete</CardTitle></CardHeader>
                    <CardContent>
                        <p>{importResults.success} records imported successfully.</p>
                        <p>{importResults.failed} records failed to import.</p>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>CSV Format Guide</CardTitle>
                    <CardDescription>
                        Your CSV file must have a header row with the exact column names as specified below. The order of columns does not matter.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="records">
                        <TabsList>
                            <TabsTrigger value="records">Records Import</TabsTrigger>
                            <TabsTrigger value="suppliers">Suppliers Import (Future)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="records" className="pt-4">
                            <h4 className="font-semibold mb-2">Required Record Headers:</h4>
                            <HeaderList headers={recordHeaders} />
                            <h4 className="font-semibold mt-4 mb-2">Formatting Notes:</h4>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                                <li>Provide at least a <code className="font-mono text-xs bg-muted p-1 rounded-sm">discogs_id</code> or <code className="font-mono text-xs bg-muted p-1 rounded-sm">barcode</code> for automatic data fetching. `discogs_id` is preferred for accuracy.</li>
                                <li>Data in your CSV (e.g., `title`, `artist`) will override data fetched from Discogs if both are present.</li>
                                <li>For the <code className="font-mono text-xs bg-muted p-1 rounded-sm">genre</code> column, separate multiple genres with a comma (e.g., "Rock, Pop, Funk").</li>
                                <li>For <code className="font-mono text-xs bg-muted p-1 rounded-sm">media_condition</code> and <code className="font-mono text-xs bg-muted p-1 rounded-sm">sleeve_condition</code>, use one of the exact predefined values (e.g., "Very Good Plus (VG+)", "Near Mint (NM)").</li>
                            </ul>
                        </TabsContent>
                        <TabsContent value="suppliers" className="pt-4">
                            <Alert>
                              <Info className="h-4 w-4" />
                              <AlertTitle>Under Development</AlertTitle>
                              <AlertDescription>
                                Importing suppliers is planned for a future update.
                              </AlertDescription>
                            </Alert>
                            <h4 className="font-semibold mb-2 mt-4">Required Supplier Headers:</h4>
                            <HeaderList headers={supplierHeaders} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
