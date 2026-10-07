// Verificación de firmas de webhooks de Resend (formato Svix).
// https://docs.svix.com/receiving/verifying-payloads/how-manual

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

// Compara en tiempo constante para no filtrar cuántos bytes coinciden.
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export async function verifySvixSignature(
  payload: string,
  headers: Headers,
  webhookSecret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  try {
    // El secreto de Svix viene en base64 después del prefijo whsec_.
    const secret = webhookSecret.startsWith("whsec_") ? webhookSecret.slice(6) : webhookSecret;
    const encoder = new TextEncoder();

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      base64ToBytes(secret).buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(`${svixId}.${svixTimestamp}.${payload}`),
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));

    let valid = false;
    for (const versionedSignature of svixSignature.split(" ")) {
      const [version, candidate] = versionedSignature.split(",");
      if (version === "v1" && candidate && timingSafeEqual(candidate, expected)) {
        valid = true;
      }
    }
    return valid;
  } catch {
    return false;
  }
}
