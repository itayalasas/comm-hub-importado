# Configuración de Webhooks de Resend

## Paso 1: Configurar el Secret en Supabase

Copia el **Signing Secret** que aparece en tu dashboard de Resend (el que está oculto con puntos).

Ejecuta este comando en tu terminal para configurarlo:

```bash
npx supabase secrets set RESEND_WEBHOOK_SECRET="whsec_tu_secret_aqui"
```

## Paso 2: URL del Webhook

Usa esta URL en el dashboard de Resend:

```
https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/resend-webhook
```

## Paso 3: Eventos a Seleccionar

En el dashboard de Resend, selecciona estos eventos:

- ✅ `email.sent` - Email aceptado por Resend
- ✅ `email.delivered` - Email entregado al destinatario
- ✅ `email.delivery_delayed` - Entrega retrasada
- ✅ `email.bounced` - Email rebotado
- ✅ `email.complained` - Marcado como spam

**NOTA:** También selecciona `contact.created` y `contact.deleted` (los que aparecen en tu screenshot) si quieres rastrear esos eventos.

## Cómo Funciona la Seguridad

La función ahora valida la firma del webhook usando el **Signing Secret**:

1. Resend envía headers especiales con cada webhook:
   - `svix-id` - ID único del webhook
   - `svix-timestamp` - Timestamp del envío
   - `svix-signature` - Firma HMAC-SHA256

2. Tu función verifica la firma usando el secret que configuraste

3. Si la firma no coincide → rechaza el webhook con error 401

4. Si la firma coincide → procesa el evento normalmente

## ¿Por Qué es Importante?

Sin validación de firma, cualquiera podría enviar webhooks falsos a tu endpoint y manipular los estados de tus emails. Con la firma, solo los webhooks legítimos de Resend serán procesados.

## Verificar que Funciona

Después de configurar:

1. Envía un email de prueba desde tu aplicación
2. Ve al dashboard de Resend → Webhooks → tu webhook
3. Verás los eventos que se están enviando
4. En los logs de Supabase verás mensajes como:
   ```
   ✅ Received Resend webhook: delivered for email: abc123
   ✅ Successfully processed webhook: email.delivered for log: xyz789
   ```

## Si No Configuras el Secret

La función seguirá funcionando pero **sin validación de seguridad**. Verás este warning en los logs:

```
⚠️ RESEND_WEBHOOK_SECRET not configured - skipping signature verification
```

Se recomienda **siempre configurar el secret** en producción.
