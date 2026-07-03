import { fetchClient } from '../api/fetchClient';

/**
 * Downloads a file from the given API endpoint using the Authorization header.
 * The filename is extracted from the Content-Disposition response header when available.
 * @param endpoint - API path (e.g. `/classes/123/report/export`)
 * @param fallbackFilename - Filename to use when Content-Disposition is absent
 */
export async function downloadFile(endpoint: string, fallbackFilename: string): Promise<void> {
  const response = await fetchClient(endpoint);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  let filename = fallbackFilename;
  const disposition = response.headers.get('Content-Disposition');
  if (disposition) {
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
      filename = decodeURIComponent(utf8Match[1]);
    } else {
      const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
      if (plainMatch) {
        filename = plainMatch[1].trim();
      }
    }
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
