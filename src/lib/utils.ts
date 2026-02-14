import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Distributor } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check if a distributor has completed all required business information.
 * Required fields: companyName, addressLine1, city, postcode, country, contactEmail
 * Returns an object with isComplete boolean and list of missing fields.
 */
export function checkBusinessProfileComplete(distributor: Distributor | null): {
  isComplete: boolean;
  missingFields: string[];
} {
  if (!distributor) {
    return { isComplete: false, missingFields: ['distributor'] };
  }

  const requiredFields: { key: keyof Distributor; label: string }[] = [
    { key: 'companyName', label: 'Company Name' },
    { key: 'addressLine1', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'postcode', label: 'Postcode' },
    { key: 'country', label: 'Country' },
    { key: 'contactEmail', label: 'Contact Email' },
  ];

  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = distributor[field.key];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(field.label);
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

export function formatPriceForDisplay(value?: number | null): string {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return "";
  }
  // Use Intl.NumberFormat for locale-specific formatting.
  // 'de-DE' or 'nl-NL' uses dot for thousands and comma for decimals.
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function parsePriceFromUserInput(valueString?: string | null): number | undefined {
  if (valueString === undefined || valueString === null || String(valueString).trim() === "") {
    return undefined;
  }

  // Remove thousand separators (dots) and then replace decimal comma with a dot.
  // Handles inputs like "1.234,56" -> "1234,56" -> "1234.56"
  // Handles inputs like "1234,56" -> "1234.56"
  // Handles inputs like "1234" -> "1234"
  // Handles inputs like "1234.56" (if user accidentally uses dot as decimal) -> "1234.56" (after removing other dots)
  //   To be safe, this logic assumes the LAST comma is the decimal separator if present,
  //   and all dots are thousand separators.
  
  let preppedString = String(valueString).trim();

  // If a comma exists, assume dots are thousand separators
  if (preppedString.includes(',')) {
    preppedString = preppedString.replace(/\./g, ""); // Remove all dots
    preppedString = preppedString.replace(",", ".");  // Replace comma with dot
  }
  // If no comma, but a dot exists, assume it might be a decimal (less common for DE/NL but good fallback)
  // This scenario is tricky if user means "1.234" as a large number without decimals.
  // The current Zod validation will catch if it's not a valid number after this.
  // For simplicity, we stick to the primary goal: comma as decimal, dots as thousands.
  // If only dots are present, they are removed. If they intended 1.23 as decimal, this won't work perfectly.
  // However, the explicit instruction is "comma as decimal".

  const num = parseFloat(preppedString);
  
  return isNaN(num) ? undefined : num;
}
