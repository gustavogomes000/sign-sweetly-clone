import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://bluepoint-api.bluetechfilms.com.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiToken = Deno.env.get("BLUEPOINT_API_TOKEN");
    if (!apiToken) {
      return new Response(
        JSON.stringify({ success: false, error: "BLUEPOINT_API_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { endpoint, method = "GET", payload } = body as {
      endpoint: string;
      method?: string;
      payload?: Record<string, unknown>;
    };

    if (!endpoint) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'endpoint'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize endpoint
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${cleanEndpoint}`;

    console.log(`[bluepoint-proxy] ${method} ${url}`);

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    const fetchOpts: RequestInit = { method, headers };
    if (payload && method !== "GET") {
      fetchOpts.body = JSON.stringify(payload);
    }

    const upstream = await fetch(url, fetchOpts);
    const responseBody = await upstream.text();

    return new Response(responseBody, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[bluepoint-proxy] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
