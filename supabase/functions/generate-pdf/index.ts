import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { renderTemplate } from '../_shared/template-engine.ts';
import { jsPDF } from 'npm:jspdf@2.5.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

interface GeneratePDFRequest {
  template_id?: string;
  pdf_template_name?: string;
  data: Record<string, any>;
  pending_communication_id?: string;
  order_id?: string;
}

function generateFilename(pattern: string, data: Record<string, any>): string {
  return renderTemplate(pattern || 'document.pdf', data);
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHtmlToPdfStructure(html: string): {
  title: string;
  sections: Array<{ heading?: string; content: string }>;
} {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i) || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch ? stripHtmlTags(titleMatch[1]) : 'Document';

  const sections: Array<{ heading?: string; content: string }> = [];

  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const parts = html.split(h2Regex);

  if (parts.length === 1) {
    sections.push({ content: stripHtmlTags(html) });
  } else {
    if (parts[0].trim()) {
      sections.push({ content: stripHtmlTags(parts[0]) });
    }

    for (let i = 1; i < parts.length; i += 2) {
      const heading = stripHtmlTags(parts[i]);
      const content = i + 1 < parts.length ? stripHtmlTags(parts[i + 1]) : '';
      sections.push({ heading, content });
    }
  }

  return { title, sections };
}

async function htmlToPdfBase64(html: string, filename: string): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  const { title, sections } = parseHtmlToPdfStructure(html);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(title, maxWidth);
  titleLines.forEach((line: string) => {
    if (yPosition + 10 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
    doc.text(line, margin, yPosition);
    yPosition += 10;
  });

  yPosition += 5;

  sections.forEach((section) => {
    if (section.heading) {
      if (yPosition + 8 > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const headingLines = doc.splitTextToSize(section.heading, maxWidth);
      headingLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 7;
      });
      yPosition += 3;
    }

    if (section.content) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const contentLines = doc.splitTextToSize(section.content, maxWidth);

      contentLines.forEach((line: string) => {
        if (yPosition + 6 > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });

      yPosition += 4;
    }
  });

  const pdfArrayBuffer = doc.output('arraybuffer');
  const uint8Array = new Uint8Array(pdfArrayBuffer);
  return btoa(String.fromCharCode(...uint8Array));
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
    const { template_id, pdf_template_name, data, pending_communication_id, order_id } = requestData;

    if (!data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: data',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let pendingComm = null;

    if (order_id) {
      console.log(`Looking for pending communication with order_id: ${order_id}`);

      const { data: pending, error: pendingError } = await supabase
        .from('pending_communications')
        .select('*')
        .eq('order_id', order_id)
        .eq('application_id', application.id)
        .eq('status', 'waiting_data')
        .maybeSingle();

      if (pendingError) {
        console.error('Error finding pending communication:', pendingError);
      } else if (pending) {
        console.log(`Found pending communication for order ${order_id}:`, pending.id);
        pendingComm = pending;
      } else {
        console.warn(`No pending communication found for order_id: ${order_id}`);
      }
    }

    let pdfTemplate;

    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('communication_templates')
        .select('id, name, html_content, template_type, pdf_filename_pattern')
        .eq('id', template_id)
        .eq('application_id', application.id)
        .eq('template_type', 'pdf')
        .eq('is_active', true)
        .maybeSingle();

      if (templateError || !template) {
        console.error('PDF template not found:', { template_id, error: templateError });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'PDF template not found or inactive',
            details: templateError?.message || 'Template not found',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      pdfTemplate = template;
    } else if (pdf_template_name) {
      const { data: template, error: templateError } = await supabase
        .from('communication_templates')
        .select('id, name, html_content, template_type, pdf_filename_pattern')
        .eq('name', pdf_template_name)
        .eq('application_id', application.id)
        .eq('template_type', 'pdf')
        .eq('is_active', true)
        .maybeSingle();

      if (templateError || !template) {
        console.error('PDF template not found:', { pdf_template_name, error: templateError });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'PDF template not found or inactive',
            details: templateError?.message || 'Template not found',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      pdfTemplate = template;
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Either template_id or pdf_template_name is required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Rendering HTML template with data...');
    const htmlContent = renderTemplate(pdfTemplate.html_content, data);

    const filename = generateFilename(pdfTemplate.pdf_filename_pattern || 'document.pdf', data);

    console.log('Converting HTML to PDF with jsPDF...');
    const pdfBase64 = await htmlToPdfBase64(htmlContent, filename);

    const sizeBytes = pdfBase64.length;

    console.log('PDF generated successfully:', { filename, sizeBytes });

    const { data: pdfLog, error: logError } = await supabase
      .from('pdf_generation_logs')
      .insert({
        application_id: application.id,
        pdf_template_id: pdfTemplate.id,
        data,
        pdf_base64: pdfBase64,
        filename,
        size_bytes: sizeBytes,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging PDF generation:', logError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to log PDF generation',
          details: logError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const targetPendingId = pending_communication_id || (pendingComm ? pendingComm.id : null);

    if (targetPendingId) {
      console.log('Updating pending communication with PDF attachment...');
      const { error: updateError } = await supabase
        .from('pending_communications')
        .update({
          completed_data: {
            pdf_attachment: {
              filename,
              content: pdfBase64,
              encoding: 'base64',
            },
          },
          status: 'data_received',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPendingId);

      if (updateError) {
        console.error('Error updating pending communication:', updateError);
      } else {
        console.log('Pending communication updated successfully');

        if (pendingComm && order_id) {
          console.log(`Triggering email send for order ${order_id}...`);

          try {
            const completeUrl = `${supabaseUrl}/functions/v1/complete-pending-communication`;

            const completeResponse = await fetch(completeUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'x-api-key': apiKey,
              },
              body: JSON.stringify({
                pending_communication_id: targetPendingId,
              }),
            });

            const completeResult = await completeResponse.json();

            if (completeResult.success) {
              console.log(`Email sent successfully for order ${order_id}`);

              await supabase.from('email_logs').insert({
                application_id: application.id,
                template_id: pdfTemplate.id,
                recipient_email: pendingComm.recipient_email,
                subject: `PDF Generated & Email Triggered for ${order_id}`,
                status: 'triggered',
                communication_type: 'email_with_pdf',
                pdf_generated: true,
                metadata: {
                  order_id,
                  pending_communication_id: targetPendingId,
                  pdf_log_id: pdfLog.id,
                  filename,
                  size_bytes: sizeBytes,
                  action: 'pdf_generated_email_triggered',
                  complete_result: completeResult,
                  message: 'PDF generated successfully, email sending triggered',
                },
              });
            } else {
              console.error(`Failed to send email for order ${order_id}:`, completeResult);

              await supabase.from('email_logs').insert({
                application_id: application.id,
                template_id: pdfTemplate.id,
                recipient_email: pendingComm.recipient_email,
                subject: `PDF Generated but Email Failed for ${order_id}`,
                status: 'failed',
                communication_type: 'email_with_pdf',
                pdf_generated: true,
                error_message: completeResult.error || 'Failed to trigger email after PDF generation',
                metadata: {
                  order_id,
                  pending_communication_id: targetPendingId,
                  pdf_log_id: pdfLog.id,
                  filename,
                  size_bytes: sizeBytes,
                  action: 'pdf_generated_email_failed',
                  complete_result: completeResult,
                },
              });
            }
          } catch (emailError: any) {
            console.error(`Error triggering email send for order ${order_id}:`, emailError);
          }
        }
      }
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
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});