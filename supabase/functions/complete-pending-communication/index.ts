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

  try {
    console.log('[complete-pending] Request received');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Missing API key in x-api-key header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: application } = await supabase.from('applications').select('id, name').eq('api_key', apiKey).maybeSingle();
    if (!application) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid API key' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const requestData: any = await req.json();
    const { external_reference_id, pending_communication_id, completed_data } = requestData;

    if (!external_reference_id && !pending_communication_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required field: external_reference_id or pending_communication_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let query = supabase.from('pending_communications').select('*').eq('application_id', application.id);
    if (pending_communication_id) {
      query = query.eq('id', pending_communication_id);
    } else {
      query = query.eq('external_reference_id', external_reference_id);
    }

    const { data: pendingComm } = await query.maybeSingle();
    if (!pendingComm) {
      return new Response(JSON.stringify({ success: false, error: 'Pending communication not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (pendingComm.status === 'sent') {
      return new Response(JSON.stringify({ success: false, error: 'Communication already sent', sent_at: pendingComm.sent_at }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const mergedData = { ...pendingComm.base_data, ...completed_data };

    console.log('[complete-pending] Status:', pendingComm.status);
    console.log('[complete-pending] Has PDF attachment:', !!pendingComm.completed_data?.pdf_attachment);

    if (pendingComm.status === 'waiting_data') {
      await supabase.from('pending_communications').update({
        completed_data: mergedData,
        status: 'data_received',
        completed_at: new Date().toISOString(),
      }).eq('id', pendingComm.id);
      console.log('[complete-pending] Status updated to data_received');
    }

    console.log('[complete-pending] Sending email...');

    const sendEmailUrl = supabaseUrl + '/functions/v1/send-email';

    try {
      console.log('[complete-pending] completed_data:', JSON.stringify(pendingComm.completed_data));

      const pdfEmailLogId = pendingComm.completed_data?.pdf_email_log_id || pendingComm.completed_data?.pdf_generation_log_id;

      const pdfInfo = {
        pdf_email_log_id: pdfEmailLogId,
        pdf_template_id: pendingComm.completed_data?.pdf_template_id,
        pdf_filename: pendingComm.completed_data?.pdf_filename,
        pdf_size_bytes: pendingComm.completed_data?.pdf_size_bytes,
      };

      console.log('[complete-pending] PDF info:', JSON.stringify(pdfInfo));
      console.log('[complete-pending] PDF email_log_id:', pdfEmailLogId);

      const requestBody: any = {
        template_name: pendingComm.template_name,
        recipient_email: pendingComm.recipient_email,
        data: mergedData,
        order_id: pendingComm.order_id || null,
        parent_log_id: pendingComm.parent_log_id || null,
        _skip_pdf_generation: !!pdfEmailLogId,
        _pdf_info: pdfInfo,
        _pending_communication_id: pendingComm.id,
        _existing_log_id: pendingComm.parent_log_id,
      };

      console.log('[complete-pending] Reusing parent log ID:', pendingComm.parent_log_id);
      console.log('[complete-pending] PDF will be fetched using email_log_id:', pdfEmailLogId);

      const emailResponse = await fetch(sendEmailUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(requestBody),
      });

      const emailResult = await emailResponse.json();

      if (emailResult.success) {
        await supabase.from('pending_communications').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_log_id: emailResult.log_id,
        }).eq('id', pendingComm.id);

        if (pendingComm.parent_log_id) {
          console.log('[complete-pending] Updating parent email log to sent:', pendingComm.parent_log_id);
          await supabase.from('email_logs').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          }).eq('id', pendingComm.parent_log_id);
        }

        if (pendingComm.webhook_url) {
          try {
            await fetch(pendingComm.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'communication_sent',
                external_reference_id: pendingComm.external_reference_id,
                sent_at: new Date().toISOString(),
                log_id: emailResult.log_id,
              }),
            });
          } catch (webhookError) {
            console.error('[complete-pending] Webhook error:', webhookError);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Communication completed and email sent',
          pending_communication_id: pendingComm.id,
          log_id: emailResult.log_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
        console.error('[complete-pending] Email send failed:', emailResult);
        await supabase.from('pending_communications').update({
          status: 'failed',
          error_message: emailResult.error || 'Failed to send email',
        }).eq('id', pendingComm.id);
        return new Response(JSON.stringify({ success: false, error: 'Failed to send email', details: emailResult.error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (sendError: any) {
      console.error('[complete-pending] Error:', sendError);
      await supabase.from('pending_communications').update({ status: 'failed', error_message: sendError.message }).eq('id', pendingComm.id);
      return new Response(JSON.stringify({ success: false, error: 'Error sending email', details: sendError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    console.error('[complete-pending] Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});