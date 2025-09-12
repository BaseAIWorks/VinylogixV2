
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save } from "lucide-react";

const initialAddFormState = {
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    companyName: "",
    phoneNumber: "",
    addressLine1: "",
    addressLine2: "",
    postcode: "",
    city: "",
    country: "",
    chamberOfCommerce: "",
    vatNumber: "",
};

export default function AddClientPage() {
    const { user, addUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [isProcessing, setIsProcessing] = useState(false);
    const [addFormState, setAddFormState] = useState(initialAddFormState);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setAddFormState(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addFormState.email.includes('@') || !addFormState.password) {
            toast({ title: "Invalid Input", description: "A valid email and password are required.", variant: "destructive" });
            return;
        }
        if (addFormState.password.length < 6) {
            toast({ title: "Invalid Input", description: "Password must be at least 6 characters long.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        try {
            const { email, password, ...otherDetails } = addFormState;
            await addUser(email, password, 'viewer', user?.distributorId, otherDetails);
            setAddFormState(initialAddFormState);
            toast({ title: "Client Added", description: `An account for ${addFormState.email} has been created.` });
            router.push('/clients');
        } catch (error) {
             toast({ title: "Failed to Add Client", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <Button onClick={() => router.back()} variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Clients
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Add a New Client</CardTitle>
                    <CardDescription>
                        Manually create a new client account. They will not receive an email notification unless you send them their password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddClient} className="space-y-6">
                        <h4 className="font-semibold text-foreground border-b pb-2">Login Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input id="email" type="email" placeholder="client@email.com" value={addFormState.email} onChange={handleInputChange} disabled={isProcessing} required autoComplete="off" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Temporary Password *</Label>
                                <Input id="password" type="password" placeholder="Min. 6 characters" value={addFormState.password} onChange={handleInputChange} disabled={isProcessing} required autoComplete="new-password" />
                            </div>
                        </div>

                        <Separator className="my-4"/>
                        <h4 className="font-semibold text-foreground border-b pb-2">Personal & Company Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="firstName">First Name</Label><Input id="firstName" value={addFormState.firstName} onChange={handleInputChange} disabled={isProcessing} /></div>
                            <div className="space-y-2"><Label htmlFor="lastName">Last Name</Label><Input id="lastName" value={addFormState.lastName} onChange={handleInputChange} disabled={isProcessing} /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="companyName">Company Name</Label><Input id="companyName" value={addFormState.companyName} onChange={handleInputChange} disabled={isProcessing} /></div>
                            <div className="space-y-2"><Label htmlFor="phoneNumber">Phone Number</Label><Input id="phoneNumber" value={addFormState.phoneNumber} onChange={handleInputChange} disabled={isProcessing} /></div>
                        </div>

                        <Separator className="my-4"/>
                        <h4 className="font-semibold text-foreground border-b pb-2">Address</h4>
                        <div className="space-y-2"><Label htmlFor="addressLine1">Address Line 1</Label><Input id="addressLine1" value={addFormState.addressLine1} onChange={handleInputChange} disabled={isProcessing} /></div>
                        <div className="space-y-2"><Label htmlFor="addressLine2">Address Line 2</Label><Input id="addressLine2" value={addFormState.addressLine2} onChange={handleInputChange} disabled={isProcessing} /></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2"><Label htmlFor="postcode">Postcode</Label><Input id="postcode" value={addFormState.postcode} onChange={handleInputChange} disabled={isProcessing} /></div>
                            <div className="space-y-2 col-span-2"><Label htmlFor="city">City</Label><Input id="city" value={addFormState.city} onChange={handleInputChange} disabled={isProcessing} /></div>
                        </div>
                        <div className="space-y-2"><Label htmlFor="country">Country</Label><Input id="country" value={addFormState.country} onChange={handleInputChange} disabled={isProcessing} /></div>
                        
                        <Separator className="my-4"/>
                        <h4 className="font-semibold text-foreground border-b pb-2">Business Details (Optional)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="chamberOfCommerce">KVK Number</Label><Input id="chamberOfCommerce" value={addFormState.chamberOfCommerce} onChange={handleInputChange} disabled={isProcessing} /></div>
                            <div className="space-y-2"><Label htmlFor="vatNumber">VAT Number</Label><Input id="vatNumber" value={addFormState.vatNumber} onChange={handleInputChange} disabled={isProcessing} /></div>
                        </div>

                        <div className="flex justify-end pt-6 border-t">
                            <Button type="submit" disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                Save Client
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
