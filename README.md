# Inkless

Inkless is a minimalist, AI-assisted electronic-signature application built with static HTML, CSS, browser-native JavaScript modules, and Supabase. The frontend is hosted on GitHub Pages; Supabase provides authentication, PostgreSQL, private file storage, and Edge Functions.

Live app: <https://jay23606.github.io/inkless/>

## What it does

- Drafts agreements with OpenAI from a plain-language description.
- Starts from common agreement prompts, including NDAs, service agreements, leases, land contracts, promissory notes, releases, and more.
- Accepts up to five optional PDF, DOCX, or TXT example documents as AI drafting references. Examples are not added to the signing packet.
- Revises a generated draft from additional plain-language guidance.
- Accepts multiple existing PDF, DOCX, or TXT documents, shows previews, and lets the sender reorder the signing packet.
- Uses AI to propose signature, initials, full-name, and date placements.
- Supports one-person signing or multiple recipients.
- Stores a reusable typed or hand-drawn signature in the signed-in user's profile.
- Freezes the reviewed document, emails private signing links, and records each signature against the frozen document hash.

AI-generated agreements are starting points, not legal advice. Review every document and obtain jurisdiction-specific legal advice where appropriate.

## Architecture

The project follows OpenStart's client/backend boundary:

- The browser owns presentation and reversible draft state.
- Supabase Auth identifies senders and returning signers.
- PostgreSQL owns durable documents, contacts, parties, versions, fields, signatures, and audit events.
- Private Supabase Storage holds uploaded originals and temporary AI references.
- Edge Functions own OpenAI and email provider calls, invitation tokens, field validation, content hashing, and signing mutations.

There is no framework build step and no Sites workflow. GitHub Pages publishes the repository's static files directly through `.github/workflows/pages.yml`.

## Local development

```bash
npm test
npm run serve
```

Open <http://localhost:8000>.

The unconfigured app allows UI exploration, document selection and ordering, profile editing, and local previews. It deliberately does **not** generate a generic fallback agreement. AI drafting stays disabled until Supabase, a signed-in session, and the server-side OpenAI key are available.

## Supabase setup

1. Create a Supabase project and link this repository's `supabase` directory.

2. Copy `config.example.js` to `config.js`, then enter the Supabase project URL and public publishable/anonymous key. These two values are designed to be public:

   ```js
   export const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
   export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";
   ```

3. Apply the migrations and deploy both Edge Functions:

   ```bash
   supabase db push
   supabase functions deploy ink-ai-document
   supabase functions deploy ink-envelope
   ```

4. Configure server-side secrets. Never place these in `config.js`, browser storage, committed files, or GitHub Pages settings exposed to the frontend:

   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   supabase secrets set OPENAI_MODEL=gpt-5.5
   supabase secrets set ALLOWED_ORIGINS="http://localhost:8000,https://jay23606.github.io"
   supabase secrets set APP_ORIGIN="https://jay23606.github.io/inkless"
   ```

5. To send invitation emails, verify a sending domain and configure Resend:

   ```bash
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set RESEND_FROM_EMAIL="Inkless <sign@your-domain.com>"
   ```

   If email delivery is unavailable, Inkless provides private invitation links for the sender to copy.

6. Add both URLs to the Supabase Auth redirect allow-list:

   - `http://localhost:8000`
   - `https://jay23606.github.io/inkless/`

After sign-in, the frontend calls the AI function's readiness endpoint. Drafting is enabled only when the Edge Function confirms that `OPENAI_API_KEY` exists.

## AI document flow

1. The sender chooses an agreement type or describes the intended agreement.
2. Optional examples are uploaded to private storage and exposed through temporary signed URLs.
3. The Edge Function sends the intent, parties, and example files to the OpenAI Responses API with a strict structured-output schema.
4. OpenAI returns a title, semantic agreement HTML, warnings, and a proposed field plan.
5. The sender can edit the text or request another AI revision.
6. Before review, AI proposes all signature, initials, name, and date locations.
7. The envelope function validates the field plan, freezes the document, and later fills a signer's assigned fields deterministically after explicit consent.

Uploaded or referenced document contents are treated as untrusted source material; the AI prompt explicitly prevents instructions embedded inside those documents from overriding the drafting task.

## Security and integrity

- OpenAI, Resend, and Supabase service-role credentials exist only in Edge Function secrets.
- Every application table has Row Level Security enabled.
- Uploaded originals are stored in a private bucket beneath the owner's user ID.
- Reference files use short-lived signed URLs when supplied to OpenAI.
- Multi-file packet order is persisted in `ink_document_files`.
- Original-file SHA-256 hashes are included in the frozen envelope manifest.
- Raw invitation tokens are delivered to recipients; only their SHA-256 hashes are stored. Tokens expire after 14 days and are placed in URL fragments rather than query strings.
- Sending freezes an immutable version and stores a SHA-256 hash of its title, sanitized HTML, attachment manifest, and field plan.
- Signature application is deterministic. AI proposes locations but cannot consent or sign for a person.
- A signature record includes the frozen version and hash, adopted name, signature method, applied fields, exact consent statement, timestamp, user agent, and a hash—not plaintext—of the network address.
- Rate limits protect drafting, sending, viewing, and signing endpoints.
- Signers cannot alter documents, and owners cannot apply another recipient's signature.

## Tests

Run the complete static and security-oriented suite with:

```bash
npm test
```

The suite currently contains 13 checks covering static-module delivery, secret separation, Row Level Security, packet ordering, agreement templates, signature profiles, token handling, immutable envelopes, automatic fields, AI readiness, and multiple reference documents.

## Production checklist

Before using Inkless for legally consequential agreements:

- Complete jurisdiction-specific legal and electronic-signature review.
- Add CAPTCHA or equivalent abuse protection to public signing endpoints.
- Generate a final downloadable PDF and completion certificate.
- Define document retention, deletion, export, and account-recovery policies.
- Add delivery monitoring and retry handling for invitation email.
- Perform accessibility, cross-browser, mobile, load, and adversarial security testing against the configured production backend.
