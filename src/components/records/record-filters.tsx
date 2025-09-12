
"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, ArrowUpDown } from "lucide-react";
import type { SortOption } from "@/types";

interface RecordFiltersProps {
  filters: Record<string, string | undefined>;
  setFilters: (filters: any) => void;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  filterOptions: {
    locations: string[];
    years: string[];
    genres: string[];
    conditions: string[];
    formats: string[];
  };
}

const FilterSelect = ({ label, value, onValueChange, options }: { label: string, value?: string, onValueChange: (value: string) => void, options: string[] }) => {
    if (!options || options.length === 0) return null;

    return (
        <div className="px-2">
            <p className="text-sm font-medium mb-1">{label}</p>
            <Select onValueChange={onValueChange} value={value || "all"}>
                <SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    );
};

export default function RecordFilters({ filters, setFilters, sortOption, setSortOption, filterOptions }: RecordFiltersProps) {
  
  const handleFilterChange = (filterType: string, value: string) => {
    setFilters((prevFilters: any) => ({ ...prevFilters, [filterType]: value === "all" ? undefined : value }));
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="flex flex-wrap gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
                <span className="ml-1 h-5 w-5 text-xs flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {activeFilterCount}
                </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-2 space-y-3">
          <DropdownMenuLabel>Filter by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <FilterSelect label="Genre" value={filters.genre} onValueChange={(v) => handleFilterChange('genre', v)} options={filterOptions.genres} />
          <FilterSelect label="Year" value={filters.year} onValueChange={(v) => handleFilterChange('year', v)} options={filterOptions.years} />
          <FilterSelect label="Format" value={filters.format} onValueChange={(v) => handleFilterChange('format', v)} options={filterOptions.formats} />
          <FilterSelect label="Location" value={filters.location} onValueChange={(v) => handleFilterChange('location', v)} options={filterOptions.locations} />
          <FilterSelect label="Condition" value={filters.condition} onValueChange={(v) => handleFilterChange('condition', v)} options={filterOptions.conditions} />

        </DropdownMenuContent>
      </DropdownMenu>

      <Select onValueChange={(v) => setSortOption(v as SortOption)} value={sortOption}>
        <SelectTrigger className="w-auto min-w-[180px]">
          <ArrowUpDown className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Sort by..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="added_at_desc">Recently Added</SelectItem>
          <SelectItem value="title_asc">Title (A-Z)</SelectItem>
          <SelectItem value="title_desc">Title (Z-A)</SelectItem>
          <SelectItem value="stock_shelves_desc">Stock (Shelves)</SelectItem>
          <SelectItem value="stock_storage_desc">Stock (Storage)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
