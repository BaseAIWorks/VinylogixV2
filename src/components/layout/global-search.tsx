

"use client";

import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Command, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { Search, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function GlobalSearch() {
  const { 
    globalSearchTerm, 
    setGlobalSearchTerm, 
    globalSearchResults, 
    isGlobalSearching 
  } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (globalSearchTerm.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [globalSearchTerm, globalSearchResults, isGlobalSearching]);

  const handleSelect = (recordId: string) => {
    setIsOpen(false);
    setGlobalSearchTerm("");
    router.push(`/records/${recordId}`);
  };
  
  const handleShowAll = () => {
    setIsOpen(false);
    router.push(`/inventory?search=${encodeURIComponent(globalSearchTerm)}`);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            className="pl-9"
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
            onFocus={() => { if (globalSearchTerm) setIsOpen(true); }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command>
          <CommandList>
            {isGlobalSearching ? (
              <div className="p-4 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (globalSearchResults && globalSearchResults.length > 0) ? (
              globalSearchResults.map((record) => (
                <CommandItem key={record.id} onSelect={() => handleSelect(record.id)} value={`${record.artist} ${record.title}`}>
                   <div className="flex items-center gap-3">
                     <Image 
                       src={record.cover_url || 'https://placehold.co/40x40.png'}
                       alt={record.title}
                       width={40}
                       height={40}
                       className="rounded-sm object-cover aspect-square"
                     />
                     <div>
                       <p className="font-medium line-clamp-1">{record.title}</p>
                       <p className="text-sm text-muted-foreground line-clamp-1">{record.artist}</p>
                     </div>
                   </div>
                </CommandItem>
              ))
            ) : globalSearchTerm ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : null}
            {globalSearchResults && globalSearchResults.length > 0 && (
                <CommandItem onSelect={handleShowAll} className="font-semibold justify-center text-primary">
                    Show all results
                </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

    
