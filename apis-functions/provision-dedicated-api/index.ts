type ProvisionDedicatedApiRequest = Record<string, unknown> & {
  upstreamUrl?: string;
  upstream_url?: string;
  provisioningUrl?: string;
  provisioning_url?: string;
  cloneUrl?: string;
  clone_url?: string;
  url?: string;
  api_key?: string;
  apiKey?: string;
  authorization?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, x-api-key',
  Vary: 'Origin',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function firstString(...values: Array<string | number | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function collectStringCandidates(
  payload: unknown,
  targetKeys: string[],
  nestedKeys: string[],
  depth = 0,
  visited = new Set<object>(),
): string[] {
  if (depth > 5) return [];

  if (typeof payload === 'string' || typeof payload === 'number') {
    const candidate = firstString(payload);
    return candidate ? [candidate] : [];
  }

  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  if (visited.has(record)) return [];
  visited.add(record);

  const candidates: string[] = [];

  for (const key of targetKeys) {
    const candidate = firstString(record[key] as string | number | null | undefined);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  for (const key of nestedKeys) {
    const nestedValue = record[key];
    if (Array.isArray(nestedValue)) {
      for (const item of nestedValue) {
        candidates.push(...collectStringCandidates(item, targetKeys, nestedKeys, depth + 1, visited));
      }
      continue;
    }

    candidates.push(...collectStringCandidates(nestedValue, targetKeys, nestedKeys, depth + 1, visited));
  }

  return candidates;
}

function normalizeUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeHostnameToBaseUrl(hostname: string): string {
  const trimmed = String(hostname || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return normalizeUrl(withProtocol);
}

function getDedicatedDomain(): string {
  return String(
    Deno.env.get('VITE_DEDICATED_API_DOMAIN') ||
      Deno.env.get('DEDICATED_API_DOMAIN') ||
      'sendcraft.net',
  ).trim().replace(/\/+$/, '') || 'sendcraft.net';
}

function isAllowedFallbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.endsWith('.azurecontainerapps.io') ||
      url.hostname.includes('function-plataform.')
    );
  } catch {
    return false;
  }
}

function resolveUpstreamUrl(body: ProvisionDedicatedApiRequest): string {
  const envUrl = normalizeUrl(
    Deno.env.get('URL_SERVER_DEDICADO') ||
      Deno.env.get('VITE_URL_SERVER_DEDICADO') ||
      '',
  );

  if (envUrl) {
    return envUrl;
  }

  const bodyUrl = normalizeUrl(
    body.upstreamUrl ||
      body.upstream_url ||
      body.provisioningUrl ||
      body.provisioning_url ||
      body.cloneUrl ||
      body.clone_url ||
      body.url ||
      '',
  );

  return isAllowedFallbackUrl(bodyUrl) ? bodyUrl : '';
}

function stripProxyFields(body: ProvisionDedicatedApiRequest): Record<string, unknown> {
  const {
    upstreamUrl,
    upstream_url,
    provisioningUrl,
    provisioning_url,
    cloneUrl,
    clone_url,
    url,
    ...forwardBody
  } = body;

  return forwardBody;
}

function extractProvisionErrorText(payload: unknown, rawText = ''): string {
  const candidates = collectStringCandidates(
    payload,
    ['error', 'message', 'details', 'reason', 'description'],
    ['data', 'result', 'deployment', 'project', 'response', 'payload', 'body', 'details', 'error'],
  );

  return [rawText, ...candidates].filter((part) => typeof part === 'string' && part.trim()).join(' ');
}

function extractHostnameFromPayload(payload: unknown): string {
  const candidates = collectStringCandidates(
    payload,
    [
      'publicHostname',
      'public_hostname',
      'publicUrl',
      'public_url',
      'hostname',
      'fqdn',
      'ingressFqdn',
      'ingress_fqdn',
      'defaultFqdn',
      'default_fqdn',
      'defaultHostname',
      'default_hostname',
    ],
    ['data', 'result', 'deployment', 'project', 'response', 'payload', 'body', 'details', 'customDomains', 'custom_domains', 'ingress'],
  );

  return firstString(...candidates);
}

function extractHostnameFromError(payload: unknown, rawText = ''): string {
  const text = extractProvisionErrorText(payload, rawText);
  if (!text) return '';

  if (!/hostname|publichostname|public[_ ]?url|fqdn/i.test(text)) {
    return '';
  }

  const quotedHostname = text.match(/(?:hostname|public[_ ]?url|fqdn)\s+"([^"]+)"/i)?.[1];
  if (quotedHostname) {
    return quotedHostname.trim();
  }

  const directHostname = text.match(/(?:hostname|public[_ ]?url|fqdn)\s*[:=]\s*([A-Za-z0-9.-]+(?:\.[A-Za-z0-9.-]+)+)/i)?.[1];
  if (directHostname) {
    return directHostname.trim();
  }

  const genericHost = text.match(/([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/)?.[1];
  return genericHost ? genericHost.trim() : '';
}

function resolveForwardApiKey(body: ProvisionDedicatedApiRequest, req: Request): string {
  return String(
    body.api_key ||
      body.apiKey ||
      req.headers.get('x-api-key') ||
      '',
  ).trim();
}

function resolveForwardAuthorization(body: ProvisionDedicatedApiRequest, req: Request): string {
  return String(
    body.authorization ||
      req.headers.get('authorization') ||
      '',
  ).trim();
}

function isDuplicateCloneError(payload: unknown, rawText: string, status: number): boolean {
  if (status !== 500) return false;

  const haystack = `${extractProvisionErrorText(payload, rawText)} ${rawText}`.toLowerCase();
  return haystack.includes('clone failed') ||
    haystack.includes('already exists') ||
    haystack.includes('ya existe') ||
    haystack.includes('ya existe un clon') ||
    haystack.includes('hostname');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method not allowed',
        },
      },
      405,
    );
  }

  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: 'INVALID_BODY',
            message: 'Invalid request body',
          },
        },
        400,
      );
    }

    const body = rawBody as ProvisionDedicatedApiRequest;
    const upstreamUrl = resolveUpstreamUrl(body);
    const forwardApiKey = resolveForwardApiKey(body, req);
    const forwardAuthorization = resolveForwardAuthorization(body, req);

    if (!upstreamUrl) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'Dedicated upstream URL not configured',
          },
        },
        500,
      );
    }

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(forwardApiKey ? { 'x-api-key': forwardApiKey } : {}),
        ...(forwardAuthorization ? { Authorization: forwardAuthorization } : {}),
      },
      body: JSON.stringify(stripProxyFields(body)),
    });

    const rawText = await upstream.text();
    const responseHeaders = new Headers(upstream.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));

    if (!responseHeaders.has('Content-Type') && rawText.trim().startsWith('{')) {
      responseHeaders.set('Content-Type', 'application/json');
    }

    let parsedBody: unknown = rawText;
    if (rawText.trim()) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    }

    const responseRecord = parsedBody && typeof parsedBody === 'object' ? parsedBody as Record<string, unknown> : {};
    const deployment = responseRecord.deployment && typeof responseRecord.deployment === 'object'
      ? responseRecord.deployment as Record<string, unknown>
      : undefined;
    const project = responseRecord.project && typeof responseRecord.project === 'object'
      ? responseRecord.project as Record<string, unknown>
      : undefined;
    const explicitHostname = extractHostnameFromPayload(responseRecord) || extractHostnameFromError(parsedBody, rawText);
    const fallbackSubdomain = String(body.subdomain || '').trim() || 'tenant';
    const fallbackHostname = `${fallbackSubdomain}.${getDedicatedDomain()}`;
    const hostnameCandidate = explicitHostname || fallbackHostname;
    const baseUrl = normalizeHostnameToBaseUrl(hostnameCandidate);
    const errorText = extractProvisionErrorText(parsedBody, rawText);
    const duplicateCloneError = isDuplicateCloneError(parsedBody, rawText, upstream.status);
    const canNormalize = upstream.ok || duplicateCloneError || Boolean(explicitHostname);

    if (canNormalize) {
      return jsonResponse(
        {
          ...responseRecord,
          success: true,
          normalized: true,
          status: duplicateCloneError ? 'reused' : 'provisioned',
          upstreamStatus: upstream.status,
          tenantName: String(body.name || '').trim(),
          subdomain: String(body.subdomain || '').trim(),
          hostname: hostnameCandidate,
          publicHostname: hostnameCandidate,
          public_hostname: hostnameCandidate,
          baseUrl,
          base_url: baseUrl,
          project,
          deployment,
          warning: upstream.ok ? undefined : errorText || `HTTP ${upstream.status}`,
        },
        200,
      );
    }

    return new Response(rawText, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: 'UPSTREAM_UNAVAILABLE',
          message: error instanceof Error ? error.message : 'Upstream dedicated service unavailable',
        },
      },
      502,
    );
  }
});
