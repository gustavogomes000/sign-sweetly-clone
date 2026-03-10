import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * BlueTech Proxy Edge Function
 * Routes requests to the correct BlueTech microservice based on the `service` field.
 *
 * Supported services:
 *   assinatura/desenho      → ms-assinatura  POST /api/v1/assinatura/desenho
 *   assinatura/tipografica  → ms-assinatura  POST /api/v1/assinatura/tipografica
 *   documento/upload        → ms-documento   POST /api/v1/documento/upload
 *   selfie-documento/capturar → ms-selfie-documento POST /api/v1/selfie-documento/capturar
 */

const SERVICE_MAP: Record<string, { envKey: string; path: string }> = {
  "assinatura/desenho": {
    envKey: "BLUETECH_ASSINATURA_URL",
    path: "/api/v1/assinatura/desenho",
  },
  "assinatura/tipografica": {
    envKey: "BLUETECH_ASSINATURA_URL",
    path: "/api/v1/assinatura/tipografica",
  },
  "documento/upload": {
    envKey: "BLUETECH_DOCUMENTO_URL",
    path: "/api/v1/documento/upload",
  },
  "selfie-documento/capturar": {
    envKey: "BLUETECH_SELFIE_DOC_URL",
    path: "/api/v1/selfie-documento/capturar",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { service, payload } = body as {
      service: string;
      payload: Record<string, unknown>;
    };

    if (!service || !payload) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'service' or 'payload'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const route = SERVICE_MAP[service];
    if (!route) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown service: ${service}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = Deno.env.get(route.envKey);
    if (!baseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: `${route.envKey} not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceKey = Deno.env.get("BLUETECH_SERVICE_KEY") || "";

    // Build HMAC if configured
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-service-key": serviceKey,
    };

    const url = `${baseUrl.replace(/\/+$/, "")}${route.path}`;
    console.log(`[bluetech-proxy] → ${service} → ${url}`);

    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const responseBody = await upstream.text();

    if (!upstream.ok) {
      console.error(`[bluetech-proxy] upstream error ${upstream.status}: ${responseBody}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Microservice error (${upstream.status})`,
          details: responseBody,
        }),
        {
          status: upstream.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(responseBody, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[bluetech-proxy] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
