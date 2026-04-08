
"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DistributorSlugPage() {
    const params = useParams();
    const router = useRouter();
    const slug = typeof params.slug === 'string' ? params.slug : null;

    useEffect(() => {
        if (slug) {
            // Redirect to the public storefront page
            router.replace(`/storefront/${slug}`);
        } else {
            router.replace('/dashboard');
        }
    }, [slug, router]);

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg">Loading...</p>
        </div>
    );
}
