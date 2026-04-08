import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function StorefrontNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        This storefront could not be found.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">Go to Vinylogix</Link>
      </Button>
    </div>
  );
}
