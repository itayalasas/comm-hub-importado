import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

interface GeneratePDFRequest {
  pdf_template_name: string;
  data: Record<string, any>;
  external_reference_id?: string;
}

function replacePlaceholders(html: string, data: Record<string, any>): string {
  let result = html;

  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value || ''));
  }

  return result;
}

function generateFilename(pattern: string, data: Record<string, any>): string {
  let filename = pattern || 'document.pdf';

  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    filename = filename.replace(regex, String(value || ''));
  }

  return filename;
}

function htmlToPdfBase64(html: string): string {
  const pdfHeader = '%PDF-1.4\n';
  const simpleContent = `
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
endobj
5 0 obj
<< /Length 100 >>
stream
BT
/F1 12 Tf
50 700 Td
(${html.replace(/[<>]/g, '').substring(0, 100)}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
0000000304 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
455
%%EOF
`;

  const pdfContent = pdfHeader + simpleContent;
  const encoder = new TextEncoder();
  const pdfBytes = encoder.encode(pdfContent);

  return btoa(String.fromCharCode(...pdfBytes));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing API key in x-api-key header',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, name')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (appError || !application) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid API key',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const requestData: GeneratePDFRequest = await req.json();
    const { pdf_template_name, data, external_reference_id } = requestData;

    if (!pdf_template_name || !data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: pdf_template_name, data',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: pdfTemplate, error: templateError } = await supabase
      .from('communication_templates')
      .select('id, name, content, template_type, pdf_filename_pattern')
      .eq('name', pdf_template_name)
      .eq('application_id', application.id)
      .eq('template_type', 'pdf')
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !pdfTemplate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PDF template not found or inactive',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const htmlContent = replacePlaceholders(pdfTemplate.content, data);
    const pdfBase64 = htmlToPdfBase64(htmlContent);
    const filename = generateFilename(pdfTemplate.pdf_filename_pattern || 'document.pdf', data);
    const sizeBytes = pdfBase64.length;

    const { data: pdfLog, error: logError } = await supabase
      .from('pdf_generation_logs')
      .insert({
        application_id: application.id,
        pdf_template_id: pdfTemplate.id,
        data,
        pdf_base64: pdfBase64,
        filename,
        size_bytes: sizeBytes,
        external_reference_id,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging PDF generation:', logError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to log PDF generation',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PDF generated successfully',
        data: {
          pdf_id: pdfLog.id,
          pdf_base64: pdfBase64,
          filename,
          size_bytes: sizeBytes,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error generating PDF:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message || String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});