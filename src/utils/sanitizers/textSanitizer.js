/**
 * Text Sanitizer Utility
 */

export function escapeHtml(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function cleanTitle(title) {
  if (!title || typeof title !== 'string') {
    return 'Tracked Product';
  }

  return title
    .replace(/\s+/g, ' ')
    .trim();
}
