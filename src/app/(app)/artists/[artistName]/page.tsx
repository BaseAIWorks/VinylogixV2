"use client";

import { useAuth } from "@/hooks/use-auth";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getRecordsByArtist, getDistinctArtists } from "@/services/record-service";
import { generateArtistProfile, type GenerateArtistProfileOutput } from "@/ai/flows/generate-artist-profile-flow";
import type { VinylRecord, ArtistProfile } from "@/types";
import RecordCard from "@/components/records/record-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Calendar, Music, Disc3, Sparkles, Users } from "lucide-react";
import Link from "next/link";

export default function ArtistProfilePage() {
  const { user, activeDistributorId, activeDistributor } = useAuth();
  const params = useParams();
  const router = useRouter();
  const artistName = decodeURIComponent(params.artistName as string);

  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Partial<ArtistProfile> | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const isOperator = user?.role === 'master' || user?.role === 'worker';

  // Fetch all records by this artist
  useEffect(() => {
    if (!artistName || !activeDistributorId) return;

    const fetch = async () => {
      setLoading(true);
      try {
        const data = await getRecordsByArtist(artistName, activeDistributorId);
        setRecords(data);

        // Build profile from existing record data
        const allGenres = new Set<string>();
        let bio = '';
        data.forEach(r => {
          r.genre?.forEach(g => allGenres.add(g));
          if (r.artistBio && !bio) bio = r.artistBio;
        });

        setProfile({
          name: artistName,
          bio,
          genres: Array.from(allGenres),
        });
      } catch (err) {
        console.error('Failed to load artist records:', err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [artistName, activeDistributorId]);

  // Generate AI profile metadata (active years, origin, fun fact, related artists)
  const profileMetadataLoaded = useRef(false);

  const generateProfileMetadata = useCallback(async () => {
    if (!profile || loadingProfile || profileMetadataLoaded.current) return;

    const cacheKey = `artist_profile_${activeDistributorId}_${artistName}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setProfile(prev => ({ ...prev, ...parsed }));
        profileMetadataLoaded.current = true;
        return;
      }
    } catch {}

    setLoadingProfile(true);
    profileMetadataLoaded.current = true;
    try {
      // Cache distinct artists list per session to avoid repeated full-collection reads
      const artistsCacheKey = `distinct_artists_${activeDistributorId}`;
      let allArtists: string[];
      try {
        const cachedArtists = sessionStorage.getItem(artistsCacheKey);
        allArtists = cachedArtists ? JSON.parse(cachedArtists) : [];
      } catch { allArtists = []; }

      if (allArtists.length === 0) {
        allArtists = await getDistinctArtists(activeDistributorId!);
        try { sessionStorage.setItem(artistsCacheKey, JSON.stringify(allArtists)); } catch {}
      }

      const otherArtists = allArtists.filter(a => a !== artistName);
      // Cap to 150 artists for AI prompt to reduce token cost
      const cappedArtists = otherArtists.slice(0, 150);

      const result = await generateArtistProfile({
        artist: artistName,
        genres: profile.genres || [],
        inventoryArtists: cappedArtists,
      });

      const metadata = {
        activeYears: result.activeYears,
        origin: result.origin,
        funFact: result.funFact,
        relatedArtists: result.relatedArtists,
      };

      setProfile(prev => ({ ...prev, ...metadata }));
      try { sessionStorage.setItem(cacheKey, JSON.stringify(metadata)); } catch {}
    } catch (err) {
      console.error('Failed to generate artist profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, [profile, loadingProfile, artistName, activeDistributorId]);

  // Auto-generate profile metadata when profile loads with bio
  useEffect(() => {
    if (profile?.bio && !profileMetadataLoaded.current && !loadingProfile) {
      generateProfileMetadata();
    }
  }, [profile?.bio, loadingProfile, generateProfileMetadata]);

  // Sorted discography (memoized to avoid mutating on every render)
  const sortedRecords = useMemo(() => [...records].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0)), [records]);

  // Stats
  const totalInStock = records.reduce((sum, r) => sum + (r.stock_shelves || 0) + (r.stock_storage || 0), 0);
  const years = records.map(r => r.year).filter(Boolean).map(Number).filter(y => !isNaN(y));
  const earliestYear = years.length ? Math.min(...years) : null;
  const latestYear = years.length ? Math.max(...years) : null;

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Header */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Bio column */}
        <div className="md:col-span-2 space-y-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-primary">{artistName}</h1>
            {profile?.genres && profile.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {profile.genres.map(g => (
                  <Link key={g} href={`/inventory?genre=${encodeURIComponent(g)}`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-primary/10 transition-colors">
                      {g}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {profile?.bio && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> About {artistName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">{profile.bio}</p>
                {profile.funFact && (
                  <p className="text-sm text-muted-foreground mt-3 italic border-l-2 border-primary/30 pl-3">
                    {profile.funFact}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {loadingProfile ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <>
                  {profile?.origin && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Origin</p>
                        <p className="text-sm font-medium">{profile.origin}</p>
                      </div>
                    </div>
                  )}
                  {profile?.activeYears && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Active</p>
                        <p className="text-sm font-medium">{profile.activeYears}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Disc3 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">In Catalog</p>
                      <p className="text-sm font-medium">{records.length} record{records.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Music className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Total in Stock</p>
                      <p className="text-sm font-medium">{totalInStock} copies</p>
                    </div>
                  </div>
                  {earliestYear && latestYear && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Year Range</p>
                        <p className="text-sm font-medium">
                          {earliestYear === latestYear ? earliestYear : `${earliestYear} – ${latestYear}`}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Discography */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Disc3 className="h-5 w-5 text-primary" />
          Discography ({records.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sortedRecords.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                isOperator={isOperator}
                isFavorite={user?.role === 'viewer' && user?.favorites?.includes(record.id)}
              />
            ))}
        </div>
      </div>

      {/* Related Artists */}
      {profile?.relatedArtists && profile.relatedArtists.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Related Artists
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.relatedArtists.map(a => (
              <Link key={a} href={`/artists/${encodeURIComponent(a)}`}>
                <Badge variant="outline" className="px-3 py-1.5 text-sm cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors">
                  {a}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
