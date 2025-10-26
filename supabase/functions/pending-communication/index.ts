import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  let application: any = null;
  let supabase: any = null;

  try {
    console.log('[pending-communication] Request received');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');
    let requestData: any = null;
    let requestBody = '';

    try {
      requestBody = await req.text();
      requestData = JSON.parse(requestBody);
      console.log('[pending-communication] Request parsed successfully');
    } catch (parseError: any) {
      console.error('[pending-communication] JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON', details: parseError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing API key in x-api-key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id, name')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (appError || !app) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    application = app;

    const { template_name, recipient_email, data, base_data } = requestData;
    const emailData = data || base_data || {};

    if (!template_name || !recipient_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: template_name, recipient_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ success: false, error: 'Template not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderId = requestData.order_id;
    const waitForInvoice = requestData.wait_for_invoice;

    if (orderId && waitForInvoice) {
      console.log('[pending-communication] wait_for_invoice=true, creating parent log');

      function renderTemplate(template: string, data: Record<string, any>): string {
        let result = template;
        const variableRegex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;
        result = result.replace(variableRegex, (match, path) => {
          const keys = path.split('.');
          let value: any = data;
          for (const key of keys) {
            if (value === null || value === undefined) return '';
            value = value[key];
          }
          return value !== undefined && value !== null ? String(value) : '';
        });
        return result;
      }

      const emailDataWithOrderId = { ...emailData, order_id: orderId };
      const renderedSubject = requestData.subject || renderTemplate(template.subject || 'Pending Invoice', emailDataWithOrderId);

      const { data: parentLogData, error: parentLogError } = await supabase
        .from('email_logs')
        .insert({
          application_id: application.id,
          template_id: template.id,
          recipient_email,
          subject: renderedSubject,
          status: 'pending',
          communication_type: 'email_with_pdf',
          pdf_generated: false,
          metadata: {
            action: 'email_queued',
            message: 'Email queued, waiting for invoice PDF',
            order_id: orderId,
            wait_for_invoice: true,
            template_name,
          },
        })
        .select()
        .single();

      if (parentLogError || !parentLogData) {
        console.error('[pending-communication] Failed to create parent log:', parentLogError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create email log', details: parentLogError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: pendingComm, error: pendingError } = await supabase
        .from('pending_communications')
        .insert({
          application_id: application.id,
          template_name: template_name,
          recipient_email,
          base_data: emailDataWithOrderId,
          pending_fields: ['invoice_pdf'],
          external_system: 'email_system',
          external_reference_id: orderId,
          order_id: orderId,
          parent_log_id: parentLogData.id,
        })
        .select()
        .single();

      if (pendingError || !pendingComm) {
        console.error('[pending-communication] Failed to create pending communication:', pendingError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create pending communication', details: pendingError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[pending-communication] Checking for existing PDF for order_id:', orderId);

      const { data: pdfLogs } = await supabase
        .from('email_logs')
        .select('id, metadata, created_at')
        .eq('application_id', application.id)
        .eq('communication_type', 'pdf_generation')
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(20);

      console.log('[pending-communication] Found', pdfLogs?.length || 0, 'PDF logs');

      let existingPdf = null;
      let pdfEmailLogId = null;

      if (pdfLogs && pdfLogs.length > 0) {
        for (const log of pdfLogs) {
          const logOrderId = log.metadata?.order_id;
          console.log('[pending-communication] Checking log:', log.id, 'order_id:', logOrderId);
          
          if (logOrderId === orderId) {
            console.log('[pending-communication] ✅ MATCH! Found PDF for order_id:', orderId);
            pdfEmailLogId = log.id;

            const { data: pdfData } = await supabase
              .from('pdf_generation_logs')
              .select('id, pdf_base64, filename, size_bytes')
              .eq('email_log_id', log.id)
              .maybeSingle();

            if (pdfData && pdfData.pdf_base64) {
              console.log('[pending-communication] PDF found, size:', pdfData.size_bytes);
              existingPdf = pdfData;
              break;
            }
          }
        }
      }

      if (!existingPdf) {
        console.log('[pending-communication] ❌ NO PDF found for order_id:', orderId);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email queued, waiting for invoice PDF',
            log_id: parentLogData.id,
            pending_communication_id: pendingComm.id,
            status: 'queued',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[pending-communication] ✅ PDF exists! Attaching...');

      await supabase
        .from('email_logs')
        .update({ parent_log_id: parentLogData.id })
        .eq('id', pdfEmailLogId);

      await supabase
        .from('pending_communications')
        .update({
          completed_data: {
            pdf_attachment: {
              filename: existingPdf.filename,
              content: existingPdf.pdf_base64,
              encoding: 'base64',
            },
            pdf_generation_log_id: pdfEmailLogId,
            pdf_email_log_id: pdfEmailLogId,
            pdf_filename: existingPdf.filename,
            pdf_size_bytes: existingPdf.size_bytes,
            initial_log_id: parentLogData.id,
          },
          status: 'pdf_generated',
          pdf_generated: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', pendingComm.id);

      console.log('[pending-communication] Triggering email send...');

      const completeUrl = `${supabaseUrl}/functions/v1/complete-pending-communication`;
      const completeResponse = await fetch(completeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ pending_communication_id: pendingComm.id }),
      });

      const completeResult = await completeResponse.json();

      if (completeResult.success) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email sent with PDF',
            log_id: parentLogData.id,
            pending_communication_id: pendingComm.id,
            status: 'sent',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to send email',
            details: completeResult,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
    const emailResponse = await fetch(sendEmailUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ template_name, recipient_email, data: emailData }),
    });

    const emailResult = await emailResponse.json();

    return new Response(
      JSON.stringify(emailResult),
      { status: emailResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});