
"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getDistributorBySlug } from '@/services/distributor-service';
import { Loader2 } from 'lucide-react';

export default function DistributorSlugPage() {
    const params = useParams();
    const router = useRouter();
    const { setActiveDistributorId } = useAuth();
    const slug = typeof params.slug === 'string' ? params.slug : null;

    useEffect(() => {
        const resolveSlug = async () => {
            if (slug) {
                try {
                    const distributor = await getDistributorBySlug(slug);
                    if (distributor) {
                        // Set the active distributor ID in context/storage
                        setActiveDistributorId(distributor.id);
                        // Redirect to the main inventory page
                        router.replace('/inventory');
                    } else {
                        // If no distributor found for the slug, redirect to a safe page
                        // In a real app, this could be a custom 404 page
                        router.replace('/dashboard'); 
                    }
                } catch (error) {
                    console.error("Error resolving distributor slug:", error);
                    router.replace('/dashboard');
                }
            } else {
                router.replace('/dashboard');
            }
        };

        resolveSlug();
    }, [slug, router, setActiveDistributorId]);

    // Show a loading state while resolving the slug and redirecting
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg">Loading distributor catalog...</p>
        </div>
    );
}
