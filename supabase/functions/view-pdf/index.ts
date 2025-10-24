import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || url.pathname.split('/').pop();
    const action = url.searchParams.get('action') || 'view';

    if (!token) {
      return new Response(
        '<html><body><h1>Invalid Link</h1><p>No access token provided.</p></body></html>',
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[view-pdf] Looking up token:', token);

    const { data: link, error: linkError } = await supabase
      .from('public_pdf_links')
      .select('*, pdf_generation_logs(*)')
      .eq('access_token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (linkError || !link) {
      console.error('[view-pdf] Link not found or error:', linkError);
      return new Response(
        '<html><body><h1>Link Not Found</h1><p>This PDF link is invalid or has been deactivated.</p></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      console.log('[view-pdf] Link expired:', link.expires_at);
      return new Response(
        '<html><body><h1>Link Expired</h1><p>This PDF link has expired.</p></body></html>',
        { status: 410, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const pdfLog = link.pdf_generation_logs;
    if (!pdfLog || !pdfLog.pdf_base64) {
      console.error('[view-pdf] PDF data not found');
      return new Response(
        '<html><body><h1>PDF Not Available</h1><p>The PDF file is no longer available.</p></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    await supabase
      .from('public_pdf_links')
      .update({
        view_count: link.view_count + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', link.id);

    console.log('[view-pdf] Serving PDF:', link.filename, 'view_count:', link.view_count + 1);

    const pdfBuffer = Uint8Array.from(atob(pdfLog.pdf_base64), c => c.charCodeAt(0));

    const disposition = action === 'download' 
      ? `attachment; filename="${link.filename}"` 
      : `inline; filename="${link.filename}"`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('[view-pdf] Error:', error);
    return new Response(
      '<html><body><h1>Error</h1><p>An error occurred while retrieving the PDF.</p></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
});