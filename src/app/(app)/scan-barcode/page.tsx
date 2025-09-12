
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This is a simple redirector page.
// It navigates to the main scan page with a query parameter
// that tells the scan page to open the handheld scanner dialog immediately.
export default function ScanBarcodePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/scan?action=handheld');
  }, [router]);

  // Render nothing, or a simple loading state, as the user will be redirected immediately.
  return null; 
}
