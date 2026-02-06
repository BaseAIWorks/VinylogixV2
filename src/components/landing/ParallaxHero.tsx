'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Gift, Menu, X, Settings, LogOut, LayoutDashboard, ScanLine, Disc3, BarChart3, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedGroup } from '@/components/ui/animated-group';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { VinylRecordSVG } from './VinylRecordSVG';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { UserRole } from '@/types';

const roleDisplayNames: Record<UserRole, string> = {
  master: 'Master',
  worker: 'Operator',
  viewer: 'Client',
  superadmin: 'Super Admin',
};

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      filter: 'blur(12px)',
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        type: 'spring',
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
};

export function ParallaxHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const vinyl1Y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const vinyl2Y = useTransform(scrollYProgress, [0, 1], ['0%', '70%']);
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <HeroHeader />

      {/* Background gradient layer */}
      <motion.div
        className="absolute inset-0 -z-30"
        style={{ y: backgroundY }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(124,58,237,0.15),transparent)]" />
      </motion.div>

      {/* Floating vinyl records - parallax layers */}
      <motion.div
        className="absolute -left-10 top-40 -z-20 hidden lg:block opacity-25"
        style={{ y: vinyl1Y }}
      >
        <div className="animate-float">
          <VinylRecordSVG size={220} spinning />
        </div>
      </motion.div>

      <motion.div
        className="absolute -right-8 top-32 -z-20 hidden lg:block opacity-20"
        style={{ y: vinyl2Y }}
      >
        <div className="animate-float-slow">
          <VinylRecordSVG size={180} />
        </div>
      </motion.div>

      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-64 w-64 rounded-full bg-primary/20 blur-[100px] animate-glow-pulse" />
      <div className="absolute top-1/3 right-1/4 -z-10 h-48 w-48 rounded-full bg-accent/20 blur-[80px] animate-glow-pulse" />

      {/* Main content */}
      <motion.section
        className="relative pt-24 md:pt-32 pb-8"
        style={{ y: textY, opacity }}
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <AnimatedGroup variants={transitionVariants}>
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full glass-card glass-hover"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-sm font-medium">New: AI-Powered Content Generation</span>
              </motion.div>

              {/* Headline */}
              <h1 className="max-w-4xl mx-auto text-balance text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                <span className="block">The All-In-One</span>
                <span className="block mt-1 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer">
                  Vinyl Platform
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-muted-foreground text-balance">
                From inventory management and order processing to client engagement and sales analytics, Vinylogix provides the tools you need to thrive.
              </p>
            </AnimatedGroup>

            {/* CTA Buttons + Promo inline */}
            <AnimatedGroup
              variants={{
                container: {
                  visible: {
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.5,
                    },
                  },
                },
                ...transitionVariants,
              }}
              className="mt-8 flex flex-col items-center gap-5"
            >
              {/* Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-6 text-base rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                >
                  <Link href="/register/client">
                    Start Your Collection Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 px-6 text-base rounded-xl glass-hover"
                >
                  <Link href="/pricing">
                    Are you a Distributor?
                  </Link>
                </Button>
              </div>

              {/* Compact promo badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm">
                <Gift className="h-4 w-4 text-primary" />
                <span className="font-medium text-primary">7-day free trial</span>
                <span className="text-muted-foreground">with all Scale features</span>
              </div>
            </AnimatedGroup>
          </div>
        </div>

        {/* Hero Image with floating feature badges */}
        <AnimatedGroup
          variants={{
            container: {
              visible: {
                transition: {
                  delayChildren: 0.8,
                },
              },
            },
            ...transitionVariants,
          }}
        >
          <div className="relative mt-10 px-4 sm:mt-12">
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-24 z-10 bg-gradient-to-t from-background to-transparent pointer-events-none"
            />
            <div className="relative mx-auto max-w-6xl">
              {/* Floating feature badges - left side */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
                className="absolute -left-4 top-1/4 z-20 hidden lg:block"
              >
                <div className="glass-card px-3 py-2 shadow-lg animate-float">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <ScanLine className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium">Barcode Scanning</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 }}
                className="absolute -left-2 top-1/2 z-20 hidden lg:block"
              >
                <div className="glass-card px-3 py-2 shadow-lg animate-float-slow">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Disc3 className="w-4 h-4 text-accent" />
                    </div>
                    <span className="font-medium">Discogs Sync</span>
                  </div>
                </div>
              </motion.div>

              {/* Floating feature badges - right side */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.3 }}
                className="absolute -right-4 top-1/3 z-20 hidden lg:block"
              >
                <div className="glass-card px-3 py-2 shadow-lg animate-float-slow">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="font-medium">Analytics</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5 }}
                className="absolute -right-2 top-2/3 z-20 hidden lg:block"
              >
                <div className="glass-card px-3 py-2 shadow-lg animate-float">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="font-medium">Order Management</span>
                  </div>
                </div>
              </motion.div>

              {/* Main image */}
              <div className="glass-card p-2 shadow-2xl shadow-primary/10 overflow-hidden">
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    className="w-full aspect-[16/9] object-cover hidden dark:block"
                    src="/Hero-2.png"
                    alt="Vinylogix dashboard dark mode"
                    width="2700"
                    height="1440"
                  />
                  <img
                    className="w-full aspect-[16/9] object-cover dark:hidden"
                    src="/Hero-2.png"
                    alt="Vinylogix dashboard light mode"
                    width="2700"
                    height="1440"
                  />
                </div>
              </div>
            </div>
          </div>
        </AnimatedGroup>
      </motion.section>
    </div>
  );
}

const menuItems = [{ name: 'Pricing', href: '/pricing' }];

function HeroHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuState, setMenuState] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  const getInitials = (email?: string | null) => {
    if (!email) return 'TU';
    return email.substring(0, 2).toUpperCase();
  };

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.email;

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header>
      <nav
        data-state={menuState ? 'active' : 'inactive'}
        className="fixed z-50 w-full px-2 group"
      >
        <div
          className={cn(
            'mx-auto mt-2 max-w-6xl px-6 transition-all duration-300 lg:px-12',
            isScrolled &&
              'glass max-w-4xl rounded-2xl lg:px-5'
          )}
        >
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
            <div className="flex w-full justify-between lg:w-auto">
              <Link href="/" aria-label="home" className="flex items-center space-x-2">
                <Image
                  src="/logo.png"
                  alt="Vinylogix Logo"
                  width={180}
                  height={36}
                  style={{ width: 'auto', height: 'auto', maxHeight: '36px' }}
                  className="object-contain"
                  unoptimized
                  priority
                />
              </Link>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                <Menu className="in-data-[state=active]:rotate-180 group-data-[state=active]:scale-0 group-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                <X className="group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
              </button>
            </div>

            <div className="absolute inset-0 m-auto hidden size-fit lg:block">
              <ul className="flex gap-8 text-sm">
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground block duration-150"
                    >
                      <span>{item.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-background group-data-[state=active]:block lg:group-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
              <div className="lg:hidden">
                <ul className="space-y-6 text-base">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      <Link
                        href={item.href}
                        className="text-muted-foreground hover:text-foreground block duration-150"
                      >
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center gap-3 px-2 h-12">
                        <div className="text-right">
                          <p className="font-semibold text-sm leading-tight">{displayName}</p>
                          <p className="text-xs text-muted-foreground leading-tight capitalize">
                            {roleDisplayNames[user.role]} Account
                          </p>
                        </div>
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={`https://placehold.co/100x100.png?text=${getInitials(user.email)}`}
                            alt={user.email || 'User'}
                          />
                          <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none text-foreground">
                            {user.email}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground capitalize">
                            {roleDisplayNames[user.role]} Account
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push('/settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/login">
                        <span>Login</span>
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/register/client">
                        <span>Sign Up</span>
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
