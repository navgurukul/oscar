import { corsHeaders } from "../_shared/cors.ts";

// Exchange a Google OAuth2 authorization code (PKCE flow) for tokens.
// The desktop app generates a PKCE code_verifier / code_challenge, opens
// Google's consent screen, receives the code via deep-link, then calls this
// function to exchange the code for an access_token + refresh_token.
// Because PKCE is used, no client_secret is required for native/desktop app
// OAuth clients.  If the project uses a "Web application" client the secret
// must be set as GOOGLE_OAUTH_CLIENT_SECRET in Supabase secrets.

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CLIENT_ID = "332965035815-v8fnucr2ho5tm0c1jvsd84lch5n8m654.apps.googleusercontent.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // No Supabase auth required — the PKCE code_verifier is self-authenticating.
    // Only the party that generated the code_challenge can provide the matching
    // code_verifier, so there is no risk of unauthorized token exchange.

    const { code, code_verifier, redirect_uri } = await req.json();
    if (!code || !code_verifier || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, code_verifier, redirect_uri" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build token request body
    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      code_verifier,
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri,
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
      console.error("[exchange-calendar-token] Google error:", tokenData);
      return new Response(
        JSON.stringify({ error: tokenData.error_description || tokenData.error || "Google token exchange failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_in: tokenData.expires_in ?? 3600,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[exchange-calendar-token] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
