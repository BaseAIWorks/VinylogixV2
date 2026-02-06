'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VideoDemoProps {
  videoUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
}

export function VideoDemo({
  videoUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  thumbnailUrl = '/Hero-2.png',
  title = 'See Vinylogix in Action',
  description = 'Watch how Vinylogix transforms vinyl record management with powerful inventory tools, seamless ordering, and beautiful analytics.',
}: VideoDemoProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="relative py-12 sm:py-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-accent/5 to-background" />
      </div>

      <div className="container mx-auto px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3">
            {title.split(' ').slice(0, -2).join(' ')}
            <span className="block mt-1 bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              {title.split(' ').slice(-2).join(' ')}
            </span>
          </h2>
          <p className="max-w-2xl mx-auto text-base text-muted-foreground">
            {description}
          </p>
        </motion.div>

        {/* Video container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-6xl mx-auto"
        >
          <div className="relative group">
            {/* Glow effect */}
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />

            {/* Video frame */}
            <div className="relative glass-card p-2 sm:p-4 overflow-hidden">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black/50">
                {!isPlaying ? (
                  <>
                    {/* Thumbnail */}
                    <img
                      src={thumbnailUrl}
                      alt="Video thumbnail"
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      {/* Play button */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsPlaying(true)}
                        className={cn(
                          'relative flex items-center justify-center',
                          'w-20 h-20 sm:w-24 sm:h-24 rounded-full',
                          'bg-primary/90 hover:bg-primary',
                          'shadow-2xl shadow-primary/50',
                          'transition-all duration-300'
                        )}
                      >
                        <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" fill="currentColor" />

                        {/* Pulse rings */}
                        <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
                        <span className="absolute -inset-4 rounded-full border-2 border-primary/30 animate-pulse" />
                      </motion.button>
                    </div>

                    {/* Duration badge */}
                    <div className="absolute bottom-4 right-4 px-3 py-1 rounded-lg glass text-sm font-medium">
                      3:45
                    </div>
                  </>
                ) : (
                  <>
                    {/* Embedded video */}
                    <iframe
                      src={`${videoUrl}?autoplay=1`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />

                    {/* Close button */}
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setIsPlaying(false)}
                      className="absolute top-4 right-4 z-10 glass"
                    >
                      <Pause className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Feature highlights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {[
                { label: 'Barcode Scanning', time: '0:30' },
                { label: 'Inventory Management', time: '1:15' },
                { label: 'Analytics Dashboard', time: '2:30' },
              ].map((chapter, index) => (
                <button
                  key={index}
                  onClick={() => setIsPlaying(true)}
                  className="flex items-center justify-between p-3 rounded-lg glass-card glass-hover text-left group text-sm"
                >
                  <span className="font-medium">{chapter.label}</span>
                  <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    {chapter.time}
                  </span>
                </button>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
