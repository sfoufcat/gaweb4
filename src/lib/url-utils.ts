/**
 * Normalizes a URL by adding https:// protocol if it looks like a domain but lacks a protocol.
 * Examples:
 *   - "lol.com" → "https://lol.com"
 *   - "zoom.us/j/123" → "https://zoom.us/j/123"
 *   - "https://meet.google.com/abc" → "https://meet.google.com/abc" (unchanged)
 *   - "" → ""
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Already has http:// or https:// protocol
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Looks like a domain (has a dot followed by 2+ letter TLD)
  if (/\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}
