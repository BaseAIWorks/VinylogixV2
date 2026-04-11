'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Settings,
  LogOut,
  LayoutDashboard,
  Menu,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// -----------------------------------------------------------------------------
// Nav schema
//
// Top-level items are either a direct link (`href`) or a group of children
// (`children`). Keep this in sync with the footer schema and the marketing
// spec (docs/MARKETING_PAGES_SPEC.md).
// -----------------------------------------------------------------------------

type NavLeaf = {
  name: string;
  href: string;
  description?: string;
};

type NavItem =
  | { name: string; href: string }
  | { name: string; children: NavLeaf[] };

const navItems: NavItem[] = [
  {
    name: 'Product',
    children: [
      { name: 'Features', href: '/features', description: 'Every tool in the platform' },
      { name: 'Integrations', href: '/integrations', description: 'Discogs, Stripe, PayPal & more' },
      { name: 'Discogs Sync', href: '/discogs-sync', description: 'How Discogs works with Vinylogix' },
      { name: 'Security', href: '/security', description: 'How we protect your data' },
    ],
  },
  {
    name: 'Solutions',
    children: [
      { name: 'For Distributors', href: '/for-distributors', description: 'Wholesale operations at scale' },
      { name: 'For Collectors', href: '/for-collectors', description: 'Catalog and buy — free forever' },
      { name: 'All Solutions', href: '/solutions', description: 'The full platform overview' },
    ],
  },
  { name: 'Pricing', href: '/pricing' },
  {
    name: 'Resources',
    children: [
      { name: 'Help Center', href: '/help', description: 'Guides and FAQs' },
      { name: 'Contact', href: '/contact', description: 'Talk to our team' },
      { name: 'Status', href: '/status', description: 'Live system status' },
    ],
  },
  {
    name: 'Company',
    children: [
      { name: 'About', href: '/about', description: 'Who we are' },
      { name: 'Careers', href: '/careers', description: 'Join the team' },
    ],
  },
];

function isLeaf(item: NavItem): item is { name: string; href: string } {
  return 'href' in item;
}

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const getInitials = (email?: string | null) => {
    if (!email) return 'TU';
    return email.substring(0, 2).toUpperCase();
  };

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.email;

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed z-50 w-full">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className={cn(
            'mt-4 rounded-2xl px-4 py-3 transition-all duration-300',
            isScrolled
              ? 'bg-background/80 backdrop-blur-xl border border-border/50 shadow-lg'
              : 'bg-background/40 backdrop-blur-sm border border-border/30',
          )}
        >
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0">
              <Logo width={140} height={32} priority />
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) =>
                isLeaf(item) ? (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <DropdownMenu key={item.name}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                        aria-label={`Open ${item.name} menu`}
                      >
                        {item.name}
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-72 p-2"
                      sideOffset={8}
                    >
                      {item.children.map((child) => (
                        <DropdownMenuItem
                          key={child.href}
                          asChild
                          className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-primary/10"
                        >
                          <Link href={child.href} className="block">
                            <div className="text-sm font-medium text-foreground">
                              {child.name}
                            </div>
                            {child.description && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {child.description}
                              </div>
                            )}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              )}
            </div>

            {/* Right side: auth */}
            <div className="flex items-center gap-2">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <span className="hidden sm:inline">{displayName}</span>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild size="sm" className="hidden sm:inline-flex">
                    <Link href="/get-started">Get Started</Link>
                  </Button>
                </>
              )}

              {/* Mobile trigger */}
              <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-sm p-0">
                  <SheetHeader className="border-b px-6 py-4">
                    <SheetTitle className="flex items-center">
                      <Logo width={120} height={28} />
                    </SheetTitle>
                  </SheetHeader>

                  <div className="flex flex-col h-[calc(100%-73px)] overflow-y-auto">
                    {/* Mobile nav — accordion */}
                    <div className="flex-1 px-4 py-4">
                      <Accordion type="multiple" className="w-full">
                        {navItems.map((item) =>
                          isLeaf(item) ? (
                            <Link
                              key={item.name}
                              href={item.href}
                              onClick={() => setIsMobileOpen(false)}
                              className="flex items-center justify-between rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                            >
                              {item.name}
                              <ArrowRight className="h-4 w-4 opacity-50" />
                            </Link>
                          ) : (
                            <AccordionItem
                              key={item.name}
                              value={item.name}
                              className="border-b-0"
                            >
                              <AccordionTrigger className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted hover:no-underline">
                                {item.name}
                              </AccordionTrigger>
                              <AccordionContent className="pb-1">
                                <div className="flex flex-col space-y-1 pl-3">
                                  {item.children.map((child) => (
                                    <Link
                                      key={child.href}
                                      href={child.href}
                                      onClick={() => setIsMobileOpen(false)}
                                      className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                                    >
                                      {child.name}
                                    </Link>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ),
                        )}
                      </Accordion>
                    </div>

                    {/* Mobile CTA */}
                    {!user && (
                      <div className="border-t px-6 py-5 space-y-2">
                        <Button
                          asChild
                          size="lg"
                          className="w-full"
                          onClick={() => setIsMobileOpen(false)}
                        >
                          <Link href="/get-started">Get Started</Link>
                        </Button>
                        <Button
                          asChild
                          size="lg"
                          variant="outline"
                          className="w-full"
                          onClick={() => setIsMobileOpen(false)}
                        >
                          <Link href="/login">Log in</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
