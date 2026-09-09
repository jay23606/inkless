-- Sent envelopes are immutable to browser clients. Only Edge Functions use the
-- service role to freeze, complete, or void them.
drop policy if exists "documents_owner" on public.ink_documents;
create policy "documents_owner_read" on public.ink_documents for select to authenticated
using (owner_id=auth.uid());
create policy "documents_owner_create_draft" on public.ink_documents for insert to authenticated
with check (owner_id=auth.uid() and status='draft');
create policy "documents_owner_update_draft" on public.ink_documents for update to authenticated
using (owner_id=auth.uid() and status='draft')
with check (owner_id=auth.uid() and status='draft' and sent_at is null and completed_at is null);
create policy "documents_owner_delete_draft" on public.ink_documents for delete to authenticated
using (owner_id=auth.uid() and status='draft');

drop policy if exists "parties_owner" on public.ink_parties;
create policy "parties_owner_read" on public.ink_parties for select to authenticated
using (exists(select 1 from public.ink_documents d where d.id=document_id and d.owner_id=auth.uid()));
create policy "parties_owner_create_draft" on public.ink_parties for insert to authenticated
with check (exists(select 1 from public.ink_documents d where d.id=document_id and d.owner_id=auth.uid() and d.status='draft'));
create policy "parties_owner_update_draft" on public.ink_parties for update to authenticated
using (exists(select 1 from public.ink_documents d where d.id=document_id and d.owner_id=auth.uid() and d.status='draft'))
with check (exists(select 1 from public.ink_documents d where d.id=document_id and d.owner_id=auth.uid() and d.status='draft'));
create policy "parties_owner_delete_draft" on public.ink_parties for delete to authenticated
using (exists(select 1 from public.ink_documents d where d.id=document_id and d.owner_id=auth.uid() and d.status='draft'));

alter table public.ink_profiles
  add constraint ink_profile_name_length check (char_length(full_name)<=120),
  add constraint ink_profile_email_length check (char_length(email)<=254),
  add constraint ink_profile_signature_size check (signature_data is null or char_length(signature_data)<=250000);
alter table public.ink_contacts
  add constraint ink_contact_name_length check (char_length(full_name) between 1 and 120),
  add constraint ink_contact_email_length check (char_length(email) between 3 and 254);
alter table public.ink_documents add constraint ink_document_title_length check (char_length(title) between 1 and 300);
alter table public.ink_document_versions
  add constraint ink_document_body_size check (char_length(body_html) between 1 and 100000),
  add constraint ink_document_hash_format check (content_hash ~ '^[0-9a-f]{64}$');
alter table public.ink_parties
  add constraint ink_party_name_length check (char_length(full_name) between 1 and 120),
  add constraint ink_party_email_length check (char_length(email) between 3 and 254);
