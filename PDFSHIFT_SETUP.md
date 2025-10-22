# PDFShift API Configuration

This project uses PDFShift API to convert HTML templates to PDF documents with full CSS styling support.

## Setup Instructions

### 1. Get Your PDFShift API Key

1. Go to [https://pdfshift.io](https://pdfshift.io)
2. Sign up for an account or log in
3. Navigate to your Dashboard
4. Copy your API key

### 2. Configure Local Environment Variables (Optional - for local testing)

Add your PDFShift API key to your `.env` file:

```bash
PDFSHIFT_API_KEY=your_actual_api_key_here
PDFSHIFT_API_URL=https://api.pdfshift.io/v3/convert/pdf
```

**IMPORTANT:** Replace `your_actual_api_key_here` with your real PDFShift API key.

### 3. Configure Supabase Edge Functions Secrets (REQUIRED) ⚠️

**This is the critical step!** The Edge Functions run on Supabase's servers and need the API key configured there.

#### Method 1: Using Supabase Dashboard (Easiest) ⭐

1. Go to your Supabase Dashboard: **https://supabase.com/dashboard**
2. Select your project: **drhbcmithlrldtjlhnee**
3. Click on **Project Settings** (gear icon ⚙️ in the bottom left sidebar)
4. In the settings menu, click on **Edge Functions**
5. Scroll down to the **Environment Variables** or **Secrets** section
6. Click **Add new secret** or **New secret**
7. Add these two secrets one by one:

**Secret 1:**
- Name: `PDFSHIFT_API_KEY`
- Value: Your actual PDFShift API key (from step 1)

**Secret 2:**
- Name: `PDFSHIFT_API_URL`
- Value: `https://api.pdfshift.io/v3/convert/pdf`

8. Click **Save** or **Add** for each secret
9. **Important:** The secrets are available immediately - no need to redeploy

#### Method 2: Using Supabase CLI (Advanced)

If you have Supabase CLI installed and linked to your project:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref drhbcmithlrldtjlhnee

# Set the PDFShift API Key
supabase secrets set PDFSHIFT_API_KEY=your_actual_api_key_here

# Set the PDFShift API URL
supabase secrets set PDFSHIFT_API_URL=https://api.pdfshift.io/v3/convert/pdf

# Verify secrets are set
supabase secrets list
```

### 4. Verify Configuration

After setting the secrets in Supabase Dashboard, test the endpoint immediately:

```bash
curl -X POST https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/generate-pdf \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_template_name": "invoice_email_service",
    "data": {
      "order_id": "TEST-001"
    }
  }'
```

✅ **Success:** You should get a PDF generated successfully
❌ **Still getting error?** Double-check that you saved the secrets in the Supabase Dashboard

## How It Works

The `generate-pdf` Edge Function:

1. Receives a template name and data via API
2. Fetches the HTML template from the database
3. Renders the template with the provided data using the template engine
4. Sends the rendered HTML to PDFShift API
5. Receives the PDF as binary data
6. Converts to Base64 and stores it
7. Returns the PDF to the caller

## HTML Template Support

PDFShift supports full HTML and CSS, including:

- ✅ CSS styles (inline, `<style>` tags, and external stylesheets)
- ✅ Complex layouts with flexbox and grid
- ✅ Tables with borders and styling
- ✅ Images (base64 or external URLs)
- ✅ Custom fonts
- ✅ Page breaks (`page-break-before`, `page-break-after`)
- ✅ Headers and footers
- ✅ Landscape or portrait orientation

## Example Template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
    }
    .invoice-table th,
    .invoice-table td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    .invoice-table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .total {
      font-size: 20px;
      font-weight: bold;
      text-align: right;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="invoice-header">
    <div>
      <h1>Factura #{{order_id}}</h1>
      <p>Fecha: {{date}}</p>
    </div>
    <div>
      <h2>{{company_name}}</h2>
      <p>{{company_address}}</p>
    </div>
  </div>

  <h3>Cliente</h3>
  <p>{{customer_name}}</p>
  <p>{{customer_email}}</p>

  <h3>Detalles</h3>
  <table class="invoice-table">
    <thead>
      <tr>
        <th>Producto</th>
        <th>Cantidad</th>
        <th>Precio</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td>{{name}}</td>
        <td>{{quantity}}</td>
        <td>${{price}}</td>
        <td>${{total}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <div class="total">
    Total: ${{total_amount}}
  </div>
</body>
</html>
```

## API Usage Example

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-pdf \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_template_name": "invoice",
    "data": {
      "order_id": "ORDER-12345",
      "date": "2025-10-22",
      "company_name": "Mi Empresa SRL",
      "company_address": "Av. 18 de Julio 1234, Montevideo",
      "customer_name": "Juan Pérez",
      "customer_email": "juan@example.com",
      "items": [
        {
          "name": "Producto 1",
          "quantity": 2,
          "price": "100.00",
          "total": "200.00"
        }
      ],
      "total_amount": "200.00"
    },
    "order_id": "ORDER-12345"
  }'
```

## Pricing

PDFShift offers:
- **Free tier**: 250 conversions per month
- **Paid plans**: Starting at $19/month for 1,000 conversions

Check current pricing at [https://pdfshift.io/pricing](https://pdfshift.io/pricing)

## Troubleshooting

### Error: "PDFSHIFT_API_KEY environment variable is not set"

Make sure you have added the API key to:
1. Local `.env` file (for local development)
2. Supabase Edge Function secrets (for production)

### Error: "PDFShift API error: 401"

Your API key is invalid or expired. Check your PDFShift dashboard and regenerate if needed.

### PDF doesn't look right

1. Test your HTML locally in a browser first
2. Make sure all CSS is inline or in `<style>` tags
3. Check that images use absolute URLs or base64 encoding
4. Review PDFShift documentation for supported CSS properties
