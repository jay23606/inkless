import { createClient } from "npm:@supabase/supabase-js@2";

const defaults = ["http://localhost:8000", "http://127.0.0.1:8000"];
const configured = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(v => v.trim()).filter(Boolean);
const origins = new Set(configured.length ? configured : defaults);
const fallbackOrigin = [...origins][0];

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origins.has(origin) ? origin : fallbackOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function appOrigin() {
  const configuredOrigin = Deno.env.get("APP_ORIGIN");
  if (!configuredOrigin) throw new Error("APP_ORIGIN is not configured");
  const url = new URL(configuredOrigin);
  if (!origins.has(url.origin)) throw new Error("APP_ORIGIN must use an allowed origin");
  return configuredOrigin.replace(/\/$/, "");
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), "Content-Type": "application/json" } });
}

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requiredUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

export async function enforceRateLimit(request: Request, scope: string, limit: number, seconds: number) {
  const chain = request.headers.get("x-forwarded-for")?.split(",").map(value => value.trim()).filter(Boolean);
  const address = chain?.at(-1) || "unknown";
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address)));
  const fingerprint = [...bytes.slice(0, 16)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const { data, error } = await adminClient().rpc("ink_check_rate_limit", { p_key: `${scope}:${fingerprint}`, p_limit: limit, p_seconds: seconds });
  if (error) throw error;
  return data === true;
}
