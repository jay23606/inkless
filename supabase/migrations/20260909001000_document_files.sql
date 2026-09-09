create table public.ink_document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ink_documents(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  packet_order integer not null check (packet_order > 0),
  created_at timestamptz not null default now(),
  unique(document_id,packet_order),
  unique(document_id,storage_path)
);

alter table public.ink_document_files enable row level security;
create policy "document_files_owner_read" on public.ink_document_files for select to authenticated
using (exists(select 1 from public.ink_documents d where d.id=document_id and d.owner_id=auth.uid()));
