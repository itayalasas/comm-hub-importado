import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

interface SendEmailRequest {
  template_name: string;
  recipient_email: string;
  data: Record<string, any>;
}

const generateQRCode = (data: string): string => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  return qrUrl;
};

const processLogoAndQR = (html: string, data: Record<string, any>, template: any): string => {
  let processedHtml = html;

  if (template.has_logo && template.logo_variable && data[template.logo_variable]) {
    const logoData = data[template.logo_variable];
    const logoSrc = logoData.startsWith('http') ? logoData : `data:image/png;base64,${logoData}`;
    const logoTag = `<img src="${logoSrc}" alt="Logo" style="max-width: 200px; height: auto;" />`;
    const regex = new RegExp(`\\{\\{${template.logo_variable}\\}\\}`, 'g');
    processedHtml = processedHtml.replace(regex, logoTag);
  }

  if (template.has_qr && template.qr_variable && data[template.qr_variable]) {
    const qrData = data[template.qr_variable];
    const qrUrl = generateQRCode(qrData);
    const qrTag = `<img src="${qrUrl}" alt="QR Code" style="width: 200px; height: 200px;" />`;
    const regex = new RegExp(`\\{\\{${template.qr_variable}_qr\\}\\}`, 'g');
    processedHtml = processedHtml.replace(regex, qrTag);
  }

  return processedHtml;
};

const prepareForSMTP = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\r\n');
};

const addTracking = (html: string, logId: string, supabaseUrl: string): string => {
  let trackedHtml = html;

  const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-email/open?log_id=${logId}" width="1" height="1" style="display:none;" alt="" />`;
  trackedHtml = trackedHtml.replace('</body>', `${trackingPixel}</body>`);

  trackedHtml = trackedHtml.replace(
    /href="([^"]+)"/g,
    (match, url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const trackingUrl = `${supabaseUrl}/functions/v1/track-email/click?log_id=${logId}&url=${encodeURIComponent(url)}`;
        return `href="${trackingUrl}"`;
      }
      return match;
    }
  );

  return trackedHtml;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let logEntry: any = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const requestData: SendEmailRequest = await req.json();
    const { template_name, recipient_email, data } = requestData;

    if (!template_name || !recipient_email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: template_name, recipient_email',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: template, error: templateError } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('name', template_name)
      .eq('application_id', application.id)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Template not found or inactive',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let pdfAttachment = null;

    if (template.pdf_template_id) {
      console.log('Template has associated PDF, generating...');

      const { data: pdfTemplate, error: pdfTemplateError } = await supabase
        .from('communication_templates')
        .select('*')
        .eq('id', template.pdf_template_id)
        .eq('is_active', true)
        .maybeSingle();

      if (pdfTemplate) {
        let pdfHtmlContent = pdfTemplate.html_content;

        Object.keys(data).forEach((key) => {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          const value = data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
          pdfHtmlContent = pdfHtmlContent.replace(regex, value);
        });

        pdfHtmlContent = processLogoAndQR(pdfHtmlContent, data, pdfTemplate);

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
(${pdfHtmlContent.replace(/[<>]/g, '').substring(0, 100)}) Tj
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
        const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

        let filename = pdfTemplate.pdf_filename_pattern || 'document.pdf';
        Object.keys(data).forEach((key) => {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          filename = filename.replace(regex, String(data[key] || ''));
        });

        pdfAttachment = {
          filename,
          content: pdfBase64,
          encoding: 'base64',
        };

        await supabase.from('pdf_generation_logs').insert({
          application_id: application.id,
          pdf_template_id: pdfTemplate.id,
          data,
          pdf_base64: pdfBase64,
          filename,
          size_bytes: pdfBase64.length,
        });

        console.log('PDF generated successfully:', filename);
      } else {
        console.warn('PDF template not found, continuing without attachment');
      }
    }

    const { data: credentials, error: credError } = await supabase
      .from('email_credentials')
      .select('*')
      .eq('application_id', application.id)
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credentials) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email credentials not configured',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let htmlContent = template.html_content;
    let subject = template.subject || '';

    console.log('Variables received:', JSON.stringify(data));
    console.log('Template contains cta_url?', htmlContent.includes('{{cta_url}}'));

    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const value = data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
      console.log(`Replacing {{${key}}} with: ${value}`);
      htmlContent = htmlContent.replace(regex, value);
      subject = subject.replace(regex, value);
    });

    console.log('After replacement, still contains {{cta_url}}?', htmlContent.includes('{{cta_url}}'));

    htmlContent = processLogoAndQR(htmlContent, data, template);
    subject = prepareForSMTP(subject);

    const emailLog = {
      application_id: application.id,
      template_id: template.id,
      recipient_email,
      subject,
      status: 'pending',
      metadata: {
        data,
        has_attachment: template.has_attachment,
        has_logo: template.has_logo,
        has_qr: template.has_qr,
        request_headers: {
          'user-agent': req.headers.get('user-agent'),
          'x-forwarded-for': req.headers.get('x-forwarded-for'),
        },
      },
    };

    const { data: logData, error: logError } = await supabase
      .from('email_logs')
      .insert(emailLog)
      .select()
      .single();

    if (logError) {
      console.error('Error creating log entry:', logError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create log entry',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    logEntry = logData;

    htmlContent = addTracking(htmlContent, logEntry.id, supabaseUrl);
    htmlContent = prepareForSMTP(htmlContent);

    try {
      const useTLS = credentials.smtp_port === 465;

      const client = new SMTPClient({
        connection: {
          hostname: credentials.smtp_host,
          port: credentials.smtp_port,
          tls: useTLS,
          auth: {
            username: credentials.smtp_user,
            password: credentials.smtp_password,
          },
        },
      });

      const emailMessage: any = {
        from: credentials.from_name
          ? `${credentials.from_name} <${credentials.from_email}>`
          : credentials.from_email,
        to: recipient_email,
        subject: subject,
        content: 'text/html',
        html: htmlContent,
      };

      if (pdfAttachment) {
        emailMessage.attachments = [pdfAttachment];
        console.log('Adding PDF attachment:', pdfAttachment.filename);
      }

      await client.send(emailMessage);

      await client.close();

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          metadata: {
            ...emailLog.metadata,
            processing_time_ms: processingTime,
            smtp_config: {
              host: credentials.smtp_host,
              port: credentials.smtp_port,
              tls: useTLS,
            },
          },
        })
        .eq('id', logEntry.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          log_id: logEntry.id,
          features: {
            has_attachment: template.has_attachment || !!pdfAttachment,
            has_logo: template.has_logo,
            has_qr: template.has_qr,
            has_pdf: !!pdfAttachment,
          },
          pdf_attachment: pdfAttachment ? {
            filename: pdfAttachment.filename,
            size_bytes: pdfAttachment.content.length,
          } : null,
          processing_time_ms: processingTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (emailError: any) {
      console.error('Error sending email:', emailError);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      await supabase
        .from('email_logs')
        .update({
          status: 'failed',
          error_message: emailError.message || String(emailError),
          metadata: {
            ...emailLog.metadata,
            processing_time_ms: processingTime,
            error_details: {
              name: emailError.name,
              message: emailError.message,
              stack: emailError.stack,
            },
          },
        })
        .eq('id', logEntry.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send email',
          details: emailError.message || String(emailError),
          log_id: logEntry.id,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('Error processing request:', error);

    if (logEntry) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('email_logs')
        .update({
          status: 'failed',
          error_message: error.message || String(error),
        })
        .eq('id', logEntry.id);
    }

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