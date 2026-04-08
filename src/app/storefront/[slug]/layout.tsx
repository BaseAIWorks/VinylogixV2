import type { ReactNode } from "react";
import Link from "next/link";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <p>
          Powered by{" "}
          <Link href="/" className="font-medium text-primary hover:underline">
            Vinylogix
          </Link>
        </p>
      </footer>
    </div>
  );
}
