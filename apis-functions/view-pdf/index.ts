
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const pool = new Pool(
  Deno.env.get("DATABASE_URL") || "",
  3,
  true,
);

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return htmlResponse(
      "<html><body><h1>Method Not Allowed</h1></body></html>",
      405,
    );
  }

  let client;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return htmlResponse(
        "<html><body><h1>Configuration Error</h1><p>Missing DATABASE_URL.</p></body></html>",
        500,
      );
    }

    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ||
      url.pathname.split("/").filter(Boolean).pop();

    const action = url.searchParams.get("action") || "view";

    if (!token) {
      return htmlResponse(
        "<html><body><h1>Invalid Link</h1><p>No access token provided.</p></body></html>",
        400,
      );
    }

    client = await pool.connect();

    const linkResult = await client.queryObject<{
      id: string;
      access_token: string;
      filename: string | null;
      expires_at: string | null;
      view_count: number | null;
      pdf_base64: string | null;
    }>(
      `
      SELECT
        ppl.id,
        ppl.access_token,
        ppl.filename,
        ppl.expires_at,
        ppl.view_count,
        pgl.pdf_base64
      FROM public_pdf_links ppl
      INNER JOIN pdf_generation_logs pgl
        ON pgl.id = ppl.pdf_generation_log_id
      WHERE ppl.access_token = $1
        AND ppl.is_active = true
      LIMIT 1
      `,
      [token],
    );

    const link = linkResult.rows[0];

    if (!link) {
      return htmlResponse(
        "<html><body><h1>Link Not Found</h1><p>This PDF link is invalid or has been deactivated.</p></body></html>",
        404,
      );
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return htmlResponse(
        "<html><body><h1>Link Expired</h1><p>This PDF link has expired.</p></body></html>",
        410,
      );
    }

    if (!link.pdf_base64) {
      return htmlResponse(
        "<html><body><h1>PDF Not Available</h1><p>The PDF file is no longer available.</p></body></html>",
        404,
      );
    }

    await client.queryObject(
      `
      UPDATE public_pdf_links
      SET
        view_count = COALESCE(view_count, 0) + 1,
        last_viewed_at = NOW()
      WHERE id = $1
      `,
      [link.id],
    );

    const pdfBuffer = base64ToUint8Array(link.pdf_base64);

    const filename = link.filename || "document.pdf";

    const disposition = action === "download"
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (_error) {
    return htmlResponse(
      "<html><body><h1>Error</h1><p>An error occurred while retrieving the PDF.</p></body></html>",
      500,
    );
  } finally {
    if (client) {
      client.release();
    }
  }
});
