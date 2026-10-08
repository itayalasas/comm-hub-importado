-- migrate:up
-- Esquema base de SendCraft: la rama dev de Neon el 2026-10-08, sacado de su
-- pg_dump con solo la estructura (sin datos, dueños ni permisos).
--
-- Ya incluye las migraciones sueltas anteriores, de 20260702 a 20261007_0001,
-- salvo audit_logs, que dev no tenía y sigue como migración aparte.
--
-- En una base que ya existe (dev, producción) esta migración NO se corre: se marca
-- como aplicada. Ver infra/neon/README.md.

-- EXTENSION pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- FUNCTION public check_license_limit(uuid, uuid, text)
CREATE FUNCTION public.check_license_limit(p_user_id uuid, p_application_id uuid, p_resource_type text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
v_license record;
v_limits record;
v_plan record;
BEGIN
-- Obtener licencia activa del usuario
SELECT ul.*, lp.*
INTO v_license
FROM user_licenses ul
JOIN license_plans lp ON ul.license_plan_id = lp.id
WHERE ul.user_id = p_user_id
AND ul.status = 'active'
AND (ul.expires_at IS NULL OR ul.expires_at > now())
ORDER BY ul.created_at DESC
LIMIT 1;

IF NOT FOUND THEN
RETURN false;
END IF;

-- Obtener límites de uso de la aplicación
SELECT * INTO v_limits
FROM application_limits
WHERE application_id = p_application_id;

IF NOT FOUND THEN
RETURN true;
END IF;

-- Verificar límites según el tipo de recurso
CASE p_resource_type
WHEN 'email' THEN
IF v_limits.emails_sent_today >= v_license.max_emails_per_day THEN
RETURN false;
END IF;
IF v_limits.emails_sent_this_month >= v_license.max_emails_per_month THEN
RETURN false;
END IF;
WHEN 'pdf' THEN
IF v_limits.pdfs_generated_this_month >= v_license.max_pdfs_per_month THEN
RETURN false;
END IF;
WHEN 'template' THEN
IF v_limits.templates_count >= v_license.max_templates_per_app THEN
RETURN false;
END IF;
END CASE;

RETURN true;
END;
$$;

-- FUNCTION public cleanup_expired_pdf_locks()
CREATE FUNCTION public.cleanup_expired_pdf_locks() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
DELETE FROM pdf_generation_locks
WHERE expires_at < now();
RETURN NEW;
END;
$$;

-- FUNCTION public get_current_month_email_count(uuid)
CREATE FUNCTION public.get_current_month_email_count(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
v_year integer;
v_month integer;
v_count integer;
BEGIN
-- Get current year and month
v_year := EXTRACT(YEAR FROM CURRENT_DATE);
v_month := EXTRACT(MONTH FROM CURRENT_DATE);

-- Get the count
SELECT COALESCE(emails_sent, 0)
INTO v_count
FROM monthly_email_usage
WHERE user_id = p_user_id
AND year = v_year
AND month = v_month;

RETURN COALESCE(v_count, 0);
END;
$$;

-- FUNCTION public increment_monthly_email_count(uuid)
CREATE FUNCTION public.increment_monthly_email_count(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
v_year integer;
v_month integer;
v_new_count integer;
BEGIN
-- Get current year and month
v_year := EXTRACT(YEAR FROM CURRENT_DATE);
v_month := EXTRACT(MONTH FROM CURRENT_DATE);

-- Insert or update the count
INSERT INTO monthly_email_usage (user_id, year, month, emails_sent, updated_at)
VALUES (p_user_id, v_year, v_month, 1, now())
ON CONFLICT (user_id, year, month)
DO UPDATE SET
emails_sent = monthly_email_usage.emails_sent + 1,
updated_at = now()
RETURNING emails_sent INTO v_new_count;

RETURN v_new_count;
END;
$$;

-- FUNCTION public increment_resource_usage(uuid, uuid, text)
CREATE FUNCTION public.increment_resource_usage(p_application_id uuid, p_user_id uuid, p_resource_type text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
v_today date := CURRENT_DATE;
BEGIN
-- Insertar o actualizar límites de aplicación
INSERT INTO application_limits (
application_id,
user_id,
emails_sent_today,
emails_sent_this_month,
pdfs_generated_today,
pdfs_generated_this_month,
api_calls_today,
api_calls_this_month,
last_reset_daily,
last_reset_monthly
) VALUES (
p_application_id,
p_user_id,
CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END,
CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END,
CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END,
CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END,
CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END,
CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END,
v_today,
v_today
)
ON CONFLICT (application_id) DO UPDATE SET
-- Resetear contadores diarios si cambió el día
emails_sent_today = CASE
WHEN application_limits.last_reset_daily < v_today THEN
CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END
ELSE
application_limits.emails_sent_today + CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END
END,
pdfs_generated_today = CASE
WHEN application_limits.last_reset_daily < v_today THEN
CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END
ELSE
application_limits.pdfs_generated_today + CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END
END,
api_calls_today = CASE
WHEN application_limits.last_reset_daily < v_today THEN
CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END
ELSE
application_limits.api_calls_today + CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END
END,
-- Resetear contadores mensuales si cambió el mes
emails_sent_this_month = CASE
WHEN date_trunc('month', application_limits.last_reset_monthly) < date_trunc('month', v_today) THEN
CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END
ELSE
application_limits.emails_sent_this_month + CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END
END,
pdfs_generated_this_month = CASE
WHEN date_trunc('month', application_limits.last_reset_monthly) < date_trunc('month', v_today) THEN
CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END
ELSE
application_limits.pdfs_generated_this_month + CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END
END,
api_calls_this_month = CASE
WHEN date_trunc('month', application_limits.last_reset_monthly) < date_trunc('month', v_today) THEN
CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END
ELSE
application_limits.api_calls_this_month + CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END
END,
last_reset_daily = v_today,
last_reset_monthly = CASE
WHEN date_trunc('month', application_limits.last_reset_monthly) < date_trunc('month', v_today) THEN v_today
ELSE application_limits.last_reset_monthly
END,
updated_at = now();
END;
$$;

-- FUNCTION public log_license_change()
CREATE FUNCTION public.log_license_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
IF TG_OP = 'INSERT' THEN
INSERT INTO license_audit (
user_license_id,
user_id,
action,
new_status,
new_plan_id,
performed_by
) VALUES (
NEW.id,
NEW.user_id,
'created',
NEW.status,
NEW.license_plan_id,
NULL
);
ELSIF TG_OP = 'UPDATE' THEN
IF OLD.status != NEW.status OR OLD.license_plan_id != NEW.license_plan_id THEN
INSERT INTO license_audit (
user_license_id,
user_id,
action,
previous_status,
new_status,
previous_plan_id,
new_plan_id,
performed_by
) VALUES (
NEW.id,
NEW.user_id,
'updated',
OLD.status,
NEW.status,
OLD.license_plan_id,
NEW.license_plan_id,
NULL
);
END IF;
END IF;
RETURN NEW;
END;
$$;

-- FUNCTION public set_tenant_dedicated_api_servers_updated_at()
CREATE FUNCTION public.set_tenant_dedicated_api_servers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- FUNCTION public set_tenant_webchat_conversations_updated_at()
CREATE FUNCTION public.set_tenant_webchat_conversations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- FUNCTION public set_tenant_webchat_widget_configs_updated_at()
CREATE FUNCTION public.set_tenant_webchat_widget_configs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- FUNCTION public set_web_access_attempts_updated_at()
CREATE FUNCTION public.set_web_access_attempts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- FUNCTION public update_automation_program_queue_items_updated_at()
CREATE FUNCTION public.update_automation_program_queue_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- FUNCTION public update_pending_communications_updated_at()
CREATE FUNCTION public.update_pending_communications_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;

-- FUNCTION public update_updated_at_column()
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;

-- FUNCTION public update_user_preferences_timestamp()
CREATE FUNCTION public.update_user_preferences_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;

-- TABLE public application_limits
CREATE TABLE public.application_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emails_sent_today integer DEFAULT 0,
    emails_sent_this_month integer DEFAULT 0,
    pdfs_generated_today integer DEFAULT 0,
    pdfs_generated_this_month integer DEFAULT 0,
    templates_count integer DEFAULT 0,
    api_calls_today integer DEFAULT 0,
    api_calls_this_month integer DEFAULT 0,
    last_reset_daily date DEFAULT CURRENT_DATE,
    last_reset_monthly date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- TABLE public applications
CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    app_id text NOT NULL,
    name text NOT NULL,
    domain text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    api_key text,
    tenant_id text
);

-- TABLE public automation_program_queue_items
CREATE TABLE public.automation_program_queue_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    program_id uuid NOT NULL,
    external_reference_id text,
    recipient_email text NOT NULL,
    recipient_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    shared_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    last_attempt_at timestamp with time zone,
    sent_at timestamp with time zone,
    last_job_id uuid,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_error text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT automation_program_queue_items_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])))
);

-- TABLE public automation_programs
CREATE TABLE public.automation_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    name text NOT NULL,
    kind text DEFAULT 'scheduled'::text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    channel text DEFAULT 'email'::text NOT NULL,
    template_name text,
    pdf_template_name text,
    pdf_filename_pattern text,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    shared_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    schedule_at timestamp with time zone,
    cron_expression text,
    timezone text DEFAULT 'America/Montevideo'::text NOT NULL,
    next_run_at timestamp with time zone,
    last_run_at timestamp with time zone,
    last_job_id uuid,
    run_count integer DEFAULT 0 NOT NULL,
    last_error text,
    created_by text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery_mode text DEFAULT 'static'::text NOT NULL,
    CONSTRAINT automation_programs_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'email_pdf'::text, 'pdf'::text]))),
    CONSTRAINT automation_programs_delivery_mode_check CHECK ((delivery_mode = ANY (ARRAY['static'::text, 'queued'::text]))),
    CONSTRAINT automation_programs_kind_check CHECK ((kind = ANY (ARRAY['scheduled'::text, 'batch'::text]))),
    CONSTRAINT automation_programs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'active'::text, 'paused'::text, 'done'::text, 'failed'::text, 'cancelled'::text])))
);

-- TABLE public campaign_jobs
CREATE TABLE public.campaign_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    type text NOT NULL,
    template_name text,
    pdf_template_name text,
    pdf_filename_pattern text,
    shared_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    processed integer DEFAULT 0 NOT NULL,
    sent integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    results jsonb DEFAULT '[]'::jsonb NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    program_id uuid,
    CONSTRAINT campaign_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT campaign_jobs_type_check CHECK ((type = ANY (ARRAY['email'::text, 'email_pdf'::text, 'pdf'::text])))
);

-- COMMENT public COLUMN campaign_jobs.program_id
COMMENT ON COLUMN public.campaign_jobs.program_id IS 'automation_programs.id that originated this job, when sent through /notify from an automation program. Null for ad-hoc /notify calls.';

-- TABLE public communication_templates
CREATE TABLE public.communication_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    channel text DEFAULT 'email'::text NOT NULL,
    subject text,
    html_content text NOT NULL,
    variables jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    has_attachment boolean DEFAULT false,
    attachment_variable text,
    has_logo boolean DEFAULT false,
    logo_variable text,
    has_qr boolean DEFAULT false,
    qr_variable text,
    qr_position text DEFAULT 'bottom'::text,
    template_type text DEFAULT 'email'::text,
    pdf_template_id uuid,
    generates_pdf boolean DEFAULT false,
    pdf_filename_pattern text,
    CONSTRAINT communication_templates_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'push'::text, 'whatsapp'::text]))),
    CONSTRAINT communication_templates_template_type_check CHECK ((template_type = ANY (ARRAY['email'::text, 'pdf'::text, 'whatsapp'::text])))
);

-- COMMENT public COLUMN communication_templates.template_type
COMMENT ON COLUMN public.communication_templates.template_type IS 'Tipo de template: "email" para emails HTML, "pdf" para generar PDFs que se adjuntan a emails.';

-- COMMENT public COLUMN communication_templates.pdf_template_id
COMMENT ON COLUMN public.communication_templates.pdf_template_id IS 'ID del template de PDF que debe generarse y adjuntarse al email. El template referenciado debe ser de tipo "pdf".';

-- COMMENT public COLUMN communication_templates.generates_pdf
COMMENT ON COLUMN public.communication_templates.generates_pdf IS 'Si true, este template se usa para generar PDFs que se adjuntan a otros emails.';

-- COMMENT public COLUMN communication_templates.pdf_filename_pattern
COMMENT ON COLUMN public.communication_templates.pdf_filename_pattern IS 'Patrón para el nombre del archivo PDF. Soporta variables como: "invoice_{{invoice_number}}.pdf"';

-- TABLE public email_credentials
CREATE TABLE public.email_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    smtp_host text,
    smtp_port integer DEFAULT 587,
    smtp_user text,
    smtp_password text,
    from_email text NOT NULL,
    from_name text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    provider_type text DEFAULT 'smtp'::text,
    resend_api_key text,
    CONSTRAINT email_credentials_provider_type_check CHECK ((provider_type = ANY (ARRAY['smtp'::text, 'resend'::text])))
);

-- COMMENT public COLUMN email_credentials.provider_type
COMMENT ON COLUMN public.email_credentials.provider_type IS 'Email provider: smtp or resend';

-- COMMENT public COLUMN email_credentials.resend_api_key
COMMENT ON COLUMN public.email_credentials.resend_api_key IS 'API key for Resend service (only needed when provider_type is resend)';

-- TABLE public email_logs
CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    template_id uuid,
    recipient_email text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    communication_type text DEFAULT 'email'::text,
    pdf_generated boolean DEFAULT false,
    pdf_attachment_size integer,
    parent_log_id uuid,
    resend_email_id text,
    delivery_status text,
    bounce_type text,
    bounce_reason text,
    delivered_at timestamp with time zone,
    bounced_at timestamp with time zone,
    complained_at timestamp with time zone,
    program_id uuid,
    CONSTRAINT email_logs_bounce_type_check CHECK ((bounce_type = ANY (ARRAY['hard'::text, 'soft'::text, 'spam'::text]))),
    CONSTRAINT email_logs_communication_type_check CHECK ((communication_type = ANY (ARRAY['email'::text, 'pdf'::text, 'email_with_pdf'::text, 'pdf_generation'::text]))),
    CONSTRAINT email_logs_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['sent'::text, 'delivered'::text, 'delivery_delayed'::text, 'bounced'::text, 'complained'::text])))
);

ALTER TABLE ONLY public.email_logs REPLICA IDENTITY FULL;

-- COMMENT public COLUMN email_logs.parent_log_id
COMMENT ON COLUMN public.email_logs.parent_log_id IS 'ID del log padre para crear jerarquía de transacciones relacionadas';

-- COMMENT public COLUMN email_logs.program_id
COMMENT ON COLUMN public.email_logs.program_id IS 'automation_programs.id that originated this email, when sent through the automation program chain. Null for ad-hoc sends.';

-- TABLE public email_provider_audit
CREATE TABLE public.email_provider_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider_type text NOT NULL,
    action text NOT NULL,
    config_snapshot jsonb DEFAULT '{}'::jsonb,
    success boolean DEFAULT true,
    error_message text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_provider_audit_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'deleted'::text, 'tested'::text]))),
    CONSTRAINT email_provider_audit_provider_type_check CHECK ((provider_type = ANY (ARRAY['smtp'::text, 'resend'::text])))
);

-- TABLE public embed_credentials
CREATE TABLE public.embed_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    app_id uuid,
    username text NOT NULL,
    password_hash text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- TABLE public license_audit
CREATE TABLE public.license_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_license_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    previous_status text,
    new_status text,
    previous_plan_id uuid,
    new_plan_id uuid,
    reason text,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT license_audit_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'suspended'::text, 'activated'::text, 'expired'::text, 'renewed'::text])))
);

-- TABLE public license_plans
CREATE TABLE public.license_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    max_applications integer DEFAULT 1 NOT NULL,
    max_templates_per_app integer DEFAULT 10 NOT NULL,
    max_emails_per_month integer DEFAULT 1000 NOT NULL,
    max_emails_per_day integer DEFAULT 50 NOT NULL,
    max_pdfs_per_month integer DEFAULT 100 NOT NULL,
    can_use_smtp boolean DEFAULT true,
    can_use_resend boolean DEFAULT false,
    can_use_webhooks boolean DEFAULT false,
    can_use_custom_variables boolean DEFAULT true,
    max_users_per_org integer DEFAULT 1,
    price_monthly numeric(10,2) DEFAULT 0,
    price_yearly numeric(10,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    features_json jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- TABLE public menu_permissions
CREATE TABLE public.menu_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_id uuid NOT NULL,
    role_id uuid NOT NULL,
    can_create boolean DEFAULT false,
    can_read boolean DEFAULT false,
    can_update boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- TABLE public menus
CREATE TABLE public.menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text,
    icon text DEFAULT ''::text,
    "order" integer DEFAULT 0,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- TABLE public monthly_email_usage
CREATE TABLE public.monthly_email_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    emails_sent integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT monthly_email_usage_month_check CHECK (((month >= 1) AND (month <= 12)))
);

-- TABLE public pdf_generation_locks
CREATE TABLE public.pdf_generation_locks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id text NOT NULL,
    application_id uuid NOT NULL,
    locked_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '00:05:00'::interval),
    created_at timestamp with time zone DEFAULT now()
);

-- TABLE public pdf_generation_logs
CREATE TABLE public.pdf_generation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    pdf_template_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    pdf_base64 text NOT NULL,
    filename text NOT NULL,
    size_bytes integer NOT NULL,
    external_reference_id text,
    created_at timestamp with time zone DEFAULT now(),
    email_log_id uuid,
    public_url text
);

-- TABLE public pending_communications
CREATE TABLE public.pending_communications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    template_name text NOT NULL,
    recipient_email text NOT NULL,
    base_data jsonb DEFAULT '{}'::jsonb,
    pending_fields jsonb DEFAULT '[]'::jsonb,
    external_reference_id text NOT NULL,
    external_system text NOT NULL,
    status text DEFAULT 'waiting_data'::text NOT NULL,
    webhook_url text,
    expires_at timestamp with time zone,
    completed_data jsonb DEFAULT '{}'::jsonb,
    sent_log_id uuid,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    sent_at timestamp with time zone,
    communication_type text DEFAULT 'email'::text,
    pdf_generated boolean DEFAULT false,
    pdf_template_id uuid,
    order_id text,
    parent_log_id uuid,
    bounce_count integer DEFAULT 0,
    last_bounce_reason text,
    CONSTRAINT pending_communications_communication_type_check CHECK ((communication_type = ANY (ARRAY['email'::text, 'pdf'::text, 'email_with_pdf'::text, 'pdf_generation'::text]))),
    CONSTRAINT pending_communications_status_check CHECK ((status = ANY (ARRAY['waiting_data'::text, 'data_received'::text, 'pdf_generated'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])))
);

-- TABLE public predefined_variables
CREATE TABLE public.predefined_variables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    example text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- TABLE public public_pdf_links
CREATE TABLE public.public_pdf_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    pdf_generation_log_id uuid NOT NULL,
    order_id text,
    access_token text NOT NULL,
    filename text NOT NULL,
    expires_at timestamp with time zone,
    view_count integer DEFAULT 0 NOT NULL,
    last_viewed_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- TABLE public roles
CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- TABLE public tenant_dedicated_api_servers
CREATE TABLE public.tenant_dedicated_api_servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_key text NOT NULL,
    tenant_id text,
    subscription_id text,
    scope_key text NOT NULL,
    tenant_name text NOT NULL,
    subdomain text NOT NULL,
    base_url text NOT NULL,
    public_hostname text NOT NULL,
    status text DEFAULT 'provisioned'::text NOT NULL,
    project jsonb DEFAULT '{}'::jsonb NOT NULL,
    deployment jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_dedicated_api_servers_base_url_not_blank CHECK ((btrim(base_url) <> ''::text)),
    CONSTRAINT tenant_dedicated_api_servers_public_hostname_not_blank CHECK ((btrim(public_hostname) <> ''::text)),
    CONSTRAINT tenant_dedicated_api_servers_scope_key_not_blank CHECK ((btrim(scope_key) <> ''::text)),
    CONSTRAINT tenant_dedicated_api_servers_status_not_blank CHECK ((btrim(status) <> ''::text)),
    CONSTRAINT tenant_dedicated_api_servers_subdomain_not_blank CHECK ((btrim(subdomain) <> ''::text)),
    CONSTRAINT tenant_dedicated_api_servers_tenant_key_not_blank CHECK ((btrim(tenant_key) <> ''::text)),
    CONSTRAINT tenant_dedicated_api_servers_tenant_name_not_blank CHECK ((btrim(tenant_name) <> ''::text))
);

-- COMMENT public TABLE tenant_dedicated_api_servers
COMMENT ON TABLE public.tenant_dedicated_api_servers IS 'Central registry for tenant dedicated API servers. One row per tenant_key, used to reuse the same dedicated base URL across devices.';

-- COMMENT public COLUMN tenant_dedicated_api_servers.tenant_key
COMMENT ON COLUMN public.tenant_dedicated_api_servers.tenant_key IS 'Stable lookup key derived from tenant_id, subscription_id, or the current tenant scope.';

-- COMMENT public COLUMN tenant_dedicated_api_servers.scope_key
COMMENT ON COLUMN public.tenant_dedicated_api_servers.scope_key IS 'Current tenant scope used by the client cache and as a fallback lookup.';

-- TABLE public tenant_settings
CREATE TABLE public.tenant_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    subscription_return_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- TABLE public tenant_webchat_conversations
CREATE TABLE public.tenant_webchat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_key text NOT NULL,
    tenant_id text,
    subscription_id text,
    scope_key text NOT NULL,
    session_id text NOT NULL,
    conversation_id text NOT NULL,
    source_domain text NOT NULL,
    page_url text,
    visitor_name text,
    visitor_email text,
    visitor_phone text,
    status text DEFAULT 'open'::text NOT NULL,
    assigned_user_id text,
    assigned_user_name text,
    assigned_at timestamp with time zone,
    closed_at timestamp with time zone,
    last_message_at timestamp with time zone,
    last_user_message text,
    last_ai_reply text,
    handoff_requested boolean DEFAULT false NOT NULL,
    handoff_reason text,
    cause text,
    cause_custom text,
    result text,
    result_notes text,
    source_channel text,
    source_detail text,
    client_id text,
    opportunity_id text,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    queued_messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_webchat_conversations_conversation_id_not_blank CHECK ((btrim(conversation_id) <> ''::text)),
    CONSTRAINT tenant_webchat_conversations_scope_key_not_blank CHECK ((btrim(scope_key) <> ''::text)),
    CONSTRAINT tenant_webchat_conversations_session_id_not_blank CHECK ((btrim(session_id) <> ''::text)),
    CONSTRAINT tenant_webchat_conversations_source_domain_not_blank CHECK ((btrim(source_domain) <> ''::text)),
    CONSTRAINT tenant_webchat_conversations_status_not_blank CHECK ((btrim(status) <> ''::text)),
    CONSTRAINT tenant_webchat_conversations_tenant_key_not_blank CHECK ((btrim(tenant_key) <> ''::text))
);

-- COMMENT public TABLE tenant_webchat_conversations
COMMENT ON TABLE public.tenant_webchat_conversations IS 'Central registry for tenant webchat conversations, AI replies, and CRM handoff state.';

-- COMMENT public COLUMN tenant_webchat_conversations.tenant_key
COMMENT ON COLUMN public.tenant_webchat_conversations.tenant_key IS 'Stable lookup key derived from tenant_id, subscription_id, or the current tenant scope.';

-- COMMENT public COLUMN tenant_webchat_conversations.scope_key
COMMENT ON COLUMN public.tenant_webchat_conversations.scope_key IS 'Current tenant scope used by the CRM and as a fallback lookup.';

-- TABLE public tenant_webchat_widget_configs
CREATE TABLE public.tenant_webchat_widget_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_key text NOT NULL,
    tenant_id text,
    subscription_id text,
    scope_key text NOT NULL,
    tenant_name text NOT NULL,
    subdomain text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    ai_enabled boolean DEFAULT true NOT NULL,
    handoff_enabled boolean DEFAULT true NOT NULL,
    crm_url text,
    support_email text,
    widget_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_webchat_widget_configs_scope_key_not_blank CHECK ((btrim(scope_key) <> ''::text)),
    CONSTRAINT tenant_webchat_widget_configs_status_not_blank CHECK ((btrim(status) <> ''::text)),
    CONSTRAINT tenant_webchat_widget_configs_subdomain_not_blank CHECK ((btrim(subdomain) <> ''::text)),
    CONSTRAINT tenant_webchat_widget_configs_tenant_key_not_blank CHECK ((btrim(tenant_key) <> ''::text)),
    CONSTRAINT tenant_webchat_widget_configs_tenant_name_not_blank CHECK ((btrim(tenant_name) <> ''::text))
);

-- COMMENT public TABLE tenant_webchat_widget_configs
COMMENT ON TABLE public.tenant_webchat_widget_configs IS 'Central registry for tenant webchat widget configuration and CRM handoff settings.';

-- COMMENT public COLUMN tenant_webchat_widget_configs.tenant_key
COMMENT ON COLUMN public.tenant_webchat_widget_configs.tenant_key IS 'Stable lookup key derived from tenant_id, subscription_id, or the current tenant scope.';

-- COMMENT public COLUMN tenant_webchat_widget_configs.scope_key
COMMENT ON COLUMN public.tenant_webchat_widget_configs.scope_key IS 'Current tenant scope used by the CRM and as a fallback lookup.';

-- TABLE public usage_audit
CREATE TABLE public.usage_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    user_id uuid NOT NULL,
    resource_type text NOT NULL,
    action text NOT NULL,
    resource_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    cost_units integer DEFAULT 1,
    success boolean DEFAULT true,
    error_code text,
    processing_time_ms integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT usage_audit_resource_type_check CHECK ((resource_type = ANY (ARRAY['email'::text, 'pdf'::text, 'template'::text, 'api_call'::text, 'webhook'::text])))
);

-- TABLE public user_licenses
CREATE TABLE public.user_licenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    license_plan_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    billing_cycle text DEFAULT 'monthly'::text,
    auto_renew boolean DEFAULT false,
    custom_limits jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_licenses_billing_cycle_check CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text, 'lifetime'::text]))),
    CONSTRAINT user_licenses_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'expired'::text, 'cancelled'::text])))
);

-- TABLE public user_preferences
CREATE TABLE public.user_preferences (
    user_id uuid NOT NULL,
    default_application_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id text
);

-- TABLE public web_access_attempts
CREATE TABLE public.web_access_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id text NOT NULL,
    event_type text NOT NULL,
    status text GENERATED ALWAYS AS (event_type) STORED,
    email text,
    path text,
    referrer text,
    error_message text,
    user_agent text,
    ip_address text,
    country_code text,
    country_name text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT web_access_attempts_attempt_id_check CHECK ((btrim(attempt_id) <> ''::text)),
    CONSTRAINT web_access_attempts_event_type_check CHECK ((btrim(event_type) <> ''::text))
);

-- COMMENT public TABLE web_access_attempts
COMMENT ON TABLE public.web_access_attempts IS 'Consolidated access analytics table: one row per attempt, updated by attempt_id.';

-- COMMENT public COLUMN web_access_attempts.attempt_id
COMMENT ON COLUMN public.web_access_attempts.attempt_id IS 'Stable attempt identifier generated on the client.';

-- COMMENT public COLUMN web_access_attempts.event_type
COMMENT ON COLUMN public.web_access_attempts.event_type IS 'Latest attempt state, usually login_started, login_success or login_failed.';

-- COMMENT public COLUMN web_access_attempts.status
COMMENT ON COLUMN public.web_access_attempts.status IS 'Generated mirror of event_type for dashboard compatibility.';

-- TABLE public whatsapp_configs
CREATE TABLE public.whatsapp_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    phone_number_id text NOT NULL,
    waba_id text DEFAULT ''::text NOT NULL,
    access_token text NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- TABLE public whatsapp_logs
CREATE TABLE public.whatsapp_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    whatsapp_template_id uuid,
    wamid text,
    recipient_phone text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    error_code text,
    error_message text,
    template_variables jsonb DEFAULT '{}'::jsonb,
    external_reference_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_logs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text])))
);

-- TABLE public whatsapp_templates
CREATE TABLE public.whatsapp_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    template_id uuid,
    meta_template_name text NOT NULL,
    meta_template_id text,
    language_code text DEFAULT 'es'::text NOT NULL,
    category text DEFAULT 'UTILITY'::text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    components jsonb DEFAULT '[]'::jsonb NOT NULL,
    rejection_reason text,
    submitted_at timestamp with time zone,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_templates_category_check CHECK ((category = ANY (ARRAY['UTILITY'::text, 'MARKETING'::text, 'AUTHENTICATION'::text]))),
    CONSTRAINT whatsapp_templates_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'PAUSED'::text])))
);

-- CONSTRAINT public application_limits application_limits_application_id_key
ALTER TABLE ONLY public.application_limits
    ADD CONSTRAINT application_limits_application_id_key UNIQUE (application_id);

-- CONSTRAINT public application_limits application_limits_pkey
ALTER TABLE ONLY public.application_limits
    ADD CONSTRAINT application_limits_pkey PRIMARY KEY (id);

-- CONSTRAINT public applications applications_api_key_key
ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_api_key_key UNIQUE (api_key);

-- CONSTRAINT public applications applications_app_id_key
ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_app_id_key UNIQUE (app_id);

-- CONSTRAINT public applications applications_pkey
ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);

-- CONSTRAINT public automation_program_queue_items automation_program_queue_item_application_id_program_id_ext_key
ALTER TABLE ONLY public.automation_program_queue_items
    ADD CONSTRAINT automation_program_queue_item_application_id_program_id_ext_key UNIQUE (application_id, program_id, external_reference_id);

-- CONSTRAINT public automation_program_queue_items automation_program_queue_items_pkey
ALTER TABLE ONLY public.automation_program_queue_items
    ADD CONSTRAINT automation_program_queue_items_pkey PRIMARY KEY (id);

-- CONSTRAINT public automation_programs automation_programs_pkey
ALTER TABLE ONLY public.automation_programs
    ADD CONSTRAINT automation_programs_pkey PRIMARY KEY (id);

-- CONSTRAINT public campaign_jobs campaign_jobs_pkey
ALTER TABLE ONLY public.campaign_jobs
    ADD CONSTRAINT campaign_jobs_pkey PRIMARY KEY (id);

-- CONSTRAINT public communication_templates communication_templates_pkey
ALTER TABLE ONLY public.communication_templates
    ADD CONSTRAINT communication_templates_pkey PRIMARY KEY (id);

-- CONSTRAINT public email_credentials email_credentials_pkey
ALTER TABLE ONLY public.email_credentials
    ADD CONSTRAINT email_credentials_pkey PRIMARY KEY (id);

-- CONSTRAINT public email_logs email_logs_pkey
ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);

-- CONSTRAINT public email_provider_audit email_provider_audit_pkey
ALTER TABLE ONLY public.email_provider_audit
    ADD CONSTRAINT email_provider_audit_pkey PRIMARY KEY (id);

-- CONSTRAINT public embed_credentials embed_credentials_pkey
ALTER TABLE ONLY public.embed_credentials
    ADD CONSTRAINT embed_credentials_pkey PRIMARY KEY (id);

-- CONSTRAINT public embed_credentials embed_credentials_user_id_username_key
ALTER TABLE ONLY public.embed_credentials
    ADD CONSTRAINT embed_credentials_user_id_username_key UNIQUE (user_id, username);

-- CONSTRAINT public license_audit license_audit_pkey
ALTER TABLE ONLY public.license_audit
    ADD CONSTRAINT license_audit_pkey PRIMARY KEY (id);

-- CONSTRAINT public license_plans license_plans_code_key
ALTER TABLE ONLY public.license_plans
    ADD CONSTRAINT license_plans_code_key UNIQUE (code);

-- CONSTRAINT public license_plans license_plans_pkey
ALTER TABLE ONLY public.license_plans
    ADD CONSTRAINT license_plans_pkey PRIMARY KEY (id);

-- CONSTRAINT public menu_permissions menu_permissions_menu_id_role_id_key
ALTER TABLE ONLY public.menu_permissions
    ADD CONSTRAINT menu_permissions_menu_id_role_id_key UNIQUE (menu_id, role_id);

-- CONSTRAINT public menu_permissions menu_permissions_pkey
ALTER TABLE ONLY public.menu_permissions
    ADD CONSTRAINT menu_permissions_pkey PRIMARY KEY (id);

-- CONSTRAINT public menus menus_pkey
ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_pkey PRIMARY KEY (id);

-- CONSTRAINT public menus menus_user_id_slug_key
ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_user_id_slug_key UNIQUE (user_id, slug);

-- CONSTRAINT public monthly_email_usage monthly_email_usage_pkey
ALTER TABLE ONLY public.monthly_email_usage
    ADD CONSTRAINT monthly_email_usage_pkey PRIMARY KEY (id);

-- CONSTRAINT public monthly_email_usage monthly_email_usage_user_id_year_month_key
ALTER TABLE ONLY public.monthly_email_usage
    ADD CONSTRAINT monthly_email_usage_user_id_year_month_key UNIQUE (user_id, year, month);

-- CONSTRAINT public pdf_generation_locks pdf_generation_locks_order_id_key
ALTER TABLE ONLY public.pdf_generation_locks
    ADD CONSTRAINT pdf_generation_locks_order_id_key UNIQUE (order_id);

-- CONSTRAINT public pdf_generation_locks pdf_generation_locks_pkey
ALTER TABLE ONLY public.pdf_generation_locks
    ADD CONSTRAINT pdf_generation_locks_pkey PRIMARY KEY (id);

-- CONSTRAINT public pdf_generation_logs pdf_generation_logs_pkey
ALTER TABLE ONLY public.pdf_generation_logs
    ADD CONSTRAINT pdf_generation_logs_pkey PRIMARY KEY (id);

-- CONSTRAINT public pending_communications pending_communications_external_reference_id_key
ALTER TABLE ONLY public.pending_communications
    ADD CONSTRAINT pending_communications_external_reference_id_key UNIQUE (external_reference_id);

-- CONSTRAINT public pending_communications pending_communications_pkey
ALTER TABLE ONLY public.pending_communications
    ADD CONSTRAINT pending_communications_pkey PRIMARY KEY (id);

-- CONSTRAINT public predefined_variables predefined_variables_application_id_name_key
ALTER TABLE ONLY public.predefined_variables
    ADD CONSTRAINT predefined_variables_application_id_name_key UNIQUE (application_id, name);

-- CONSTRAINT public predefined_variables predefined_variables_pkey
ALTER TABLE ONLY public.predefined_variables
    ADD CONSTRAINT predefined_variables_pkey PRIMARY KEY (id);

-- CONSTRAINT public public_pdf_links public_pdf_links_access_token_key
ALTER TABLE ONLY public.public_pdf_links
    ADD CONSTRAINT public_pdf_links_access_token_key UNIQUE (access_token);

-- CONSTRAINT public public_pdf_links public_pdf_links_pkey
ALTER TABLE ONLY public.public_pdf_links
    ADD CONSTRAINT public_pdf_links_pkey PRIMARY KEY (id);

-- CONSTRAINT public roles roles_pkey
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

-- CONSTRAINT public roles roles_user_id_slug_key
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_user_id_slug_key UNIQUE (user_id, slug);

-- CONSTRAINT public tenant_dedicated_api_servers tenant_dedicated_api_servers_pkey
ALTER TABLE ONLY public.tenant_dedicated_api_servers
    ADD CONSTRAINT tenant_dedicated_api_servers_pkey PRIMARY KEY (id);

-- CONSTRAINT public tenant_dedicated_api_servers tenant_dedicated_api_servers_tenant_key_key
ALTER TABLE ONLY public.tenant_dedicated_api_servers
    ADD CONSTRAINT tenant_dedicated_api_servers_tenant_key_key UNIQUE (tenant_key);

-- CONSTRAINT public tenant_settings tenant_settings_pkey
ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);

-- CONSTRAINT public tenant_settings tenant_settings_tenant_id_key
ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_key UNIQUE (tenant_id);

-- CONSTRAINT public tenant_webchat_conversations tenant_webchat_conversations_conversation_id_key
ALTER TABLE ONLY public.tenant_webchat_conversations
    ADD CONSTRAINT tenant_webchat_conversations_conversation_id_key UNIQUE (conversation_id);

-- CONSTRAINT public tenant_webchat_conversations tenant_webchat_conversations_pkey
ALTER TABLE ONLY public.tenant_webchat_conversations
    ADD CONSTRAINT tenant_webchat_conversations_pkey PRIMARY KEY (id);

-- CONSTRAINT public tenant_webchat_widget_configs tenant_webchat_widget_configs_pkey
ALTER TABLE ONLY public.tenant_webchat_widget_configs
    ADD CONSTRAINT tenant_webchat_widget_configs_pkey PRIMARY KEY (id);

-- CONSTRAINT public tenant_webchat_widget_configs tenant_webchat_widget_configs_tenant_key_key
ALTER TABLE ONLY public.tenant_webchat_widget_configs
    ADD CONSTRAINT tenant_webchat_widget_configs_tenant_key_key UNIQUE (tenant_key);

-- CONSTRAINT public usage_audit usage_audit_pkey
ALTER TABLE ONLY public.usage_audit
    ADD CONSTRAINT usage_audit_pkey PRIMARY KEY (id);

-- CONSTRAINT public user_licenses user_licenses_pkey
ALTER TABLE ONLY public.user_licenses
    ADD CONSTRAINT user_licenses_pkey PRIMARY KEY (id);

-- CONSTRAINT public user_preferences user_preferences_pkey
ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id);

-- CONSTRAINT public web_access_attempts web_access_attempts_attempt_id_key
ALTER TABLE ONLY public.web_access_attempts
    ADD CONSTRAINT web_access_attempts_attempt_id_key UNIQUE (attempt_id);

-- CONSTRAINT public web_access_attempts web_access_attempts_pkey
ALTER TABLE ONLY public.web_access_attempts
    ADD CONSTRAINT web_access_attempts_pkey PRIMARY KEY (id);

-- CONSTRAINT public whatsapp_configs whatsapp_configs_application_id_key
ALTER TABLE ONLY public.whatsapp_configs
    ADD CONSTRAINT whatsapp_configs_application_id_key UNIQUE (application_id);

-- CONSTRAINT public whatsapp_configs whatsapp_configs_pkey
ALTER TABLE ONLY public.whatsapp_configs
    ADD CONSTRAINT whatsapp_configs_pkey PRIMARY KEY (id);

-- CONSTRAINT public whatsapp_logs whatsapp_logs_pkey
ALTER TABLE ONLY public.whatsapp_logs
    ADD CONSTRAINT whatsapp_logs_pkey PRIMARY KEY (id);

-- CONSTRAINT public whatsapp_templates whatsapp_templates_pkey
ALTER TABLE ONLY public.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id);

-- INDEX public automation_program_queue_items_application_id_idx
CREATE INDEX automation_program_queue_items_application_id_idx ON public.automation_program_queue_items USING btree (application_id);

-- INDEX public automation_program_queue_items_available_at_idx
CREATE INDEX automation_program_queue_items_available_at_idx ON public.automation_program_queue_items USING btree (available_at);

-- INDEX public automation_program_queue_items_external_reference_id_idx
CREATE INDEX automation_program_queue_items_external_reference_id_idx ON public.automation_program_queue_items USING btree (external_reference_id);

-- INDEX public automation_program_queue_items_program_id_idx
CREATE INDEX automation_program_queue_items_program_id_idx ON public.automation_program_queue_items USING btree (program_id);

-- INDEX public automation_program_queue_items_program_status_idx
CREATE INDEX automation_program_queue_items_program_status_idx ON public.automation_program_queue_items USING btree (program_id, status, available_at);

-- INDEX public automation_program_queue_items_status_idx
CREATE INDEX automation_program_queue_items_status_idx ON public.automation_program_queue_items USING btree (status);

-- INDEX public automation_programs_application_id_idx
CREATE INDEX automation_programs_application_id_idx ON public.automation_programs USING btree (application_id);

-- INDEX public automation_programs_created_at_idx
CREATE INDEX automation_programs_created_at_idx ON public.automation_programs USING btree (created_at DESC);

-- INDEX public automation_programs_kind_idx
CREATE INDEX automation_programs_kind_idx ON public.automation_programs USING btree (kind);

-- INDEX public automation_programs_next_run_at_idx
CREATE INDEX automation_programs_next_run_at_idx ON public.automation_programs USING btree (next_run_at);

-- INDEX public automation_programs_status_idx
CREATE INDEX automation_programs_status_idx ON public.automation_programs USING btree (status);

-- INDEX public campaign_jobs_application_id_idx
CREATE INDEX campaign_jobs_application_id_idx ON public.campaign_jobs USING btree (application_id);

-- INDEX public campaign_jobs_created_at_idx
CREATE INDEX campaign_jobs_created_at_idx ON public.campaign_jobs USING btree (created_at DESC);

-- INDEX public campaign_jobs_status_idx
CREATE INDEX campaign_jobs_status_idx ON public.campaign_jobs USING btree (status);

-- INDEX public idx_application_limits_app
CREATE INDEX idx_application_limits_app ON public.application_limits USING btree (application_id);

-- INDEX public idx_application_limits_user
CREATE INDEX idx_application_limits_user ON public.application_limits USING btree (user_id);

-- INDEX public idx_applications_app_id
CREATE INDEX idx_applications_app_id ON public.applications USING btree (app_id);

-- INDEX public idx_applications_tenant_id
CREATE INDEX idx_applications_tenant_id ON public.applications USING btree (tenant_id);

-- INDEX public idx_applications_user_id
CREATE INDEX idx_applications_user_id ON public.applications USING btree (user_id);

-- INDEX public idx_campaign_jobs_program_id
CREATE INDEX idx_campaign_jobs_program_id ON public.campaign_jobs USING btree (program_id);

-- INDEX public idx_communication_templates_application_id
CREATE INDEX idx_communication_templates_application_id ON public.communication_templates USING btree (application_id);

-- INDEX public idx_communication_templates_pdf_template
CREATE INDEX idx_communication_templates_pdf_template ON public.communication_templates USING btree (pdf_template_id) WHERE (pdf_template_id IS NOT NULL);

-- INDEX public idx_email_credentials_active
CREATE INDEX idx_email_credentials_active ON public.email_credentials USING btree (application_id, is_active) WHERE (is_active = true);

-- INDEX public idx_email_credentials_application_id
CREATE INDEX idx_email_credentials_application_id ON public.email_credentials USING btree (application_id);

-- INDEX public idx_email_logs_application_id
CREATE INDEX idx_email_logs_application_id ON public.email_logs USING btree (application_id);

-- INDEX public idx_email_logs_communication_type
CREATE INDEX idx_email_logs_communication_type ON public.email_logs USING btree (communication_type);

-- INDEX public idx_email_logs_created_at
CREATE INDEX idx_email_logs_created_at ON public.email_logs USING btree (created_at DESC);

-- INDEX public idx_email_logs_delivery_status
CREATE INDEX idx_email_logs_delivery_status ON public.email_logs USING btree (delivery_status) WHERE (delivery_status IS NOT NULL);

-- INDEX public idx_email_logs_parent_log_id
CREATE INDEX idx_email_logs_parent_log_id ON public.email_logs USING btree (parent_log_id);

-- INDEX public idx_email_logs_pdf_generated
CREATE INDEX idx_email_logs_pdf_generated ON public.email_logs USING btree (pdf_generated) WHERE (pdf_generated = true);

-- INDEX public idx_email_logs_program_id
CREATE INDEX idx_email_logs_program_id ON public.email_logs USING btree (program_id);

-- INDEX public idx_email_logs_recipient
CREATE INDEX idx_email_logs_recipient ON public.email_logs USING btree (recipient_email);

-- INDEX public idx_email_logs_resend_email_id
CREATE INDEX idx_email_logs_resend_email_id ON public.email_logs USING btree (resend_email_id) WHERE (resend_email_id IS NOT NULL);

-- INDEX public idx_email_logs_status
CREATE INDEX idx_email_logs_status ON public.email_logs USING btree (status);

-- INDEX public idx_email_logs_template_id
CREATE INDEX idx_email_logs_template_id ON public.email_logs USING btree (template_id);

-- INDEX public idx_email_provider_audit_app
CREATE INDEX idx_email_provider_audit_app ON public.email_provider_audit USING btree (application_id);

-- INDEX public idx_email_provider_audit_created
CREATE INDEX idx_email_provider_audit_created ON public.email_provider_audit USING btree (created_at DESC);

-- INDEX public idx_email_provider_audit_user
CREATE INDEX idx_email_provider_audit_user ON public.email_provider_audit USING btree (user_id);

-- INDEX public idx_embed_credentials_user_id
CREATE INDEX idx_embed_credentials_user_id ON public.embed_credentials USING btree (user_id);

-- INDEX public idx_embed_credentials_username
CREATE INDEX idx_embed_credentials_username ON public.embed_credentials USING btree (username);

-- INDEX public idx_license_audit_created
CREATE INDEX idx_license_audit_created ON public.license_audit USING btree (created_at DESC);

-- INDEX public idx_license_audit_license
CREATE INDEX idx_license_audit_license ON public.license_audit USING btree (user_license_id);

-- INDEX public idx_license_audit_user
CREATE INDEX idx_license_audit_user ON public.license_audit USING btree (user_id);

-- INDEX public idx_license_plans_active
CREATE INDEX idx_license_plans_active ON public.license_plans USING btree (is_active);

-- INDEX public idx_license_plans_code
CREATE INDEX idx_license_plans_code ON public.license_plans USING btree (code);

-- INDEX public idx_menu_permissions_menu_id
CREATE INDEX idx_menu_permissions_menu_id ON public.menu_permissions USING btree (menu_id);

-- INDEX public idx_menu_permissions_role_id
CREATE INDEX idx_menu_permissions_role_id ON public.menu_permissions USING btree (role_id);

-- INDEX public idx_menu_permissions_user_id
CREATE INDEX idx_menu_permissions_user_id ON public.menu_permissions USING btree (user_id);

-- INDEX public idx_menus_order
CREATE INDEX idx_menus_order ON public.menus USING btree ("order");

-- INDEX public idx_menus_user_id
CREATE INDEX idx_menus_user_id ON public.menus USING btree (user_id);

-- INDEX public idx_monthly_email_usage_user_period
CREATE INDEX idx_monthly_email_usage_user_period ON public.monthly_email_usage USING btree (user_id, year, month);

-- INDEX public idx_pdf_generation_logs_application
CREATE INDEX idx_pdf_generation_logs_application ON public.pdf_generation_logs USING btree (application_id);

-- INDEX public idx_pdf_generation_logs_application_id
CREATE INDEX idx_pdf_generation_logs_application_id ON public.pdf_generation_logs USING btree (application_id);

-- INDEX public idx_pdf_generation_logs_email_log_id
CREATE INDEX idx_pdf_generation_logs_email_log_id ON public.pdf_generation_logs USING btree (email_log_id);

-- INDEX public idx_pdf_generation_logs_external_ref
CREATE INDEX idx_pdf_generation_logs_external_ref ON public.pdf_generation_logs USING btree (external_reference_id) WHERE (external_reference_id IS NOT NULL);

-- INDEX public idx_pdf_generation_logs_template
CREATE INDEX idx_pdf_generation_logs_template ON public.pdf_generation_logs USING btree (pdf_template_id);

-- INDEX public idx_pdf_locks_expires
CREATE INDEX idx_pdf_locks_expires ON public.pdf_generation_locks USING btree (expires_at);

-- INDEX public idx_pdf_locks_order_id
CREATE INDEX idx_pdf_locks_order_id ON public.pdf_generation_locks USING btree (order_id);

-- INDEX public idx_pending_communications_app_order
CREATE INDEX idx_pending_communications_app_order ON public.pending_communications USING btree (application_id, order_id) WHERE (order_id IS NOT NULL);

-- INDEX public idx_pending_communications_application
CREATE INDEX idx_pending_communications_application ON public.pending_communications USING btree (application_id);

-- INDEX public idx_pending_communications_application_id
CREATE INDEX idx_pending_communications_application_id ON public.pending_communications USING btree (application_id);

-- INDEX public idx_pending_communications_communication_type
CREATE INDEX idx_pending_communications_communication_type ON public.pending_communications USING btree (communication_type);

-- INDEX public idx_pending_communications_expires
CREATE INDEX idx_pending_communications_expires ON public.pending_communications USING btree (expires_at) WHERE (expires_at IS NOT NULL);

-- INDEX public idx_pending_communications_external_ref
CREATE INDEX idx_pending_communications_external_ref ON public.pending_communications USING btree (external_reference_id);

-- INDEX public idx_pending_communications_order_id
CREATE INDEX idx_pending_communications_order_id ON public.pending_communications USING btree (order_id) WHERE (order_id IS NOT NULL);

-- INDEX public idx_pending_communications_pdf_generated
CREATE INDEX idx_pending_communications_pdf_generated ON public.pending_communications USING btree (pdf_generated) WHERE (pdf_generated = true);

-- INDEX public idx_pending_communications_status
CREATE INDEX idx_pending_communications_status ON public.pending_communications USING btree (status);

-- INDEX public idx_predefined_variables_application_id
CREATE INDEX idx_predefined_variables_application_id ON public.predefined_variables USING btree (application_id);

-- INDEX public idx_public_pdf_links_access_token
CREATE INDEX idx_public_pdf_links_access_token ON public.public_pdf_links USING btree (access_token) WHERE (is_active = true);

-- INDEX public idx_public_pdf_links_order_id
CREATE INDEX idx_public_pdf_links_order_id ON public.public_pdf_links USING btree (order_id) WHERE (order_id IS NOT NULL);

-- INDEX public idx_public_pdf_links_pdf_log
CREATE INDEX idx_public_pdf_links_pdf_log ON public.public_pdf_links USING btree (pdf_generation_log_id);

-- INDEX public idx_roles_user_id
CREATE INDEX idx_roles_user_id ON public.roles USING btree (user_id);

-- INDEX public idx_templates_application_id
CREATE INDEX idx_templates_application_id ON public.communication_templates USING btree (application_id);

-- INDEX public idx_templates_channel
CREATE INDEX idx_templates_channel ON public.communication_templates USING btree (channel);

-- INDEX public idx_tenant_dedicated_api_servers_scope_key
CREATE INDEX idx_tenant_dedicated_api_servers_scope_key ON public.tenant_dedicated_api_servers USING btree (scope_key);

-- INDEX public idx_tenant_dedicated_api_servers_subscription_id
CREATE INDEX idx_tenant_dedicated_api_servers_subscription_id ON public.tenant_dedicated_api_servers USING btree (subscription_id);

-- INDEX public idx_tenant_dedicated_api_servers_tenant_id
CREATE INDEX idx_tenant_dedicated_api_servers_tenant_id ON public.tenant_dedicated_api_servers USING btree (tenant_id);

-- INDEX public idx_tenant_dedicated_api_servers_updated_at
CREATE INDEX idx_tenant_dedicated_api_servers_updated_at ON public.tenant_dedicated_api_servers USING btree (updated_at DESC);

-- INDEX public idx_tenant_webchat_conversations_scope_key
CREATE INDEX idx_tenant_webchat_conversations_scope_key ON public.tenant_webchat_conversations USING btree (scope_key);

-- INDEX public idx_tenant_webchat_conversations_session_id
CREATE INDEX idx_tenant_webchat_conversations_session_id ON public.tenant_webchat_conversations USING btree (session_id);

-- INDEX public idx_tenant_webchat_conversations_status
CREATE INDEX idx_tenant_webchat_conversations_status ON public.tenant_webchat_conversations USING btree (status);

-- INDEX public idx_tenant_webchat_conversations_subscription_id
CREATE INDEX idx_tenant_webchat_conversations_subscription_id ON public.tenant_webchat_conversations USING btree (subscription_id);

-- INDEX public idx_tenant_webchat_conversations_tenant_id
CREATE INDEX idx_tenant_webchat_conversations_tenant_id ON public.tenant_webchat_conversations USING btree (tenant_id);

-- INDEX public idx_tenant_webchat_conversations_tenant_session
CREATE UNIQUE INDEX idx_tenant_webchat_conversations_tenant_session ON public.tenant_webchat_conversations USING btree (tenant_key, session_id);

-- INDEX public idx_tenant_webchat_conversations_updated_at
CREATE INDEX idx_tenant_webchat_conversations_updated_at ON public.tenant_webchat_conversations USING btree (updated_at DESC);

-- INDEX public idx_tenant_webchat_widget_configs_scope_key
CREATE INDEX idx_tenant_webchat_widget_configs_scope_key ON public.tenant_webchat_widget_configs USING btree (scope_key);

-- INDEX public idx_tenant_webchat_widget_configs_subscription_id
CREATE INDEX idx_tenant_webchat_widget_configs_subscription_id ON public.tenant_webchat_widget_configs USING btree (subscription_id);

-- INDEX public idx_tenant_webchat_widget_configs_tenant_id
CREATE INDEX idx_tenant_webchat_widget_configs_tenant_id ON public.tenant_webchat_widget_configs USING btree (tenant_id);

-- INDEX public idx_tenant_webchat_widget_configs_updated_at
CREATE INDEX idx_tenant_webchat_widget_configs_updated_at ON public.tenant_webchat_widget_configs USING btree (updated_at DESC);

-- INDEX public idx_usage_audit_app
CREATE INDEX idx_usage_audit_app ON public.usage_audit USING btree (application_id);

-- INDEX public idx_usage_audit_app_type_created
CREATE INDEX idx_usage_audit_app_type_created ON public.usage_audit USING btree (application_id, resource_type, created_at DESC);

-- INDEX public idx_usage_audit_created
CREATE INDEX idx_usage_audit_created ON public.usage_audit USING btree (created_at DESC);

-- INDEX public idx_usage_audit_type
CREATE INDEX idx_usage_audit_type ON public.usage_audit USING btree (resource_type);

-- INDEX public idx_usage_audit_user
CREATE INDEX idx_usage_audit_user ON public.usage_audit USING btree (user_id);

-- INDEX public idx_user_licenses_expires
CREATE INDEX idx_user_licenses_expires ON public.user_licenses USING btree (expires_at);

-- INDEX public idx_user_licenses_status
CREATE INDEX idx_user_licenses_status ON public.user_licenses USING btree (status);

-- INDEX public idx_user_licenses_user_id
CREATE INDEX idx_user_licenses_user_id ON public.user_licenses USING btree (user_id);

-- INDEX public idx_user_preferences_user_id
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences USING btree (user_id);

-- INDEX public idx_web_access_attempts_country_code
CREATE INDEX idx_web_access_attempts_country_code ON public.web_access_attempts USING btree (country_code);

-- INDEX public idx_web_access_attempts_created_at
CREATE INDEX idx_web_access_attempts_created_at ON public.web_access_attempts USING btree (created_at DESC);

-- INDEX public idx_web_access_attempts_email
CREATE INDEX idx_web_access_attempts_email ON public.web_access_attempts USING btree (email);

-- INDEX public idx_web_access_attempts_event_type
CREATE INDEX idx_web_access_attempts_event_type ON public.web_access_attempts USING btree (event_type);

-- INDEX public idx_web_access_attempts_updated_at
CREATE INDEX idx_web_access_attempts_updated_at ON public.web_access_attempts USING btree (updated_at DESC);

-- INDEX public idx_whatsapp_configs_app_id
CREATE INDEX idx_whatsapp_configs_app_id ON public.whatsapp_configs USING btree (application_id);

-- INDEX public idx_whatsapp_configs_application_id
CREATE INDEX idx_whatsapp_configs_application_id ON public.whatsapp_configs USING btree (application_id);

-- INDEX public idx_whatsapp_logs_app_id
CREATE INDEX idx_whatsapp_logs_app_id ON public.whatsapp_logs USING btree (application_id);

-- INDEX public idx_whatsapp_logs_application_id
CREATE INDEX idx_whatsapp_logs_application_id ON public.whatsapp_logs USING btree (application_id);

-- INDEX public idx_whatsapp_logs_status
CREATE INDEX idx_whatsapp_logs_status ON public.whatsapp_logs USING btree (status);

-- INDEX public idx_whatsapp_logs_wamid
CREATE INDEX idx_whatsapp_logs_wamid ON public.whatsapp_logs USING btree (wamid);

-- INDEX public idx_whatsapp_templates_app_id
CREATE INDEX idx_whatsapp_templates_app_id ON public.whatsapp_templates USING btree (application_id);

-- INDEX public idx_whatsapp_templates_application_id
CREATE INDEX idx_whatsapp_templates_application_id ON public.whatsapp_templates USING btree (application_id);

-- INDEX public idx_whatsapp_templates_status
CREATE INDEX idx_whatsapp_templates_status ON public.whatsapp_templates USING btree (status);

-- TRIGGER public pdf_generation_locks cleanup_expired_locks_trigger
CREATE TRIGGER cleanup_expired_locks_trigger BEFORE INSERT ON public.pdf_generation_locks FOR EACH STATEMENT EXECUTE FUNCTION public.cleanup_expired_pdf_locks();

-- TRIGGER public automation_program_queue_items set_automation_program_queue_items_updated_at
CREATE TRIGGER set_automation_program_queue_items_updated_at BEFORE UPDATE ON public.automation_program_queue_items FOR EACH ROW EXECUTE FUNCTION public.update_automation_program_queue_items_updated_at();

-- TRIGGER public pending_communications set_pending_communications_updated_at
CREATE TRIGGER set_pending_communications_updated_at BEFORE UPDATE ON public.pending_communications FOR EACH ROW EXECUTE FUNCTION public.update_pending_communications_updated_at();

-- TRIGGER public tenant_dedicated_api_servers trg_tenant_dedicated_api_servers_updated_at
CREATE TRIGGER trg_tenant_dedicated_api_servers_updated_at BEFORE UPDATE ON public.tenant_dedicated_api_servers FOR EACH ROW EXECUTE FUNCTION public.set_tenant_dedicated_api_servers_updated_at();

-- TRIGGER public tenant_webchat_conversations trg_tenant_webchat_conversations_updated_at
CREATE TRIGGER trg_tenant_webchat_conversations_updated_at BEFORE UPDATE ON public.tenant_webchat_conversations FOR EACH ROW EXECUTE FUNCTION public.set_tenant_webchat_conversations_updated_at();

-- TRIGGER public tenant_webchat_widget_configs trg_tenant_webchat_widget_configs_updated_at
CREATE TRIGGER trg_tenant_webchat_widget_configs_updated_at BEFORE UPDATE ON public.tenant_webchat_widget_configs FOR EACH ROW EXECUTE FUNCTION public.set_tenant_webchat_widget_configs_updated_at();

-- TRIGGER public web_access_attempts trg_web_access_attempts_updated_at
CREATE TRIGGER trg_web_access_attempts_updated_at BEFORE UPDATE ON public.web_access_attempts FOR EACH ROW EXECUTE FUNCTION public.set_web_access_attempts_updated_at();

-- TRIGGER public user_licenses trigger_license_audit
CREATE TRIGGER trigger_license_audit AFTER INSERT OR UPDATE ON public.user_licenses FOR EACH ROW EXECUTE FUNCTION public.log_license_change();

-- TRIGGER public menu_permissions update_menu_permissions_updated_at
CREATE TRIGGER update_menu_permissions_updated_at BEFORE UPDATE ON public.menu_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TRIGGER public menus update_menus_updated_at
CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TRIGGER public user_preferences user_preferences_updated_at
CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_timestamp();

-- FK CONSTRAINT public application_limits application_limits_application_id_fkey
ALTER TABLE ONLY public.application_limits
    ADD CONSTRAINT application_limits_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public automation_program_queue_items automation_program_queue_items_application_id_fkey
ALTER TABLE ONLY public.automation_program_queue_items
    ADD CONSTRAINT automation_program_queue_items_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public automation_program_queue_items automation_program_queue_items_program_id_fkey
ALTER TABLE ONLY public.automation_program_queue_items
    ADD CONSTRAINT automation_program_queue_items_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.automation_programs(id) ON DELETE CASCADE;

-- FK CONSTRAINT public automation_programs automation_programs_application_id_fkey
ALTER TABLE ONLY public.automation_programs
    ADD CONSTRAINT automation_programs_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public campaign_jobs campaign_jobs_application_id_fkey
ALTER TABLE ONLY public.campaign_jobs
    ADD CONSTRAINT campaign_jobs_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id);

-- FK CONSTRAINT public communication_templates communication_templates_application_id_fkey
ALTER TABLE ONLY public.communication_templates
    ADD CONSTRAINT communication_templates_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public communication_templates communication_templates_pdf_template_id_fkey
ALTER TABLE ONLY public.communication_templates
    ADD CONSTRAINT communication_templates_pdf_template_id_fkey FOREIGN KEY (pdf_template_id) REFERENCES public.communication_templates(id) ON DELETE SET NULL;

-- FK CONSTRAINT public email_credentials email_credentials_application_id_fkey
ALTER TABLE ONLY public.email_credentials
    ADD CONSTRAINT email_credentials_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public email_logs email_logs_application_id_fkey
ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public email_logs email_logs_parent_log_id_fkey
ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_parent_log_id_fkey FOREIGN KEY (parent_log_id) REFERENCES public.email_logs(id) ON DELETE SET NULL;

-- FK CONSTRAINT public email_logs email_logs_template_id_fkey
ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.communication_templates(id) ON DELETE SET NULL;

-- FK CONSTRAINT public email_provider_audit email_provider_audit_application_id_fkey
ALTER TABLE ONLY public.email_provider_audit
    ADD CONSTRAINT email_provider_audit_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public license_audit license_audit_new_plan_id_fkey
ALTER TABLE ONLY public.license_audit
    ADD CONSTRAINT license_audit_new_plan_id_fkey FOREIGN KEY (new_plan_id) REFERENCES public.license_plans(id);

-- FK CONSTRAINT public license_audit license_audit_previous_plan_id_fkey
ALTER TABLE ONLY public.license_audit
    ADD CONSTRAINT license_audit_previous_plan_id_fkey FOREIGN KEY (previous_plan_id) REFERENCES public.license_plans(id);

-- FK CONSTRAINT public license_audit license_audit_user_license_id_fkey
ALTER TABLE ONLY public.license_audit
    ADD CONSTRAINT license_audit_user_license_id_fkey FOREIGN KEY (user_license_id) REFERENCES public.user_licenses(id) ON DELETE CASCADE;

-- FK CONSTRAINT public menu_permissions menu_permissions_menu_id_fkey
ALTER TABLE ONLY public.menu_permissions
    ADD CONSTRAINT menu_permissions_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE CASCADE;

-- FK CONSTRAINT public menu_permissions menu_permissions_role_id_fkey
ALTER TABLE ONLY public.menu_permissions
    ADD CONSTRAINT menu_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

-- FK CONSTRAINT public pdf_generation_locks pdf_generation_locks_application_id_fkey
ALTER TABLE ONLY public.pdf_generation_locks
    ADD CONSTRAINT pdf_generation_locks_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public pdf_generation_logs pdf_generation_logs_application_id_fkey
ALTER TABLE ONLY public.pdf_generation_logs
    ADD CONSTRAINT pdf_generation_logs_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public pdf_generation_logs pdf_generation_logs_email_log_id_fkey
ALTER TABLE ONLY public.pdf_generation_logs
    ADD CONSTRAINT pdf_generation_logs_email_log_id_fkey FOREIGN KEY (email_log_id) REFERENCES public.email_logs(id);

-- FK CONSTRAINT public pdf_generation_logs pdf_generation_logs_pdf_template_id_fkey
ALTER TABLE ONLY public.pdf_generation_logs
    ADD CONSTRAINT pdf_generation_logs_pdf_template_id_fkey FOREIGN KEY (pdf_template_id) REFERENCES public.communication_templates(id) ON DELETE CASCADE;

-- FK CONSTRAINT public pending_communications pending_communications_application_id_fkey
ALTER TABLE ONLY public.pending_communications
    ADD CONSTRAINT pending_communications_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public pending_communications pending_communications_parent_log_id_fkey
ALTER TABLE ONLY public.pending_communications
    ADD CONSTRAINT pending_communications_parent_log_id_fkey FOREIGN KEY (parent_log_id) REFERENCES public.email_logs(id) ON DELETE SET NULL;

-- FK CONSTRAINT public pending_communications pending_communications_pdf_template_id_fkey
ALTER TABLE ONLY public.pending_communications
    ADD CONSTRAINT pending_communications_pdf_template_id_fkey FOREIGN KEY (pdf_template_id) REFERENCES public.communication_templates(id);

-- FK CONSTRAINT public pending_communications pending_communications_sent_log_id_fkey
ALTER TABLE ONLY public.pending_communications
    ADD CONSTRAINT pending_communications_sent_log_id_fkey FOREIGN KEY (sent_log_id) REFERENCES public.email_logs(id);

-- FK CONSTRAINT public predefined_variables predefined_variables_application_id_fkey
ALTER TABLE ONLY public.predefined_variables
    ADD CONSTRAINT predefined_variables_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public public_pdf_links public_pdf_links_application_id_fkey
ALTER TABLE ONLY public.public_pdf_links
    ADD CONSTRAINT public_pdf_links_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public usage_audit usage_audit_application_id_fkey
ALTER TABLE ONLY public.usage_audit
    ADD CONSTRAINT usage_audit_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

-- FK CONSTRAINT public user_licenses user_licenses_license_plan_id_fkey
ALTER TABLE ONLY public.user_licenses
    ADD CONSTRAINT user_licenses_license_plan_id_fkey FOREIGN KEY (license_plan_id) REFERENCES public.license_plans(id);

-- FK CONSTRAINT public user_preferences user_preferences_default_application_id_fkey
ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_default_application_id_fkey FOREIGN KEY (default_application_id) REFERENCES public.applications(id) ON DELETE SET NULL;

-- POLICY public license_plans Anyone can view active license plans
CREATE POLICY "Anyone can view active license plans" ON public.license_plans FOR SELECT USING ((is_active = true));

-- POLICY public public_pdf_links Public can access active PDF links
CREATE POLICY "Public can access active PDF links" ON public.public_pdf_links FOR SELECT USING (((is_active = true) AND ((expires_at IS NULL) OR (expires_at > now()))));

-- ROW SECURITY public applications
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public automation_programs
ALTER TABLE public.automation_programs ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public campaign_jobs
ALTER TABLE public.campaign_jobs ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public communication_templates
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public email_credentials
ALTER TABLE public.email_credentials ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public embed_credentials
ALTER TABLE public.embed_credentials ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public license_plans
ALTER TABLE public.license_plans ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public monthly_email_usage
ALTER TABLE public.monthly_email_usage ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public pdf_generation_locks
ALTER TABLE public.pdf_generation_locks ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public pdf_generation_logs
ALTER TABLE public.pdf_generation_logs ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public pending_communications
ALTER TABLE public.pending_communications ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public public_pdf_links
ALTER TABLE public.public_pdf_links ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public tenant_settings
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- ROW SECURITY public whatsapp_configs
ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;

-- migrate:down
-- No se deshace: borraría todo el esquema.
