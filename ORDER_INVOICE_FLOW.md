# Order-Invoice-Email Flow

This document explains how to send emails that wait for invoices to be generated before sending.

## Use Case

Your application (e.g., Dogcatify) creates an order and wants to send an email with an invoice PDF attachment. However, the invoice might not be ready immediately. This system allows you to:

1. Create the email request with an `order_id`
2. Mark it as "waiting for invoice"
3. Later, when the invoice is ready, generate the PDF and automatically send the email

## Flow Diagram

```
┌─────────────┐
│  Dogcatify  │
│  creates    │
│  order      │
└──────┬──────┘
       │
       │ POST /send-email
       │ {
       │   "template_name": "invoice_email",
       │   "recipient_email": "client@example.com",
       │   "order_id": "12345",
       │   "wait_for_invoice": true,
       │   "data": { ... }
       │ }
       ▼
┌─────────────────────┐
│  pending_           │
│  communications     │
│  created            │
│  status: waiting    │
└─────────────────────┘
       │
       │ Response 202:
       │ "Email queued, waiting for invoice"
       │
       ▼
┌─────────────┐
│  Later...   │
│  Invoice    │
│  generated  │
└──────┬──────┘
       │
       │ POST /generate-pdf
       │ {
       │   "order_id": "12345",
       │   "pdf_template_name": "invoice_template",
       │   "data": {
       │     "invoice_number": "INV-2024-001",
       │     "items": [...],
       │     "total": 150.00
       │   }
       │ }
       ▼
┌─────────────────────┐
│  System finds       │
│  pending email by   │
│  order_id           │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Generate PDF       │
│  with jsPDF         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Update pending_    │
│  communications     │
│  with PDF           │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Trigger email send │
│  via complete-      │
│  pending-           │
│  communication      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Email sent with    │
│  PDF attachment     │
│  status: sent       │
└─────────────────────┘
```

## Step-by-Step Implementation

### Step 1: Create Order and Queue Email

When you create an order in your system, immediately call the email API with `wait_for_invoice: true`:

```bash
POST https://your-project.supabase.co/functions/v1/send-email
Headers:
  x-api-key: YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "template_name": "invoice_email",
  "recipient_email": "client@example.com",
  "order_id": "ORDER-12345",
  "wait_for_invoice": true,
  "data": {
    "client_name": "John Doe",
    "order_date": "2024-10-22",
    "service_name": "Premium Package"
  }
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Email queued, waiting for invoice",
  "pending_communication_id": "uuid-here",
  "order_id": "ORDER-12345",
  "status": "waiting_invoice",
  "instructions": "Call /generate-pdf with order_id: \"ORDER-12345\" when invoice is ready"
}
```

### Step 2: Generate Invoice and Send Email

Later, when your billing system generates the invoice, call the PDF generation endpoint with the same `order_id`:

```bash
POST https://your-project.supabase.co/functions/v1/generate-pdf
Headers:
  x-api-key: YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "order_id": "ORDER-12345",
  "pdf_template_name": "invoice_template",
  "data": {
    "invoice_number": "INV-2024-001",
    "invoice_date": "2024-10-22",
    "due_date": "2024-11-22",
    "client_name": "John Doe",
    "client_address": "123 Main St",
    "items": [
      {
        "description": "Premium Package",
        "quantity": 1,
        "unit_price": 100.00,
        "total": 100.00
      },
      {
        "description": "Additional Service",
        "quantity": 2,
        "unit_price": 25.00,
        "total": 50.00
      }
    ],
    "subtotal": 150.00,
    "tax": 15.00,
    "total": 165.00
  }
}
```

**What Happens Automatically:**

1. System finds the pending email by `order_id: "ORDER-12345"`
2. Generates PDF from the invoice template
3. Attaches PDF to the pending email
4. **Automatically sends the email** with the PDF attached
5. Updates `pending_communications` status to `sent`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "PDF generated successfully",
  "data": {
    "pdf_id": "uuid",
    "pdf_base64": "...",
    "filename": "invoice-INV-2024-001.pdf",
    "size_bytes": 25000
  }
}
```

## Database Schema

### pending_communications Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `application_id` | uuid | Your application |
| `order_id` | text | **Order identifier for matching** |
| `template_name` | text | Email template name |
| `recipient_email` | text | Recipient email |
| `base_data` | jsonb | Initial data (client info, etc.) |
| `completed_data` | jsonb | PDF attachment data |
| `pending_fields` | jsonb | `["invoice_pdf"]` |
| `external_reference_id` | text | Unique reference |
| `external_system` | text | `"billing_system"` |
| `status` | text | `waiting_data` → `data_received` → `sent` |
| `created_at` | timestamp | When created |
| `completed_at` | timestamp | When PDF was attached |
| `sent_at` | timestamp | When email was sent |

## Templates Required

### 1. Email Template (`invoice_email`)

Create in the Dashboard → Templates:

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .header { background-color: #f0f0f0; padding: 20px; }
        .content { padding: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Your Invoice is Ready</h1>
    </div>
    <div class="content">
        <p>Hello {{client_name}},</p>
        <p>Thank you for your order on {{order_date}}.</p>
        <p>Please find your invoice attached to this email.</p>
        <p>Service: {{service_name}}</p>
        <p>Best regards,<br>Your Company</p>
    </div>
</body>
</html>
```

**Important:** Set `pdf_template_id` to link to the invoice PDF template!

### 2. PDF Template (`invoice_template`)

Create in the Dashboard → Templates (Type: PDF):

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .invoice-header { text-align: center; margin-bottom: 30px; }
        .invoice-details { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .total { font-size: 18px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="invoice-header">
        <h1>INVOICE</h1>
        <p>Invoice #: {{invoice_number}}</p>
        <p>Date: {{invoice_date}}</p>
    </div>

    <div class="invoice-details">
        <h3>Bill To:</h3>
        <p>{{client_name}}<br>{{client_address}}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            {{#each items}}
            <tr>
                <td>{{description}}</td>
                <td>{{quantity}}</td>
                <td>${{unit_price}}</td>
                <td>${{total}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>

    <div style="text-align: right; margin-top: 20px;">
        <p>Subtotal: ${{subtotal}}</p>
        <p>Tax: ${{tax}}</p>
        <p class="total">Total: ${{total}}</p>
    </div>

    <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
        <p>Thank you for your business!</p>
    </div>
</body>
</html>
```

**PDF Filename Pattern:** `invoice-{{invoice_number}}.pdf`

## Error Handling

If PDF generation fails, the system will:
- Mark `pending_communications` status as `failed`
- Log the error in `email_logs`
- NOT send the email

You can query failed communications:

```sql
SELECT * FROM pending_communications
WHERE status = 'failed'
AND order_id = 'ORDER-12345';
```

## Monitoring

Check pending emails waiting for invoices:

```sql
SELECT
  order_id,
  recipient_email,
  template_name,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_waiting
FROM pending_communications
WHERE status = 'waiting_data'
AND external_system = 'billing_system'
ORDER BY created_at DESC;
```

## Benefits of This Approach

1. **Decoupled:** Order creation and invoice generation are separate
2. **Reliable:** Email won't send without the invoice
3. **Automatic:** No manual triggering needed once invoice is ready
4. **Trackable:** Full audit trail in `pending_communications` and `email_logs`
5. **Scalable:** Can handle thousands of pending emails

## Alternative: Immediate Send (No Waiting)

If you DON'T need to wait for an invoice, simply omit `wait_for_invoice`:

```json
{
  "template_name": "invoice_email",
  "recipient_email": "client@example.com",
  "data": {
    "client_name": "John Doe"
  }
}
```

The system will immediately generate the PDF (if template has `pdf_template_id`) and send the email.
