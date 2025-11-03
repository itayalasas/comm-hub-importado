import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, svix-id, svix-timestamp, svix-signature',
};

interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.bounced' | 'email.complained';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    bounced_at?: string;
    bounce?: {
      bounce_type: 'hard' | 'soft' | 'spam';
      diagnostic_code?: string;
    };
  };
}

async function verifyWebhookSignature(
  payload: string,
  headers: Headers
): Promise<boolean> {
  const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');
  
  if (!WEBHOOK_SECRET) {
    console.warn('RESEND_WEBHOOK_SECRET not configured - skipping signature verification');
    return true;
  }

  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('Missing Svix headers');
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  
  const secret = WEBHOOK_SECRET.startsWith('whsec_') 
    ? WEBHOOK_SECRET.slice(6) 
    : WEBHOOK_SECRET;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(signedContent);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const signatures = svixSignature.split(' ');
  
  for (const versionedSignature of signatures) {
    const [version, signatureToCompare] = versionedSignature.split(',');
    if (version === 'v1' && signatureToCompare === base64Signature) {
      return true;
    }
  }

  console.error('Signature verification failed');
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload = await req.text();
    
    const isValid = await verifyWebhookSignature(payload, req.headers);
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event: ResendWebhookEvent = JSON.parse(payload);
    
    console.log('Received Resend webhook:', event.type, 'for email:', event.data.email_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const recipientEmail = event.data.to[0];

    const { data: emailLog, error: findError } = await supabase
      .from('email_logs')
      .select('id, status, application_id')
      .eq('resend_email_id', event.data.email_id)
      .maybeSingle();

    if (findError) {
      console.error('Error finding email log:', findError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: findError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!emailLog) {
      console.log('Email log not found for resend_email_id:', event.data.email_id);
      return new Response(
        JSON.stringify({ message: 'Email log not found, possibly not tracked' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updateData: any = {
      delivery_status: event.type.replace('email.', ''),
    };

    switch (event.type) {
      case 'email.sent':
        updateData.status = 'sent';
        break;

      case 'email.delivered':
        updateData.status = 'sent';
        updateData.delivered_at = event.created_at;
        break;

      case 'email.delivery_delayed':
        console.log('Email delivery delayed:', event.data.email_id);
        break;

      case 'email.bounced':
        updateData.status = 'failed';
        updateData.bounced_at = event.data.bounced_at || event.created_at;
        updateData.bounce_type = event.data.bounce?.bounce_type || 'hard';
        updateData.bounce_reason = event.data.bounce?.diagnostic_code || 'Email bounced';
        updateData.error_message = `Bounced (${updateData.bounce_type}): ${updateData.bounce_reason}`;

        const { data: pendingComm, error: pendingError } = await supabase
          .from('pending_communications')
          .select('id, bounce_count, status')
          .eq('recipient_email', recipientEmail)
          .eq('application_id', emailLog.application_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingComm && pendingComm.status !== 'cancelled') {
          const newBounceCount = (pendingComm.bounce_count || 0) + 1;
          const shouldCancel = newBounceCount >= 3 || updateData.bounce_type === 'hard';

          await supabase
            .from('pending_communications')
            .update({
              bounce_count: newBounceCount,
              last_bounce_reason: updateData.bounce_reason,
              status: shouldCancel ? 'failed' : pendingComm.status,
              error_message: shouldCancel 
                ? `Email permanently failed after ${newBounceCount} bounces: ${updateData.bounce_reason}`
                : `Email bounced (attempt ${newBounceCount}): ${updateData.bounce_reason}`,
            })
            .eq('id', pendingComm.id);

          console.log(`Updated pending communication: bounces=${newBounceCount}, cancelled=${shouldCancel}`);
        }
        break;

      case 'email.complained':
        updateData.status = 'failed';
        updateData.complained_at = event.created_at;
        updateData.error_message = 'Email marked as spam by recipient';
        break;
    }

    const { error: updateError } = await supabase
      .from('email_logs')
      .update(updateData)
      .eq('id', emailLog.id);

    if (updateError) {
      console.error('Error updating email log:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update email log', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully processed webhook:', event.type, 'for log:', emailLog.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Webhook processed: ${event.type}`,
        email_log_id: emailLog.id,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error processing Resend webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});