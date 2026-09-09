# Inkless

Inkless is a minimalist electronic-signature application built with static HTML,
CSS, browser-native JavaScript modules, and Supabase. It can draft or revise an
agreement through OpenAI, accept and reorder multiple uploaded PDF/DOCX/TXT files, collect recipients,
freeze an immutable version, email private signing links, and record signatures
against the frozen document hash.

The architecture follows OpenStart's boundary: the browser owns presentation and
reversible draft state; PostgreSQL owns durable records and access policies; Edge
Functions own secrets, provider calls, invitation tokens, and signing mutations.

## Local demo

No setup is required for the interactive demo:

```bash
npm test
npm run serve
```

Open `http://localhost:8000`. Drafting, upload UI, editing, recipients, revision
guidance, profile persistence, review, and download work locally. AI, login,
durable envelopes, email, and signing links activate after Supabase is configured.

## Supabase setup

1. Create and link a Supabase project.
2. Copy `config.example.js` to `config.js` and add the project URL and public
   publishable key. These values are expected to be visible in the browser.
3. Apply the schema and deploy the functions:

   ```bash
   supabase db push
   supabase functions deploy ink-ai-document
   supabase functions deploy ink-envelope
   ```

4. Add secrets. The OpenAI key is entered once and is never returned to clients:

   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   supabase secrets set OPENAI_MODEL=gpt-5.5
   supabase secrets set ALLOWED_ORIGINS="http://localhost:8000,https://YOUR_USER.github.io"
   supabase secrets set APP_ORIGIN="https://YOUR_USER.github.io/YOUR_REPO"
   ```

5. For invitation delivery, verify a sending domain and configure Resend:

   ```bash
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set RESEND_FROM_EMAIL="Inkless <sign@your-domain.com>"
   ```

6. Add the local and GitHub Pages URLs to the Supabase Auth redirect allow-list.

## Security model

- OpenAI and Resend credentials exist only as Edge Function secrets.
- Every application table has Row Level Security enabled.
- Uploaded originals live in a private Storage bucket under the owner's user ID.
- Multi-file packets retain their explicit order in `ink_document_files`; PDF and
  text previews can be reordered visually before preparation.
- Raw invitation tokens are emailed; only SHA-256 hashes are stored.
- Invitations expire after 14 days.
- Sending freezes a document version and stores its SHA-256 content hash.
- A signature records the frozen version, hash, exact consent statement, adopted
  name, timestamp, user agent, and a hash—not plaintext—of the network address.
- Signers cannot modify documents. Owners cannot apply a recipient's signature.

Before production use, obtain jurisdiction-specific legal review, add abuse/rate
limits and CAPTCHA to public signing endpoints, produce a final PDF/certificate,
and configure retention and deletion policies appropriate to the documents used.
