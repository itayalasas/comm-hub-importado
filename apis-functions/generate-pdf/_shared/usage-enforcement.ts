
async function getAuthBaseUrl(): Promise<string> {
  return (
    Deno.env.get("AUTH_FUNCTIONS_BASE_URL") ||
    Deno.env.get("AUTH_EDGE_FUNCTIONS_BASE_URL") ||
    Deno.env.get("AUTH_URL") ||
    Deno.env.get("VITE_AUTH_URL") ||
    Deno.env.get("FUNCTIONS_BASE_URL") ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
}

// Base de las funciones propias de SendCraft (para llamar a /send-email a si
// mismo). Distinta de getAuthBaseUrl(), que resuelve AuthSystem - usar
// authBaseUrl aca por error mandaria la notificacion al send-email de
// AuthSystem (contrato distinto, {to,subject,html} en vez de
// {recipient_email,template_name,data}) y nunca aparecerian los logs del
// lado de SendCraft.
function getSendCraftFunctionsBaseUrl(): string {
  return (Deno.env.get("FUNCTIONS_BASE_URL") || "").trim().replace(/\/+$/, "");
}

// URL publica del dashboard de SendCraft (no la de la API). Se resuelve por
// env var en vez de hardcodear el dominio para que funcione igual en
// cualquier ambiente (dev/staging/produccion).
function getDashboardBaseUrl(): string {
  return (
    Deno.env.get("SENDCRAFT_DASHBOARD_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    Deno.env.get("VITE_APP_URL") ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
}

// Aplicacion "plataforma" ya usada como fallback de credenciales de email en
// send-email/generate-pdf cuando el cliente no tiene sus propias credenciales.
// La reusamos como emisora de los avisos de billetera/uso.
const PLATFORM_APPLICATION_ID = "4685df9c-46ac-48d5-aa91-8b72221ec6f2";
const USAGE_WARNING_THRESHOLD_PCT = 90;

export type UsageFeatureCode = "total_de_correos_mensuales" | "pdf_generations_monthly";
export type OverageFeatureCode = "email_overage_price" | "pdf_overage_price";

const FEATURE_LABELS: Record<UsageFeatureCode, string> = {
  total_de_correos_mensuales: "Emails mensuales",
  pdf_generations_monthly: "PDFs mensuales",
};

export interface EnforceUsageQuotaParams {
  client: any;
  tenantId: string | null;
  userId: string | null;
  usageFeatureCode: UsageFeatureCode;
  overageFeatureCode: OverageFeatureCode;
  communicationTypes: string[];
  idempotencyKey: string;
}

export interface EnforceUsageQuotaResult {
  allowed: boolean;
  charged: boolean;
  blockedReason?: string;
}

async function notifyUsageThreshold(params: {
  client: any;
  appIds: string[];
  usageFeatureCode: UsageFeatureCode;
  currentUsage: number;
  maxLimit: number;
  planName: string | null;
  periodStart: string;
  periodEnd: string;
  payerEmail: string | null;
  tenantId: string | null;
  userId: string | null;
  authAppId: string;
  authApiKey: string;
}) {
  const {
    client, appIds, usageFeatureCode, currentUsage, maxLimit, planName, periodStart, periodEnd,
    payerEmail, tenantId, userId, authAppId, authApiKey,
  } = params;

  if (!payerEmail || appIds.length === 0) return;

  try {
    const existingNoticeResult = await client.queryObject(
      `
      SELECT id
      FROM email_logs
      WHERE application_id = ANY($1::uuid[])
        AND communication_type = 'usage_threshold_notice'
        AND metadata->>'usage_feature_code' = $2
        AND created_at >= $3
        AND created_at <= $4
      LIMIT 1
      `,
      [appIds, usageFeatureCode, periodStart, periodEnd],
    );

    if ((existingNoticeResult.rows as any[]).length > 0) {
      return;
    }

    await client.queryObject(
      `
      INSERT INTO email_logs (
        application_id, recipient_email, subject, status, communication_type, metadata
      )
      VALUES ($1, $2, $3, 'sent', 'usage_threshold_notice', $4::jsonb)
      `,
      [
        appIds[0],
        payerEmail,
        `Aviso de uso cercano al limite: ${usageFeatureCode}`,
        JSON.stringify({ usage_feature_code: usageFeatureCode, period_start: periodStart, period_end: periodEnd }),
      ],
    );

    const authBaseUrl = await getAuthBaseUrl();

    const platformKeyResult = await client.queryObject<{ api_key: string }>(
      `SELECT api_key FROM applications WHERE id = $1 LIMIT 1`,
      [PLATFORM_APPLICATION_ID],
    );
    const platformApiKey = (platformKeyResult.rows as any[])[0]?.api_key;
    if (!authBaseUrl || !platformApiKey) return;

    const usagePercent = Math.min(100, Math.round((currentUsage / maxLimit) * 100));

    let walletBalance: number | null = null;
    let walletCurrency = "UYU";

    try {
      const walletResponse = await fetch(`${authBaseUrl}/wallet-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: authAppId,
          api_key: authApiKey,
          tenant_id: tenantId,
          app_user_id: userId,
        }),
      });
      const walletResult = await walletResponse.json().catch(() => ({}));
      if (walletResponse.ok && walletResult?.success) {
        walletBalance = Number(walletResult.data?.balance ?? 0);
        walletCurrency = walletResult.data?.currency || "UYU";
      }
    } catch {
      // El saldo es solo contexto informativo del aviso; si falla la
      // consulta seguimos sin el en vez de cancelar la notificacion.
    }

    const dashboardBaseUrl = getDashboardBaseUrl();
    const sendCraftFunctionsBaseUrl = getSendCraftFunctionsBaseUrl();

    if (!sendCraftFunctionsBaseUrl) {
      console.warn("usage_threshold_warning: falta FUNCTIONS_BASE_URL, no se puede llamar a send-email");
      return;
    }

    const response = await fetch(`${sendCraftFunctionsBaseUrl}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": platformApiKey },
      body: JSON.stringify({
        recipient_email: payerEmail,
        template_name: "usage_threshold_warning",
        data: {
          application_name: "SendCraft",
          plan_name: planName,
          feature_label: FEATURE_LABELS[usageFeatureCode],
          current_usage: currentUsage,
          plan_limit: maxLimit,
          usage_percent: usagePercent,
          period_end: periodEnd,
          period_end_formatted: new Date(periodEnd).toLocaleDateString("es-UY", {
            year: "numeric", month: "long", day: "numeric",
          }),
          wallet_balance: walletBalance,
          wallet_currency: walletCurrency,
          account_management_url: dashboardBaseUrl ? `${dashboardBaseUrl}/dashboard/billing` : null,
        },
      }),
    });

    const responseBody = await response.text().catch(() => "");

    if (!response.ok) {
      console.warn("usage_threshold_warning: send-email respondio con error", {
        status: response.status,
        body: responseBody.slice(0, 500),
      });
    } else {
      console.log("usage_threshold_warning: email notificado", { status: response.status });
    }
  } catch {
    // El aviso de umbral nunca debe impedir el envio real; se ignora
    // cualquier error de notificacion.
  }
}

// Chequea el uso del periodo contra el limite del plan (consultado en
// AuthSystem, que es quien tiene el estado de facturacion) y, si se supera,
// intenta debitar el excedente de la billetera antes de permitir el envio.
// Si algo en la cadena de habilitacion (config faltante, AuthSystem caido,
// precio de excedente sin configurar en el plan) no permite resolver el
// chequeo, se falla abierto: se permite el envio sin cobrar. Solo se bloquea
// cuando se confirma que el plan tiene precio de excedente configurado y la
// billetera no alcanza para cubrirlo.
export async function enforceUsageQuota(params: EnforceUsageQuotaParams): Promise<EnforceUsageQuotaResult> {
  const {
    client,
    tenantId,
    userId,
    usageFeatureCode,
    overageFeatureCode,
    communicationTypes,
    idempotencyKey,
  } = params;

  if (!tenantId && !userId) {
    return { allowed: true, charged: false };
  }

  const authBaseUrl = await getAuthBaseUrl();
  const authAppId = (Deno.env.get("AUTH_APP_ID") || "").trim();
  const authApiKey = (Deno.env.get("AUTH_API_KEY") || "").trim();

  if (!authBaseUrl || !authAppId || !authApiKey) {
    return { allowed: true, charged: false };
  }

  let limitsData: any = null;

  try {
    const limitsResponse = await fetch(`${authBaseUrl}/application-usage-limits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_id: authAppId,
        api_key: authApiKey,
        tenant_id: tenantId,
        app_user_id: userId,
      }),
    });

    const limitsResult = await limitsResponse.json().catch(() => ({}));
    if (limitsResponse.ok && limitsResult?.success) {
      limitsData = limitsResult.data;
    }
  } catch {
    return { allowed: true, charged: false };
  }

  if (!limitsData) {
    return { allowed: true, charged: false };
  }

  const maxLimit = limitsData.limits?.[usageFeatureCode];

  if (maxLimit === null || maxLimit === undefined || !Number.isFinite(maxLimit)) {
    return { allowed: true, charged: false };
  }

  const periodStart = limitsData.period?.start;
  const periodEnd = limitsData.period?.end;

  const { start, end } = periodStart && periodEnd
    ? { start: periodStart, end: periodEnd }
    : (() => {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      };
    })();

  const appIdsResult = await client.queryObject<{ id: string }>(
    tenantId
      ? `SELECT id FROM applications WHERE tenant_id = $1`
      : `SELECT id FROM applications WHERE user_id = $1 AND tenant_id IS NULL`,
    [tenantId || userId],
  );

  const appIds = (appIdsResult.rows as any[]).map((row) => row.id);

  if (appIds.length === 0) {
    return { allowed: true, charged: false };
  }

  const usageResult = await client.queryObject<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM email_logs
    WHERE application_id = ANY($1::uuid[])
      AND communication_type = ANY($2::text[])
      AND created_at >= $3
      AND created_at <= $4
    `,
    [appIds, communicationTypes, start, end],
  );

  const currentUsage = Number((usageResult.rows as any[])[0]?.count || 0);

  if (currentUsage < maxLimit) {
    if ((currentUsage / maxLimit) * 100 >= USAGE_WARNING_THRESHOLD_PCT) {
      // Se espera (no fire-and-forget) porque el pool client se libera apenas
      // termina el handler que llama a enforceUsageQuota; si esto quedara
      // corriendo en segundo plano, podria usar una conexion ya liberada.
      await notifyUsageThreshold({
        client,
        appIds,
        usageFeatureCode,
        currentUsage,
        maxLimit,
        planName: limitsData.plan_name || null,
        periodStart: start,
        periodEnd: end,
        payerEmail: limitsData.payer_email || null,
        tenantId,
        userId,
        authAppId,
        authApiKey,
      });
    }

    return { allowed: true, charged: false };
  }

  const overagePrice = Number(limitsData.overage_prices?.[overageFeatureCode] || 0);

  if (!Number.isFinite(overagePrice) || overagePrice <= 0) {
    return { allowed: true, charged: false };
  }

  try {
    const debitResponse = await fetch(`${authBaseUrl}/wallet-debit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_id: authAppId,
        api_key: authApiKey,
        tenant_id: tenantId,
        app_user_id: userId,
        feature_code: overageFeatureCode,
        quantity: 1,
        idempotency_key: idempotencyKey,
      }),
    });

    const debitResult = await debitResponse.json().catch(() => ({}));

    if (debitResponse.ok && debitResult?.success) {
      return { allowed: true, charged: true };
    }

    if (debitResponse.status === 402 || debitResult?.error?.code === "INSUFFICIENT_BALANCE") {
      return { allowed: false, charged: false, blockedReason: "insufficient_wallet_balance" };
    }

    return { allowed: true, charged: false };
  } catch {
    return { allowed: true, charged: false };
  }
}
