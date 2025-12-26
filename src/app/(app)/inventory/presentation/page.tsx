
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Loader2, Music, X, CalendarDays, Layers3, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getInventoryRecords } from "@/services/record-service";
import type { VinylRecord } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// --- Settings Type ---
type TransitionType = 'fade' | 'slide' | 'zoom';
type LayoutType = 'side-by-side' | 'stacked';

interface PresentationSettings {
    duration: number; // in seconds
    transition: TransitionType | 'random';
    layout: LayoutType | 'random';
}

// --- Animation Variants ---
const transitions: Record<TransitionType, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 1.5, ease: "easeInOut" } },
    exit: { opacity: 0, transition: { duration: 1.5, ease: "easeIn" } },
  },
  slide: {
    initial: (direction: number) => ({ opacity: 0.5, x: direction > 0 ? '100%' : '-100%' }),
    animate: { opacity: 1, x: 0, transition: { duration: 1, ease: "easeInOut" } },
    exit: (direction: number) => ({ opacity: 0.5, x: direction < 0 ? '100%' : '-100%', transition: { duration: 1, ease: "easeIn" } }),
  },
  zoom: {
    initial: { opacity: 0.8, scale: 1.1 },
    animate: { opacity: 1, scale: 1, transition: { duration: 1, ease: "easeInOut" } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 1.5, ease: "easeIn" } },
  },
};

// --- Layout Components ---
const LayoutSideBySide = ({ record }: { record: VinylRecord }) => (
    <div className="grid md:grid-cols-2 gap-8 lg:gap-16 max-w-6xl w-full items-center">
        <motion.div 
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="aspect-square w-full max-w-lg mx-auto"
        >
            <Image
                src={record.cover_url!}
                alt={`${record.title} cover`}
                width={800}
                height={800}
                className="rounded-lg shadow-2xl object-contain w-full h-full"
                unoptimized={record.cover_url?.includes('discogs.com')}
            />
        </motion.div>
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-4 text-center md:text-left"
        >
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter leading-tight text-primary-foreground drop-shadow-lg">
                {record.title}
            </h1>
            <h2 className="text-3xl lg:text-4xl font-light text-muted-foreground drop-shadow-lg">
                {record.artist}
            </h2>
            <div className="pt-4 flex flex-wrap gap-x-6 gap-y-3 justify-center md:justify-start text-lg">
                {record.year && (
                <span className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" /> {record.year}
                </span>
                )}
                {record.label && (
                <span className="flex items-center gap-2">
                    <Layers3 className="h-5 w-5 text-primary" /> {record.label}
                </span>
                )}
            </div>
        </motion.div>
    </div>
);

const LayoutStacked = ({ record }: { record: VinylRecord }) => (
    <div className="flex flex-col items-center justify-center max-w-3xl w-full gap-8">
        <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="aspect-square w-full max-w-md"
        >
            <Image
                src={record.cover_url!}
                alt={`${record.title} cover`}
                width={600}
                height={600}
                className="rounded-lg shadow-2xl object-contain w-full h-full"
                unoptimized={record.cover_url?.includes('discogs.com')}
            />
        </motion.div>
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-2 text-center"
        >
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-primary-foreground drop-shadow-md">
                {record.title}
            </h1>
            <h2 className="text-2xl lg:text-3xl font-light text-muted-foreground drop-shadow-md">
                {record.artist}
            </h2>
        </motion.div>
    </div>
);


export default function PresentationModePage() {
  const { user, loading: authLoading, activeDistributorId } = useAuth();
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<PresentationSettings>({
      duration: 10,
      transition: 'fade',
      layout: 'side-by-side',
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
        const savedSettings = localStorage.getItem('presentationSettings');
        if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
        }
    } catch (e) {
        console.error("Failed to load presentation settings from localStorage", e);
    }
  }, []);

  // Save settings to localStorage when they change
  const handleSettingsChange = (newSettings: Partial<PresentationSettings>) => {
    setSettings(prev => {
        const updated = { ...prev, ...newSettings };
        try {
            localStorage.setItem('presentationSettings', JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save presentation settings to localStorage", e);
        }
        return updated;
    });
  };

  const fetchRecords = useCallback(async () => {
    if (!user || !activeDistributorId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { records: fetchedRecords } = await getInventoryRecords(user, { distributorId: activeDistributorId });
      const recordsWithCovers = fetchedRecords.filter(r => r.cover_url);
      setRecords(recordsWithCovers.sort(() => Math.random() - 0.5));
    } catch (error) {
      console.error("PresentationMode: Failed to fetch records:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, activeDistributorId]);

  useEffect(() => {
    if (!authLoading) {
      fetchRecords();
    }
  }, [authLoading, fetchRecords]);

  useEffect(() => {
    if (records.length > 1) {
      const interval = setInterval(() => {
        setDirection(1);
        setCurrentIndex((prevIndex) => (prevIndex + 1) % records.length);
      }, settings.duration * 1000);

      return () => clearInterval(interval);
    }
  }, [records.length, settings.duration]);
  
  const currentTransition = useMemo((): TransitionType => {
      if (settings.transition === 'random') {
          const transitionKeys = Object.keys(transitions) as TransitionType[];
          return transitionKeys[currentIndex % transitionKeys.length];
      }
      return settings.transition;
  }, [settings.transition, currentIndex]);
  
  const CurrentLayout = useMemo(() => {
      let layout: LayoutType;
      if (settings.layout === 'random') {
          const layoutKeys: LayoutType[] = ['side-by-side', 'stacked'];
          layout = layoutKeys[currentIndex % layoutKeys.length];
      } else {
          layout = settings.layout;
      }
      
      return layout === 'side-by-side' ? LayoutSideBySide : LayoutStacked;
  }, [settings.layout, currentIndex]);


  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl">Loading your collection...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white text-center p-4">
        <Music className="h-24 w-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-bold mb-2">No Records to Display</h2>
        <p className="text-xl text-muted-foreground mb-8">
          No records with cover images were found in your inventory.
        </p>
        <Button onClick={() => router.push("/inventory")} variant="outline" size="lg">
          Back to Inventory
        </Button>
      </div>
    );
  }

  const currentRecord = records[currentIndex];

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            className="h-12 w-12 bg-black/50 hover:bg-black/80"
            aria-label="Open Settings"
        >
            <Settings className="h-6 w-6" />
        </Button>
        <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/inventory")}
            className="h-12 w-12 bg-black/50 hover:bg-black/80"
            aria-label="Exit Presentation"
        >
            <X className="h-8 w-8" />
        </Button>
      </div>

      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentRecord.id}
          custom={direction}
          variants={transitions[currentTransition]}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full h-full"
        >
          <Image
            src={currentRecord.cover_url!}
            alt={`${currentRecord.title} cover`}
            fill
            className="object-cover opacity-20 blur-xl scale-110"
            unoptimized={currentRecord.cover_url?.includes('discogs.com')}
          />
          <div className="absolute inset-0 bg-black/50" />

          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8">
            <CurrentLayout record={currentRecord} />
          </div>
        </motion.div>
      </AnimatePresence>
      
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Presentation Settings</DialogTitle>
                  <DialogDescription>Customize your slideshow experience. Changes are saved automatically.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                  <div className="space-y-3">
                      <Label htmlFor="duration">Duration per Slide ({settings.duration}s)</Label>
                      <Slider
                          id="duration"
                          min={3}
                          max={30}
                          step={1}
                          value={[settings.duration]}
                          onValueChange={(value) => handleSettingsChange({ duration: value[0] })}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="transition">Transition Effect</Label>
                      <Select value={settings.transition} onValueChange={(value) => handleSettingsChange({ transition: value as any })}>
                          <SelectTrigger id="transition"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="fade">Fade</SelectItem>
                              <SelectItem value="slide">Slide</SelectItem>
                              <SelectItem value="zoom">Zoom</SelectItem>
                              <SelectItem value="random">Random</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="layout">Layout Style</Label>
                      <Select value={settings.layout} onValueChange={(value) => handleSettingsChange({ layout: value as any })}>
                          <SelectTrigger id="layout"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="side-by-side">Side by Side</SelectItem>
                              <SelectItem value="stacked">Stacked</SelectItem>
                              <SelectItem value="random">Random</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={() => setIsSettingsOpen(false)}>Close</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
