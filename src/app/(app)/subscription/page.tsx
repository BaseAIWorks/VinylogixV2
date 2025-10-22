
"use client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ArrowLeft, CreditCard, CheckCircle, XCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatPriceForDisplay } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

const subscriptionStatusColors: Record<string, string> = {
    active: 'text-green-500',
    trialing: 'text-blue-500',
    past_due: 'text-orange-500',
    canceled: 'text-red-500',
    incomplete: 'text-yellow-500',
};

const DetailItem = ({ label, value }: { label: string; value?: string | number | React.ReactNode }) => {
    if (value === undefined || value === null) return null;
    return (
        <div className="flex justify-between items-center py-2 border-b">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
        </div>
    );
};

export default function SubscriptionPage() {
    const { user, loading: authLoading, activeDistributor } = useAuth();
    const router = useRouter();

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (user?.role !== 'master') {
        return (
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
                <p className="text-muted-foreground mt-2">Only Master users can manage subscriptions.</p>
                <Button onClick={() => router.push('/dashboard')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard</Button>
            </div>
        );
    }

    const subscription = activeDistributor?.subscription;
    
    const getTrialDaysLeft = () => {
        if (!activeDistributor?.createdAt || subscription?.status !== 'trialing') {
            return null;
        }
        const createdAt = new Date(activeDistributor.createdAt);
        const trialEndDate = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const daysLeft = formatDistanceToNowStrict(trialEndDate, { unit: 'day' });

        if (now > trialEndDate) {
            return "Trial has expired.";
        }
        return `~${daysLeft} left`;
    };
    
    const trialDaysLeft = getTrialDaysLeft();


    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <CreditCard className="h-8 w-8 text-primary"/>
                        <div>
                            <CardTitle className="text-2xl">My Subscription</CardTitle>
                            <CardDescription>View and manage your Vinylogix plan.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {activeDistributor?.isSubscriptionExempt ? (
                        <div className="flex flex-col items-center justify-center text-center p-8 bg-green-500/10 rounded-lg">
                            <ShieldCheck className="h-16 w-16 text-green-500 mb-4" />
                            <h3 className="text-2xl font-bold text-green-600">You are on a Managed Plan!</h3>
                            <p className="text-muted-foreground mt-2">Your account is directly managed and is exempt from standard billing. <br/>Contact support for any questions about your plan.</p>
                        </div>
                    ) : subscription ? (
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                               <h3 className="text-lg font-semibold">Current Plan</h3>
                               <p className="text-4xl font-bold text-primary capitalize">{subscription.tier}</p>
                               <div className="flex items-center gap-2">
                                <p className={`text-lg font-semibold capitalize ${subscriptionStatusColors[subscription.status] || ''}`}>{subscription.status?.replace('_', ' ')}</p>
                                {trialDaysLeft && <Badge variant="secondary">{trialDaysLeft}</Badge>}
                               </div>
                               <Button onClick={() => router.push('/pricing')}>Change Plan</Button>
                            </div>
                            <div className="p-4 border rounded-lg bg-muted/50">
                                <h4 className="font-semibold mb-3">Plan Details</h4>
                                <div className="space-y-2">
                                    <DetailItem label="Max Records" value={subscription.maxRecords === -1 ? "Unlimited" : subscription.maxRecords.toLocaleString()} />
                                    <DetailItem label="Max Users" value={subscription.maxUsers === -1 ? "Unlimited" : subscription.maxUsers.toLocaleString()} />
                                    <DetailItem label="Order Management" value={subscription.allowOrders ? <CheckCircle className="text-green-500"/> : <XCircle className="text-destructive"/>} />
                                    <DetailItem label="AI Features" value={subscription.allowAiFeatures ? <CheckCircle className="text-green-500"/> : <XCircle className="text-destructive"/>} />
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="text-center py-10 text-muted-foreground">
                            <p>No active subscription found.</p>
                             <Button onClick={() => router.push('/pricing')} className="mt-4">Choose a Plan</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {/* Payment history will be implemented in a future step */}
             <Card>
                <CardHeader>
                    <CardTitle>Billing & Invoices</CardTitle>
                     <CardDescription>Your payment history and details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                        <p>Payment history and invoice management is coming soon.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
