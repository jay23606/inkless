import { configured, currentSession, supabase } from "./core.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const DEMO_DOCUMENTS = "inkless-documents";
const DEMO_PROFILE = "inkless-profile";

export function demoProfile() {
  try { return JSON.parse(localStorage.getItem(DEMO_PROFILE)) || { name: "", email: "" }; }
  catch { return { name: "", email: "" }; }
}

export function saveDemoProfile(profile) {
  localStorage.setItem(DEMO_PROFILE, JSON.stringify(profile));
}

export function demoDocuments() {
  try { return JSON.parse(localStorage.getItem(DEMO_DOCUMENTS)) || []; }
  catch { return []; }
}

export function saveDemoDocuments(documents) {
  localStorage.setItem(DEMO_DOCUMENTS, JSON.stringify(documents.slice(0, 20)));
}

export function clearDemoDocuments() { localStorage.removeItem(DEMO_DOCUMENTS); }

export async function invokeFunction(name, body) {
  if (!configured) return null;
  const session = await currentSession();
  if (!session) throw new Error("Sign in before using AI or sending agreements.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || `${name} returned ${response.status}`);
  return data;
}

export async function invokePublicFunction(name, body) {
  if (!configured) throw new Error("Configure Supabase to use signing links.");
  const session = await currentSession();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || `${name} returned ${response.status}`);
  return data;
}

export async function uploadOriginal(file) {
  if (!configured) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in before uploading a document.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("ink-documents").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data, error: signedError } = await supabase.storage.from("ink-documents").createSignedUrl(path, 300);
  if (signedError) throw signedError;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return { path, url: data.signedUrl, filename: file.name, mimeType: file.type || "application/octet-stream", size: file.size, sha256 };
}

export async function saveProfile(profile) {
  if (!configured) return saveDemoProfile(profile);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in is required.");
  const { error } = await supabase.from("ink_profiles").upsert({
    id: user.id, full_name: profile.name, email: profile.email,
    signature_method: profile.signatureMethod || "font",
    signature_font: profile.signatureFont || "newsreader",
    signature_data: profile.signatureData || null,
  });
  if (error) throw error;
}
