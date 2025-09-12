"use client"; 

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
      <h2 className="text-3xl font-semibold text-destructive mb-4">Oops, something went wrong!</h2>
      <p className="text-lg text-muted-foreground mb-8 max-w-md">
        An unexpected error occurred. We apologize for the inconvenience.
        Please try again, or contact support if the problem persists.
      </p>
      {error.message && (
        <pre className="mb-6 max-w-full overflow-x-auto rounded-md border bg-muted p-4 text-left text-sm text-foreground">
          {error.message}
        </pre>
      )}
      <Button
        onClick={() => reset()}
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
        size="lg"
      >
        Try Again
      </Button>
    </div>
  );
}
