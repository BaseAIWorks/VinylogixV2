/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert simple markdown to safe HTML.
 *
 * Supports:
 * - **bold**
 * - *italic*
 * - __underline__
 * - [text](url) — only http/https URLs allowed
 * - newlines → <br>
 *
 * All content is HTML-escaped first to prevent XSS.
 * Use with dangerouslySetInnerHTML safely.
 */
export function markdownToSafeHtml(text: string): string {
  if (!text) return '';

  // Escape HTML first
  let html = escapeHtml(text);

  // Links: [text](url) — only http/https allowed
  // After escaping, parens and brackets are still literal characters
  html = html.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/)[^)\s]+)\)/g,
    (_match, label, url) => {
      return `<a href="${url}" style="color:#3b82f6;text-decoration:underline;" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
  );

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* (must come after bold to avoid conflict)
  // Use lookbehind/lookahead to avoid matching ** boundaries
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  // Underline: __text__
  html = html.replace(/__([^_]+)__/g, '<u>$1</u>');

  // Newlines → <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}
