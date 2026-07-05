# SendCraft Java SDK

Starter kit generado desde el Marketplace de SendCraft.

## Base URL

La version descargada ya incluye como referencia la URL actual del entorno:

```
https://api.sendcraft.net
```

## Instalacion local

1. Descomprime este ZIP en tu maquina o en tu repo.
2. Ejecuta: `mvn install`

## Uso rapido

```
SendCraftClient client = new SendCraftClient(
    "https://api.sendcraft.net",
    System.getenv("SENDCRAFT_API_KEY"));

Map<String, Object> payload = new HashMap<>();
payload.put("recipient_email", "cliente@empresa.com");
payload.put("template_name", "welcome");
payload.put("data", Map.of("nombre", "Juan Perez"));

JsonNode response = client.sendEmail(payload);
System.out.println(response.toPrettyString());
```

## Catalogo incluido

### SendCraft Email

Envio de emails transaccionales

Endpoints

- `POST /send-email` - Envio transaccional con template, destinatario y datos dinamicos.

Features

- Templates HTML con variables dinamicas
- Seguimiento de aperturas y clics
- Logos y codigos QR automaticos

### SendCraft Email + PDF

Email adjuntando PDF generado al vuelo

Endpoints

- `POST /send-email-with-pdf` - Envio combinado de email y PDF en una sola operacion.

Features

- PDF generado en tiempo real desde templates HTML
- Email y PDF en una sola llamada API
- Variables independientes para email y PDF

### SendCraft PDF Generator

Generacion y almacenamiento de PDFs

Endpoints

- `POST /generate-pdf` - Generacion de PDF a partir de un template y datos.

Features

- URL publica de descarga con expiracion configurable
- CSS completo soportado
- Variables dinamicas en todo el documento

### SendCraft Notify

Campanas y notificaciones masivas asincronas

Endpoints

- `POST /notify` - Dispara una campana asincrona y devuelve un job_id.
- `GET /notify/:job_id` - Consulta el progreso y el estado de una campana por job_id.

Features

- Procesamiento asincrono con job_id
- Tipos email, email + PDF y solo PDF
- Datos compartidos con override por destinatario

### SendCraft Programs

Programacion y ejecucion de envios

Endpoints

- `GET /automation-programs` - Lista las programaciones del tenant.
- `POST /automation-programs` - Crea una programacion nueva.
- `PUT /automation-programs/:programId` - Actualiza una programacion existente.
- `DELETE /automation-programs/:programId` - Elimina una programacion.
- `POST /automation-programs/:programId/run` - Dispara una programacion y crea el job asociado.
- `GET /automation-programs/:programId/queue` - Lista los items encolados de una programacion.
- `POST /automation-programs/:programId/queue` - Agrega items a la cola de una programacion.
- `DELETE /automation-programs/:programId/queue/:queueItemId` - Cancela un item puntual de la cola.

Features

- Programaciones one-shot y recetas reutilizables
- Repeticion con cron para agendas recurrentes
- Cola externa por programa y por aplicacion

### SendCraft Monitoring

Trazas y estadisticas operativas

Endpoints

- `GET /automation-monitoring` - Devuelve el resumen operativo de automatizaciones.

Features

- Resumen de programas y jobs
- Trazas cronologicas para diagnostico rapido
- Vista compacta para dashboards internos

### SendCraft Webhooks

Tracking de emails en tiempo real

Endpoints

- `GET /track-email/open` - Marca una apertura para un email enviado.
- `GET /track-email/click` - Registra un click y redirige de forma transparente.

Features

- Pixel de apertura 1x1 inyectado automaticamente
- Tracking de clics con redireccion transparente
- Visible en el dashboard de estadisticas

## Notas

- Pensado para Java 17+ con Maven y Jackson.
- Instalalo en el repositorio local con `mvn install` y luego consumilo como dependencia.
- Si preferis Gradle, el codigo tambien se puede adaptar facilmente.