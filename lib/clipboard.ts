/**
 * Copies text to the clipboard, falling back to a legacy execCommand-based
 * approach for browsers/contexts where navigator.clipboard is unavailable
 * (e.g. non-HTTPS origins, older browsers).
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to the legacy approach below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}
