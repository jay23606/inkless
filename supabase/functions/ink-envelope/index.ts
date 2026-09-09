import { adminClient, appOrigin, corsHeaders, enforceRateLimit, json, requiredUser } from "../_shared/common.ts";

const enc = new TextEncoder();
async function hash(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "the invited email address";
  return `${local.slice(0, 1)}${"*".repeat(Math.min(3, Math.max(1, local.length - 1)))}@${domain}`;
}
function cleanHtml(value: unknown) {
  const allowed = new Set(["section","h1","h2","p","ul","ol","li","strong","em","mark","hr"]);
  return clean(value, 100_000).replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?([a-z0-9-]+)(?:\s[^>]*)?>/gi, (tag, name) => allowed.has(String(name).toLowerCase()) ? tag.replace(/\s[^>]*/, "") : "");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
  try {
    const body = await request.json();
    const admin = adminClient();
    if (body.action === "send") {
      if (!await enforceRateLimit(request, "send", 20, 3600)) return json(request, { error: "Too many send requests. Try again later." }, 429);
      const user = await requiredUser(request);
      if (!user) return json(request, { error: "Sign in is required" }, 401);
      const title = clean(body.title, 300), html = cleanHtml(body.html);
      const parties = Array.isArray(body.parties) ? body.parties.slice(0, 20) : [];
      if (!title || !html || !parties.length) throw new Error("Document and signers are required");
      const sourceFiles = Array.isArray(body.sourceFiles) ? body.sourceFiles.slice(0, 30) : [];
      const attachmentManifest = sourceFiles.map((file: Record<string, unknown>, index: number) => ({ filename: clean(file.filename, 300), path: clean(file.path, 1_000), mimeType: clean(file.mimeType, 200), size: Number(file.size) || 0, sha256: clean(file.sha256, 64), order: index + 1 }));
      const rawFields = Array.isArray(body.fields) ? body.fields.slice(0, 200) : [];
      const fieldPlan = rawFields.map((field: Record<string, unknown>) => ({
        type: ["signature","initials","date","full_name"].includes(String(field.type)) ? String(field.type) : "signature",
        partyIndex: Math.max(0, Math.min(parties.length - 1, Math.trunc(Number(field.partyIndex) || 0))),
        anchorText: clean(field.anchorText, 200), placement: field.placement === "before" ? "before" : "after",
        page: Math.max(0, Math.trunc(Number(field.page) || 0)),
        x: Math.max(0, Math.min(1, Number(field.x) || 0)), y: Math.max(0, Math.min(1, Number(field.y) || 0)),
        width: Math.max(0, Math.min(1, Number(field.width) || 0)), height: Math.max(0, Math.min(1, Number(field.height) || 0)),
      }));
      const contentHash = await hash(`${title}\n${html}\n${JSON.stringify(attachmentManifest)}\n${JSON.stringify(fieldPlan)}`);
      const { data: document, error: docError } = await admin.from("il_documents").insert({ owner_id: user.id, title, status: "sent", sent_at: new Date().toISOString() }).select().single();
      if (docError) throw docError;
      const { data: version, error: versionError } = await admin.from("il_document_versions").insert({ document_id: document.id, version: 1, title, body_html: html, field_plan: fieldPlan, content_hash: contentHash, frozen_at: new Date().toISOString() }).select().single();
      if (versionError) throw versionError;
      if (attachmentManifest.length) {
        const rows = attachmentManifest.map(file => {
          const storagePath = file.path;
          if (!storagePath.startsWith(`${user.id}/`)) throw new Error("An uploaded file is outside this account");
          if (!/^[0-9a-f]{64}$/.test(file.sha256) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Invalid uploaded-file manifest");
          return { document_id: document.id, storage_path: storagePath, filename: file.filename, mime_type: file.mimeType, byte_size: file.size, sha256: file.sha256, packet_order: file.order };
        });
        const { error: filesError } = await admin.from("il_document_files").insert(rows);
        if (filesError) throw filesError;
      }
      const publicOrigin = appOrigin();
      const invites = [];
      for (const [index, party] of parties.entries()) {
        const token = randomToken(), tokenHash = await hash(token), email = clean(party.email, 254), fullName = clean(party.name, 120);
        if (!email || !fullName) continue;
        const { data: savedParty, error } = await admin.from("il_parties").insert({ document_id: document.id, full_name: fullName, email, signing_order: index + 1, invite_token_hash: tokenHash, invite_expires_at: new Date(Date.now() + 14 * 864e5).toISOString() }).select().single();
        if (error) throw error;
        const url = `${publicOrigin}/#sign=${encodeURIComponent(token)}`;
        const resendKey = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("RESEND_FROM_EMAIL");
        let emailSent = false;
        if (resendKey && from) {
          const delivery = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], subject: `Signature requested: ${title}`, html: `<p>${clean(user.user_metadata?.full_name || user.email, 150)} invited you to review and sign <strong>${title.replace(/[<>&]/g, "")}</strong>.</p><p><a href="${url}">Review and sign</a></p><p>This link expires in 14 days.</p>` }) });
          emailSent = delivery.ok;
        }
        invites.push({ partyId: savedParty.id, email, url, emailSent });
      }
      await admin.from("il_audit_events").insert({ document_id: document.id, actor_user_id: user.id, event_type: "document.sent", metadata: { contentHash, recipientCount: invites.length } });
      return json(request, { documentId: document.id, versionId: version.id, invitations: invites.map(({ email, url, emailSent }) => ({ email, url, emailSent })) });
    }
    if (body.action === "get" || body.action === "sign") {
      if (!await enforceRateLimit(request, body.action === "sign" ? "sign" : "view", body.action === "sign" ? 20 : 120, 3600)) return json(request, { error: "Too many requests. Try again later." }, 429);
      const tokenHash = await hash(clean(body.token, 500));
      const { data: party, error } = await admin.from("il_parties").select("*,il_documents(*,il_document_versions(*))").eq("invite_token_hash", tokenHash).maybeSingle();
      if (error) throw error;
      if (!party || new Date(party.invite_expires_at) < new Date()) return json(request, { error: "This signing link is invalid or expired" }, 404);
      const document = party.il_documents, version = document.il_document_versions.find((v: any) => v.version === document.current_version);
      if (!version?.frozen_at || document.status === "void") return json(request, { error: "This document is unavailable" }, 409);
      if (body.action === "get") {
        if (!party.viewed_at) { await admin.from("il_parties").update({ viewed_at: new Date().toISOString(), status: "viewed" }).eq("id", party.id); await admin.from("il_audit_events").insert({ document_id: document.id, party_id: party.id, event_type: "document.viewed" }); }
        let savedSignature = null;
        const signedInUser = await requiredUser(request);
        const identityVerified = Boolean(signedInUser?.email_confirmed_at && signedInUser.email?.toLowerCase() === party.email.toLowerCase());
        if (identityVerified && signedInUser) {
          const { data: profile } = await admin.from("il_profiles").select("signature_method,signature_font,signature_data").eq("id", signedInUser.id).maybeSingle();
          savedSignature = profile;
        }
        const { data: fileRows, error: fileError } = await admin.from("il_document_files").select("filename,storage_path,mime_type,byte_size,sha256,packet_order").eq("document_id", document.id).order("packet_order");
        if (fileError) throw fileError;
        const files = await Promise.all((fileRows || []).map(async (file: any) => {
          const { data, error: urlError } = await admin.storage.from("il-documents").createSignedUrl(file.storage_path, 900);
          if (urlError) throw urlError;
          return { filename: file.filename, mimeType: file.mime_type, size: file.byte_size, sha256: file.sha256, order: file.packet_order, url: data.signedUrl };
        }));
        const partyIndex = Math.max(0, Number(party.signing_order) - 1);
        const fields = Array.isArray(version.field_plan) ? version.field_plan.filter((field: any) => field.partyIndex === partyIndex) : [];
        return json(request, { title: version.title, html: version.body_html, signerName: party.full_name, signerEmailHint: maskEmail(party.email), identityVerified, status: party.status, savedSignature, files, fields });
      }
      if (party.signed_at) return json(request, { error: "This document has already been signed" }, 409);
      const signedInUser = await requiredUser(request);
      if (!signedInUser) return json(request, { error: "Sign in with the invited email address before signing" }, 401);
      if (!signedInUser.email_confirmed_at) return json(request, { error: "Verify your email address before signing" }, 403);
      if (signedInUser.email?.toLowerCase() !== party.email.toLowerCase()) return json(request, { error: "Your verified email does not match this invitation" }, 403);
      const adoptedName = clean(body.adoptedName, 120);
      if (!body.consent || !adoptedName) return json(request, { error: "Name and electronic-signature consent are required" }, 400);
      const requestedMethod = body.signatureMethod === "draw" ? "drawn" : "typed";
      const signatureData = clean(body.signatureData, 250_000);
      const signatureFont = ["newsreader","cursive","serif","sans"].includes(body.signatureFont) ? body.signatureFont : "newsreader";
      if (!signatureData || (requestedMethod === "drawn" && !signatureData.startsWith("data:image/png;base64,"))) return json(request, { error: "A valid signature is required" }, 400);
      const consentText = "I agree to use electronic records and adopt the displayed signature for this document.";
      const agent = clean(request.headers.get("user-agent"), 500);
      const ip = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
      const partyIndex = Math.max(0, Number(party.signing_order) - 1);
      const initials = adoptedName.split(/\s+/).filter(Boolean).map((part: string) => part[0]).join("").toUpperCase().slice(0, 8);
      const appliedFields = (Array.isArray(version.field_plan) ? version.field_plan : []).filter((field: any) => field.partyIndex === partyIndex).map((field: any) => ({ ...field, value: field.type === "signature" ? signatureData : field.type === "initials" ? initials : field.type === "date" ? new Date().toISOString().slice(0, 10) : adoptedName }));
      await admin.from("il_signatures").insert({ party_id: party.id, version_id: version.id, signer_user_id: signedInUser.id, identity_method: "supabase_email", adopted_name: adoptedName, signature_method: requestedMethod, signature_data: signatureData, signature_font: requestedMethod === "typed" ? signatureFont : null, applied_fields: appliedFields, consent_text: consentText, document_hash: version.content_hash, ip_hash: await hash(ip), user_agent: agent });
      await admin.from("il_parties").update({ signed_at: new Date().toISOString(), status: "signed" }).eq("id", party.id);
      await admin.from("il_audit_events").insert({ document_id: document.id, party_id: party.id, actor_user_id: signedInUser.id, event_type: "document.signed", metadata: { documentHash: version.content_hash, method: requestedMethod, identityMethod: "supabase_email" } });
      const { count } = await admin.from("il_parties").select("id", { head: true, count: "exact" }).eq("document_id", document.id).neq("status", "signed");
      if (!count) await admin.from("il_documents").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", document.id);
      return json(request, { signed: true });
    }
    return json(request, { error: "Unknown action" }, 400);
  } catch (error) { return json(request, { error: error instanceof Error ? error.message : "Envelope request failed" }, 400); }
});
