import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Refresh a Google Calendar access token using a stored refresh_token.
// Called by the desktop app whenever the access token has expired or is
// about to expire, so the user never has to reconnect Google Calendar.

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CLIENT_ID = "332965035815-v8fnucr2ho5tm0c1jvsd84lch5n8m654.apps.googleusercontent.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the caller via Supabase session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { refresh_token } = await req.json();
    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: "Missing required field: refresh_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: Record<string, string> = {
      grant_type: "refresh_token",
      refresh_token,
      client_id: GOOGLE_CLIENT_ID,
    };

    // Include client_secret if configured (required for "Web application" OAuth clients)
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    if (clientSecret) body.client_secret = clientSecret;

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      const errMsg = tokenData.error_description || tokenData.error || "Google token refresh failed";
      console.error("[refresh-calendar-token] Google error:", tokenData);
      // 401 from Google means refresh_token is revoked → user must reconnect
      return new Response(
        JSON.stringify({ error: errMsg, needs_reconnect: tokenRes.status === 400 }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in ?? 3600,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[refresh-calendar-token] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
