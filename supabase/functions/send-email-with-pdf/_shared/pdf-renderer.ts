export interface PdfRenderResult {
  base64: string;
  sizeBytes: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function toBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binaryString = '';
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binaryString);
}

export function ensureHtmlDocument(html: string, title = 'Document'): string {
  const trimmedHtml = html.trim();
  const hasFullDocument = /<!doctype/i.test(trimmedHtml) || /<html[\s>]/i.test(trimmedHtml);

  if (hasFullDocument) {
    return trimmedHtml;
  }

  const safeTitle = escapeHtml(title);

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <style>
      @page {
        size: A4;
        margin: 16mm;
      }

      html, body {
        margin: 0;
        padding: 0;
      }

      body {
        font-family: Arial, sans-serif;
        color: #111827;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      img {
        max-width: 100%;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }
    </style>
  </head>
  <body>
${trimmedHtml}
  </body>
</html>`;
}

export async function renderHtmlToPdfBase64(
  html: string,
  options?: { title?: string },
): Promise<PdfRenderResult> {
  const gotenbergUrl = Deno.env.get('GOTENBERG_URL');
  const gotenbergUsername = Deno.env.get('GOTENBERG_BASIC_AUTH_USERNAME');
  const gotenbergPassword = Deno.env.get('GOTENBERG_BASIC_AUTH_PASSWORD');

  if (!gotenbergUrl) {
    throw new Error(
      'GOTENBERG_URL environment variable is not set. Please configure it in Supabase Edge Functions secrets.',
    );
  }

  const endpoint = `${normalizeBaseUrl(gotenbergUrl)}/forms/chromium/convert/html`;
  const documentHtml = ensureHtmlDocument(html, options?.title);

  console.log('[pdf-renderer] Rendering HTML with Gotenberg...');
  console.log('[pdf-renderer] Endpoint:', endpoint);
  console.log('[pdf-renderer] HTML length:', documentHtml.length);

  const formData = new FormData();
  formData.set('files', new Blob([documentHtml], { type: 'text/html; charset=utf-8' }), 'index.html');
  formData.set('printBackground', 'true');
  formData.set('emulatedMediaType', 'screen');
  formData.set('preferCssPageSize', 'true');

  const waitDelay = Deno.env.get('GOTENBERG_WAIT_DELAY');
  if (waitDelay) {
    formData.set('waitDelay', waitDelay);
  }

  const headers = new Headers();
  if (gotenbergUsername && gotenbergPassword) {
    headers.set('Authorization', `Basic ${btoa(`${gotenbergUsername}:${gotenbergPassword}`)}`);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: formData,
  });

  console.log('[pdf-renderer] Gotenberg response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[pdf-renderer] Gotenberg API error:', errorText);
    throw new Error(`Gotenberg API error: ${response.status} - ${errorText}`);
  }

  const pdfArrayBuffer = await response.arrayBuffer();
  const base64 = toBase64(pdfArrayBuffer);

  console.log('[pdf-renderer] PDF buffer size:', pdfArrayBuffer.byteLength, 'bytes');
  console.log('[pdf-renderer] PDF converted to base64, length:', base64.length);

  return {
    base64,
    sizeBytes: pdfArrayBuffer.byteLength,
  };
}
