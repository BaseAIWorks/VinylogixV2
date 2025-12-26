/**
 * Input sanitization utilities for Vinylogix
 * Helps prevent XSS and injection attacks
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * Strips dangerous tags and attributes
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  // Remove script tags and their content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  return sanitized.trim();
}

/**
 * Sanitize plain text input
 * Encodes HTML entities to prevent rendering as HTML
 */
export function sanitizeText(input: string): string {
  if (!input) return '';

  const div = typeof document !== 'undefined'
    ? document.createElement('div')
    : null;

  if (div) {
    div.textContent = input;
    return div.innerHTML;
  }

  // Fallback for server-side
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize SQL input (basic protection)
 * Note: Firestore doesn't use SQL, but this helps with string interpolation
 */
export function sanitizeSql(input: string): string {
  if (!input) return '';

  return input
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

/**
 * Sanitize email address
 * Validates and returns clean email or empty string
 */
export function sanitizeEmail(input: string): string {
  if (!input) return '';

  const email = input.trim().toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

  return emailRegex.test(email) ? email : '';
}

/**
 * Sanitize URL
 * Only allows http and https protocols
 */
export function sanitizeUrl(input: string): string {
  if (!input) return '';

  try {
    const url = new URL(input);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // Invalid URL
  }

  return '';
}

/**
 * Sanitize file name
 * Removes path traversal attempts and dangerous characters
 */
export function sanitizeFileName(input: string): string {
  if (!input) return '';

  return input
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/[<>:"|?*]/g, '') // Remove Windows invalid chars
    .replace(/^\.+/, '') // Remove leading dots
    .trim();
}

/**
 * Sanitize number input
 * Returns valid number or null
 */
export function sanitizeNumber(input: any): number | null {
  const num = Number(input);
  return !isNaN(num) && isFinite(num) ? num : null;
}

/**
 * Sanitize integer input
 * Returns valid integer or null
 */
export function sanitizeInteger(input: any): number | null {
  const num = parseInt(String(input), 10);
  return !isNaN(num) && isFinite(num) ? num : null;
}

/**
 * Sanitize boolean input
 * Handles string representations of booleans
 */
export function sanitizeBoolean(input: any): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    const lower = input.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  return Boolean(input);
}

/**
 * Truncate string to maximum length
 * Useful for preventing database/display issues with overly long input
 */
export function truncate(input: string, maxLength: number): string {
  if (!input || input.length <= maxLength) return input;
  return input.substring(0, maxLength);
}

/**
 * Sanitize object for logging
 * Removes sensitive fields before logging
 */
export function sanitizeForLogging(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
  const sanitized = { ...obj };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}
