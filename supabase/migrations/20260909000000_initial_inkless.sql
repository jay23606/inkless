create extension if not exists pgcrypto;

create type public.il_document_status as enum ('draft','sent','completed','void');
create type public.il_party_status as enum ('pending','viewed','signed','declined');

create table public.il_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  signature_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.il_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique(owner_id,email)
);

create table public.il_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status public.il_document_status not null default 'draft',
  current_version integer not null default 1 check (current_version > 0),
  source_kind text not null default 'generated' check (source_kind in ('generated','uploaded')),
  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  completed_at timestamptz
);

create table public.il_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.il_documents(id) on delete cascade,
  version integer not null check (version > 0),
  title text not null,
  body_html text not null,
  revision_prompt text,
  content_hash text not null,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  unique(document_id,version)
);

create table public.il_parties (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.il_documents(id) on delete cascade,
  full_name text not null,
  email text not null,
  signing_order integer not null default 1,
  status public.il_party_status not null default 'pending',
  invite_token_hash text unique,
  invite_expires_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.il_signatures (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null unique references public.il_parties(id) on delete cascade,
  version_id uuid not null references public.il_document_versions(id),
  adopted_name text not null,
  signature_method text not null check (signature_method in ('typed','drawn')),
  signature_data text not null,
  consent_text text not null,
  document_hash text not null,
  ip_hash text,
  user_agent text,
  signed_at timestamptz not null default now()
);

create table public.il_audit_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.il_documents(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  party_id uuid references public.il_parties(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.il_profiles enable row level security;
alter table public.il_contacts enable row level security;
alter table public.il_documents enable row level security;
alter table public.il_document_versions enable row level security;
alter table public.il_parties enable row level security;
alter table public.il_signatures enable row level security;
alter table public.il_audit_events enable row level security;

create policy "profiles_self" on public.il_profiles for all to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy "contacts_owner" on public.il_contacts for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "documents_owner" on public.il_documents for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "versions_owner_read" on public.il_document_versions for select to authenticated using (exists(select 1 from public.il_documents d where d.id=document_id and d.owner_id=auth.uid()));
create policy "versions_owner_insert" on public.il_document_versions for insert to authenticated with check (exists(select 1 from public.il_documents d where d.id=document_id and d.owner_id=auth.uid() and d.status='draft'));
create policy "parties_owner" on public.il_parties for all to authenticated using (exists(select 1 from public.il_documents d where d.id=document_id and d.owner_id=auth.uid())) with check (exists(select 1 from public.il_documents d where d.id=document_id and d.owner_id=auth.uid() and d.status='draft'));
create policy "signatures_owner_read" on public.il_signatures for select to authenticated using (exists(select 1 from public.il_parties p join public.il_documents d on d.id=p.document_id where p.id=party_id and d.owner_id=auth.uid()));
create policy "audit_owner_read" on public.il_audit_events for select to authenticated using (exists(select 1 from public.il_documents d where d.id=document_id and d.owner_id=auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('il-documents','il-documents',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
on conflict(id) do nothing;

create policy "document_upload_owner" on storage.objects for insert to authenticated
with check(bucket_id='il-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "document_read_owner" on storage.objects for select to authenticated
using(bucket_id='il-documents' and (storage.foldername(name))[1]=auth.uid()::text);
